/**
 * BUILDsmore — Dynamic Hero Banner Slider CRUD, Reordering, Fallback & SSR Test Suite
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { HeroSlideRepository } from '../src/server/heroSlideRepository';
import {
  HERO_SLIDES_UPSERT_COLUMNS,
  syncHeroSlideToPostgres,
} from '../src/server/postgresSync';
import {
  DEFAULT_HERO_DESCRIPTION,
  DEFAULT_HERO_HEADING,
  DEFAULT_HERO_IMAGE_URL,
  resolveActiveHeroSlides,
} from '../src/utils/heroSlides';
import { render } from '../src/entry-server';
import { propertyRepository } from '../src/server/propertyRepository';

export async function runHeroSliderTests(): Promise<{
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
      results.push({
        name,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildsmore-hero-test-'));

  try {
    await test('Fallback Guarantee: empty or incomplete slides always resolve to exact default homepage hero banner', () => {
      const fromEmpty = resolveActiveHeroSlides([]);
      if (
        fromEmpty.length !== 1 ||
        fromEmpty[0].imageUrl !== DEFAULT_HERO_IMAGE_URL ||
        fromEmpty[0].heading !== DEFAULT_HERO_HEADING ||
        fromEmpty[0].description !== DEFAULT_HERO_DESCRIPTION
      ) {
        throw new Error('Empty slide list did not fall back to exact default hero banner');
      }

      const fromIncomplete = resolveActiveHeroSlides([
        {
          id: 'inc-1',
          imageUrl: '/uploads/banner.jpg',
          heading: 'Missing Description Only',
          description: '   ',
          displayOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'inc-2',
          imageUrl: '',
          heading: 'Missing Image',
          description: 'Has description but no image.',
          displayOrder: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      if (
        fromIncomplete.length !== 1 ||
        !fromIncomplete[0].isDefault ||
        fromIncomplete[0].heading !== DEFAULT_HERO_HEADING
      ) {
        throw new Error('Incomplete admin slides did not fall back cleanly to default hero banner');
      }
    });

    await test('HeroSlideRepository CRUD, Reorder & Disk Persistence across reloadFromDisk()', () => {
      const repo = new HeroSlideRepository({ dataDir: tmpDir });
      if (repo.getAllSlides().length !== 0) {
        throw new Error('Fresh HeroSlideRepository should start empty');
      }

      const s1 = repo.createSlide({
        imageUrl: '/uploads/slide-1.jpg',
        heading: 'Mohali Trophy Estates',
        description: 'Signature architectural villas across Aerocity and Sector 82A.',
      });
      const s2 = repo.createSlide({
        imageUrl: '/uploads/slide-2.jpg',
        heading: 'New Chandigarh Private Plots',
        description: 'Curated investment land holdings along Shivalik foothills.',
      });
      const s3 = repo.createSlide({
        imageUrl: '/uploads/slide-3.jpg',
        heading: 'Commercial High-Street Landmarks',
        description: 'Institutional-grade retail and corporate plazas across Tricity.',
      });

      const updated = repo.updateSlide(s2.id, {
        heading: 'New Chandigarh Signature Plots',
      });
      if (!updated || updated.heading !== 'New Chandigarh Signature Plots') {
        throw new Error('Failed to update hero slide heading');
      }

      const reordered = repo.reorderSlides([s3.id, s1.id, s2.id]);
      if (
        reordered.length !== 3 ||
        reordered[0].id !== s3.id ||
        reordered[1].id !== s1.id ||
        reordered[2].id !== s2.id ||
        reordered[0].displayOrder !== 0 ||
        reordered[2].displayOrder !== 2
      ) {
        throw new Error('Hero slide reorder did not preserve expected order and indexes');
      }

      // Verify reload from disk persists exact order and edits
      const repoReloaded = new HeroSlideRepository({ dataDir: tmpDir });
      const reloadedSlides = repoReloaded.getAllSlides();
      if (reloadedSlides.length !== 3 || reloadedSlides[0].id !== s3.id) {
        throw new Error('Reordered slides did not persist across reloadFromDisk');
      }

      const deleted = repoReloaded.deleteSlide(s1.id);
      if (!deleted || repoReloaded.getAllSlides().length !== 2) {
        throw new Error('Hero slide deletion failed');
      }
    });

    await test('PostgreSQL Hero Slide Sync: aligns with Drizzle schema columns and executes clean UPSERT', async () => {
      const schemaSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/db/schema.ts'), 'utf-8');
      for (const col of HERO_SLIDES_UPSERT_COLUMNS) {
        if (!schemaSrc.includes(`'${col}'`)) {
          throw new Error(`hero_slides column '${col}' missing from src/db/schema.ts`);
        }
      }

      let executedSql = '';
      let executedParams: unknown[] = [];
      const mockPool = {
        query: async (text: string, params?: unknown[]) => {
          executedSql = text;
          executedParams = params || [];
          return { rows: [] };
        },
      };

      const res = await syncHeroSlideToPostgres(
        {
          id: 'hero-pg-1',
          imageUrl: '/uploads/hero-pg.webp',
          heading: 'Luxury Estates Mohali',
          description: 'Curated trophy holdings across Tricity.',
          displayOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        mockPool
      );

      if (!res.synced || !executedSql.includes('INSERT INTO hero_slides') || executedParams.length !== 7) {
        throw new Error('Hero slide PostgreSQL UPSERT failed or had mismatched parameters');
      }
    });

    await test('Hero Banner SSR: renders default banner when empty and dynamic slides + controls when 2+ complete slides exist', () => {
      const baseData = {
        properties: propertyRepository.getAllProperties({ status: 'Published', limit: 20 }).items,
        collections: propertyRepository.getAllCollections(false),
        locations: propertyRepository.getAllLocations(true),
        trophyHoldings: propertyRepository.getTrophyHoldings(),
        blogs: [],
      };

      const defaultHtml = render('/', { ...baseData, heroSlides: [] });
      if (
        !defaultHtml.includes(DEFAULT_HERO_HEADING.replace(/&/g, '&amp;')) ||
        !defaultHtml.includes(DEFAULT_HERO_IMAGE_URL.replace(/&/g, '&amp;'))
      ) {
        throw new Error('SSR homepage with 0 slides did not render default hero banner');
      }
      if (defaultHtml.includes('Hero banner slide navigation')) {
        throw new Error('Single default hero banner should not render multi-slide controls');
      }

      const customHtml = render('/', {
        ...baseData,
        heroSlides: [
          {
            id: 'ssr-slide-1',
            imageUrl: '/uploads/custom-hero-1.jpg',
            heading: 'Tricity Luxury Residences',
            description: 'Handpicked penthouses and private estates in Mohali & New Chandigarh.',
            displayOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'ssr-slide-2',
            imageUrl: '/uploads/custom-hero-2.jpg',
            heading: 'Prime Commercial Corridors',
            description: 'Grade-A retail and corporate landmarks with verified titles.',
            displayOrder: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      if (
        !customHtml.includes('Tricity Luxury Residences') ||
        !customHtml.includes('/uploads/custom-hero-1.jpg') ||
        !customHtml.includes('/uploads/custom-hero-2.jpg') ||
        !customHtml.includes('Hero banner slide navigation')
      ) {
        throw new Error('SSR homepage did not render dynamic hero slides and navigation controls');
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
