/**
 * BUILDsmore Luxury Real Estate Platform
 * Test Suite: Auth, Property CRUD, Duplicate Prevention, WordPress Extraction & CSV
 */

import { storage } from '../src/services/storage';
import { 
  adaptWordPressPostToProperty, 
  extractPageBuilderData, 
  parsePrice,
  getNestedValue 
} from '../src/services/wordpressImporter';
import { 
  exportPropertiesToCsv, 
  parseCsvString, 
  processCsvImport 
} from '../src/services/csvService';
import { Property, WordPressSource } from '../src/types/property';

export function runAllTests(): { passed: number; failed: number; results: Array<{ name: string; success: boolean; error?: string }> } {
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, success: true });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      results.push({ name, success: false, error: err });
    }
  }

  // 1. Admin Auth (Client-side fallback disabled; server JWT session scoped)
  test('Admin Auth: blocks client-side fallback login and legacy username aliases', () => {
    const emailAttempt = storage.loginAdmin('info@buildsmoremohali.com', 'buildsmore2026!');
    if (emailAttempt.success) throw new Error('Direct client-side loginAdmin must be disabled');

    const adminAlias = storage.loginAdmin('admin', 'buildsmore2026!');
    if (adminAlias.success) throw new Error('Legacy admin alias must be rejected');

    const administratorAlias = storage.loginAdmin('administrator', 'buildsmore2026!');
    if (administratorAlias.success) throw new Error('Legacy administrator alias must be rejected');

    const brandAlias = storage.loginAdmin('buildsmore', 'buildsmore2026!');
    if (brandAlias.success) throw new Error('Legacy buildsmore alias must be rejected');
  });

  test('Admin Auth: stores server-issued admin session and clears cleanly on logout', () => {
    storage.setAuthenticatedAdmin(
      {
        id: 'admin-01',
        email: 'info@buildsmoremohali.com',
        name: 'Executive Managing Director',
        role: 'SuperAdmin',
        lastLoginAt: new Date().toISOString(),
      },
      'test-jwt-token'
    );

    const current = storage.getCurrentAdmin();
    const token = storage.getAdminToken();
    if (!current || current.email !== 'info@buildsmoremohali.com' || token !== 'test-jwt-token') {
      throw new Error('Expected active server-authenticated session');
    }

    storage.logoutAdmin();
    if (storage.getCurrentAdmin() !== null || storage.getAdminToken() !== null) {
      throw new Error('Expected session and token to be cleared after logout');
    }
  });

  // 2. Property CRUD
  test('Property CRUD: saves new property and generates slug', () => {
    const initialCount = storage.getProperties().length;
    const testProp: Property = {
      id: `test-prop-${Date.now()}`,
      slug: '',
      title: 'Chateau de Miraval Cote d Azur',
      subtitle: 'Historic French Provence Domain',
      description: 'Superb 17th century bastide with organic olive grove.',
      price: 15000000,
      currency: 'EUR',
      category: 'Residential',
      propertyType: 'Historic Estate',
      status: 'Published',
      featured: false,
      isNewDevelopment: false,
      address: 'Route de Miraval',
      city: 'Correns',
      stateRegion: 'Provence',
      country: 'France',
      coordinates: { lat: 43.48, lng: 6.08 },
      bedrooms: 8,
      bathrooms: 10,
      interiorAreaSqFt: 14000,
      images: [{ id: '1', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9', isPrimary: true }],
      amenities: ['Private Chapel', 'Vineyards'],
      specifications: { 'Heritage Status': 'Monument Historique' },
      seo: { metaTitle: 'Chateau de Miraval', metaDescription: 'Historic estate', keywords: ['miraval'] },
      source: { type: 'manual', lastSyncedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = storage.saveProperty(testProp);
    if (!saved.slug || !saved.slug.includes('chateau-de-miraval')) {
      throw new Error(`Expected generated slug, got: ${saved.slug}`);
    }

    const fetched = storage.getPropertyById(saved.id);
    if (!fetched || fetched.title !== testProp.title) {
      throw new Error('Property retrieval failed');
    }

    // Cleanup
    storage.deleteProperty(saved.id);
  });

  test('Property Sorting: latest added property appears first (index 0)', () => {
    const brandNewProp: Property = {
      id: `prop-${Date.now() + 50000}`,
      slug: 'hlp-palmgreens-zirakpur-test',
      title: 'HLP PalmGreens Zirakpur Test',
      subtitle: 'Luxury apartments in Zirakpur',
      description: 'Modern luxury flats',
      price: 4800000,
      currency: 'INR',
      category: 'Residential',
      propertyType: 'Penthouse',
      status: 'Published',
      featured: false,
      isNewDevelopment: true,
      address: 'VIP Road',
      city: 'Zirakpur',
      stateRegion: 'Punjab',
      country: 'India',
      coordinates: { lat: 30.64, lng: 76.82 },
      bedrooms: 3,
      bathrooms: 3,
      interiorAreaSqFt: 1850,
      images: [{ id: 'img-1', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9', isPrimary: true }],
      amenities: ['Clubhouse', 'Gym'],
      specifications: {},
      seo: { metaTitle: 'HLP PalmGreens', metaDescription: 'Luxury flats', keywords: ['zirakpur'] },
      source: { type: 'manual', lastSyncedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = storage.saveProperty(brandNewProp);
    const all = storage.getProperties();

    if (all.length === 0 || all[0].id !== saved.id) {
      throw new Error(`Expected newest property to be at index 0, but found "${all[0]?.title}" instead`);
    }

    // Cleanup
    storage.deleteProperty(saved.id);
  });

  // 3. WordPress Nested Value Extraction & Page Builder Fallback
  test('WordPress Extractor: extracts dot-notation paths', () => {
    const mockPost = {
      meta: {
        specs: {
          bedrooms_count: 6,
        },
      },
    };
    const val = getNestedValue(mockPost as any, 'meta.specs.bedrooms_count');
    if (val !== 6) throw new Error(`Expected 6, got ${val}`);
  });

  test('WordPress Extractor: parses varied price strings', () => {
    if (parsePrice('€ 24,500,000') !== 24500000) throw new Error('Failed parsing euro price');
    if (parsePrice('$ 15M') !== 15000000) throw new Error('Failed parsing M price');
    if (parsePrice(4500000) !== 4500000) throw new Error('Failed numeric price');
  });

  test('WordPress Extractor: page-builder text regex fallback', () => {
    const rawContent = '<div>Exclusive estate featuring 7 bedrooms, 9 bathrooms, and 12,500 sq ft of interior luxury. Asking € 35,000,000.</div>';
    const fallback = extractPageBuilderData(rawContent);
    if (fallback.bedrooms !== 7) throw new Error(`Expected 7 beds, got ${fallback.bedrooms}`);
    if (fallback.bathrooms !== 9) throw new Error(`Expected 9 baths, got ${fallback.bathrooms}`);
    if (fallback.interiorAreaSqFt !== 12500) throw new Error(`Expected 12500 sqft, got ${fallback.interiorAreaSqFt}`);
  });

  test('WordPress Importer: converts raw post to Property schema', () => {
    const dummySource: WordPressSource = {
      id: 'test-src',
      name: 'Test Partner',
      siteUrl: 'https://test.wp',
      restApiEndpoint: '/wp-json/wp/v2/properties',
      postType: 'properties',
      status: 'Active',
      authType: 'none',
      propertyCount: 0,
      fieldMapping: {
        titleField: 'title.rendered',
        descriptionField: 'content.rendered',
        priceField: 'meta.price',
        currencyField: 'EUR',
        addressField: 'meta.address',
        cityField: 'meta.city',
        categoryField: 'meta.category',
        bedroomsField: 'meta.bedrooms',
        bathroomsField: 'meta.bathrooms',
        areaField: 'meta.area',
        imageField: 'featured_media_url',
      },
      syncPolicy: 'preserve_central',
      autoSyncEnabled: false,
      syncIntervalHours: 12,
    };

    const rawPost = {
      id: 999,
      title: { rendered: 'Alpine Manor Verbier' },
      content: { rendered: '<p>Stunning alpine retreat with panoramic mountain views.</p>' },
      link: 'https://test.wp/alpine-manor/',
      meta: {
        price: 18000000,
        address: 'Rue de Verbier 10',
        city: 'Verbier',
        category: 'Residential',
        bedrooms: 5,
        bathrooms: 6,
        area: 6500,
      },
      featured_media_url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233',
    };

    const { property } = adaptWordPressPostToProperty(rawPost, dummySource);
    if (property.title !== 'Alpine Manor Verbier') throw new Error('Title adaptation failed');
    if (property.price !== 18000000) throw new Error('Price adaptation failed');
    if (property.source.sourcePropertyId !== '999') throw new Error('Source property ID tracking failed');
  });

  // 4. CSV Import / Export
  test('CSV Engine: exports RFC 4180 with UTF-8 BOM and parses back', () => {
    const testProps = storage.getProperties().slice(0, 2);
    const csv = exportPropertiesToCsv(testProps);
    if (!csv.startsWith('\uFEFFid,slug,title')) {
      throw new Error('CSV missing UTF-8 BOM or header');
    }

    const parsed = parseCsvString(csv);
    if (parsed.length !== testProps.length) {
      throw new Error(`Parsed rows (${parsed.length}) do not match source count (${testProps.length})`);
    }

    if (parsed[0].title !== testProps[0].title) {
      throw new Error('Title mismatch in parsed CSV');
    }
  });

  test('CSV Engine: dry-run detects duplicate records safely', () => {
    const testProps = storage.getProperties().slice(0, 1);
    const csv = exportPropertiesToCsv(testProps);
    const parsed = parseCsvString(csv);

    const dryRunJob = processCsvImport(parsed, true);
    if (dryRunJob.duplicateRecords < 1) {
      throw new Error(`Expected at least 1 duplicate detected, got ${dryRunJob.duplicateRecords}`);
    }
  });

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  return { passed, failed, results };
}
