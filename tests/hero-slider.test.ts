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
  isHeroVideoUrl,
  resolveActiveHeroSlides,
} from '../src/utils/heroSlides';
import { detectSafeVideoFormat } from '../src/server/storage-local';
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
      const defaultHeroSection = defaultHtml.split('<section')[1]?.split('</section>')[0] || '';
      if (
        !defaultHtml.includes(DEFAULT_HERO_HEADING.replace(/&/g, '&amp;')) ||
        !defaultHtml.includes(DEFAULT_HERO_IMAGE_URL.replace(/&/g, '&amp;')) ||
        !defaultHeroSection.includes('<video')
      ) {
        throw new Error('SSR homepage with 0 slides did not render default Buildsmore hero video banner');
      }
      if (defaultHeroSection.includes('<img')) {
        throw new Error('Default video hero banner must never render an <img> together with <video>');
      }
      if (defaultHtml.includes('Hero banner slide navigation')) {
        throw new Error('Single default hero banner should not render multi-slide controls');
      }

      // Verify single custom IMAGE slide renders ONLY <img> and never <video> in hero section
      const singleImageHtml = render('/', {
        ...baseData,
        heroSlides: [
          {
            id: 'ssr-img-only',
            imageUrl: '/uploads/image-only-banner.jpg',
            heading: 'Image Only Banner',
            description: 'Displays only the selected image background.',
            displayOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      const singleImageHero = singleImageHtml.split('<section')[1]?.split('</section>')[0] || '';
      if (!singleImageHero.includes('<img') || !singleImageHero.includes('/uploads/image-only-banner.jpg')) {
        throw new Error('Single image hero banner did not render selected image');
      }
      if (singleImageHero.includes('<video')) {
        throw new Error('Image hero banner must never render a <video> together with <img>');
      }

      // Verify right-side Hero Enquiry Form fields are rendered on the homepage banner
      for (const requiredText of [
        'Full Name',
        'Mobile Number',
        'Interested In',
        'Residential',
        'Commercial',
        'Plots',
        'Preferred Location',
        'Budget Range',
        'Submit Enquiry',
      ]) {
        if (!defaultHtml.includes(requiredText)) {
          throw new Error(`Homepage hero enquiry form missing expected field/label: ${requiredText}`);
        }
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
            imageUrl: '/uploads/custom-hero-2.mp4',
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
        !customHtml.includes('<video') ||
        !customHtml.includes('/uploads/custom-hero-2.mp4') ||
        !customHtml.includes('Hero banner slide navigation')
      ) {
        throw new Error('SSR homepage did not render dynamic image + video hero slides and navigation controls');
      }
    });

    await test('Hero Banner Video Support: detects video URLs and validates safe binary headers', () => {
      if (!isHeroVideoUrl('/uploads/tour.mp4') || !isHeroVideoUrl('https://cdn.example.com/clip.webm?v=1')) {
        throw new Error('isHeroVideoUrl failed to recognize valid video URLs');
      }
      if (isHeroVideoUrl('/uploads/estate.webp') || isHeroVideoUrl('')) {
        throw new Error('isHeroVideoUrl falsely flagged non-video URL');
      }

      const resolved = resolveActiveHeroSlides([
        {
          id: 'vid-1',
          imageUrl: '/uploads/hero-showcase.mp4',
          heading: 'Signature Video Showcase',
          description: 'Cinematic walkthrough of Mohali luxury villas.',
          displayOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      if (resolved[0].mediaType !== 'video') {
        throw new Error('resolveActiveHeroSlides did not classify .mp4 slide as video');
      }

      // Valid ISO-BMFF MP4 header: size(4) + 'ftyp' + 'mp42' + version(4)
      const validMp4 = Buffer.from([
        0x00, 0x00, 0x00, 0x18,
        0x66, 0x74, 0x79, 0x70, // ftyp
        0x6d, 0x70, 0x34, 0x32, // mp42
        0x00, 0x00, 0x00, 0x00,
      ]);
      const mp4Detected = detectSafeVideoFormat(validMp4);
      if (!mp4Detected || mp4Detected.ext !== 'mp4') {
        throw new Error('detectSafeVideoFormat rejected a valid MP4 header');
      }

      // Valid WebM EBML header
      const validWebm = Buffer.from([
        0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81,
        0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81,
      ]);
      const webmDetected = detectSafeVideoFormat(validWebm);
      if (!webmDetected || webmDetected.ext !== 'webm') {
        throw new Error('detectSafeVideoFormat rejected a valid WebM header');
      }

      // Disguised HTML/SVG payload must be rejected
      const fakeVideo = Buffer.from('<html><script>alert(1)</script></html>', 'utf-8');
      if (detectSafeVideoFormat(fakeVideo) !== null) {
        throw new Error('detectSafeVideoFormat accepted a disguised HTML payload');
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
