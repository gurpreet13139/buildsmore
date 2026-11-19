/**
 * BUILDsmore — WordPress Property Import & REST API Integration Service
 * Inspects WordPress endpoints, handles ACF/custom fields, field mapping,
 * duplicate detection, image media resolution, and safe synchronization.
 */

import { propertyRepository, PropertyRepository } from './propertyRepository';
import { Property, PropertyCategory, PropertyType, PropertyImage } from '../types/property';
import {
  extractSourceWebsiteId,
  computeWebsiteHash,
  computeWordPressPropertyId,
  normalizeSourceUrl,
} from '../utils/sourceIdentity';
import {
  isSafeDisplayImageUrl,
  isValidPropertyAddress,
  looksLikeBrandLogoUrl,
  looksLikeRawMarkupOrCss,
  sanitizeWordPressText,
} from '../utils/propertyImages';

export interface WordPressEndpointDiscovery {
  siteUrl: string;
  isWordPress: boolean;
  restAvailable: boolean;
  detectedEndpoints: Array<{
    name: string;
    endpoint: string;
    count?: number;
  }>;
  samplePost?: Record<string, unknown>;
  availableFields?: string[];
  message: string;
}

export interface FieldMappingConfig {
  titleField?: string;
  descriptionField?: string;
  priceField?: string;
  categoryField?: string;
  typeField?: string;
  cityField?: string;
  addressField?: string;
  bedroomsField?: string;
  bathroomsField?: string;
  areaField?: string;
  featuredImageField?: string;
  galleryField?: string;
}

function sanitizeHtml(html: string): string {
  if (!html) return '';
  return sanitizeWordPressText(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, ' ')
  );
}

function resolvePostImageUrl(raw: unknown, siteUrl: string): string | undefined {
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const abs = new URL(raw.trim(), siteUrl).href;
      return isSafeDisplayImageUrl(abs) ? abs : undefined;
    } catch {
      return undefined;
    }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nested = obj.url || obj.source_url || obj.src;
    if (typeof nested === 'string') {
      return resolvePostImageUrl(nested, siteUrl);
    }
  }
  return undefined;
}

function parseInrPrice(raw: unknown): number {
  if (typeof raw === 'number' && !isNaN(raw)) return raw;
  if (!raw) return 5000000; // default ₹50 Lakhs
  const str = String(raw).replace(/,/g, '').trim();

  // Check for "Cr" or "Crore"
  const crMatch = str.match(/([\d.]+)\s*(?:cr|crore|crores)/i);
  if (crMatch) {
    const val = parseFloat(crMatch[1]);
    if (!isNaN(val)) return Math.round(val * 10000000);
  }

  // Check for "Lakh" or "Lac"
  const lacMatch = str.match(/([\d.]+)\s*(?:lac|lacs|lakh|lakhs)/i);
  if (lacMatch) {
    const val = parseFloat(lacMatch[1]);
    if (!isNaN(val)) return Math.round(val * 100000);
  }

  // Pure digits
  const numMatch = str.match(/[\d.]+/);
  if (numMatch) {
    const val = parseFloat(numMatch[0]);
    if (!isNaN(val)) return Math.round(val);
  }

  return 5000000;
}

function extractValueByPath(obj: Record<string, unknown>, pathStr: string): unknown {
  if (!obj || !pathStr) return undefined;
  const parts = pathStr.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export async function inspectWordPressSite(targetUrl: string): Promise<WordPressEndpointDiscovery> {
  const normalized = targetUrl.trim().replace(/\/+$/, '');
  const candidateEndpoints = [
    '/wp-json/wp/v2/properties',
    '/wp-json/wp/v2/property',
    '/wp-json/wp/v2/real_estate',
    '/wp-json/wp/v2/listings',
    '/wp-json/wp/v2/estate',
    '/wp-json/wp/v2/posts',
    '/wp-json/wp/v2/pages',
  ];

  const foundEndpoints: Array<{ name: string; endpoint: string; count?: number }> = [];
  let samplePost: Record<string, unknown> | undefined;

  for (const ep of candidateEndpoints) {
    try {
      const testUrl = `${normalized}${ep}?per_page=1&_embed=1`;
      const res = await fetch(testUrl, {
        headers: { 'User-Agent': 'BUILDsmore-PropertyImporter/1.0' },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const totalHeader = res.headers.get('x-wp-total');
        const count = totalHeader ? parseInt(totalHeader, 10) : undefined;
        const posts = await res.json();

        if (Array.isArray(posts) && posts.length > 0) {
          foundEndpoints.push({
            name: ep.split('/').pop() || 'endpoint',
            endpoint: ep,
            count: count || posts.length,
          });

          if (!samplePost) {
            samplePost = posts[0];
          }
        }
      }
    } catch {
      // Continue to next endpoint candidate
    }
  }

  const isWp = foundEndpoints.length > 0;
  const availableFields: string[] = [];

  if (samplePost) {
    Object.keys(samplePost).forEach(k => {
      availableFields.push(k);
      if (k === 'meta' && typeof samplePost?.meta === 'object' && samplePost.meta !== null) {
        Object.keys(samplePost.meta as object).forEach(mk => availableFields.push(`meta.${mk}`));
      }
      if (k === 'acf' && typeof samplePost?.acf === 'object' && samplePost.acf !== null) {
        Object.keys(samplePost.acf as object).forEach(ak => availableFields.push(`acf.${ak}`));
      }
    });
  }

  return {
    siteUrl: normalized,
    isWordPress: isWp,
    restAvailable: isWp,
    detectedEndpoints: foundEndpoints,
    samplePost,
    availableFields,
    message: isWp 
      ? `Successfully discovered ${foundEndpoints.length} WordPress REST API endpoints.` 
      : 'No standard WordPress REST API endpoint responded. Universal HTML parsing will be used as fallback.',
  };
}

export async function fetchWordPressPosts(
  siteUrl: string, 
  endpoint = '/wp-json/wp/v2/properties',
  page = 1,
  perPage = 20
): Promise<{ posts: Array<Record<string, unknown>>; total: number }> {
  const normalized = siteUrl.trim().replace(/\/+$/, '');
  const url = `${normalized}${endpoint}?page=${page}&per_page=${perPage}&_embed=1`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'BUILDsmore-PropertyImporter/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`WordPress REST API request failed with status: ${res.status} ${res.statusText}`);
  }

  const total = parseInt(res.headers.get('x-wp-total') || '0', 10);
  const posts = await res.json();

  return {
    posts: Array.isArray(posts) ? posts : [],
    total: total || (Array.isArray(posts) ? posts.length : 0),
  };
}

export function transformWpPostToProperty(
  siteUrl: string,
  post: Record<string, unknown>,
  mapping?: FieldMappingConfig,
  repo: PropertyRepository = propertyRepository
): Property {
  const wpId = String(post.id || `wp-${Date.now()}`);
  const siteDomain = extractSourceWebsiteId(siteUrl);
  const siteHash = computeWebsiteHash(siteUrl, 10);
  const propertyId = computeWordPressPropertyId(siteUrl, wpId);

  // Title
  let title = 'Untitled WordPress Property';
  if (mapping?.titleField) {
    title = String(extractValueByPath(post, mapping.titleField) || title);
  } else if (typeof post.title === 'object' && post.title !== null) {
    title = (post.title as { rendered?: string }).rendered || title;
  } else if (typeof post.title === 'string') {
    title = post.title;
  }
  title = sanitizeHtml(title);

  // Unique Slug scoped to siteHash + wpId so two sites never collide on identical post slugs
  const baseSlug = post.slug
    ? propertyRepository.generateSlug(String(post.slug))
    : propertyRepository.generateSlug(title);
  const slug = `${baseSlug}-${siteHash}-${wpId}`;

  // Description
  let description = '';
  if (mapping?.descriptionField) {
    description = String(extractValueByPath(post, mapping.descriptionField) || '');
  } else if (typeof post.content === 'object' && post.content !== null) {
    description = (post.content as { rendered?: string }).rendered || '';
  } else if (typeof post.content === 'string') {
    description = post.content;
  }
  description = sanitizeHtml(description) || `${title} — prime luxury property listed via WordPress synchronization.`;

  // Price (strictly INR)
  let rawPrice: unknown = undefined;
  if (mapping?.priceField) {
    rawPrice = extractValueByPath(post, mapping.priceField);
  } else {
    rawPrice = extractValueByPath(post, 'meta.price') || 
               extractValueByPath(post, 'meta.property_price') ||
               extractValueByPath(post, 'acf.price') ||
               extractValueByPath(post, 'acf.property_price') ||
               extractValueByPath(post, 'meta._price');
  }
  const price = parseInrPrice(rawPrice);

  // Category
  let category: PropertyCategory = 'Residential';
  const rawCat = mapping?.categoryField 
    ? String(extractValueByPath(post, mapping.categoryField) || '')
    : String(extractValueByPath(post, 'meta.category') || extractValueByPath(post, 'acf.category') || '');
  
  if (/commercial|office|retail/i.test(rawCat) || /commercial/i.test(title)) {
    category = 'Commercial';
  } else if (/plot|land|acre|vineyard/i.test(rawCat) || /land|plot/i.test(title)) {
    category = 'Plots/Land';
  } else if (/project|development|phase/i.test(rawCat) || /development/i.test(title)) {
    category = 'New Projects';
  }

  // Property Type
  let propertyType: PropertyType = 'Villa';
  if (/penthouse/i.test(title) || /penthouse/i.test(rawCat)) propertyType = 'Penthouse';
  else if (/chalet/i.test(title)) propertyType = 'Chalet';
  else if (/commercial|office/i.test(title)) propertyType = 'Office Tower';
  else if (/land|plot/i.test(title)) propertyType = 'Development Parcel';

  // Location Detection (City, Locality, Address, and WP taxonomies)
  let rawCity = '';
  if (mapping?.cityField) {
    rawCity = String(extractValueByPath(post, mapping.cityField) || '');
  } else {
    const detectedCity = extractValueByPath(post, 'meta.city') || 
                         extractValueByPath(post, 'acf.city') ||
                         extractValueByPath(post, 'meta.property_city');
    if (detectedCity) rawCity = String(detectedCity);
  }

  let rawLocality = '';
  const detectedLocality = extractValueByPath(post, 'meta.locality') || 
                           extractValueByPath(post, 'acf.locality') ||
                           extractValueByPath(post, 'meta.neighborhood') ||
                           extractValueByPath(post, 'meta.sector');
  if (detectedLocality) rawLocality = String(detectedLocality);

  let rawLocationField = '';
  const detectedLocField = extractValueByPath(post, 'meta.location') || 
                           extractValueByPath(post, 'acf.location') ||
                           extractValueByPath(post, 'meta.property_location');
  if (detectedLocField) rawLocationField = String(detectedLocField);

  const addrCtx = {
    slug: post.slug ? String(post.slug) : '',
    postType: post.type ? String(post.type) : '',
    title,
  };

  let address = '';
  if (mapping?.addressField) {
    const mappedAddr = sanitizeHtml(String(extractValueByPath(post, mapping.addressField) || ''));
    if (isValidPropertyAddress(mappedAddr, addrCtx)) address = mappedAddr;
  } else {
    const detectedAddr =
      extractValueByPath(post, 'meta.address') ||
      extractValueByPath(post, 'acf.address') ||
      extractValueByPath(post, 'meta.property_address') ||
      extractValueByPath(post, 'acf.property_address') ||
      extractValueByPath(post, 'acf.site_address');
    if (detectedAddr) {
      const cleanAddr = sanitizeHtml(String(detectedAddr));
      if (isValidPropertyAddress(cleanAddr, addrCtx)) address = cleanAddr;
    }
  }
  if (!address && isValidPropertyAddress(rawLocationField, addrCtx)) {
    address = sanitizeWordPressText(rawLocationField);
  }
  if (!address) {
    address = isValidPropertyAddress(rawCity, addrCtx) ? `${sanitizeWordPressText(rawCity)}, India` : 'Chandigarh, India';
  }
  address = sanitizeWordPressText(address);

  // Automatic matching against Admin Managed Locations & Aliases
  const matchResult = repo.findLocationMatch(
    rawCity || rawLocationField || title,
    address,
    rawLocality
  );

  let locationId: string | undefined = undefined;
  let city = rawCity || 'Chandigarh';
  let stateRegion = 'Punjab / Tricity';
  let country = 'India';
  let needsLocationReview = false;

  if (matchResult.location) {
    locationId = matchResult.location.id;
    city = matchResult.location.name;
    if (matchResult.location.stateRegion) stateRegion = matchResult.location.stateRegion;
    if (matchResult.location.country) country = matchResult.location.country;
    needsLocationReview = matchResult.confidence === 'uncertain';
  } else {
    // No match found in existing admin locations -> Mark for admin review
    needsLocationReview = true;
  }

  // Bedrooms & Bathrooms
  const bedrooms = Number(
    (mapping?.bedroomsField && extractValueByPath(post, mapping.bedroomsField)) ||
    extractValueByPath(post, 'meta.bedrooms') ||
    extractValueByPath(post, 'acf.bedrooms') ||
    3
  ) || 3;

  const bathrooms = Number(
    (mapping?.bathroomsField && extractValueByPath(post, mapping.bathroomsField)) ||
    extractValueByPath(post, 'meta.bathrooms') ||
    extractValueByPath(post, 'acf.bathrooms') ||
    3
  ) || 3;

  const interiorAreaSqFt = Number(
    (mapping?.areaField && extractValueByPath(post, mapping.areaField)) ||
    extractValueByPath(post, 'meta.area') ||
    extractValueByPath(post, 'acf.area') ||
    extractValueByPath(post, 'meta.size') ||
    1850
  ) || 1850;

  // Images from mapped field, WP _embedded featured media, Yoast OG, Jetpack, ACF, content HTML, and site logo fallback
  const images: PropertyImage[] = [];
  const seenImgUrls = new Set<string>();
  let sourceLogoUrl: string | undefined;

  const pushPhoto = (candidate: unknown, origin: PropertyImage['origin'], caption?: string) => {
    const abs = resolvePostImageUrl(candidate, siteUrl);
    if (!abs || seenImgUrls.has(abs)) return;
    if (looksLikeBrandLogoUrl(abs)) {
      if (!sourceLogoUrl) sourceLogoUrl = abs;
      return;
    }
    if (/\.(?:svg|ico)(?:$|\?)/i.test(abs) || abs.includes('gravatar.com')) return;
    seenImgUrls.add(abs);
    images.push({
      id: `img-${Date.now()}-${images.length + 1}`,
      url: abs,
      caption: sanitizeHtml(caption || '') || title,
      isPrimary: images.length === 0,
      origin,
      isLogoFallback: false,
    });
  };

  if (mapping?.featuredImageField) {
    pushPhoto(extractValueByPath(post, mapping.featuredImageField), 'wp_featured', title);
  }

  const embeddedMedia = (post._embedded as Record<string, unknown>)?.[
    'wp:featuredmedia'
  ] as Array<{ source_url?: string; alt_text?: string }> | undefined;

  if (Array.isArray(embeddedMedia) && embeddedMedia.length > 0 && embeddedMedia[0]?.source_url) {
    pushPhoto(embeddedMedia[0].source_url, 'wp_featured', embeddedMedia[0].alt_text || title);
  }

  if (post.featured_media_url) {
    pushPhoto(post.featured_media_url, 'wp_featured', title);
  }

  if (post.jetpack_featured_media_url) {
    pushPhoto(post.jetpack_featured_media_url, 'wp_featured', title);
  }

  const yoast = post.yoast_head_json as Record<string, unknown> | undefined;
  const yoastOg = yoast?.og_image as Array<{ url?: string }> | undefined;
  if (Array.isArray(yoastOg) && yoastOg[0]?.url) {
    pushPhoto(yoastOg[0].url, 'wp_featured', title);
  }

  // ACF image / gallery fields
  const acfCandidates = [
    extractValueByPath(post, 'acf.featured_image'),
    extractValueByPath(post, 'acf.hero_image'),
    extractValueByPath(post, 'acf.main_image'),
    extractValueByPath(post, 'acf.image'),
    ...(mapping?.galleryField ? [extractValueByPath(post, mapping.galleryField)] : []),
    extractValueByPath(post, 'acf.gallery'),
  ];
  for (const acfVal of acfCandidates) {
    if (Array.isArray(acfVal)) {
      acfVal.forEach(item => pushPhoto(item, 'wp_scraped', title));
    } else if (acfVal) {
      pushPhoto(acfVal, 'wp_scraped', title);
    }
  }

  // Content HTML <img> fallback
  const contentHtml =
    typeof post.content === 'object' && post.content !== null
      ? String((post.content as { rendered?: string }).rendered || '')
      : typeof post.content === 'string'
      ? post.content
      : '';
  for (const match of contentHtml.matchAll(/<img[^>]+(?:data-lazy-src|data-src|src)=["']([^"']+)["']/gi)) {
    pushPhoto(match[1], 'wp_scraped', title);
    if (images.length >= 12) break;
  }

  // Extract possible site/brand logo for clean fallback
  const potentialLogo =
    resolvePostImageUrl(post.site_icon_url, siteUrl) ||
    resolvePostImageUrl(post.site_logo, siteUrl) ||
    sourceLogoUrl;
  if (potentialLogo) sourceLogoUrl = potentialLogo;

  // Fallback to source website logo if no suitable property photo was found
  if (images.length === 0 && sourceLogoUrl) {
    images.push({
      id: `img-${Date.now()}-source-logo`,
      url: sourceLogoUrl,
      caption: `${title} - Official Source Logo`,
      isPrimary: true,
      origin: 'source_logo',
      isLogoFallback: true,
    });
  }

  const now = new Date().toISOString();

  return {
    id: propertyId,
    slug,
    title,
    subtitle: `${bedrooms} BHK ${propertyType} in ${city}`,
    description,
    price,
    currency: 'INR',
    category,
    propertyType,
    status: 'Published',
    featured: false,
    isNewDevelopment: category === 'New Projects',
    isTrophyHolding: false,
    trophyOrder: 99,
    isLatestAdded: true,
    displayOrder: 1,

    locationId,
    address,
    city,
    locality: rawLocality || city,
    stateRegion,
    country,
    coordinates: { lat: 30.64, lng: 76.82 },
    needsLocationReview,

    bedrooms,
    bathrooms,
    interiorAreaSqFt,
    areaUnit: 'sq ft',
    parkingSpaces: 2,
    energyRating: 'A+',

    images,
    sourceLogoUrl,
    amenities: ['Clubhouse', 'Gymnasium', '24/7 Security Concierge', 'Landscaped Gardens'],
    specifications: {
      'Source Website': siteUrl,
      'WordPress Post ID': wpId,
      'Imported Timestamp': now,
    },

    seo: {
      metaTitle: `${title} – BUILDsmore Luxury Real Estate`,
      metaDescription: description.slice(0, 150),
      keywords: [city, category, 'real estate'],
    },

    source: {
      type: 'wordpress',
      sourceWebsiteId: siteDomain,
      sourceWebsiteName: siteDomain,
      sourcePropertyId: wpId,
      sourceUrl: normalizeSourceUrl(String(post.link || siteUrl)),
      lastSyncedAt: now,
    },

    createdAt: String(post.date || now),
    updatedAt: now,
  };
}

export async function executeWordPressImport(
  siteUrl: string,
  posts: Array<Record<string, unknown>>,
  mapping?: FieldMappingConfig,
  syncPolicy: 'preserve_central' | 'update_existing' = 'preserve_central',
  repo: PropertyRepository = propertyRepository
): Promise<{
  totalSelected: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  properties: Property[];
  errors: string[];
}> {
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  const importedProperties: Property[] = [];

  for (const post of posts) {
    try {
      const property = transformWpPostToProperty(siteUrl, post, mapping, repo);
      const outcome = repo.upsertImportedProperty(property, syncPolicy);

      if (outcome.action === 'created') {
        importedCount++;
        importedProperties.push(outcome.property);
      } else if (outcome.action === 'updated') {
        updatedCount++;
        importedProperties.push(outcome.property);
      } else {
        skippedCount++;
      }
    } catch (err) {
      failedCount++;
      errors.push(`Failed importing post ID ${post.id}: ${(err as Error).message}`);
    }
  }

  return {
    totalSelected: posts.length,
    importedCount,
    updatedCount,
    skippedCount,
    failedCount,
    properties: importedProperties,
    errors,
  };
}
