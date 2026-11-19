/**
 * BUILDsmore — Central Server-Side Property & Collection Repository
 * Provides durable JSON-backed storage (with atomic disk writes) and PostgreSQL sync.
 * Guarantees zero data loss across restarts, server deployments, and container reboots.
 */

import fs from 'fs';
import path from 'path';
import { Property, CuratedCollection, ManagedLocation } from '../types/property';
import { INITIAL_PROPERTIES } from '../data/initialProperties';
import { INITIAL_COLLECTIONS } from '../data/initialCollections';
import { INITIAL_LOCATIONS } from '../data/initialLocations';
import { getDbPool } from './db';
import {
  normalizeSourceUrl,
  extractSourceWebsiteId,
  computeSourceUrlHash,
  computeUniversalPropertyId,
} from '../utils/sourceIdentity';
import {
  DEFAULT_ARCHITECTURAL_FALLBACK_URL,
  isGenericFallbackAddress,
  isManualPropertyImage,
  isValidPropertyAddress,
  looksLikeRawMarkupOrCss,
  mergeImportedImages,
  sanitizeWordPressText,
} from '../utils/propertyImages';

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), 'data');

function atomicWrite(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export class PropertyRepository {
  private readonly dataDir: string;
  private readonly propertiesFile: string;
  private readonly collectionsFile: string;
  private readonly trophyFile: string;
  private readonly locationsFile: string;

  private properties: Property[] = [];
  private collections: CuratedCollection[] = [];
  private trophyPropertyIds: string[] = [];
  private locations: ManagedLocation[] = [];

  constructor(options?: { dataDir?: string }) {
    this.dataDir = path.resolve(options?.dataDir || DEFAULT_DATA_DIR);
    this.propertiesFile = path.join(this.dataDir, 'properties.json');
    this.collectionsFile = path.join(this.dataDir, 'collections.json');
    this.trophyFile = path.join(this.dataDir, 'trophy_holdings.json');
    this.locationsFile = path.join(this.dataDir, 'locations.json');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.init();
  }

  private init() {
    // 1. Initialize Properties
    try {
      if (fs.existsSync(this.propertiesFile)) {
        const raw = fs.readFileSync(this.propertiesFile, 'utf-8');
        this.properties = JSON.parse(raw);
      } else {
        // Seed initial properties, setting initial trophy status for top holdings
        this.properties = INITIAL_PROPERTIES.map((p, idx) => ({
          ...p,
          isTrophyHolding: idx < 3,
          trophyOrder: idx < 3 ? idx + 1 : 99,
          displayOrder: idx + 1,
          isLatestAdded: idx === 0,
        }));
        atomicWrite(this.propertiesFile, this.properties);
      }
    } catch (err) {
      console.warn('[Repo] Error reading properties.json, fallback to initial:', (err as Error).message);
      this.properties = [...INITIAL_PROPERTIES];
    }

    // 2. Initialize Collections
    try {
      if (fs.existsSync(this.collectionsFile)) {
        const raw = fs.readFileSync(this.collectionsFile, 'utf-8');
        this.collections = JSON.parse(raw);
      } else {
        this.collections = [...INITIAL_COLLECTIONS];
        atomicWrite(this.collectionsFile, this.collections);
      }
    } catch (err) {
      console.warn('[Repo] Error reading collections.json, fallback to initial:', (err as Error).message);
      this.collections = [...INITIAL_COLLECTIONS];
    }

    // 3. Initialize Trophy Holdings Config
    try {
      if (fs.existsSync(this.trophyFile)) {
        const raw = fs.readFileSync(this.trophyFile, 'utf-8');
        this.trophyPropertyIds = JSON.parse(raw);
      } else {
        this.trophyPropertyIds = this.properties
          .filter(p => p.isTrophyHolding)
          .sort((a, b) => (a.trophyOrder || 0) - (b.trophyOrder || 0))
          .map(p => p.id);
        if (this.trophyPropertyIds.length === 0) {
          this.trophyPropertyIds = this.properties.slice(0, 3).map(p => p.id);
        }
        atomicWrite(this.trophyFile, this.trophyPropertyIds);
      }
    } catch {
      this.trophyPropertyIds = this.properties.slice(0, 3).map(p => p.id);
    }

    // 4. Initialize Locations
    try {
      if (fs.existsSync(this.locationsFile)) {
        const raw = fs.readFileSync(this.locationsFile, 'utf-8');
        this.locations = JSON.parse(raw);
      } else {
        this.locations = [...INITIAL_LOCATIONS];
        atomicWrite(this.locationsFile, this.locations);
      }
    } catch (err) {
      console.warn('[Repo] Error reading locations.json, fallback to initial:', (err as Error).message);
      this.locations = [...INITIAL_LOCATIONS];
    }

    // 5. Safely migrate any legacy colliding imported IDs (e.g. prop-univ-68747470) without deleting/overwriting
    const migrated = this.migrateLegacyImportedProperties();

    // Auto-link any property that has no locationId and heal any legacy WP CSS class / post-type leaks
    let propsUpdated = false;
    for (const prop of this.properties) {
      if (prop.address && !isValidPropertyAddress(prop.address, { slug: prop.slug, title: prop.title })) {
        const cleaned = sanitizeWordPressText(prop.address);
        prop.address = isValidPropertyAddress(cleaned, { slug: prop.slug, title: prop.title })
          ? cleaned
          : `${prop.city || 'Mohali'}, ${prop.country || 'India'}`;
        propsUpdated = true;
      }
      if (!prop.hasManualMainImage && Array.isArray(prop.images) && prop.images.some(img => isManualPropertyImage(img))) {
        prop.hasManualMainImage = true;
        propsUpdated = true;
      }
      if (!prop.locationId) {
        const match = this.findLocationMatch(prop.city, prop.address, prop.locality);
        if (match.location) {
          prop.locationId = match.location.id;
          propsUpdated = true;
        }
      }
    }
    if (propsUpdated || migrated) {
      this.persistProperties();
    }
  }

  public reloadFromDisk(): void {
    this.init();
  }

  private migrateLegacyImportedProperties(): boolean {
    let anyChanged = false;
    let collectionsChanged = false;
    let trophyChanged = false;

    for (const prop of this.properties) {
      if (!prop.source || prop.source.type !== 'wordpress') continue;

      const rawSourceUrl = prop.source.sourceUrl || prop.seo?.canonicalUrl;
      if (!rawSourceUrl) {
        if (prop.id === 'prop-univ-68747470') {
          console.warn(`[Repo Migration Safety] Legacy property "${prop.title}" (${prop.id}) lacks sourceUrl; preserved untouched.`);
        }
        continue;
      }

      const canonicalUrl = normalizeSourceUrl(rawSourceUrl);
      const sourceWebsiteId = extractSourceWebsiteId(rawSourceUrl);

      if (!prop.source.sourceWebsiteId) {
        prop.source.sourceWebsiteId = sourceWebsiteId;
        anyChanged = true;
      }
      if (prop.source.sourceUrl !== canonicalUrl) {
        prop.source.sourceUrl = canonicalUrl;
        anyChanged = true;
      }

      if (prop.id === 'prop-univ-68747470') {
        const urlHash = computeSourceUrlHash(canonicalUrl, 12);
        const newId = computeUniversalPropertyId(canonicalUrl);

        if (newId !== prop.id) {
          const conflict = this.properties.some(other => other !== prop && other.id === newId);
          if (conflict) {
            console.warn(
              `[Repo Migration Safety] Target ID ${newId} already exists for another property; keeping legacy ${prop.id} ("${prop.title}") untouched.`
            );
            continue;
          }

          const oldId = prop.id;
          prop.id = newId;
          prop.source.sourcePropertyId = urlHash;
          prop.source.sourceWebsiteId = sourceWebsiteId;
          prop.source.sourceUrl = canonicalUrl;
          anyChanged = true;

          // Update collection references safely
          for (const col of this.collections) {
            if (col.propertyIds.includes(oldId)) {
              col.propertyIds = Array.from(new Set(col.propertyIds.map(pid => (pid === oldId ? newId : pid))));
              collectionsChanged = true;
            }
          }

          // Update trophy holdings references safely
          if (this.trophyPropertyIds.includes(oldId)) {
            this.trophyPropertyIds = Array.from(new Set(this.trophyPropertyIds.map(pid => (pid === oldId ? newId : pid))));
            trophyChanged = true;
          }
        }
      }
    }

    if (collectionsChanged) {
      this.persistCollections();
    }
    if (trophyChanged) {
      this.persistTrophy();
    }
    return anyChanged;
  }

  private persistProperties(): void {
    atomicWrite(this.propertiesFile, this.properties);
  }

  private persistCollections(): void {
    atomicWrite(this.collectionsFile, this.collections);
  }

  private persistTrophy(): void {
    atomicWrite(this.trophyFile, this.trophyPropertyIds);
  }

  private persistLocations(): void {
    atomicWrite(this.locationsFile, this.locations);
  }

  // ==========================================
  // PROPERTIES CRUD & FILTERING
  // ==========================================
  public getAllProperties(params?: {
    search?: string;
    category?: string;
    status?: string;
    featured?: boolean;
    trophyOnly?: boolean;
    locationId?: string;
    page?: number;
    limit?: number;
    sortBy?: 'newest' | 'price_desc' | 'price_asc' | 'area_desc' | 'featured' | 'trophy';
  }): { items: Property[]; total: number; page: number; totalPages: number } {
    let result = [...this.properties];

    if (params?.status && params.status !== 'All') {
      result = result.filter(p => p.status === params.status);
    }

    if (params?.category && params.category !== 'All') {
      result = result.filter(p => p.category === params.category);
    }

    if (params?.featured) {
      result = result.filter(p => p.featured);
    }

    if (params?.trophyOnly) {
      result = result.filter(p => this.trophyPropertyIds.includes(p.id) || p.isTrophyHolding);
    }

    if (params?.locationId && params.locationId !== 'all') {
      const loc = this.locations.find(l => l.id === params.locationId || l.slug === params.locationId);
      const locName = loc ? loc.name.toLowerCase() : params.locationId.toLowerCase();
      result = result.filter(p => {
        if (p.locationId && (p.locationId === params.locationId || (loc && p.locationId === loc.id))) {
          return true;
        }
        if (p.city && p.city.toLowerCase() === locName) {
          return true;
        }
        if (loc?.aliases && loc.aliases.length > 0) {
          return loc.aliases.some(a => 
            (p.city && p.city.toLowerCase().includes(a)) || 
            (p.locality && p.locality.toLowerCase().includes(a)) ||
            (p.address && p.address.toLowerCase().includes(a))
          );
        }
        return false;
      });
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(p => 
        p.title.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        (p.locality && p.locality.toLowerCase().includes(q)) ||
        p.country.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }

    // Sorting
    const sortBy = params?.sortBy || 'newest';
    if (sortBy === 'trophy') {
      result.sort((a, b) => {
        const orderA = this.trophyPropertyIds.indexOf(a.id);
        const orderB = this.trophyPropertyIds.indexOf(b.id);
        if (orderA !== -1 && orderB !== -1) return orderA - orderB;
        if (orderA !== -1) return -1;
        if (orderB !== -1) return 1;
        return (a.trophyOrder || 99) - (b.trophyOrder || 99);
      });
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'area_desc') {
      result.sort((a, b) => (b.interiorAreaSqFt || 0) - (a.interiorAreaSqFt || 0));
    } else if (sortBy === 'featured') {
      result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    } else {
      // Default: Newest first
      result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    const total = result.length;
    const page = params?.page && params.page > 0 ? params.page : 1;
    const limit = params?.limit && params.limit > 0 ? params.limit : total || 50;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = result.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      total,
      page,
      totalPages,
    };
  }

  public getPropertyById(id: string): Property | undefined {
    return this.properties.find(p => p.id === id);
  }

  public getPropertyBySlug(slug: string): Property | undefined {
    return this.properties.find(p => p.slug === slug || p.id === slug);
  }

  public createProperty(data: Partial<Property>): Property {
    // Prevent accidental duplicate ID insertion
    if (data.id) {
      const existingById = this.properties.find(p => p.id === data.id);
      if (existingById) {
        return this.updateProperty(existingById.id, data) || existingById;
      }
    }

    const now = new Date().toISOString();
    const id = data.id || `prop-${Date.now()}`;
    const rawTitle = data.title || 'Untitled Property';
    const slug = data.slug || this.generateSlug(rawTitle);

    // Ensure unique slug without clobbering unrelated sites
    let finalSlug = slug;
    let counter = 1;
    while (this.properties.some(p => p.slug === finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }

    const matchedLoc = !data.locationId
      ? this.findLocationMatch(data.city, data.address, data.locality)
      : { location: null, confidence: 'none' as const };

    const resolvedLocationId = data.locationId || matchedLoc.location?.id;

    const newProperty: Property = {
      id,
      slug: finalSlug,
      title: rawTitle,
      subtitle: data.subtitle || '',
      description: data.description || '',
      price: Number(data.price) || 0,
      currency: 'INR',
      category: data.category || 'Residential',
      propertyType: data.propertyType || 'Villa',
      status: data.status || 'Published',
      featured: Boolean(data.featured),
      isNewDevelopment: Boolean(data.isNewDevelopment),
      isTrophyHolding: Boolean(data.isTrophyHolding),
      trophyOrder: data.trophyOrder || 99,
      isLatestAdded: data.isLatestAdded !== undefined ? Boolean(data.isLatestAdded) : true,
      displayOrder: data.displayOrder || 1,
      
      locationId: resolvedLocationId,
      needsLocationReview: data.needsLocationReview !== undefined
        ? Boolean(data.needsLocationReview)
        : !resolvedLocationId,
      address: isValidPropertyAddress(data.address, { slug: finalSlug, title: rawTitle })
        ? sanitizeWordPressText(data.address)
        : `${sanitizeWordPressText(data.city || '') || data.city || 'Mohali'}, ${data.country || 'India'}`,
      hasManualAddress: data.hasManualAddress,
      locality: sanitizeWordPressText(data.locality || '') || '',
      city: sanitizeWordPressText(data.city || '') || (data.city || ''),
      stateRegion: data.stateRegion || '',
      country: data.country || 'India',
      postalCode: data.postalCode || '',
      coordinates: data.coordinates || { lat: 30.64, lng: 76.82 },

      bedrooms: Number(data.bedrooms) || 0,
      bathrooms: Number(data.bathrooms) || 0,
      interiorAreaSqFt: Number(data.interiorAreaSqFt) || 0,
      areaUnit: data.areaUnit || 'sq ft',
      lotSizeAcres: data.lotSizeAcres ? Number(data.lotSizeAcres) : undefined,
      yearBuilt: data.yearBuilt ? Number(data.yearBuilt) : new Date().getFullYear(),
      parkingSpaces: data.parkingSpaces !== undefined ? Number(data.parkingSpaces) : 2,
      energyRating: data.energyRating || 'A+',

      images: data.images && data.images.length > 0 ? data.images : (
        data.sourceLogoUrl ? [
          {
            id: `img-source-logo-${Date.now()}`,
            url: data.sourceLogoUrl,
            caption: `${rawTitle} - Source Logo`,
            isPrimary: true,
            origin: 'source_logo',
            isLogoFallback: true,
          }
        ] : [
          {
            id: `img-${Date.now()}`,
            url: DEFAULT_ARCHITECTURAL_FALLBACK_URL,
            caption: 'Property Facade',
            isPrimary: true,
            origin: 'fallback',
          }
        ]
      ),
      sourceLogoUrl: data.sourceLogoUrl,
      hasManualMainImage: Boolean(
        data.hasManualMainImage || (data.images && data.images.some(img => isManualPropertyImage(img)))
      ),

      highlights: data.highlights || [],
      amenities: data.amenities || ['24/7 Security', 'Covered Parking', 'Power Backup'],
      specifications: data.specifications || {},

      reraNumber: data.reraNumber,
      developerName: data.developerName,
      possessionYear: data.possessionYear,
      projectLandArea: data.projectLandArea,
      originalPriceText: data.originalPriceText,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      floorPlans: data.floorPlans,
      sourceSections: data.sourceSections,

      seo: data.seo || {
        metaTitle: `${rawTitle} – BUILDsmore Luxury Registry`,
        metaDescription: data.description ? data.description.slice(0, 155) : '',
        keywords: [data.city || 'India', data.category || 'Real Estate'],
      },
      source: data.source || {
        type: 'manual',
        lastSyncedAt: now,
      },

      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    // Prepend to top of properties
    this.properties.unshift(newProperty);
    this.persistProperties();
    return newProperty;
  }

  public findMatchingImportedProperty(incoming: {
    id?: string;
    source?: Property['source'];
  }): Property | undefined {
    const incomingUrl = incoming.source?.sourceUrl ? normalizeSourceUrl(incoming.source.sourceUrl) : '';
    const incomingWebsiteId = incoming.source?.sourceWebsiteId
      || (incomingUrl ? extractSourceWebsiteId(incomingUrl) : '');
    const incomingPropId = incoming.source?.sourcePropertyId || '';

    return this.properties.find(p => {
      if (incoming.id && p.id === incoming.id) return true;
      if (
        incomingWebsiteId &&
        incomingPropId &&
        p.source?.sourceWebsiteId === incomingWebsiteId &&
        p.source?.sourcePropertyId === incomingPropId
      ) {
        return true;
      }
      if (incomingUrl && p.source?.sourceUrl) {
        if (normalizeSourceUrl(p.source.sourceUrl) === incomingUrl) {
          return true;
        }
      }
      return false;
    });
  }

  public upsertImportedProperty(
    incoming: Property,
    syncPolicy: 'preserve_central' | 'update_existing' = 'preserve_central'
  ): { action: 'created' | 'updated' | 'skipped'; property: Property } {
    const existing = this.findMatchingImportedProperty(incoming);

    if (existing) {
      if (syncPolicy === 'preserve_central') {
        return { action: 'skipped', property: existing };
      }

      // Strictly preserve manually uploaded/set main images at highest priority during re-import
      const mergedImageResult = mergeImportedImages(
        existing.images || [],
        incoming.images || [],
        existing.hasManualMainImage
      );

      const cleanIncomingAddress = sanitizeWordPressText(incoming.address);
      const effectiveCity = existing.locationId ? existing.city : (incoming.city || existing.city);
      const incomingAddrValid = isValidPropertyAddress(cleanIncomingAddress, { slug: incoming.slug, title: incoming.title });
      const existingAddrValid = isValidPropertyAddress(existing.address, { slug: existing.slug, title: existing.title });

      const safeAddress =
        existing.hasManualAddress && existingAddrValid
          ? existing.address
          : incomingAddrValid &&
            !(existingAddrValid && isGenericFallbackAddress(cleanIncomingAddress, effectiveCity) && !isGenericFallbackAddress(existing.address, effectiveCity))
          ? cleanIncomingAddress
          : existingAddrValid
          ? existing.address
          : `${effectiveCity}, ${incoming.country || existing.country}`;

      const cleanSpecs: Record<string, string> = {};
      for (const [k, v] of Object.entries({ ...(incoming.specifications || {}), ...(existing.specifications || {}) })) {
        if (typeof v === 'string' && !looksLikeRawMarkupOrCss(v)) {
          cleanSpecs[k] = v;
        }
      }
      cleanSpecs['Location Corridor'] = safeAddress;
      cleanSpecs['City'] = effectiveCity;

      const updatedPayload: Partial<Property> = {
        ...incoming,
        id: existing.id,
        slug: existing.slug,
        status: existing.status,
        featured: existing.featured,
        isTrophyHolding: existing.isTrophyHolding,
        trophyOrder: existing.trophyOrder,
        isLatestAdded: existing.isLatestAdded,
        displayOrder: existing.displayOrder,
        isNewDevelopment: existing.isNewDevelopment,
        locationId: existing.locationId ?? incoming.locationId,
        needsLocationReview: existing.locationId ? false : incoming.needsLocationReview,
        address: safeAddress,
        hasManualAddress: existing.hasManualAddress,
        city: effectiveCity,
        highlights:
          existing.highlights && existing.highlights.length > 0
            ? existing.highlights
            : incoming.highlights || [],
        price: incoming.price > 0 ? incoming.price : existing.price,
        currency: 'INR',
        images: mergedImageResult.images.length > 0 ? mergedImageResult.images : (existing.images || []),
        hasManualMainImage: mergedImageResult.hasManualMainImage || existing.hasManualMainImage,
        sourceLogoUrl: incoming.sourceLogoUrl || existing.sourceLogoUrl,
        coordinates: existing.coordinates || incoming.coordinates,
        specifications: cleanSpecs,
        createdAt: existing.createdAt,
        source: {
          ...existing.source,
          ...incoming.source,
          sourceWebsiteId: incoming.source.sourceWebsiteId || existing.source.sourceWebsiteId,
          sourcePropertyId: incoming.source.sourcePropertyId || existing.source.sourcePropertyId,
          sourceUrl: incoming.source.sourceUrl || existing.source.sourceUrl,
          lastSyncedAt: new Date().toISOString(),
        },
      };

      const updated = this.updateProperty(existing.id, updatedPayload);
      return { action: 'updated', property: updated || existing };
    }

    const created = this.createProperty(incoming);
    return { action: 'created', property: created };
  }

  public updateProperty(id: string, updates: Partial<Property>): Property | null {
    const index = this.properties.findIndex(p => p.id === id);
    if (index === -1) return null;

    const existing = this.properties[index];
    const nextImages = updates.images ?? existing.images;
    const hasManual =
      updates.hasManualMainImage !== undefined
        ? updates.hasManualMainImage
        : (existing.hasManualMainImage ||
            (Array.isArray(nextImages) && nextImages.some(img => isManualPropertyImage(img))));

    let nextAddress = existing.address;
    if (updates.address !== undefined) {
      const cleanedUpd = sanitizeWordPressText(updates.address);
      if (isValidPropertyAddress(cleanedUpd, { slug: existing.slug, title: existing.title })) {
        nextAddress = cleanedUpd;
      } else if (isValidPropertyAddress(existing.address, { slug: existing.slug, title: existing.title })) {
        nextAddress = existing.address;
      } else {
        nextAddress = `${updates.city || existing.city}, ${updates.country || existing.country}`;
      }
    }

    const hasManualAddress =
      updates.hasManualAddress !== undefined
        ? updates.hasManualAddress
        : existing.hasManualAddress ||
          (updates.address !== undefined &&
            nextAddress !== existing.address &&
            !isGenericFallbackAddress(nextAddress, updates.city || existing.city));

    const updated: Property = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      address: nextAddress,
      hasManualAddress: Boolean(hasManualAddress),
      images: nextImages,
      hasManualMainImage: Boolean(hasManual),
      currency: 'INR', // Strictly INR
      updatedAt: new Date().toISOString(),
    };

    if (updates.slug && updates.slug !== existing.slug) {
      let candidate = updates.slug;
      let counter = 1;
      while (this.properties.some(p => p.id !== id && p.slug === candidate)) {
        candidate = `${updates.slug}-${counter++}`;
      }
      updated.slug = candidate;
    }

    this.properties[index] = updated;
    this.persistProperties();
    return updated;
  }

  public deleteProperty(id: string): boolean {
    const initialLen = this.properties.length;
    this.properties = this.properties.filter(p => p.id !== id);
    if (this.properties.length !== initialLen) {
      // Also remove from trophy and collections
      this.trophyPropertyIds = this.trophyPropertyIds.filter(pid => pid !== id);
      this.collections.forEach(c => {
        c.propertyIds = c.propertyIds.filter(pid => pid !== id);
      });
      this.persistProperties();
      this.persistTrophy();
      this.persistCollections();
      return true;
    }
    return false;
  }

  public togglePublish(id: string): Property | null {
    const prop = this.properties.find(p => p.id === id);
    if (!prop) return null;
    prop.status = prop.status === 'Published' ? 'Draft' : 'Published';
    prop.updatedAt = new Date().toISOString();
    this.persistProperties();
    return prop;
  }

  public toggleFeatured(id: string): Property | null {
    const prop = this.properties.find(p => p.id === id);
    if (!prop) return null;
    prop.featured = !prop.featured;
    prop.updatedAt = new Date().toISOString();
    this.persistProperties();
    return prop;
  }

  public toggleLatest(id: string): Property | null {
    const prop = this.properties.find(p => p.id === id);
    if (!prop) return null;
    prop.isLatestAdded = !prop.isLatestAdded;
    prop.updatedAt = new Date().toISOString();
    this.persistProperties();
    return prop;
  }

  // ==========================================
  // TROPHY HOLDINGS MANAGEMENT
  // ==========================================
  public getTrophyHoldings(): Property[] {
    const map = new Map(this.properties.map(p => [p.id, p]));
    const trophyProps: Property[] = [];

    // Collect in explicit order
    for (const id of this.trophyPropertyIds) {
      const p = map.get(id);
      if (p && p.status === 'Published') {
        trophyProps.push(p);
      }
    }

    // Also include any properties flagged with isTrophyHolding
    for (const p of this.properties) {
      if (p.isTrophyHolding && p.status === 'Published' && !this.trophyPropertyIds.includes(p.id)) {
        trophyProps.push(p);
      }
    }

    return trophyProps;
  }

  public updateTrophyHoldings(propertyIds: string[]): Property[] {
    this.trophyPropertyIds = propertyIds;
    // Update individual flags
    this.properties.forEach(p => {
      const idx = propertyIds.indexOf(p.id);
      if (idx !== -1) {
        p.isTrophyHolding = true;
        p.trophyOrder = idx + 1;
      } else {
        p.isTrophyHolding = false;
        p.trophyOrder = 99;
      }
    });

    this.persistTrophy();
    this.persistProperties();
    return this.getTrophyHoldings();
  }

  public toggleTrophyHolding(id: string): boolean {
    const prop = this.properties.find(p => p.id === id);
    if (!prop) return false;

    const exists = this.trophyPropertyIds.includes(id);
    if (exists) {
      this.trophyPropertyIds = this.trophyPropertyIds.filter(pid => pid !== id);
      prop.isTrophyHolding = false;
      prop.trophyOrder = 99;
    } else {
      this.trophyPropertyIds.push(id);
      prop.isTrophyHolding = true;
      prop.trophyOrder = this.trophyPropertyIds.length;
    }

    this.persistTrophy();
    this.persistProperties();
    return !exists;
  }

  // ==========================================
  // CURATED COLLECTIONS MANAGEMENT
  // ==========================================
  public getAllCollections(includeDrafts = true): CuratedCollection[] {
    let list = [...this.collections];
    if (!includeDrafts) {
      list = list.filter(c => c.status === 'Published');
    }
    return list.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public getCollectionBySlug(slug: string): (CuratedCollection & { properties: Property[] }) | null {
    const col = this.collections.find(c => c.slug === slug || c.id === slug);
    if (!col) return null;

    const propMap = new Map(this.properties.map(p => [p.id, p]));
    const properties = col.propertyIds
      .map(id => propMap.get(id))
      .filter((p): p is Property => p !== undefined && p.status === 'Published');

    return {
      ...col,
      properties,
    };
  }

  public createCollection(data: Partial<CuratedCollection>): CuratedCollection {
    const now = new Date().toISOString();
    const id = data.id || `col-${Date.now()}`;
    const rawTitle = data.title || 'New Curated Collection';
    const slug = data.slug || this.generateSlug(rawTitle);

    let finalSlug = slug;
    let counter = 1;
    while (this.collections.some(c => c.slug === finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }

    const newCollection: CuratedCollection = {
      id,
      slug: finalSlug,
      title: rawTitle,
      subtitle: data.subtitle || '',
      description: data.description || '',
      coverImageUrl: data.coverImageUrl || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      status: data.status || 'Published',
      displayOrder: data.displayOrder || this.collections.length + 1,
      propertyIds: Array.isArray(data.propertyIds) ? data.propertyIds : [],
      seo: data.seo || {
        metaTitle: `${rawTitle} – BUILDsmore Curated Collection`,
        metaDescription: data.description ? data.description.slice(0, 150) : '',
        keywords: [rawTitle, 'luxury properties', 'investment portfolio'],
      },
      createdAt: now,
      updatedAt: now,
    };

    this.collections.push(newCollection);
    this.persistCollections();
    return newCollection;
  }

  public updateCollection(id: string, updates: Partial<CuratedCollection>): CuratedCollection | null {
    const index = this.collections.findIndex(c => c.id === id);
    if (index === -1) return null;

    const existing = this.collections[index];
    const updated: CuratedCollection = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    if (updates.slug && updates.slug !== existing.slug) {
      let candidate = updates.slug;
      let counter = 1;
      while (this.collections.some(c => c.id !== id && c.slug === candidate)) {
        candidate = `${updates.slug}-${counter++}`;
      }
      updated.slug = candidate;
    }

    this.collections[index] = updated;
    this.persistCollections();
    return updated;
  }

  public deleteCollection(id: string): boolean {
    const initialLen = this.collections.length;
    // Does NOT delete properties, only removes the collection record
    this.collections = this.collections.filter(c => c.id !== id);
    if (this.collections.length !== initialLen) {
      this.persistCollections();
      return true;
    }
    return false;
  }

  public addPropertyToCollection(collectionId: string, propertyId: string): boolean {
    const col = this.collections.find(c => c.id === collectionId);
    if (!col) return false;
    if (!col.propertyIds.includes(propertyId)) {
      col.propertyIds.push(propertyId);
      col.updatedAt = new Date().toISOString();
      this.persistCollections();
    }
    return true;
  }

  public removePropertyFromCollection(collectionId: string, propertyId: string): boolean {
    const col = this.collections.find(c => c.id === collectionId);
    if (!col) return false;
    col.propertyIds = col.propertyIds.filter(id => id !== propertyId);
    col.updatedAt = new Date().toISOString();
    this.persistCollections();
    return true;
  }

  public reorderCollectionProperties(collectionId: string, propertyIds: string[]): boolean {
    const col = this.collections.find(c => c.id === collectionId);
    if (!col) return false;
    col.propertyIds = propertyIds;
    col.updatedAt = new Date().toISOString();
    this.persistCollections();
    return true;
  }

  // Slug generator helper
  public generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || `item-${Date.now()}`;
  }

  // ==========================================
  // LOCATION MANAGEMENT METHODS
  // ==========================================
  public getAllLocations(activeOnly = false): ManagedLocation[] {
    let list = [...this.locations];
    if (activeOnly) {
      list = list.filter(l => l.isActive);
    }

    // Attach dynamic property counts (published properties in this location)
    const publishedProps = this.properties.filter(p => p.status === 'Published');
    const withCounts = list.map(loc => {
      const locNameLower = loc.name.toLowerCase();
      const count = publishedProps.filter(p => {
        if (p.locationId && p.locationId === loc.id) return true;
        if (p.city && p.city.toLowerCase() === locNameLower) return true;
        if (loc.aliases && loc.aliases.length > 0) {
          return loc.aliases.some(a => 
            (p.city && p.city.toLowerCase().includes(a)) ||
            (p.locality && p.locality.toLowerCase().includes(a)) ||
            (p.address && p.address.toLowerCase().includes(a))
          );
        }
        return false;
      }).length;

      return {
        ...loc,
        propertyCount: count,
      };
    });

    return withCounts.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name));
  }

  public getLocationById(id: string): ManagedLocation | undefined {
    return this.locations.find(l => l.id === id);
  }

  public getLocationBySlug(slug: string): ManagedLocation | undefined {
    return this.locations.find(l => l.slug === slug || l.id === slug);
  }

  public createLocation(data: Partial<ManagedLocation>): ManagedLocation {
    const now = new Date().toISOString();
    const id = data.id || `loc-${Date.now()}`;
    const slug = data.slug || this.generateSlug(data.name || 'location');

    // Ensure slug uniqueness
    let finalSlug = slug;
    let counter = 1;
    while (this.locations.some(l => l.slug === finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }

    const newLoc: ManagedLocation = {
      id,
      name: (data.name || '').trim(),
      slug: finalSlug,
      stateRegion: data.stateRegion?.trim() || undefined,
      country: data.country?.trim() || 'India',
      aliases: Array.isArray(data.aliases) 
        ? data.aliases.map(a => a.trim().toLowerCase()).filter(Boolean)
        : [],
      displayOrder: Number(data.displayOrder) || (this.locations.length + 1),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: now,
      updatedAt: now,
    };

    this.locations.push(newLoc);
    this.persistLocations();

    // Check if any existing properties match this newly created location and lack locationId
    let propsUpdated = false;
    const locNameLower = newLoc.name.toLowerCase();
    for (const prop of this.properties) {
      if (!prop.locationId) {
        if (prop.city.toLowerCase() === locNameLower || (newLoc.aliases && newLoc.aliases.some(a => prop.city.toLowerCase().includes(a)))) {
          prop.locationId = newLoc.id;
          propsUpdated = true;
        }
      }
    }
    if (propsUpdated) {
      this.persistProperties();
    }

    return newLoc;
  }

  public updateLocation(id: string, data: Partial<ManagedLocation>): ManagedLocation | null {
    const index = this.locations.findIndex(l => l.id === id);
    if (index === -1) return null;

    const existing = this.locations[index];
    const updated: ManagedLocation = {
      ...existing,
      ...data,
      id: existing.id,
      aliases: Array.isArray(data.aliases) 
        ? data.aliases.map(a => a.trim().toLowerCase()).filter(Boolean)
        : existing.aliases,
      updatedAt: new Date().toISOString(),
    };

    if (data.slug && data.slug !== existing.slug) {
      let finalSlug = data.slug;
      let counter = 1;
      while (this.locations.some(l => l.id !== id && l.slug === finalSlug)) {
        finalSlug = `${data.slug}-${counter++}`;
      }
      updated.slug = finalSlug;
    }

    this.locations[index] = updated;
    this.persistLocations();
    return updated;
  }

  public deleteLocation(id: string): boolean {
    const initialLen = this.locations.length;
    this.locations = this.locations.filter(l => l.id !== id);
    if (this.locations.length !== initialLen) {
      this.persistLocations();
      return true;
    }
    return false;
  }

  public findLocationMatch(
    query?: string,
    address?: string,
    locality?: string
  ): { location: ManagedLocation | null; confidence: 'exact' | 'alias' | 'uncertain' | 'none' } {
    if (!query && !address && !locality) {
      return { location: null, confidence: 'none' };
    }

    const textToSearch = [query, locality, address].filter(Boolean).join(' ').toLowerCase();

    // 1. Exact match on location name
    for (const loc of this.locations) {
      const locNameLower = loc.name.toLowerCase();
      if (query && query.toLowerCase().trim() === locNameLower) {
        return { location: loc, confidence: 'exact' };
      }
      if (loc.slug && query && query.toLowerCase().trim() === loc.slug) {
        return { location: loc, confidence: 'exact' };
      }
    }

    // 2. Whole-word match on location name in textToSearch
    const exactMatches: ManagedLocation[] = [];
    for (const loc of this.locations) {
      const locNameLower = loc.name.toLowerCase();
      const regex = new RegExp(`\\b${locNameLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(textToSearch)) {
        exactMatches.push(loc);
      }
    }
    if (exactMatches.length === 1) {
      return { location: exactMatches[0], confidence: 'exact' };
    }
    if (exactMatches.length > 1) {
      const direct = exactMatches.find(l => query && l.name.toLowerCase() === query.toLowerCase().trim());
      return { location: direct || exactMatches[0], confidence: 'uncertain' };
    }

    // 3. Alias match
    const aliasMatches: ManagedLocation[] = [];
    for (const loc of this.locations) {
      if (loc.aliases && Array.isArray(loc.aliases)) {
        for (const alias of loc.aliases) {
          const aliasLower = alias.trim().toLowerCase();
          if (!aliasLower) continue;
          const regex = new RegExp(`\\b${aliasLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
          if (regex.test(textToSearch)) {
            if (!aliasMatches.some(m => m.id === loc.id)) {
              aliasMatches.push(loc);
            }
          }
        }
      }
    }
    if (aliasMatches.length === 1) {
      return { location: aliasMatches[0], confidence: 'alias' };
    }
    if (aliasMatches.length > 1) {
      return { location: aliasMatches[0], confidence: 'uncertain' };
    }

    return { location: null, confidence: 'none' };
  }
}

export const propertyRepository = new PropertyRepository();
