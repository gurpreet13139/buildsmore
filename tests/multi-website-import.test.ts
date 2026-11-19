/**
 * BUILDsmore — Multi-Website WordPress Import & Legacy Migration Integration Tests
 * Verifies SHA-256 source IDs, non-destructive multi-site merging, admin-field preservation,
 * REST & Universal Importer flows, legacy prop-univ-68747470 migration, and disk persistence.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  sha256Hex,
  normalizeSourceUrl,
  extractSourceWebsiteId,
  computeUniversalPropertyId,
  computeWordPressPropertyId,
} from '../src/utils/sourceIdentity';
import { convertExtractedDataToProperty } from '../src/server/universalScraper';
import { executeWordPressImport } from '../src/server/wordpressService';
import { PropertyRepository } from '../src/server/propertyRepository';
import { adaptWordPressPostToProperty, executeWordPressSync } from '../src/services/wordpressImporter';
import { storage } from '../src/services/storage';
import { ExtractedWebsiteData, Property, WordPressSource } from '../src/types/property';

function buildMockExtracted(url: string, title: string, price: number, city = 'Zirakpur'): ExtractedWebsiteData {
  return {
    sourceUrl: url,
    sourceType: 'wordpress_elementor_html',
    title,
    subtitle: `Premier project in ${city}`,
    description: `${title} luxury residential and commercial development in ${city}.`,
    developer: title.split(' ')[0] + ' Group',
    reraNumber: 'PBRERA-TEST-2026',
    category: 'New Projects',
    propertyType: 'Development Parcel',
    price,
    originalPriceText: `₹ ${price.toLocaleString('en-IN')}`,
    currency: 'INR',
    priceInInr: price,
    exchangeRateUsed: 1,
    address: `VIP Corridor, ${city}`,
    city,
    stateRegion: 'Punjab',
    country: 'India',
    phone: '977-987-8303',
    email: 'info@buildsmoremohali.com',
    amenities: ['Club House', '24/7 Gated Security'],
    specifications: { 'Developer / Group': title.split(' ')[0] + ' Group' },
    images: [{ id: 'img-0', url: `https://example.com/${encodeURIComponent(title)}.jpg`, isPrimary: true }],
    floorPlans: [],
    sections: [{ id: 'sec-1', title: 'Overview', content: `${title} overview` }],
    extractionConfidence: {
      title: true,
      price: true,
      location: true,
      images: true,
      rera: true,
      developer: true,
      amenities: true,
    },
    warnings: [],
    scannedAt: new Date().toISOString(),
  };
}

export async function runMultiWebsiteImportTests(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      results.push({ name, success: true });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      results.push({ name, success: false, error: err });
    }
  }

  // Isolated temporary data directory so live data/*.json records are never touched or depended on
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildsmore-mw-test-'));
  const tempPropsFile = path.join(tempDir, 'properties.json');
  const tempColsFile = path.join(tempDir, 'collections.json');
  const tempTrophyFile = path.join(tempDir, 'trophy_holdings.json');
  const repo = new PropertyRepository({ dataDir: tempDir });

  try {
    await test('SHA-256 utility: pure-TS sha256Hex matches Node crypto SHA-256 identically', () => {
      const samples = [
        'https://hlppalmgreen.com/',
        'https://stjforum.com/',
        'https://example-luxury-estates.in/villas/chandigarh',
      ];
      for (const s of samples) {
        const expected = crypto.createHash('sha256').update(s, 'utf8').digest('hex');
        const actual = sha256Hex(s);
        if (actual !== expected) {
          throw new Error(`SHA-256 mismatch for ${s}: got ${actual}, expected ${expected}`);
        }
      }
    });

    await test('Universal Converter: generates unique SHA-256 IDs & sourceWebsiteId for multiple websites', () => {
      const hlpData = buildMockExtracted('https://hlppalmgreen.com/', 'HLP Palm Greens', 4800000);
      const stjData = buildMockExtracted('https://stjforum.com/', 'STJ Forum Mohali', 9000000, 'Mohali');

      const hlpRes = convertExtractedDataToProperty(hlpData, []);
      const stjRes = convertExtractedDataToProperty(stjData, [hlpRes.property]);

      if (hlpRes.property.id === 'prop-univ-68747470' || stjRes.property.id === 'prop-univ-68747470') {
        throw new Error('Legacy colliding ID prop-univ-68747470 should never be generated');
      }
      if (hlpRes.property.id === stjRes.property.id) {
        throw new Error(`Expected distinct IDs for different sites, both got ${hlpRes.property.id}`);
      }
      if (hlpRes.property.source.sourceWebsiteId !== 'hlppalmgreen.com') {
        throw new Error(`Unexpected HLP sourceWebsiteId: ${hlpRes.property.source.sourceWebsiteId}`);
      }
      if (stjRes.property.source.sourceWebsiteId !== 'stjforum.com') {
        throw new Error(`Unexpected STJ sourceWebsiteId: ${stjRes.property.source.sourceWebsiteId}`);
      }
      if (stjRes.action !== 'create') {
        throw new Error(`Expected create action for STJ Forum, got ${stjRes.action}`);
      }
    });

    await test('Repository Merge: importing Website 2 (STJ Forum) merges alongside Website 1 (HLP Palm Greens) and baseline properties', () => {
      const baselineCount = repo.getAllProperties({ limit: 5000 }).total;
      const existingAll = repo.getAllProperties({ limit: 5000 }).items;

      const hlpData = buildMockExtracted('https://hlppalmgreen.com/', 'HLP Palm Greens', 4800000, 'Zirakpur');
      const hlpConverted = convertExtractedDataToProperty(hlpData, existingAll);
      const hlpOutcome = repo.upsertImportedProperty(hlpConverted.property, 'preserve_central');

      if (hlpOutcome.action !== 'created') {
        throw new Error(`Expected HLP created, got ${hlpOutcome.action}`);
      }

      const stjData = buildMockExtracted('https://stjforum.com/', 'STJ Forum Mohali', 9000000, 'Mohali');
      const stjConverted = convertExtractedDataToProperty(
        stjData,
        repo.getAllProperties({ limit: 5000 }).items
      );
      const stjOutcome = repo.upsertImportedProperty(stjConverted.property, 'preserve_central');

      if (stjOutcome.action !== 'created') {
        throw new Error(`Expected STJ created, got ${stjOutcome.action}`);
      }

      const afterCount = repo.getAllProperties({ limit: 5000 }).total;
      if (afterCount !== baselineCount + 2) {
        throw new Error(`Expected ${baselineCount + 2} properties after merging 2 sites, got ${afterCount}`);
      }

      const hlpCheck = repo.getPropertyById(hlpOutcome.property.id);
      const stjCheck = repo.getPropertyById(stjOutcome.property.id);
      if (!hlpCheck || !stjCheck) {
        throw new Error('Both HLP Palm Greens and STJ Forum must coexist in repository');
      }
    });

    await test('Re-Import Update Policy: updates only matching website and preserves all admin-managed fields', () => {
      const hlpId = computeUniversalPropertyId('https://hlppalmgreen.com/');
      const stjId = computeUniversalPropertyId('https://stjforum.com/');

      // Admin customizes HLP Palm Greens
      repo.updateProperty(hlpId, {
        featured: true,
        isTrophyHolding: true,
        trophyOrder: 2,
        status: 'Under Offer',
        locationId: 'loc-zirakpur',
        displayOrder: 7,
        highlights: ['NH-7 Corridor Frontage', 'RERA Cleared'],
        images: [
          { id: 'img-custom-1', url: '/uploads/hlp-custom-brochure.jpg', caption: 'Custom Brochure', isPrimary: true },
        ],
      });

      const beforeStj = JSON.stringify(repo.getPropertyById(stjId));

      // Re-import HLP with updated price under update_existing
      const updatedHlpData = buildMockExtracted('https://www.hlppalmgreen.com/#top', 'HLP Palm Greens', 5400000, 'Zirakpur');
      const converted = convertExtractedDataToProperty(
        updatedHlpData,
        repo.getAllProperties({ limit: 5000 }).items
      );
      const outcome = repo.upsertImportedProperty(converted.property, 'update_existing');

      if (outcome.action !== 'updated') {
        throw new Error(`Expected update action for HLP re-import, got ${outcome.action}`);
      }

      const afterHlp = repo.getPropertyById(hlpId)!;
      if (afterHlp.price !== 5400000) throw new Error(`Expected updated price 5400000, got ${afterHlp.price}`);
      if (!afterHlp.featured) throw new Error('Lost admin featured flag on re-import');
      if (!afterHlp.isTrophyHolding || afterHlp.trophyOrder !== 2) throw new Error('Lost Trophy Holding flags on re-import');
      if (afterHlp.status !== 'Under Offer') throw new Error(`Lost admin status, got ${afterHlp.status}`);
      if (afterHlp.locationId !== 'loc-zirakpur') throw new Error(`Lost admin locationId, got ${afterHlp.locationId}`);
      if (afterHlp.displayOrder !== 7) throw new Error(`Lost displayOrder, got ${afterHlp.displayOrder}`);
      if (!afterHlp.highlights || afterHlp.highlights.length !== 2) throw new Error('Lost admin highlights');
      if (!afterHlp.images.some(i => i.url === '/uploads/hlp-custom-brochure.jpg')) {
        throw new Error('Lost custom admin-uploaded image');
      }

      const afterStj = JSON.stringify(repo.getPropertyById(stjId));
      if (beforeStj !== afterStj) {
        throw new Error('Re-importing HLP modified unrelated STJ Forum property!');
      }
    });

    await test('Preserve Policy: re-importing under preserve_central skips overwriting admin edits', () => {
      const stjId = computeUniversalPropertyId('https://stjforum.com/');
      repo.updateProperty(stjId, { title: 'STJ Forum Curated Admin Title', price: 9500000 });

      const freshStjData = buildMockExtracted('https://stjforum.com/', 'STJ Overwrite Attempt', 1000000, 'Mohali');
      const converted = convertExtractedDataToProperty(
        freshStjData,
        repo.getAllProperties({ limit: 5000 }).items
      );
      const outcome = repo.upsertImportedProperty(converted.property, 'preserve_central');

      if (outcome.action !== 'skipped') {
        throw new Error(`Expected skipped action under preserve_central, got ${outcome.action}`);
      }

      const currentStj = repo.getPropertyById(stjId)!;
      if (currentStj.title !== 'STJ Forum Curated Admin Title' || currentStj.price !== 9500000) {
        throw new Error('preserve_central overwrote existing property edits!');
      }
    });

    await test('REST WordPress Connector: two sites with identical post ID & slug merge without colliding', async () => {
      const postFromAlpha = {
        id: 501,
        slug: 'signature-residences',
        title: { rendered: 'Alpha Signature Residences' },
        content: { rendered: '<p>Alpha site luxury flats</p>' },
        link: 'https://alpha-estates.com/signature-residences/',
        meta: { price: 12000000, city: 'Mohali' },
      };
      const postFromBeta = {
        id: 501,
        slug: 'signature-residences',
        title: { rendered: 'Beta Signature Residences' },
        content: { rendered: '<p>Beta site luxury flats</p>' },
        link: 'https://beta-developments.com/signature-residences/',
        meta: { price: 15000000, city: 'Chandigarh' },
      };

      const resAlpha = await executeWordPressImport('https://alpha-estates.com', [postFromAlpha], undefined, 'preserve_central', repo);
      const resBeta = await executeWordPressImport('https://beta-developments.com', [postFromBeta], undefined, 'preserve_central', repo);

      if (resAlpha.importedCount !== 1 || resBeta.importedCount !== 1) {
        throw new Error(`Expected 1 import each, got alpha=${resAlpha.importedCount}, beta=${resBeta.importedCount}`);
      }

      const alphaId = computeWordPressPropertyId('https://alpha-estates.com', 501);
      const betaId = computeWordPressPropertyId('https://beta-developments.com', 501);
      if (alphaId === betaId) {
        throw new Error('WordPress property IDs collided across different domains!');
      }

      const alphaProp = repo.getPropertyById(alphaId);
      const betaProp = repo.getPropertyById(betaId);
      if (!alphaProp || !betaProp) {
        throw new Error('Both Alpha and Beta REST properties should coexist in repository');
      }
      if (alphaProp.slug === betaProp.slug) {
        throw new Error('Slugs should be scoped uniquely per website');
      }
    });

    await test('Persistence Across Restart: reloadFromDisk() retains all multi-site imported properties', () => {
      const beforeCount = repo.getAllProperties({ limit: 5000 }).total;
      const hlpId = computeUniversalPropertyId('https://hlppalmgreen.com/');
      const stjId = computeUniversalPropertyId('https://stjforum.com/');

      repo.reloadFromDisk();

      const afterCount = repo.getAllProperties({ limit: 5000 }).total;
      if (afterCount !== beforeCount) {
        throw new Error(`Property count changed after reloadFromDisk(): ${beforeCount} -> ${afterCount}`);
      }
      if (!repo.getPropertyById(hlpId) || !repo.getPropertyById(stjId)) {
        throw new Error('Imported properties lost after simulated server restart!');
      }
    });

    await test('Safe Legacy Migration: migrates prop-univ-68747470 cleanly and updates collection & trophy references', () => {
      // Inject a legacy prop-univ-68747470 record referencing a brand new test URL so no conflict occurs
      const legacyUrl = 'https://legacy-palmgreens-migration-test.com/';
      const expectedNewId = computeUniversalPropertyId(legacyUrl);

      const currentProps: Property[] = JSON.parse(fs.readFileSync(tempPropsFile, 'utf-8'));
      const legacyProp: Property = {
        ...currentProps[0],
        id: 'prop-univ-68747470',
        slug: 'legacy-hlp-68747470',
        title: 'Legacy HLP Migration Record',
        featured: true,
        isTrophyHolding: true,
        trophyOrder: 4,
        source: {
          type: 'wordpress',
          sourceWebsiteName: 'Legacy HLP',
          sourcePropertyId: '68747470',
          sourceUrl: legacyUrl,
          lastSyncedAt: new Date().toISOString(),
        },
      };
      currentProps.push(legacyProp);
      fs.writeFileSync(tempPropsFile, JSON.stringify(currentProps, null, 2), 'utf-8');

      const currentCols = JSON.parse(fs.readFileSync(tempColsFile, 'utf-8'));
      currentCols[0].propertyIds.push('prop-univ-68747470');
      fs.writeFileSync(tempColsFile, JSON.stringify(currentCols, null, 2), 'utf-8');

      const currentTrophy: string[] = JSON.parse(fs.readFileSync(tempTrophyFile, 'utf-8'));
      currentTrophy.push('prop-univ-68747470');
      fs.writeFileSync(tempTrophyFile, JSON.stringify(currentTrophy, null, 2), 'utf-8');

      // Run migration via reloadFromDisk on isolated repository
      repo.reloadFromDisk();

      const migrated = repo.getPropertyById(expectedNewId);
      if (!migrated) {
        throw new Error(`Legacy property was not migrated to SHA-256 ID ${expectedNewId}`);
      }
      if (migrated.title !== 'Legacy HLP Migration Record' || !migrated.featured || !migrated.isTrophyHolding) {
        throw new Error('Legacy property lost fields during migration');
      }

      const colAfter = repo.getAllCollections(true)[0];
      if (!colAfter.propertyIds.includes(expectedNewId) || colAfter.propertyIds.includes('prop-univ-68747470')) {
        throw new Error('Collection reference was not safely remapped during legacy migration');
      }

      const trophyList = repo.getTrophyHoldings();
      if (!trophyList.some(p => p.id === expectedNewId)) {
        throw new Error('Trophy holding reference was not safely remapped during legacy migration');
      }

      // Also verify client storage.migrateLegacyPropertyList never deletes colliding records
      const collisionList: Property[] = [
        { ...legacyProp, id: 'prop-univ-68747470', title: 'Record A Legacy' },
        { ...legacyProp, id: expectedNewId, title: 'Record B Existing' },
      ];
      const safeResult = storage.migrateLegacyPropertyList(collisionList);
      if (safeResult.list.length !== 2) {
        throw new Error('Conflict safety violated: migration deleted or dropped a colliding property!');
      }
    });

    await test('Client WP Importer: multi-site sync merges cleanly without overwriting unrelated site', async () => {
      const initialClientSnapshot = storage.getProperties();
      try {
        const baseline = storage.getProperties().length;
        const src1: WordPressSource = {
          id: 'wp-test-site-1',
          name: 'Site One',
          siteUrl: 'https://site-one-wp-test.com',
          restApiEndpoint: '/wp-json/wp/v2/properties',
          postType: 'properties',
          status: 'Active',
          authType: 'none',
          propertyCount: 0,
          fieldMapping: {
            titleField: 'title.rendered',
            descriptionField: 'content.rendered',
            priceField: 'meta.price',
            currencyField: 'INR',
            addressField: 'meta.address',
            cityField: 'meta.city',
            categoryField: 'meta.category',
            bedroomsField: 'meta.bedrooms',
            bathroomsField: 'meta.bathrooms',
            areaField: 'meta.sqft',
            imageField: 'featured_media_url',
          },
          syncPolicy: 'preserve_central',
          autoSyncEnabled: false,
          syncIntervalHours: 12,
        };
        const src2: WordPressSource = {
          ...src1,
          id: 'wp-test-site-2',
          name: 'Site Two',
          siteUrl: 'https://site-two-wp-test.com',
        };

        const job1 = await executeWordPressSync(src1, false);
        const job2 = await executeWordPressSync(src2, false);

        if (job1.newRecords !== 1 || job2.newRecords !== 1) {
          throw new Error(`Expected 1 new record per site, got job1=${job1.newRecords}, job2=${job2.newRecords}`);
        }

        const totalAfter = storage.getProperties().length;
        if (totalAfter !== baseline + 2) {
          throw new Error(`Expected ${baseline + 2} properties in client storage, got ${totalAfter}`);
        }

        const p1 = adaptWordPressPostToProperty({ id: 501, title: { rendered: 'A' } }, src1).property;
        const p2 = adaptWordPressPostToProperty({ id: 501, title: { rendered: 'B' } }, src2).property;
        storage.deleteProperty(p1.id);
        storage.deleteProperty(p2.id);
      } finally {
        storage.saveProperties(initialClientSnapshot);
      }
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  return { passed, failed, results };
}
