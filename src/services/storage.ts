/**
 * BUILDsmore Storage & State Manager
 * Handles persistent browser state, initial seeding, real-time CRUD, and analytics
 */

import { INITIAL_PROPERTIES, INITIAL_WORDPRESS_SOURCES } from '../data/initialProperties';
import { INITIAL_COLLECTIONS } from '../data/initialCollections';
import { INITIAL_LOCATIONS } from '../data/initialLocations';
import { 
  BlogPost,
  HeroSlide,
  Property, 
  CuratedCollection,
  ManagedLocation,
  Inquiry, 
  WordPressSource, 
  ImportJob, 
  AdminUser, 
  DashboardStats,
  PropertyCategory 
} from '../types/property';

import {
  normalizeSourceUrl,
  extractSourceWebsiteId,
  computeSourceUrlHash,
  computeUniversalPropertyId,
} from '../utils/sourceIdentity';
import {
  isGenericFallbackAddress,
  isValidPropertyAddress,
  sanitizeWordPressText,
} from '../utils/propertyImages';

export const STORAGE_EVENTS = {
  AUTH_EXPIRED: 'buildsmore:auth-expired',
  API_ERROR: 'buildsmore:api-error',
} as const;

const STORAGE_KEYS = {
  PROPERTIES: 'buildsmore_properties_v1',
  COLLECTIONS: 'buildsmore_collections_v1',
  TROPHY_HOLDINGS: 'buildsmore_trophy_v1',
  LOCATIONS: 'buildsmore_locations_v1',
  WORDPRESS_SOURCES: 'buildsmore_wp_sources_v1',
  INQUIRIES: 'buildsmore_inquiries_v1',
  IMPORT_JOBS: 'buildsmore_import_jobs_v1',
  ADMIN_SESSION: 'buildsmore_admin_session_v1',
  ADMIN_JWT: 'buildsmore_admin_jwt',
  CURRENCY_PREF: 'buildsmore_currency_pref_v1',
  DELETED_IDS: 'buildsmore_deleted_ids_v1',
  BLOGS: 'buildsmore_blogs_v1',
  HERO_SLIDES: 'buildsmore_hero_slides_v1',
};

const INITIAL_INQUIRIES: Inquiry[] = [
  {
    id: 'inq-001',
    propertyId: 'prop-001',
    propertyTitle: 'Villa Sol de Mar',
    propertySlug: 'villa-sol-mar-port-d-andratx-mallorca',
    clientName: 'Lord Alistair Sterling',
    email: 'a.sterling@sterling-holdings.co.uk',
    phone: '+44 20 7946 0912',
    preferredContactMethod: 'phone',
    investmentBudget: '€30M - €40M',
    scheduledTourDate: '2026-04-14',
    message: 'Requesting private helicopter transfer from Palma Son Sant Joan directly to the property for private inspection with family office principal.',
    status: 'In Negotiation',
    notes: 'Verified family office principal. NDA signed. Private tour booked for April 14th.',
    createdAt: '2026-03-22T14:20:00.000Z',
    assignedAdvisor: 'Marcus Vance',
  },
  {
    id: 'inq-002',
    propertyId: 'prop-002',
    propertyTitle: 'The Elysian Duplex Penthouse',
    propertySlug: 'the-elysian-duplex-penthouse-manhattan-billionaires-row',
    clientName: 'Elena Rostova',
    email: 'elena.rostova@geneva-capital.ch',
    phone: '+41 22 555 0198',
    preferredContactMethod: 'email',
    investmentBudget: '₹50 Cr+',
    scheduledTourDate: '2026-04-02',
    message: 'Seeking closing before Q3. Would like full architectural floorplans and HOA financial reserves audit.',
    status: 'Contacted',
    notes: 'Sent full architectural dossier and historical building financials.',
    createdAt: '2026-03-24T09:45:00.000Z',
    assignedAdvisor: 'Sophia Laurent',
  },
  {
    id: 'inq-003',
    propertyId: 'prop-005',
    propertyTitle: 'The Palm Royal Residence',
    propertySlug: 'the-atlantis-royal-mansion-palm-jumeirah-dubai',
    clientName: 'Sheikh Hamdan Al-Nuaimi',
    email: 'h.nuaimi@gulfinvest.ae',
    phone: '+971 4 300 8899',
    preferredContactMethod: 'whatsapp',
    investmentBudget: 'AED 150M',
    scheduledTourDate: '2026-03-29',
    message: 'Inquiring regarding yacht berth depth and private security perimeter certification.',
    status: 'New',
    notes: 'Initial inquiry via Dubai private concierge team.',
    createdAt: '2026-03-24T21:10:00.000Z',
    assignedAdvisor: 'Marcus Vance',
  },
];

class StorageService {
  private memoryProperties: Property[] = [...INITIAL_PROPERTIES];
  private memoryLocations: ManagedLocation[] = [...INITIAL_LOCATIONS];
  private memoryTrophyHoldings: Property[] | null = null;
  private memoryBlogs: BlogPost[] = [];
  private memoryHeroSlides: HeroSlide[] = [];

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  public emitAuthExpired(message = 'Your administrator session has expired. Please sign in again.'): void {
    this.logoutAdmin();
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.AUTH_EXPIRED, { detail: { message } }));
    }
  }

  public emitApiError(message: string, status?: number): void {
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.API_ERROR, { detail: { message, status } }));
    }
  }

  public handleUnauthorizedResponse(res: Response, customMessage?: string): boolean {
    if (res.status === 401) {
      this.emitAuthExpired(customMessage || 'Your administrator session has expired. Please sign in again.');
      return true;
    }
    return false;
  }

  private async readErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string' && data.error.trim()) {
        return data.error.trim();
      }
    } catch {}
    return `${fallback} (HTTP ${res.status})`;
  }

  public hydrateRuntimeSnapshot(snapshot?: {
    properties?: Property[];
    collections?: CuratedCollection[];
    locations?: ManagedLocation[];
    trophyHoldings?: Property[];
    blogs?: BlogPost[];
    heroSlides?: HeroSlide[];
  }): void {
    if (!snapshot) return;
    if (Array.isArray(snapshot.properties) && snapshot.properties.length > 0) {
      this.memoryProperties = snapshot.properties;
      if (this.isBrowser()) {
        try {
          localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(snapshot.properties));
        } catch {}
      }
    }
    if (Array.isArray(snapshot.collections) && snapshot.collections.length > 0) {
      this.memoryCollections = snapshot.collections;
      if (this.isBrowser()) {
        try {
          localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(snapshot.collections));
        } catch {}
      }
    }
    if (Array.isArray(snapshot.locations) && snapshot.locations.length > 0) {
      this.memoryLocations = snapshot.locations;
      if (this.isBrowser()) {
        try {
          localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(snapshot.locations));
        } catch {}
      }
    }
    if (Array.isArray(snapshot.trophyHoldings)) {
      this.memoryTrophyHoldings = snapshot.trophyHoldings;
    }
    if (Array.isArray(snapshot.blogs)) {
      this.memoryBlogs = snapshot.blogs;
      if (this.isBrowser()) {
        try {
          localStorage.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(snapshot.blogs));
        } catch {}
      }
    }
    if (Array.isArray(snapshot.heroSlides)) {
      this.memoryHeroSlides = snapshot.heroSlides;
      if (this.isBrowser()) {
        try {
          localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(snapshot.heroSlides));
        } catch {}
      }
    }
  }

  getPropertyTimestamp(p: Property): number {
    if (p.createdAt) {
      const t = new Date(p.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (p.updatedAt) {
      const t = new Date(p.updatedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (p.id && p.id.startsWith('prop-')) {
      const numericPart = parseInt(p.id.replace('prop-', ''), 10);
      if (!isNaN(numericPart) && numericPart > 1000000000000) {
        return numericPart;
      }
    }
    return 0;
  }

  /**
   * Safely migrates legacy colliding imported IDs (e.g. prop-univ-68747470) in-place
   * using deterministic SHA-256 hashing without deleting or overwriting any property.
   */
  public migrateLegacyPropertyList(list: Property[]): { list: Property[]; migratedMap: Record<string, string> } {
    const migratedMap: Record<string, string> = {};
    let changed = false;

    const updatedList = list.map(prop => {
      if (!prop.source || prop.source.type !== 'wordpress') return prop;
      const rawUrl = prop.source.sourceUrl || prop.seo?.canonicalUrl;
      if (!rawUrl) return prop;

      const canonicalUrl = normalizeSourceUrl(rawUrl);
      const sourceWebsiteId = extractSourceWebsiteId(canonicalUrl);
      const urlHash = computeSourceUrlHash(canonicalUrl, 12);

      let nextProp = prop;
      if (!prop.source.sourceWebsiteId || prop.source.sourceUrl !== canonicalUrl) {
        nextProp = {
          ...prop,
          source: {
            ...prop.source,
            sourceWebsiteId: prop.source.sourceWebsiteId || sourceWebsiteId,
            sourceUrl: canonicalUrl,
          },
        };
        changed = true;
      }

      if (prop.id === 'prop-univ-68747470') {
        const targetId = computeUniversalPropertyId(canonicalUrl);
        if (targetId !== prop.id) {
          const conflict = list.some(other => other !== prop && other.id === targetId);
          if (!conflict) {
            migratedMap[prop.id] = targetId;
            nextProp = {
              ...nextProp,
              id: targetId,
              source: {
                ...nextProp.source,
                sourceWebsiteId,
                sourcePropertyId: urlHash,
                sourceUrl: canonicalUrl,
              },
            };
            changed = true;
          }
        }
      }

      return nextProp;
    });

    if (changed && this.isBrowser() && Object.keys(migratedMap).length > 0) {
      // Remap collection references in localStorage
      try {
        const rawCols = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
        if (rawCols) {
          const cols: CuratedCollection[] = JSON.parse(rawCols);
          let colChanged = false;
          const nextCols = cols.map(c => {
            const remapped = c.propertyIds.map(pid => migratedMap[pid] || pid);
            if (remapped.some((pid, i) => pid !== c.propertyIds[i])) {
              colChanged = true;
              return { ...c, propertyIds: Array.from(new Set(remapped)) };
            }
            return c;
          });
          if (colChanged) {
            localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(nextCols));
            this.memoryCollections = nextCols;
          }
        }

        const rawSaved = localStorage.getItem('buildsmore_saved_properties');
        if (rawSaved) {
          const savedIds: string[] = JSON.parse(rawSaved);
          const remappedSaved = Array.from(new Set(savedIds.map(pid => migratedMap[pid] || pid)));
          localStorage.setItem('buildsmore_saved_properties', JSON.stringify(remappedSaved));
        }

        const rawTrophy = localStorage.getItem(STORAGE_KEYS.TROPHY_HOLDINGS);
        if (rawTrophy) {
          const trophyIds: string[] = JSON.parse(rawTrophy);
          const remappedTrophy = Array.from(new Set(trophyIds.map(pid => migratedMap[pid] || pid)));
          localStorage.setItem(STORAGE_KEYS.TROPHY_HOLDINGS, JSON.stringify(remappedTrophy));
        }
      } catch {
        // Non-fatal remap error
      }
    }

    return { list: updatedList, migratedMap };
  }

  // --- Properties CRUD ---
  getProperties(): Property[] {
    if (!this.isBrowser()) {
      const { list, migratedMap } = this.migrateLegacyPropertyList(this.memoryProperties);
      if (Object.keys(migratedMap).length > 0) {
        this.memoryProperties = list;
      }
      return [...list].sort((a, b) => this.getPropertyTimestamp(b) - this.getPropertyTimestamp(a));
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROPERTIES);
      let list: Property[];
      if (!data) {
        list = [...INITIAL_PROPERTIES];
        localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(list));
      } else {
        list = JSON.parse(data);
      }

      const needsMigration = list.some(
        p =>
          p.id === 'prop-univ-68747470' ||
          (p.source?.type === 'wordpress' && !p.source?.sourceWebsiteId) ||
          (p.address && !isValidPropertyAddress(p.address, { slug: p.slug, title: p.title }))
      );
      if (needsMigration) {
        const res = this.migrateLegacyPropertyList(list);
        list = res.list.map(p => {
          if (p.address && !isValidPropertyAddress(p.address, { slug: p.slug, title: p.title })) {
            const cleaned = sanitizeWordPressText(p.address);
            return {
              ...p,
              address: isValidPropertyAddress(cleaned, { slug: p.slug, title: p.title })
                ? cleaned
                : `${p.city || 'Mohali'}, ${p.country || 'India'}`,
            };
          }
          return p;
        });
        localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(list));
      }

      return list.sort((a, b) => this.getPropertyTimestamp(b) - this.getPropertyTimestamp(a));
    } catch {
      return this.memoryProperties.sort((a, b) => this.getPropertyTimestamp(b) - this.getPropertyTimestamp(a));
    }
  }

  saveProperties(properties: Property[]): void {
    this.memoryProperties = properties;
    if (!this.isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
  }

  /**
   * Merges properties returned by backend endpoints directly into localStorage/memory
   * without triggering redundant POST/PUT network calls.
   */
  upsertLocalProperties(incomingProps: Property[]): void {
    if (!incomingProps || incomingProps.length === 0) return;
    const properties = this.getProperties();

    for (const incoming of incomingProps) {
      const idx = properties.findIndex(p => {
        if (p.id === incoming.id) return true;
        if (incoming.source?.type === 'wordpress') {
          if (
            p.source?.sourceWebsiteId &&
            incoming.source?.sourceWebsiteId &&
            p.source.sourceWebsiteId === incoming.source.sourceWebsiteId &&
            p.source?.sourcePropertyId &&
            p.source.sourcePropertyId === incoming.source.sourcePropertyId
          ) {
            return true;
          }
          if (
            p.source?.sourceUrl &&
            incoming.source?.sourceUrl &&
            normalizeSourceUrl(p.source.sourceUrl) === normalizeSourceUrl(incoming.source.sourceUrl)
          ) {
            return true;
          }
        }
        return false;
      });

      if (idx >= 0) {
        properties[idx] = incoming;
      } else {
        properties.unshift(incoming);
      }
    }

    properties.sort((a, b) => this.getPropertyTimestamp(b) - this.getPropertyTimestamp(a));
    this.saveProperties(properties);
  }

  /**
   * Synchronizes frontend localStorage with backend PropertyRepository (/api/properties).
   * Preserves and backfills any local imported properties not yet on the server.
   */
  async syncWithServer(): Promise<Property[]> {
    const localProps = this.getProperties();
    if (!this.isBrowser()) return localProps;

    const token = this.getAdminToken();
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const [propsRes, colsRes, locsRes, blogsRes, heroSlidesRes] = await Promise.all([
        fetch(token ? '/api/properties?all=true' : '/api/properties', { headers: authHeaders }).catch(() => null),
        fetch(token ? '/api/collections?includeDrafts=true' : '/api/collections', { headers: authHeaders }).catch(() => null),
        fetch('/api/locations').catch(() => null),
        fetch(token ? '/api/blogs?includeDrafts=true&limit=200' : '/api/blogs?limit=200', { headers: authHeaders }).catch(() => null),
        fetch('/api/hero-slides').catch(() => null),
      ]);

      if (colsRes && colsRes.ok) {
        const serverCols = await colsRes.json();
        if (Array.isArray(serverCols) && serverCols.length > 0) {
          this.saveCollections(serverCols);
        }
      }

      if (locsRes && locsRes.ok) {
        const serverLocs = await locsRes.json();
        if (Array.isArray(serverLocs) && serverLocs.length > 0) {
          this.saveLocations(serverLocs);
        }
      }

      if (blogsRes && blogsRes.ok) {
        const blogsPayload = await blogsRes.json().catch(() => null);
        if (blogsPayload && Array.isArray(blogsPayload.items)) {
          this.saveBlogs(blogsPayload.items);
        }
      }

      if (heroSlidesRes && heroSlidesRes.ok) {
        const heroPayload = await heroSlidesRes.json().catch(() => null);
        if (heroPayload && Array.isArray(heroPayload.items)) {
          this.saveHeroSlides(heroPayload.items);
        }
      }

      if (!propsRes || !propsRes.ok) {
        if (propsRes && token && propsRes.status === 401) {
          this.handleUnauthorizedResponse(propsRes);
        }
        return localProps;
      }

      const payload = await propsRes.json();
      const serverProps: Property[] = Array.isArray(payload?.items) ? payload.items : [];
      if (serverProps.length === 0 && localProps.length > 0) {
        return localProps;
      }

      let deletedIds: string[] = [];
      try {
        const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
        deletedIds = rawDel ? JSON.parse(rawDel) : [];
      } catch {
        deletedIds = [];
      }
      const deletedSet = new Set(deletedIds);

      const serverUrlSet = new Set(
        serverProps
          .map(p => (p.source?.sourceUrl ? normalizeSourceUrl(p.source.sourceUrl) : ''))
          .filter(Boolean)
      );
      const serverIdSet = new Set(serverProps.map(p => p.id));

      // Keep only server properties that weren't deleted locally (retry delete only when admin authenticated)
      const merged: Property[] = [];
      for (const sp of serverProps) {
        if (token && deletedSet.has(sp.id)) {
          this.apiDelete(`/api/properties/${sp.id}`);
          continue;
        }
        merged.push(sp);
      }

      // Clean up deletedIds that server already removed
      const remainingDeleted = deletedIds.filter(id => serverIdSet.has(id));
      localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(remainingDeleted));

      // Only authenticated admins backfill local custom properties to backend
      if (token) {
        for (const lp of localProps) {
          if (deletedSet.has(lp.id)) continue;
          const normUrl = lp.source?.sourceUrl ? normalizeSourceUrl(lp.source.sourceUrl) : '';
          const existsOnServer = serverIdSet.has(lp.id) || (normUrl && serverUrlSet.has(normUrl));
          if (!existsOnServer && !lp.id.startsWith('prop-00')) {
            merged.push(lp);
            fetch('/api/properties', {
              method: 'POST',
              headers: this.getAuthHeaders(true),
              body: JSON.stringify(lp),
              keepalive: true,
            })
              .then((res) => {
                if (res.status === 401) {
                  this.handleUnauthorizedResponse(res);
                }
              })
              .catch(() => {});
          }
        }
      }

      merged.sort((a, b) => this.getPropertyTimestamp(b) - this.getPropertyTimestamp(a));
      this.saveProperties(merged);
      return merged;
    } catch {
      return localProps;
    }
  }

  getPropertyBySlug(slug: string): Property | undefined {
    const properties = this.getProperties();
    return properties.find(p => p.slug === slug || p.id === slug);
  }

  getPropertyById(id: string): Property | undefined {
    const properties = this.getProperties();
    return properties.find(p => p.id === id);
  }

  private preparePropertyForSave(property: Property): {
    preparedProperty: Property;
    existingIndex: number;
    properties: Property[];
  } {
    const properties = this.getProperties();
    const incomingUrl = property.source?.sourceUrl ? normalizeSourceUrl(property.source.sourceUrl) : '';

    const existingIndex = properties.findIndex(p => {
      if (p.id === property.id) return true;
      if (property.source?.type === 'wordpress') {
        if (
          p.source?.sourceWebsiteId &&
          property.source?.sourceWebsiteId &&
          p.source.sourceWebsiteId === property.source.sourceWebsiteId &&
          p.source?.sourcePropertyId &&
          p.source.sourcePropertyId === property.source.sourcePropertyId
        ) {
          return true;
        }
        if (incomingUrl && p.source?.sourceUrl && normalizeSourceUrl(p.source.sourceUrl) === incomingUrl) {
          return true;
        }
      }
      return false;
    });
    const now = new Date().toISOString();

    const existingMatch = existingIndex >= 0 ? properties[existingIndex] : undefined;
    const cleanedAddr = sanitizeWordPressText(property.address);
    const addrValid = isValidPropertyAddress(cleanedAddr, { slug: property.slug, title: property.title });
    const existingValid = isValidPropertyAddress(existingMatch?.address, {
      slug: existingMatch?.slug,
      title: existingMatch?.title,
    });
    const safeAddress =
      existingMatch?.hasManualAddress && existingValid
        ? existingMatch.address
        : addrValid &&
          !(existingValid && isGenericFallbackAddress(cleanedAddr, existingMatch?.city) && !isGenericFallbackAddress(existingMatch?.address, existingMatch?.city))
        ? cleanedAddr
        : existingValid
        ? existingMatch!.address
        : `${property.city || 'Mohali'}, ${property.country || 'India'}`;

    const preparedProperty: Property = {
      ...property,
      id: existingIndex >= 0 ? properties[existingIndex].id : (property.id || `prop-${Date.now()}`),
      address: safeAddress,
      hasManualAddress: property.hasManualAddress ?? existingMatch?.hasManualAddress,
      createdAt: property.createdAt || existingMatch?.createdAt || now,
      updatedAt: now,
      slug: property.slug || this.generateSlug(property.title),
    };

    return { preparedProperty, existingIndex, properties };
  }

  saveProperty(property: Property): Property {
    const { preparedProperty, existingIndex, properties } = this.preparePropertyForSave(property);

    if (this.isBrowser()) {
      try {
        const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
        if (rawDel) {
          const delList: string[] = JSON.parse(rawDel);
          const nextDel = delList.filter(d => d !== preparedProperty.id);
          localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(nextDel));
        }
      } catch {}
    }

    if (existingIndex >= 0) {
      properties[existingIndex] = preparedProperty;
      this.apiPut(`/api/properties/${preparedProperty.id}`, preparedProperty);
    } else {
      properties.unshift(preparedProperty);
      this.apiPost('/api/properties', preparedProperty);
    }

    properties.sort((a, b) => this.getPropertyTimestamp(b) - this.getPropertyTimestamp(a));
    this.saveProperties(properties);
    return preparedProperty;
  }

  async savePropertyAsync(property: Property): Promise<Property> {
    if (!this.isBrowser()) {
      return this.saveProperty(property);
    }
    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to save properties.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const { preparedProperty, existingIndex, properties } = this.preparePropertyForSave(property);
    const isUpdate = existingIndex >= 0;
    const url = isUpdate ? `/api/properties/${encodeURIComponent(preparedProperty.id)}` : '/api/properties';

    const res = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify(preparedProperty),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to save property');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const persisted: Property = data?.property || preparedProperty;

    if (existingIndex >= 0) {
      properties[existingIndex] = persisted;
    } else {
      properties.unshift(persisted);
    }
    properties.sort((a, b) => this.getPropertyTimestamp(b) - this.getPropertyTimestamp(a));
    this.saveProperties(properties);

    try {
      const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
      if (rawDel) {
        const delList: string[] = JSON.parse(rawDel);
        localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(delList.filter(d => d !== persisted.id)));
      }
    } catch {}

    return persisted;
  }

  deleteProperty(id: string): boolean {
    const properties = this.getProperties();
    const filtered = properties.filter(p => p.id !== id);
    if (filtered.length !== properties.length) {
      if (this.isBrowser()) {
        try {
          const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
          const delList: string[] = rawDel ? JSON.parse(rawDel) : [];
          if (!delList.includes(id)) {
            delList.push(id);
            localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(delList));
          }
        } catch {}
      }
      this.saveProperties(filtered);
      this.apiDelete(`/api/properties/${id}`);
      return true;
    }
    return false;
  }

  async deletePropertyAsync(id: string): Promise<boolean> {
    if (!this.isBrowser()) {
      return this.deleteProperty(id);
    }
    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to delete properties.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(false),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to delete property');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const properties = this.getProperties();
    const filtered = properties.filter(p => p.id !== id);
    this.saveProperties(filtered);
    try {
      const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
      if (rawDel) {
        const delList: string[] = JSON.parse(rawDel);
        localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(delList.filter(d => d !== id)));
      }
    } catch {}
    return true;
  }

  togglePublishProperty(id: string): Property | undefined {
    const properties = this.getProperties();
    const property = properties.find(p => p.id === id);
    if (!property) return undefined;

    property.status = property.status === 'Published' ? 'Draft' : 'Published';
    property.updatedAt = new Date().toISOString();
    this.saveProperties(properties);
    this.apiPatch(`/api/properties/${id}/toggle-publish`);
    return property;
  }

  async togglePublishPropertyAsync(id: string): Promise<Property> {
    if (!this.isBrowser()) {
      const res = this.togglePublishProperty(id);
      if (!res) throw new Error('Property not found');
      return res;
    }
    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to update property status.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/properties/${encodeURIComponent(id)}/toggle-publish`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(false),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to toggle publication status');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const updated: Property | undefined = data?.property;
    const properties = this.getProperties();
    const idx = properties.findIndex(p => p.id === id);
    if (idx >= 0) {
      if (updated) {
        properties[idx] = updated;
      } else {
        properties[idx].status = properties[idx].status === 'Published' ? 'Draft' : 'Published';
        properties[idx].updatedAt = new Date().toISOString();
      }
      this.saveProperties(properties);
      return properties[idx];
    }
    if (updated) {
      this.upsertLocalProperties([updated]);
      return updated;
    }
    throw new Error('Property not found');
  }

  toggleFeaturedProperty(id: string): Property | undefined {
    const properties = this.getProperties();
    const property = properties.find(p => p.id === id);
    if (!property) return undefined;

    property.featured = !property.featured;
    property.updatedAt = new Date().toISOString();
    this.saveProperties(properties);
    this.apiPatch(`/api/properties/${id}/toggle-featured`);
    return property;
  }

  toggleLatestProperty(id: string): Property | undefined {
    const properties = this.getProperties();
    const property = properties.find(p => p.id === id);
    if (!property) return undefined;

    property.isLatestAdded = !property.isLatestAdded;
    property.updatedAt = new Date().toISOString();
    this.saveProperties(properties);
    this.apiPatch(`/api/properties/${id}/toggle-latest`);
    return property;
  }

  toggleTrophyProperty(id: string): Property | undefined {
    const properties = this.getProperties();
    const property = properties.find(p => p.id === id);
    if (!property) return undefined;

    property.isTrophyHolding = !property.isTrophyHolding;
    property.updatedAt = new Date().toISOString();
    this.saveProperties(properties);
    this.apiPatch(`/api/properties/${id}/toggle-trophy`);
    return property;
  }

  setManualMainImage(id: string, url: string, caption?: string): Property | undefined {
    const properties = this.getProperties();
    const index = properties.findIndex(p => p.id === id);
    if (index === -1 || !url?.trim()) return undefined;

    const cleanUrl = url.trim();
    const existing = properties[index];
    const remaining = (existing.images || [])
      .filter(img => img.url !== cleanUrl)
      .map(img => ({ ...img, isPrimary: false }));

    const manualCover = {
      id: `img-custom-${Date.now()}`,
      url: cleanUrl,
      caption: caption || `${existing.title} - Primary Cover`,
      isPrimary: true,
      origin: 'manual' as const,
      isManual: true,
      isLogoFallback: false,
    };

    const updated: Property = {
      ...existing,
      images: [manualCover, ...remaining],
      hasManualMainImage: true,
      updatedAt: new Date().toISOString(),
    };

    properties[index] = updated;
    this.saveProperties(properties);

    if (this.isBrowser() && this.getAdminToken()) {
      fetch(`/api/properties/${id}/main-image`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify({ url: cleanUrl, caption: manualCover.caption }),
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) {
            this.handleUnauthorizedResponse(res);
            const errMsg = await this.readErrorMessage(res, 'Failed to update main image');
            this.emitApiError(errMsg, res.status);
          }
        })
        .catch(() => {});
    }

    return updated;
  }

  // --- Trophy Holdings of the Season ---
  getTrophyHoldings(): Property[] {
    if (this.memoryTrophyHoldings && this.memoryTrophyHoldings.length > 0) {
      return this.memoryTrophyHoldings.filter(p => p.status === 'Published');
    }
    const all = this.getProperties().filter(p => p.status === 'Published');
    const trophies = all
      .filter(p => p.isTrophyHolding)
      .sort((a, b) => (a.trophyOrder || 99) - (b.trophyOrder || 99));

    if (trophies.length > 0) return trophies;
    return all.filter(p => p.featured).slice(0, 3);
  }

  async updateTrophyHoldings(propertyIds: string[]): Promise<Property[]> {
    const previousProperties = this.getProperties().map(p => ({ ...p }));
    const previousTrophyMemory = this.memoryTrophyHoldings ? [...this.memoryTrophyHoldings] : null;

    const all = this.getProperties();
    all.forEach(p => {
      const idx = propertyIds.indexOf(p.id);
      if (idx !== -1) {
        p.isTrophyHolding = true;
        p.trophyOrder = idx + 1;
      } else {
        p.isTrophyHolding = false;
        p.trophyOrder = 99;
      }
    });

    if (this.isBrowser()) {
      const token = this.getAdminToken();
      if (!token) {
        const msg = 'Administrator session is required to update Trophy Holdings.';
        this.emitAuthExpired(msg);
        throw new Error(msg);
      }

      const res = await fetch('/api/trophy-holdings', {
        method: 'PUT',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify({ propertyIds }),
      });

      if (!res.ok) {
        this.handleUnauthorizedResponse(res);
        this.memoryTrophyHoldings = previousTrophyMemory;
        this.saveProperties(previousProperties);
        const errMsg = await this.readErrorMessage(res, 'Failed to update Trophy Holdings');
        this.emitApiError(errMsg, res.status);
        throw new Error(errMsg);
      }

      const data = await res.json().catch(() => null);
      this.memoryTrophyHoldings = null;
      this.saveProperties(all);
      if (Array.isArray(data?.items)) {
        this.memoryTrophyHoldings = data.items;
      }
      return this.getTrophyHoldings();
    }

    this.memoryTrophyHoldings = null;
    this.saveProperties(all);
    return this.getTrophyHoldings();
  }

  // --- Curated Investment Collections ---
  private memoryCollections: CuratedCollection[] = [...INITIAL_COLLECTIONS];

  getCollections(includeDrafts = true): CuratedCollection[] {
    let list: CuratedCollection[];
    if (!this.isBrowser()) {
      list = [...this.memoryCollections];
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
        if (!raw) {
          list = [...INITIAL_COLLECTIONS];
          localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(list));
        } else {
          list = JSON.parse(raw);
        }
      } catch {
        list = [...INITIAL_COLLECTIONS];
      }
    }

    if (!includeDrafts) {
      list = list.filter(c => c.status === 'Published');
    }
    return list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  saveCollections(collections: CuratedCollection[]): void {
    this.memoryCollections = collections;
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
    }
  }

  getCollectionBySlug(slug: string): (CuratedCollection & { properties: Property[] }) | undefined {
    const collections = this.getCollections(true);
    const col = collections.find(c => c.slug === slug || c.id === slug);
    if (!col) return undefined;

    const allProps = this.getProperties();
    const propMap = new Map(allProps.map(p => [p.id, p]));
    const properties = col.propertyIds
      .map(id => propMap.get(id))
      .filter((p): p is Property => p !== undefined && p.status === 'Published');

    return {
      ...col,
      properties,
    };
  }

  saveCollection(collection: CuratedCollection): CuratedCollection {
    const collections = this.getCollections(true);
    const existingIndex = collections.findIndex(c => c.id === collection.id);
    const now = new Date().toISOString();

    const prepared: CuratedCollection = {
      ...collection,
      slug: collection.slug || this.generateSlug(collection.title),
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      collections[existingIndex] = prepared;
      this.apiPut(`/api/collections/${prepared.id}`, prepared);
    } else {
      prepared.id = prepared.id || `col-${Date.now()}`;
      prepared.createdAt = now;
      collections.push(prepared);
      this.apiPost('/api/collections', prepared);
    }

    this.saveCollections(collections);
    return prepared;
  }

  async saveCollectionAsync(collection: CuratedCollection): Promise<CuratedCollection> {
    if (!this.isBrowser()) {
      return this.saveCollection(collection);
    }
    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to save collections.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const collections = this.getCollections(true);
    const existingIndex = collections.findIndex(c => c.id === collection.id);
    const now = new Date().toISOString();
    const prepared: CuratedCollection = {
      ...collection,
      id: collection.id || `col-${Date.now()}`,
      slug: collection.slug || this.generateSlug(collection.title),
      createdAt: collection.createdAt || now,
      updatedAt: now,
    };

    const isUpdate = existingIndex >= 0;
    const url = isUpdate ? `/api/collections/${encodeURIComponent(prepared.id)}` : '/api/collections';
    const res = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify(prepared),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to save curated collection');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const persisted: CuratedCollection = data?.collection || prepared;
    if (existingIndex >= 0) {
      collections[existingIndex] = persisted;
    } else {
      collections.push(persisted);
    }
    this.saveCollections(collections);
    return persisted;
  }

  deleteCollection(id: string): boolean {
    const collections = this.getCollections(true);
    const filtered = collections.filter(c => c.id !== id);
    if (filtered.length !== collections.length) {
      this.saveCollections(filtered);
      this.apiDelete(`/api/collections/${id}`);
      return true;
    }
    return false;
  }

  async deleteCollectionAsync(id: string): Promise<boolean> {
    if (!this.isBrowser()) {
      return this.deleteCollection(id);
    }
    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to delete collections.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(false),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to delete curated collection');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const collections = this.getCollections(true);
    this.saveCollections(collections.filter(c => c.id !== id));
    return true;
  }

  addPropertyToCollection(collectionId: string, propertyId: string): boolean {
    const collections = this.getCollections(true);
    const col = collections.find(c => c.id === collectionId);
    if (!col) return false;
    if (!col.propertyIds.includes(propertyId)) {
      col.propertyIds.push(propertyId);
      col.updatedAt = new Date().toISOString();
      this.saveCollections(collections);
      this.apiPost(`/api/collections/${collectionId}/properties`, { propertyId });
    }
    return true;
  }

  removePropertyFromCollection(collectionId: string, propertyId: string): boolean {
    const collections = this.getCollections(true);
    const col = collections.find(c => c.id === collectionId);
    if (!col) return false;
    col.propertyIds = col.propertyIds.filter(id => id !== propertyId);
    col.updatedAt = new Date().toISOString();
    this.saveCollections(collections);
    this.apiDelete(`/api/collections/${collectionId}/properties/${propertyId}`);
    return true;
  }

  reorderCollectionProperties(collectionId: string, propertyIds: string[]): boolean {
    const collections = this.getCollections(true);
    const col = collections.find(c => c.id === collectionId);
    if (!col) return false;
    col.propertyIds = propertyIds;
    col.updatedAt = new Date().toISOString();
    this.saveCollections(collections);
    this.apiPut(`/api/collections/${collectionId}/reorder`, { propertyIds });
    return true;
  }

  // --- Location Management ---
  getLocations(activeOnly = false): ManagedLocation[] {
    let list: ManagedLocation[];
    if (!this.isBrowser()) {
      list = [...this.memoryLocations];
    } else {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
        if (!data) {
          list = [...INITIAL_LOCATIONS];
          localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(list));
        } else {
          list = JSON.parse(data);
        }
      } catch {
        list = [...this.memoryLocations];
      }
    }

    // Attach dynamic published property counts
    const publishedProps = this.getProperties().filter(p => p.status === 'Published');
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

    // Background sync from backend
    if (this.isBrowser()) {
      fetch('/api/locations')
        .then(res => res.json())
        .then((serverLocations: ManagedLocation[]) => {
          if (Array.isArray(serverLocations) && serverLocations.length > 0) {
            localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(serverLocations));
            this.memoryLocations = serverLocations;
          }
        })
        .catch(() => {});
    }

    if (activeOnly) {
      return withCounts.filter(l => l.isActive).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name));
    }

    return withCounts.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name));
  }

  saveLocations(locations: ManagedLocation[]): void {
    this.memoryLocations = locations;
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(locations));
    }
  }

  getLocationById(id: string): ManagedLocation | undefined {
    return this.getLocations(false).find(l => l.id === id);
  }

  getLocationBySlug(slug: string): ManagedLocation | undefined {
    return this.getLocations(false).find(l => l.slug === slug || l.id === slug);
  }

  saveLocation(location: ManagedLocation): ManagedLocation {
    const locations = this.getLocations(false);
    const existingIndex = locations.findIndex(l => l.id === location.id);
    const now = new Date().toISOString();

    const prepared: ManagedLocation = {
      ...location,
      slug: location.slug || this.generateSlug(location.name),
      updatedAt: now,
      createdAt: location.createdAt || now,
      aliases: Array.isArray(location.aliases) 
        ? location.aliases.map(a => a.trim().toLowerCase()).filter(Boolean)
        : [],
    };

    if (existingIndex >= 0) {
      locations[existingIndex] = prepared;
      this.apiPut(`/api/locations/${prepared.id}`, prepared);
    } else {
      prepared.id = prepared.id || `loc-${Date.now()}`;
      locations.push(prepared);
      this.apiPost('/api/locations', prepared);
    }

    this.saveLocations(locations);
    return prepared;
  }

  async saveLocationAsync(location: ManagedLocation): Promise<ManagedLocation> {
    if (!this.isBrowser()) {
      return this.saveLocation(location);
    }
    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to save locations.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const locations = this.getLocations(false);
    const existingIndex = locations.findIndex(l => l.id === location.id);
    const now = new Date().toISOString();
    const prepared: ManagedLocation = {
      ...location,
      id: location.id || `loc-${Date.now()}`,
      slug: location.slug || this.generateSlug(location.name),
      updatedAt: now,
      createdAt: location.createdAt || now,
      aliases: Array.isArray(location.aliases)
        ? location.aliases.map(a => a.trim().toLowerCase()).filter(Boolean)
        : [],
    };

    const isUpdate = existingIndex >= 0;
    const url = isUpdate ? `/api/locations/${encodeURIComponent(prepared.id)}` : '/api/locations';
    const res = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify(prepared),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to save location');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const persisted: ManagedLocation = data?.location || prepared;
    if (existingIndex >= 0) {
      locations[existingIndex] = persisted;
    } else {
      locations.push(persisted);
    }
    this.saveLocations(locations);
    return persisted;
  }

  deleteLocation(id: string): boolean {
    const locations = this.getLocations(false);
    const filtered = locations.filter(l => l.id !== id);
    if (filtered.length !== locations.length) {
      this.saveLocations(filtered);
      this.apiDelete(`/api/locations/${id}`);
      return true;
    }
    return false;
  }

  async deleteLocationAsync(id: string): Promise<boolean> {
    if (!this.isBrowser()) {
      return this.deleteLocation(id);
    }
    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to delete locations.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/locations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(false),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to delete location');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const locations = this.getLocations(false);
    this.saveLocations(locations.filter(l => l.id !== id));
    return true;
  }

  findMatchingLocation(query?: string, address?: string, locality?: string): ManagedLocation | null {
    if (!query && !address && !locality) return null;
    const locations = this.getLocations(false);
    const textToSearch = [query, locality, address].filter(Boolean).join(' ').toLowerCase();

    // 1. Exact name or slug match
    if (query) {
      const qLower = query.toLowerCase().trim();
      const exact = locations.find(l => l.name.toLowerCase() === qLower || l.slug === qLower);
      if (exact) return exact;
    }

    // 2. Whole word in text
    for (const loc of locations) {
      const locNameLower = loc.name.toLowerCase();
      const regex = new RegExp(`\\b${locNameLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(textToSearch)) {
        return loc;
      }
    }

    // 3. Aliases
    for (const loc of locations) {
      if (loc.aliases && Array.isArray(loc.aliases)) {
        for (const alias of loc.aliases) {
          const aliasLower = alias.trim().toLowerCase();
          if (!aliasLower) continue;
          const regex = new RegExp(`\\b${aliasLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
          if (regex.test(textToSearch)) {
            return loc;
          }
        }
      }
    }

    return null;
  }

  // --- Editorial Blog & Journal CRUD ---
  getBlogs(includeDrafts = true): BlogPost[] {
    let list: BlogPost[];
    if (!this.isBrowser()) {
      list = [...this.memoryBlogs];
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.BLOGS);
        list = raw ? JSON.parse(raw) : [...this.memoryBlogs];
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [...this.memoryBlogs];
      }
    }

    if (!includeDrafts) {
      list = list.filter((b) => b.status === 'Published');
    }

    return [...list].sort((a, b) => {
      const tA = new Date(a.publishedAt || a.createdAt).getTime() || 0;
      const tB = new Date(b.publishedAt || b.createdAt).getTime() || 0;
      return tB - tA;
    });
  }

  saveBlogs(blogs: BlogPost[]): void {
    this.memoryBlogs = blogs;
    if (this.isBrowser()) {
      try {
        localStorage.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(blogs));
      } catch {}
    }
  }

  getBlogBySlug(slug: string): BlogPost | undefined {
    const clean = decodeURIComponent(String(slug || '')).trim().toLowerCase();
    return this.getBlogs(true).find(
      (b) => b.slug.toLowerCase() === clean || b.id === slug
    );
  }

  async saveBlogAsync(
    blog: Partial<BlogPost> & { title: string; content: string }
  ): Promise<BlogPost> {
    if (!this.isBrowser()) {
      const now = new Date().toISOString();
      const post: BlogPost = {
        id: blog.id || `blog-${Date.now()}`,
        slug: blog.slug || this.generateSlug(blog.title),
        title: blog.title,
        excerpt: blog.excerpt || blog.content.slice(0, 180),
        content: blog.content,
        category: blog.category || 'Market Intelligence',
        tags: blog.tags || [],
        featuredImage: blog.featuredImage || '',
        featuredImageAlt: blog.featuredImageAlt || blog.title,
        authorName: blog.authorName || 'BUILDsmore Editorial Desk',
        authorRole: blog.authorRole || 'Private Real Estate Advisory',
        status: blog.status === 'Published' ? 'Published' : 'Draft',
        featured: Boolean(blog.featured),
        readTimeMinutes: blog.readTimeMinutes || 1,
        seo: blog.seo || { metaTitle: `${blog.title} – BUILDsmore Journal`, metaDescription: blog.excerpt || '', keywords: blog.tags || [] },
        publishedAt: blog.status === 'Published' ? blog.publishedAt || now : blog.publishedAt,
        createdAt: blog.createdAt || now,
        updatedAt: now,
      };
      const existing = this.getBlogs(true);
      const idx = existing.findIndex((b) => b.id === post.id);
      if (idx >= 0) existing[idx] = post;
      else existing.unshift(post);
      this.saveBlogs(existing);
      return post;
    }

    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to save blog articles.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const isUpdate = Boolean(blog.id);
    const url = isUpdate ? `/api/blogs/${encodeURIComponent(blog.id!)}` : '/api/blogs';
    const res = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify(blog),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to save blog article');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const persisted: BlogPost | undefined = data?.blog || (data?.id ? data : undefined);
    if (!persisted) {
      throw new Error('Unexpected response while saving blog article.');
    }

    const current = this.getBlogs(true);
    const idx = current.findIndex((b) => b.id === persisted.id);
    if (idx >= 0) {
      current[idx] = persisted;
    } else {
      current.unshift(persisted);
    }
    this.saveBlogs(current);
    return persisted;
  }

  async togglePublishBlogAsync(id: string): Promise<BlogPost> {
    if (!this.isBrowser()) {
      const current = this.getBlogs(true);
      const idx = current.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error('Blog article not found');
      const nextStatus = current[idx].status === 'Published' ? 'Draft' : 'Published';
      current[idx] = {
        ...current[idx],
        status: nextStatus,
        publishedAt: nextStatus === 'Published' ? current[idx].publishedAt || new Date().toISOString() : current[idx].publishedAt,
        updatedAt: new Date().toISOString(),
      };
      this.saveBlogs(current);
      return current[idx];
    }

    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to update blog publication status.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/blogs/${encodeURIComponent(id)}/toggle-publish`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(false),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to update article status');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const updated: BlogPost | undefined = data?.blog || (data?.id ? data : undefined);
    if (!updated) throw new Error('Blog article not found');

    const current = this.getBlogs(true);
    const idx = current.findIndex((b) => b.id === id);
    if (idx >= 0) {
      current[idx] = updated;
    } else {
      current.unshift(updated);
    }
    this.saveBlogs(current);
    return updated;
  }

  async deleteBlogAsync(id: string): Promise<boolean> {
    if (!this.isBrowser()) {
      const current = this.getBlogs(true);
      this.saveBlogs(current.filter((b) => b.id !== id));
      return true;
    }

    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to delete blog articles.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/blogs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(false),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to delete blog article');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const current = this.getBlogs(true);
    this.saveBlogs(current.filter((b) => b.id !== id));
    return true;
  }

  // --- Homepage Hero Banner Slides CRUD & Reordering ---
  getHeroSlides(): HeroSlide[] {
    let list: HeroSlide[];
    if (!this.isBrowser()) {
      list = [...this.memoryHeroSlides];
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.HERO_SLIDES);
        list = raw ? JSON.parse(raw) : [...this.memoryHeroSlides];
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [...this.memoryHeroSlides];
      }
    }

    return [...list].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0);
    });
  }

  saveHeroSlides(slides: HeroSlide[]): void {
    this.memoryHeroSlides = slides;
    if (this.isBrowser()) {
      try {
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(slides));
      } catch {}
    }
  }

  async saveHeroSlideAsync(slide: {
    id?: string;
    imageUrl: string;
    heading: string;
    description: string;
  }): Promise<HeroSlide> {
    if (!this.isBrowser()) {
      const now = new Date().toISOString();
      const existing = this.getHeroSlides();
      const record: HeroSlide = {
        id: slide.id || `hero-slide-${Date.now()}`,
        imageUrl: slide.imageUrl.trim(),
        heading: slide.heading.trim(),
        description: slide.description.trim(),
        displayOrder: existing.length,
        createdAt: now,
        updatedAt: now,
      };
      const idx = existing.findIndex((s) => s.id === record.id);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...record, displayOrder: existing[idx].displayOrder };
      } else {
        existing.push(record);
      }
      this.saveHeroSlides(existing);
      return record;
    }

    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to manage hero banner slides.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const isUpdate = Boolean(slide.id);
    const url = isUpdate ? `/api/hero-slides/${encodeURIComponent(slide.id!)}` : '/api/hero-slides';
    const res = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({
        imageUrl: slide.imageUrl,
        heading: slide.heading,
        description: slide.description,
      }),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to save hero banner slide');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    if (Array.isArray(data?.items)) {
      this.saveHeroSlides(data.items);
    }
    const persisted: HeroSlide | undefined = data?.slide;
    if (!persisted) {
      throw new Error('Unexpected response while saving hero banner slide.');
    }
    return persisted;
  }

  async deleteHeroSlideAsync(id: string): Promise<HeroSlide[]> {
    if (!this.isBrowser()) {
      const remaining = this.getHeroSlides()
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, displayOrder: idx }));
      this.saveHeroSlides(remaining);
      return remaining;
    }

    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to delete hero banner slides.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/hero-slides/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(false),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to delete hero banner slide');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const remaining: HeroSlide[] = Array.isArray(data?.items)
      ? data.items
      : this.getHeroSlides().filter((s) => s.id !== id);
    this.saveHeroSlides(remaining);
    return remaining;
  }

  async reorderHeroSlidesAsync(orderedIds: string[]): Promise<HeroSlide[]> {
    if (!this.isBrowser()) {
      const map = new Map(this.getHeroSlides().map((s) => [s.id, s]));
      const reordered = orderedIds
        .map((id) => map.get(id))
        .filter((s): s is HeroSlide => Boolean(s))
        .map((s, idx) => ({ ...s, displayOrder: idx }));
      this.saveHeroSlides(reordered);
      return reordered;
    }

    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to reorder hero banner slides.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch('/api/hero-slides/reorder', {
      method: 'PUT',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({ orderedIds }),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to reorder hero banner slides');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const reordered: HeroSlide[] = Array.isArray(data?.items) ? data.items : this.getHeroSlides();
    this.saveHeroSlides(reordered);
    return reordered;
  }

  // --- Photo Upload Helper ---
  async uploadPhoto(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: this.getAuthHeaders(false),
      body: formData,
    });
    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, `Upload failed: ${res.statusText}`);
      throw new Error(errMsg);
    }
    const data = await res.json();
    return data.url;
  }

  async uploadMultiplePhotos(files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach(f => formData.append('photos', f));
    const res = await fetch('/api/upload-multiple', {
      method: 'POST',
      headers: this.getAuthHeaders(false),
      body: formData,
    });
    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, `Batch upload failed: ${res.statusText}`);
      throw new Error(errMsg);
    }
    const data = await res.json();
    return (data.uploaded || []).map((u: any) => u.url);
  }

  private apiPost(url: string, body: unknown) {
    if (this.isBrowser() && this.getAdminToken()) {
      fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify(body),
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) {
            this.handleUnauthorizedResponse(res);
            this.emitApiError(await this.readErrorMessage(res, 'Failed to sync created record'), res.status);
          }
        })
        .catch(() => {});
    }
  }

  private apiPut(url: string, body: unknown) {
    if (this.isBrowser() && this.getAdminToken()) {
      fetch(url, {
        method: 'PUT',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify(body),
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) {
            this.handleUnauthorizedResponse(res);
            this.emitApiError(await this.readErrorMessage(res, 'Failed to sync updated record'), res.status);
          }
        })
        .catch(() => {});
    }
  }

  private apiPatch(url: string) {
    if (this.isBrowser() && this.getAdminToken()) {
      fetch(url, {
        method: 'PATCH',
        headers: this.getAuthHeaders(false),
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) {
            this.handleUnauthorizedResponse(res);
            this.emitApiError(await this.readErrorMessage(res, 'Failed to update record'), res.status);
          }
        })
        .catch(() => {});
    }
  }

  private apiDelete(url: string) {
    if (this.isBrowser() && this.getAdminToken()) {
      fetch(url, {
        method: 'DELETE',
        headers: this.getAuthHeaders(false),
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) {
            this.handleUnauthorizedResponse(res);
            this.emitApiError(await this.readErrorMessage(res, 'Failed to delete record'), res.status);
          }
        })
        .catch(() => {});
    }
  }

  // --- WordPress Sources ---
  getWordPressSources(): WordPressSource[] {
    if (!this.isBrowser()) return INITIAL_WORDPRESS_SOURCES;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORDPRESS_SOURCES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.WORDPRESS_SOURCES, JSON.stringify(INITIAL_WORDPRESS_SOURCES));
        return INITIAL_WORDPRESS_SOURCES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_WORDPRESS_SOURCES;
    }
  }

  saveWordPressSources(sources: WordPressSource[]): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.WORDPRESS_SOURCES, JSON.stringify(sources));
  }

  saveWordPressSource(source: WordPressSource): WordPressSource {
    const sources = this.getWordPressSources();
    const index = sources.findIndex(s => s.id === source.id);
    if (index >= 0) {
      sources[index] = source;
    } else {
      source.id = source.id || `wp-src-${Date.now()}`;
      sources.push(source);
    }
    this.saveWordPressSources(sources);
    return source;
  }

  deleteWordPressSource(id: string): boolean {
    const sources = this.getWordPressSources();
    const filtered = sources.filter(s => s.id !== id);
    if (filtered.length !== sources.length) {
      this.saveWordPressSources(filtered);
      return true;
    }
    return false;
  }

  // --- Inquiries ---
  getInquiries(): Inquiry[] {
    if (!this.isBrowser()) return INITIAL_INQUIRIES;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INQUIRIES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(INITIAL_INQUIRIES));
        return INITIAL_INQUIRIES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_INQUIRIES;
    }
  }

  saveInquiries(inquiries: Inquiry[]): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(inquiries));
  }

  createInquiry(inquiry: Omit<Inquiry, 'id' | 'createdAt' | 'status' | 'notes'>): Inquiry {
    const inquiries = this.getInquiries();
    const newInquiry: Inquiry = {
      ...inquiry,
      id: `inq-${Date.now()}`,
      status: 'New',
      notes: '',
      createdAt: new Date().toISOString(),
      assignedAdvisor: 'Marcus Vance',
    };
    inquiries.unshift(newInquiry);
    this.saveInquiries(inquiries);
    return newInquiry;
  }

  updateInquiry(id: string, updates: Partial<Inquiry>): Inquiry | undefined {
    const inquiries = this.getInquiries();
    const index = inquiries.findIndex(i => i.id === id);
    if (index === -1) return undefined;
    inquiries[index] = { ...inquiries[index], ...updates };
    this.saveInquiries(inquiries);
    return inquiries[index];
  }

  deleteInquiry(id: string): boolean {
    const inquiries = this.getInquiries();
    const filtered = inquiries.filter(i => i.id !== id);
    if (filtered.length !== inquiries.length) {
      this.saveInquiries(filtered);
      return true;
    }
    return false;
  }

  // --- Import Jobs ---
  getImportJobs(): ImportJob[] {
    if (!this.isBrowser()) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.IMPORT_JOBS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveImportJob(job: ImportJob): void {
    if (!this.isBrowser()) return;
    const jobs = this.getImportJobs();
    const index = jobs.findIndex(j => j.id === job.id);
    if (index >= 0) {
      jobs[index] = job;
    } else {
      jobs.unshift(job);
    }
    // Keep last 30 jobs
    localStorage.setItem(STORAGE_KEYS.IMPORT_JOBS, JSON.stringify(jobs.slice(0, 30)));
  }

  // --- Dashboard Stats ---
  getDashboardStats(): DashboardStats {
    const properties = this.getProperties();
    const inquiries = this.getInquiries();
    const sources = this.getWordPressSources();

    const publishedProperties = properties.filter(p => p.status === 'Published').length;
    const draftProperties = properties.filter(p => p.status === 'Draft').length;
    const importedProperties = properties.filter(p => p.source.type === 'wordpress').length;
    const newInquiriesCount = inquiries.filter(i => i.status === 'New').length;

    // Aggregate total portfolio valuation in INR
    const ratesToINR: Record<string, number> = { INR: 1.0, USD: 86.5, EUR: 94.0, GBP: 110.5, AED: 23.55 };
    const portfolioValueINR = properties.reduce((sum, p) => {
      const rate = ratesToINR[p.currency] || 1.0;
      return sum + (p.price * rate);
    }, 0);

    return {
      totalProperties: properties.length,
      publishedProperties,
      draftProperties,
      importedProperties,
      totalInquiries: inquiries.length,
      newInquiriesCount,
      portfolioValueINR: Math.round(portfolioValueINR),
      portfolioValueUSD: Math.round(portfolioValueINR / 86.5),
      connectedWordpressSites: sources.filter(s => s.status === 'Active').length,
    };
  }

  async fetchInquiriesFromServer(): Promise<Inquiry[]> {
    const local = this.getInquiries();
    if (!this.isBrowser()) return local;

    const token = this.getAdminToken();
    if (!token) return local;

    const res = await fetch('/api/inquiries', {
      headers: this.getAuthHeaders(false),
    });
    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to fetch client inquiries');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const rawList = Array.isArray(data?.inquiries) ? data.inquiries : [];

    const normalized: Inquiry[] = rawList.map((row: any) => ({
      id: String(row.id || `inq-${Date.now()}`),
      propertyId: row.propertyId || row.property_id || undefined,
      propertyTitle: row.propertyTitle || row.property_title || undefined,
      propertySlug: row.propertySlug || row.property_slug || undefined,
      clientName: String(row.clientName || row.client_name || 'Client Inquiry'),
      email: String(row.email || 'Not provided'),
      phone: String(row.phone || ''),
      preferredContactMethod: (row.preferredContactMethod || row.preferred_contact_method || 'phone') as 'email' | 'phone' | 'whatsapp',
      investmentBudget: row.budgetRange || row.investmentBudget || row.investment_budget || undefined,
      scheduledTourDate: row.scheduledTourDate || row.scheduled_tour_date || undefined,
      message: String(row.message || ''),
      status: (row.status || 'New') as Inquiry['status'],
      notes: String(row.notes || ''),
      createdAt: String(row.createdAt || row.created_at || new Date().toISOString()),
      assignedAdvisor: row.assignedAdvisor || row.assigned_advisor || 'Marcus Vance',
    }));

    const merged = normalized.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    this.saveInquiries(merged);
    return merged;
  }

  async updateInquiryAsync(id: string, updates: Partial<Inquiry>): Promise<Inquiry> {
    if (!this.isBrowser()) {
      const updated = this.updateInquiry(id, updates);
      if (!updated) throw new Error('Inquiry not found');
      return updated;
    }

    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to update inquiries.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({
        status: updates.status,
        notes: updates.notes,
        assignedAdvisor: updates.assignedAdvisor,
      }),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to update inquiry');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    const data = await res.json().catch(() => null);
    const serverRow = data?.inquiry;
    const inquiries = this.getInquiries();
    const index = inquiries.findIndex(i => i.id === id);

    if (serverRow) {
      const updated: Inquiry = {
        ...(index >= 0 ? inquiries[index] : ({} as Inquiry)),
        ...updates,
        id: String(serverRow.id || id),
        status: (serverRow.status || updates.status || 'New') as Inquiry['status'],
        notes: String(serverRow.notes ?? updates.notes ?? ''),
        assignedAdvisor: serverRow.assignedAdvisor || updates.assignedAdvisor || 'Marcus Vance',
      };
      if (index >= 0) {
        inquiries[index] = updated;
      } else {
        inquiries.unshift(updated);
      }
      this.saveInquiries(inquiries);
      return updated;
    }

    const localUpdated = this.updateInquiry(id, updates);
    if (!localUpdated) throw new Error('Inquiry not found');
    return localUpdated;
  }

  async deleteInquiryAsync(id: string): Promise<boolean> {
    if (!this.isBrowser()) {
      return this.deleteInquiry(id);
    }

    const token = this.getAdminToken();
    if (!token) {
      const msg = 'Administrator session is required to delete inquiries.';
      this.emitAuthExpired(msg);
      throw new Error(msg);
    }

    const res = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(false),
    });

    if (!res.ok) {
      this.handleUnauthorizedResponse(res);
      const errMsg = await this.readErrorMessage(res, 'Failed to delete inquiry');
      this.emitApiError(errMsg, res.status);
      throw new Error(errMsg);
    }

    this.deleteInquiry(id);
    return true;
  }

  private memoryAdmin: AdminUser | null = null;
  private memoryAdminToken: string | null = null;

  getAdminToken(): string | null {
    if (!this.isBrowser()) return this.memoryAdminToken;
    try {
      if (typeof sessionStorage === 'undefined') return null;
      return sessionStorage.getItem(STORAGE_KEYS.ADMIN_JWT);
    } catch {
      return null;
    }
  }

  getAuthHeaders(includeJsonContentType = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    const token = this.getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  setAuthenticatedAdmin(user: AdminUser, token: string): void {
    this.memoryAdmin = user;
    this.memoryAdminToken = token;

    if (this.isBrowser() && typeof sessionStorage !== 'undefined') {
      const sessionPayload = {
        user,
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        loginAt: new Date().toISOString(),
      };
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(sessionPayload));
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_JWT, token);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
      }
    }
  }

  // --- Admin Auth (Secure Server-Issued JWT Session Scoped) ---
  getCurrentAdmin(): AdminUser | null {
    if (!this.isBrowser()) return this.memoryAdmin;
    try {
      // Clear legacy localStorage admin session so sessions do not persist across browser restarts
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
      }

      // Require both session profile and server-issued JWT in sessionStorage
      const sessionStr = sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION);
      const token = sessionStorage.getItem(STORAGE_KEYS.ADMIN_JWT);
      if (!sessionStr || !token) {
        sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
        sessionStorage.removeItem(STORAGE_KEYS.ADMIN_JWT);
        return null;
      }

      const parsed = JSON.parse(sessionStr);
      if (!parsed) return null;

      // Extract user object
      const user: AdminUser = parsed.user || parsed;
      if (!user || !user.email) {
        sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
        sessionStorage.removeItem(STORAGE_KEYS.ADMIN_JWT);
        return null;
      }

      return user;
    } catch {
      return null;
    }
  }

  loginAdmin(_usernameOrEmail: string, _pass: string): { success: boolean; user?: AdminUser; error?: string } {
    return {
      success: false,
      error: 'Direct client-side credential verification is disabled. Sign in via /api/auth/login server database authentication.',
    };
  }

  logoutAdmin(): void {
    if (this.isBrowser()) {
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_JWT);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    }
    this.memoryAdmin = null;
    this.memoryAdminToken = null;
  }

  // Helper
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || `property-${Date.now()}`;
  }

  // Reset to factory seed
  resetToInitial(): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(INITIAL_PROPERTIES));
    localStorage.setItem(STORAGE_KEYS.WORDPRESS_SOURCES, JSON.stringify(INITIAL_WORDPRESS_SOURCES));
    localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(INITIAL_INQUIRIES));
  }
}

export const storage = new StorageService();
