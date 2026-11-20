/**
 * BUILDsmore — Schema-Aligned PostgreSQL Synchronization Service
 * Aligns 100% with src/db/schema.ts and 0001_initial_schema.sql:
 * - Upserts source_websites before properties (satisfies FK)
 * - Uses exact normalized columns (never nonexistent seo_metadata or source_meta)
 * - Syncs property_images within transactions
 * - Reconciles disk PropertyRepository and PostgreSQL cleanly on server startup
 */

import { getDbPool } from './db';
import { BlogPost, HeroSlide, Property, PropertyImage } from '../types/property';
import type { PropertyRepository } from './propertyRepository';
import type { BlogRepository } from './blogRepository';
import type { HeroSlideRepository } from './heroSlideRepository';

function clip(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  const str = String(val).trim();
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function toSafeInt(val: unknown, fallback = 0): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.round(num));
}

function toSafeNullableInt(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? Math.round(num) : null;
}

function toSafeNumeric(val: unknown, fallback: number | null = null): number | null {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeIsoTimestamp(val: unknown): string {
  if (typeof val === 'string' && val.trim()) {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export const PROPERTIES_UPSERT_COLUMNS = [
  'id',
  'slug',
  'title',
  'subtitle',
  'description',
  'price',
  'currency',
  'category',
  'property_type',
  'status',
  'featured',
  'is_new_development',
  'address',
  'city',
  'state_region',
  'country',
  'postal_code',
  'latitude',
  'longitude',
  'bedrooms',
  'bathrooms',
  'interior_area_sqft',
  'lot_size_acres',
  'year_built',
  'parking_spaces',
  'energy_rating',
  'amenities',
  'specifications',
  'seo_meta_title',
  'seo_meta_description',
  'seo_keywords',
  'source_type',
  'source_website_id',
  'source_property_id',
  'source_url',
  'last_synced_at',
  'created_at',
  'updated_at',
] as const;

export interface QueryRunner {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}

export interface DbPoolLike extends QueryRunner {
  connect?: () => Promise<{
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
    release: () => void;
  }>;
}

async function resolveUniquePgSlug(
  runner: QueryRunner,
  propId: string,
  desiredSlug: string
): Promise<string> {
  const base = clip(desiredSlug || propId, 240) || clip(propId, 240);
  const existing = await runner.query(
    'SELECT id FROM properties WHERE slug = $1 AND id <> $2 LIMIT 1',
    [base, propId]
  );
  if (existing.rows.length === 0) {
    return base;
  }
  const suffix = clip(propId.replace(/[^a-zA-Z0-9_-]/g, ''), 12) || 'pg';
  return clip(`${base.slice(0, 238)}-${suffix}`, 255);
}

export async function syncPropertyToPostgres(
  prop: Property,
  poolOverride?: DbPoolLike
): Promise<{ synced: boolean; error?: string }> {
  const pool = poolOverride || getDbPool();
  const client = pool.connect ? await pool.connect().catch(() => null) : null;
  const runner: QueryRunner = client
    ? { query: (text: string, params?: unknown[]) => client.query(text, params) }
    : { query: (text: string, params?: unknown[]) => pool.query(text, params) };

  try {
    if (client) {
      await runner.query('BEGIN');
    }

    const propId = clip(prop.id, 64);
    const sourceType = clip(prop.source?.type || 'manual', 32) || 'manual';
    const sourceWebsiteId = prop.source?.sourceWebsiteId
      ? clip(prop.source.sourceWebsiteId, 64)
      : null;

    // Satisfy properties.source_website_id REFERENCES source_websites(id)
    if (sourceWebsiteId) {
      const siteName = clip(prop.source?.sourceWebsiteName || sourceWebsiteId, 255) || sourceWebsiteId;
      let siteUrl = prop.source?.sourceUrl || '';
      if (!siteUrl) {
        siteUrl = sourceWebsiteId.includes('.') ? `https://${sourceWebsiteId}` : `https://source.local/${sourceWebsiteId}`;
      }
      await runner.query(
        `INSERT INTO source_websites (
           id, name, site_url, rest_api_endpoint, post_type, status, auth_type,
           field_mapping, sync_policy, auto_sync_enabled, sync_interval_hours, last_sync_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          sourceWebsiteId,
          siteName,
          siteUrl,
          '/wp-json/wp/v2/properties',
          'properties',
          'Active',
          'none',
          '{}',
          'preserve_central',
          false,
          12,
          normalizeIsoTimestamp(prop.source?.lastSyncedAt || prop.updatedAt),
        ]
      );
    }

    const safeSlug = await resolveUniquePgSlug(runner, propId, prop.slug || propId);
    const safePrice = toSafeNumeric(prop.price, 0) ?? 0;
    const safeCreatedAt = normalizeIsoTimestamp(prop.createdAt);
    const safeUpdatedAt = normalizeIsoTimestamp(prop.updatedAt);
    const safeLastSynced = prop.source?.lastSyncedAt
      ? normalizeIsoTimestamp(prop.source.lastSyncedAt)
      : null;

    await runner.query(
      `INSERT INTO properties (
         id, slug, title, subtitle, description, price, currency, category, property_type,
         status, featured, is_new_development, address, city, state_region, country, postal_code,
         latitude, longitude, bedrooms, bathrooms, interior_area_sqft, lot_size_acres,
         year_built, parking_spaces, energy_rating, amenities, specifications,
         seo_meta_title, seo_meta_description, seo_keywords,
         source_type, source_website_id, source_property_id, source_url, last_synced_at,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, $16, $17,
         $18, $19, $20, $21, $22, $23,
         $24, $25, $26, $27::jsonb, $28::jsonb,
         $29, $30, $31::jsonb,
         $32, $33, $34, $35, $36,
         $37, $38
       )
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug,
         title = EXCLUDED.title,
         subtitle = EXCLUDED.subtitle,
         description = EXCLUDED.description,
         price = EXCLUDED.price,
         currency = EXCLUDED.currency,
         category = EXCLUDED.category,
         property_type = EXCLUDED.property_type,
         status = EXCLUDED.status,
         featured = EXCLUDED.featured,
         is_new_development = EXCLUDED.is_new_development,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         state_region = EXCLUDED.state_region,
         country = EXCLUDED.country,
         postal_code = EXCLUDED.postal_code,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         bedrooms = EXCLUDED.bedrooms,
         bathrooms = EXCLUDED.bathrooms,
         interior_area_sqft = EXCLUDED.interior_area_sqft,
         lot_size_acres = EXCLUDED.lot_size_acres,
         year_built = EXCLUDED.year_built,
         parking_spaces = EXCLUDED.parking_spaces,
         energy_rating = EXCLUDED.energy_rating,
         amenities = EXCLUDED.amenities,
         specifications = EXCLUDED.specifications,
         seo_meta_title = EXCLUDED.seo_meta_title,
         seo_meta_description = EXCLUDED.seo_meta_description,
         seo_keywords = EXCLUDED.seo_keywords,
         source_type = EXCLUDED.source_type,
         source_website_id = EXCLUDED.source_website_id,
         source_property_id = EXCLUDED.source_property_id,
         source_url = EXCLUDED.source_url,
         last_synced_at = EXCLUDED.last_synced_at,
         updated_at = EXCLUDED.updated_at`,
      [
        propId,
        safeSlug,
        clip(prop.title || 'Untitled Property', 255),
        prop.subtitle ? String(prop.subtitle) : null,
        String(prop.description || prop.title || 'Luxury property portfolio holding.'),
        safePrice.toFixed(2),
        clip(prop.currency || 'INR', 3) || 'INR',
        clip(prop.category || 'Residential', 64) || 'Residential',
        clip(prop.propertyType || 'Villa', 64) || 'Villa',
        clip(prop.status || 'Draft', 32) || 'Draft',
        Boolean(prop.featured),
        Boolean(prop.isNewDevelopment),
        String(prop.address || `${prop.city || 'Mohali'}, ${prop.country || 'India'}`),
        clip(prop.city || 'Mohali', 128) || 'Mohali',
        prop.stateRegion ? clip(prop.stateRegion, 128) : null,
        clip(prop.country || 'India', 128) || 'India',
        prop.postalCode ? clip(prop.postalCode, 32) : null,
        toSafeNumeric(prop.coordinates?.lat, null),
        toSafeNumeric(prop.coordinates?.lng, null),
        toSafeInt(prop.bedrooms, 0),
        toSafeInt(prop.bathrooms, 0),
        toSafeInt(prop.interiorAreaSqFt, 0),
        toSafeNumeric(prop.lotSizeAcres, null),
        toSafeNullableInt(prop.yearBuilt),
        toSafeInt(prop.parkingSpaces, 0),
        prop.energyRating ? clip(prop.energyRating, 8) : null,
        JSON.stringify(Array.isArray(prop.amenities) ? prop.amenities : []),
        JSON.stringify(prop.specifications && typeof prop.specifications === 'object' ? prop.specifications : {}),
        prop.seo?.metaTitle ? clip(prop.seo.metaTitle, 255) : null,
        prop.seo?.metaDescription ? String(prop.seo.metaDescription) : null,
        JSON.stringify(Array.isArray(prop.seo?.keywords) ? prop.seo.keywords : []),
        sourceType,
        sourceWebsiteId,
        prop.source?.sourcePropertyId ? clip(prop.source.sourcePropertyId, 128) : null,
        prop.source?.sourceUrl ? String(prop.source.sourceUrl) : null,
        safeLastSynced,
        safeCreatedAt,
        safeUpdatedAt,
      ]
    );

    // Replace property_images cleanly inside transaction
    await runner.query('DELETE FROM property_images WHERE property_id = $1', [propId]);
    const imgs = Array.isArray(prop.images) ? prop.images : [];
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (!img?.url) continue;
      await runner.query(
        `INSERT INTO property_images (property_id, url, caption, display_order, is_primary)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          propId,
          String(img.url),
          img.caption ? String(img.caption) : null,
          i,
          Boolean(img.isPrimary ?? i === 0),
        ]
      );
    }

    if (client) {
      await runner.query('COMMIT');
    }
    return { synced: true };
  } catch (err: unknown) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    const message = err instanceof Error ? err.message : String(err);
    return { synced: false, error: message };
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function deletePropertyFromPostgres(
  propertyId: string,
  poolOverride?: DbPoolLike
): Promise<{ deleted: boolean; error?: string }> {
  const pool = poolOverride || getDbPool();
  try {
    await pool.query('DELETE FROM properties WHERE id = $1', [clip(propertyId, 64)]);
    return { deleted: true };
  } catch (err: unknown) {
    return { deleted: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function hydratePropertyFromPgRow(row: any, imgRows: any[]): Property {
  const images: PropertyImage[] = imgRows.map((ir, idx) => ({
    id: String(ir.id || `img-pg-${idx}`),
    url: String(ir.url),
    caption: ir.caption ? String(ir.caption) : undefined,
    isPrimary: Boolean(ir.is_primary),
  }));

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: row.subtitle ? String(row.subtitle) : '',
    description: String(row.description || ''),
    price: Number(row.price) || 0,
    currency: (row.currency || 'INR') as Property['currency'],
    category: (row.category || 'Residential') as Property['category'],
    propertyType: (row.property_type || 'Villa') as Property['propertyType'],
    status: (row.status || 'Draft') as Property['status'],
    featured: Boolean(row.featured),
    isNewDevelopment: Boolean(row.is_new_development),
    address: String(row.address || ''),
    city: String(row.city || 'Mohali'),
    stateRegion: row.state_region ? String(row.state_region) : '',
    country: String(row.country || 'India'),
    postalCode: row.postal_code ? String(row.postal_code) : undefined,
    coordinates: {
      lat: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : 30.7333,
      lng: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : 76.7794,
    },
    bedrooms: Number(row.bedrooms) || 0,
    bathrooms: Number(row.bathrooms) || 0,
    interiorAreaSqFt: Number(row.interior_area_sqft) || 0,
    lotSizeAcres: row.lot_size_acres !== null && row.lot_size_acres !== undefined ? Number(row.lot_size_acres) : undefined,
    yearBuilt: row.year_built !== null && row.year_built !== undefined ? Number(row.year_built) : undefined,
    parkingSpaces: row.parking_spaces !== null && row.parking_spaces !== undefined ? Number(row.parking_spaces) : undefined,
    energyRating: row.energy_rating ? String(row.energy_rating) : undefined,
    images,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    specifications: row.specifications && typeof row.specifications === 'object' ? row.specifications : {},
    seo: {
      metaTitle: row.seo_meta_title ? String(row.seo_meta_title) : `${row.title} – BUILDsmore`,
      metaDescription: row.seo_meta_description ? String(row.seo_meta_description) : '',
      keywords: Array.isArray(row.seo_keywords) ? row.seo_keywords : [],
    },
    source: {
      type: (row.source_type || 'manual') as Property['source']['type'],
      sourceWebsiteId: row.source_website_id ? String(row.source_website_id) : undefined,
      sourcePropertyId: row.source_property_id ? String(row.source_property_id) : undefined,
      sourceUrl: row.source_url ? String(row.source_url) : undefined,
      lastSyncedAt: row.last_synced_at
        ? new Date(row.last_synced_at).toISOString()
        : new Date().toISOString(),
    },
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Ensures a referenced property exists in PostgreSQL before inserting an inquiry FK.
 */
export async function ensurePropertyInPostgres(
  propertyId: string,
  repo: PropertyRepository,
  poolOverride?: DbPoolLike
): Promise<boolean> {
  if (!propertyId) return false;
  const pool = poolOverride || getDbPool();
  try {
    const check = await pool.query('SELECT id FROM properties WHERE id = $1 LIMIT 1', [clip(propertyId, 64)]);
    if (check.rows.length > 0) return true;

    const repoProp = repo.getPropertyById(propertyId) || repo.getPropertyBySlug(propertyId);
    if (!repoProp) return false;

    const syncRes = await syncPropertyToPostgres(repoProp, pool);
    return syncRes.synced;
  } catch {
    return false;
  }
}

/**
 * Reconciles PropertyRepository (disk JSON) with PostgreSQL cleanly on startup:
 * - Restores any properties present in PG that are missing on disk
 * - Backfills all existing disk properties into PG without overwriting existing data
 */
export async function reconcileWithPostgres(
  repo: PropertyRepository,
  poolOverride?: DbPoolLike
): Promise<{
  connected: boolean;
  restoredFromPg: number;
  syncedToPg: number;
  error?: string;
}> {
  const pool = poolOverride || getDbPool();
  let restoredFromPg = 0;
  let syncedToPg = 0;

  try {
    const pgPropsRes = await pool.query('SELECT * FROM properties ORDER BY updated_at DESC');
    const pgImagesRes = await pool.query('SELECT * FROM property_images ORDER BY display_order ASC');

    const imagesByProp = new Map<string, any[]>();
    for (const img of pgImagesRes.rows || []) {
      const list = imagesByProp.get(img.property_id) || [];
      list.push(img);
      imagesByProp.set(img.property_id, list);
    }

    const diskProps = repo.getAllProperties({ limit: 5000 }).items;
    const diskById = new Map(diskProps.map((p) => [p.id, p]));

    for (const row of pgPropsRes.rows || []) {
      if (!diskById.has(row.id)) {
        const hydrated = hydratePropertyFromPgRow(row, imagesByProp.get(row.id) || []);
        const outcome = repo.upsertImportedProperty(hydrated, 'preserve_central');
        if (outcome.action === 'created') {
          restoredFromPg++;
        }
      }
    }

    const currentDiskProps = repo.getAllProperties({ limit: 5000 }).items;
    const pgUpdatedMap = new Map<string, number>();
    for (const row of pgPropsRes.rows || []) {
      const ts = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      pgUpdatedMap.set(row.id, ts);
    }

    for (const prop of currentDiskProps) {
      const pgTs = pgUpdatedMap.get(prop.id);
      const diskTs = prop.updatedAt ? new Date(prop.updatedAt).getTime() : 0;
      if (pgTs === undefined || diskTs > pgTs + 1000) {
        const res = await syncPropertyToPostgres(prop, pool);
        if (res.synced) syncedToPg++;
      }
    }

    return {
      connected: true,
      restoredFromPg,
      syncedToPg,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      restoredFromPg,
      syncedToPg,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const BLOGS_UPSERT_COLUMNS = [
  'id',
  'slug',
  'title',
  'excerpt',
  'content',
  'category',
  'tags',
  'featured_image',
  'featured_image_alt',
  'author_name',
  'author_role',
  'status',
  'featured',
  'read_time_minutes',
  'seo_meta_title',
  'seo_meta_description',
  'seo_keywords',
  'published_at',
  'created_at',
  'updated_at',
] as const;

async function resolveUniquePgBlogSlug(
  runner: QueryRunner,
  blogId: string,
  desiredSlug: string
): Promise<string> {
  const base = clip(desiredSlug || blogId, 240) || clip(blogId, 240);
  const existing = await runner.query(
    'SELECT id FROM blogs WHERE slug = $1 AND id <> $2 LIMIT 1',
    [base, blogId]
  );
  if (existing.rows.length === 0) {
    return base;
  }
  const suffix = clip(blogId.replace(/[^a-zA-Z0-9_-]/g, ''), 12) || 'pg';
  return clip(`${base.slice(0, 238)}-${suffix}`, 255);
}

export async function syncBlogToPostgres(
  blog: BlogPost,
  poolOverride?: DbPoolLike
): Promise<{ synced: boolean; error?: string }> {
  const pool = poolOverride || getDbPool();
  const runner: QueryRunner = {
    query: (text: string, params?: unknown[]) => pool.query(text, params),
  };

  try {
    const blogId = clip(blog.id, 64);
    const safeSlug = await resolveUniquePgBlogSlug(runner, blogId, blog.slug || blogId);
    const safeCreatedAt = normalizeIsoTimestamp(blog.createdAt);
    const safeUpdatedAt = normalizeIsoTimestamp(blog.updatedAt);
    const safePublishedAt = blog.publishedAt
      ? normalizeIsoTimestamp(blog.publishedAt)
      : null;

    await runner.query(
      `INSERT INTO blogs (
         id, slug, title, excerpt, content, category, tags,
         featured_image, featured_image_alt, author_name, author_role,
         status, featured, read_time_minutes,
         seo_meta_title, seo_meta_description, seo_keywords,
         published_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb,
         $8, $9, $10, $11,
         $12, $13, $14,
         $15, $16, $17::jsonb,
         $18, $19, $20
       )
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug,
         title = EXCLUDED.title,
         excerpt = EXCLUDED.excerpt,
         content = EXCLUDED.content,
         category = EXCLUDED.category,
         tags = EXCLUDED.tags,
         featured_image = EXCLUDED.featured_image,
         featured_image_alt = EXCLUDED.featured_image_alt,
         author_name = EXCLUDED.author_name,
         author_role = EXCLUDED.author_role,
         status = EXCLUDED.status,
         featured = EXCLUDED.featured,
         read_time_minutes = EXCLUDED.read_time_minutes,
         seo_meta_title = EXCLUDED.seo_meta_title,
         seo_meta_description = EXCLUDED.seo_meta_description,
         seo_keywords = EXCLUDED.seo_keywords,
         published_at = EXCLUDED.published_at,
         updated_at = EXCLUDED.updated_at`,
      [
        blogId,
        safeSlug,
        clip(blog.title || 'Untitled Article', 255),
        String(blog.excerpt || ''),
        String(blog.content || ''),
        clip(blog.category || 'Market Intelligence', 128) || 'Market Intelligence',
        JSON.stringify(Array.isArray(blog.tags) ? blog.tags : []),
        String(blog.featuredImage || ''),
        blog.featuredImageAlt ? clip(blog.featuredImageAlt, 255) : null,
        clip(blog.authorName || 'BUILDsmore Editorial Desk', 255) || 'BUILDsmore Editorial Desk',
        blog.authorRole ? clip(blog.authorRole, 255) : null,
        clip(blog.status || 'Draft', 32) || 'Draft',
        Boolean(blog.featured),
        toSafeInt(blog.readTimeMinutes, 1),
        blog.seo?.metaTitle ? clip(blog.seo.metaTitle, 255) : null,
        blog.seo?.metaDescription ? String(blog.seo.metaDescription) : null,
        JSON.stringify(Array.isArray(blog.seo?.keywords) ? blog.seo.keywords : []),
        safePublishedAt,
        safeCreatedAt,
        safeUpdatedAt,
      ]
    );

    return { synced: true };
  } catch (err: unknown) {
    return { synced: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteBlogFromPostgres(
  blogId: string,
  poolOverride?: DbPoolLike
): Promise<{ deleted: boolean; error?: string }> {
  const pool = poolOverride || getDbPool();
  try {
    await pool.query('DELETE FROM blogs WHERE id = $1', [clip(blogId, 64)]);
    return { deleted: true };
  } catch (err: unknown) {
    return { deleted: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reconcileBlogsWithPostgres(
  repo: BlogRepository,
  poolOverride?: DbPoolLike
): Promise<{
  connected: boolean;
  restoredFromPg: number;
  syncedToPg: number;
  error?: string;
}> {
  const pool = poolOverride || getDbPool();
  let restoredFromPg = 0;
  let syncedToPg = 0;

  try {
    const pgRes = await pool.query('SELECT * FROM blogs ORDER BY updated_at DESC');
    const diskBlogs = repo.getAllRawBlogs();
    const diskById = new Map(diskBlogs.map((b) => [b.id, b]));

    for (const row of pgRes.rows || []) {
      if (!diskById.has(row.id)) {
        repo.upsertFromDatabaseRow(row);
        restoredFromPg++;
      }
    }

    const pgUpdatedMap = new Map<string, number>();
    for (const row of pgRes.rows || []) {
      const ts = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      pgUpdatedMap.set(row.id, ts);
    }

    for (const blog of repo.getAllRawBlogs()) {
      const pgTs = pgUpdatedMap.get(blog.id);
      const diskTs = blog.updatedAt ? new Date(blog.updatedAt).getTime() : 0;
      if (pgTs === undefined || diskTs > pgTs + 1000) {
        const res = await syncBlogToPostgres(blog, pool);
        if (res.synced) syncedToPg++;
      }
    }

    return {
      connected: true,
      restoredFromPg,
      syncedToPg,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      restoredFromPg,
      syncedToPg,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const HERO_SLIDES_UPSERT_COLUMNS = [
  'id',
  'image_url',
  'heading',
  'description',
  'display_order',
  'created_at',
  'updated_at',
] as const;

export async function syncHeroSlideToPostgres(
  slide: HeroSlide,
  poolOverride?: DbPoolLike
): Promise<{ synced: boolean; error?: string }> {
  const pool = poolOverride || getDbPool();
  try {
    const slideId = clip(slide.id, 64);
    const safeCreatedAt = normalizeIsoTimestamp(slide.createdAt);
    const safeUpdatedAt = normalizeIsoTimestamp(slide.updatedAt);

    await pool.query(
      `INSERT INTO hero_slides (
         id, image_url, heading, description, display_order, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         image_url = EXCLUDED.image_url,
         heading = EXCLUDED.heading,
         description = EXCLUDED.description,
         display_order = EXCLUDED.display_order,
         updated_at = EXCLUDED.updated_at`,
      [
        slideId,
        String(slide.imageUrl || ''),
        clip(slide.heading || '', 255),
        String(slide.description || ''),
        toSafeInt(slide.displayOrder, 0),
        safeCreatedAt,
        safeUpdatedAt,
      ]
    );
    return { synced: true };
  } catch (err: unknown) {
    return { synced: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function syncAllHeroSlidesToPostgres(
  slides: HeroSlide[],
  poolOverride?: DbPoolLike
): Promise<{ synced: boolean; count: number; error?: string }> {
  const pool = poolOverride || getDbPool();
  let count = 0;
  try {
    for (const slide of slides) {
      const res = await syncHeroSlideToPostgres(slide, pool);
      if (res.synced) count++;
    }
    return { synced: true, count };
  } catch (err: unknown) {
    return { synced: false, count, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteHeroSlideFromPostgres(
  slideId: string,
  poolOverride?: DbPoolLike
): Promise<{ deleted: boolean; error?: string }> {
  const pool = poolOverride || getDbPool();
  try {
    await pool.query('DELETE FROM hero_slides WHERE id = $1', [clip(slideId, 64)]);
    return { deleted: true };
  } catch (err: unknown) {
    return { deleted: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reconcileHeroSlidesWithPostgres(
  repo: HeroSlideRepository,
  poolOverride?: DbPoolLike
): Promise<{
  connected: boolean;
  restoredFromPg: number;
  syncedToPg: number;
  error?: string;
}> {
  const pool = poolOverride || getDbPool();
  let restoredFromPg = 0;
  let syncedToPg = 0;

  try {
    const pgRes = await pool.query('SELECT * FROM hero_slides ORDER BY display_order ASC, created_at ASC');
    const diskSlides = repo.getAllSlides();
    const diskById = new Map(diskSlides.map((s) => [s.id, s]));

    for (const row of pgRes.rows || []) {
      if (!diskById.has(row.id)) {
        repo.upsertFromDatabaseRow(row);
        restoredFromPg++;
      }
    }

    const pgUpdatedMap = new Map<string, number>();
    for (const row of pgRes.rows || []) {
      const ts = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      pgUpdatedMap.set(row.id, ts);
    }

    for (const slide of repo.getAllSlides()) {
      const pgTs = pgUpdatedMap.get(slide.id);
      const diskTs = slide.updatedAt ? new Date(slide.updatedAt).getTime() : 0;
      if (pgTs === undefined || diskTs > pgTs + 1000) {
        const res = await syncHeroSlideToPostgres(slide, pool);
        if (res.synced) syncedToPg++;
      }
    }

    return {
      connected: true,
      restoredFromPg,
      syncedToPg,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      restoredFromPg,
      syncedToPg,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

