/**
 * BUILDsmore — Blog & Journal Functional, Persistence, SEO & SSR Test Suite
 * Uses isolated temp directories so real workspace data/ files are never modified.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { BlogRepository } from '../src/server/blogRepository';
import { BLOGS_UPSERT_COLUMNS, syncBlogToPostgres } from '../src/server/postgresSync';
import { render } from '../src/entry-server';
import { generateSitemapXml, InitialAppData, injectSeoIntoHtml, resolveSeoForRoute } from '../src/utils/seo';
import { BlogPost } from '../src/types/property';

export async function runBlogTests(): Promise<{
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

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildsmore-blog-test-'));

  try {
    await test('BlogRepository initializes empty (no demo articles) when data/blogs.json does not exist', () => {
      const repo = new BlogRepository({ dataDir: tmpDir });
      const res = repo.getAllBlogs({ includeDrafts: true });
      if (res.total !== 0 || res.items.length !== 0) {
        throw new Error(`Expected empty blog repository, got ${res.total} items`);
      }
    });

    await test('BlogRepository CRUD: create, unique slug, publish toggle, update, reloadFromDisk persistence & delete', () => {
      const repo = new BlogRepository({ dataDir: tmpDir });

      const draft = repo.createBlog({
        title: 'Mohali Aerocity Corridor Overview',
        content: '## Strategic Infrastructure\n\nDirect expressway access and sector connectivity.',
        category: 'Market Intelligence',
        tags: ['Mohali', 'Aerocity'],
        status: 'Draft',
      });

      if (draft.status !== 'Draft' || draft.slug !== 'mohali-aerocity-corridor-overview') {
        throw new Error(`Unexpected created draft metadata: ${JSON.stringify(draft)}`);
      }

      // Duplicate title creates unique slug
      const dup = repo.createBlog({
        title: 'Mohali Aerocity Corridor Overview',
        content: 'Follow-up note.',
        status: 'Published',
      });
      if (dup.slug === draft.slug) {
        throw new Error(`Expected unique slug suffix on duplicate title, got ${dup.slug}`);
      }

      // Public query excludes draft
      const publicOnly = repo.getAllBlogs({ includeDrafts: false });
      if (publicOnly.total !== 1 || publicOnly.items[0].id !== dup.id) {
        throw new Error('Public blog query leaked a Draft article');
      }

      // Toggle publish & verify persistence after reloadFromDisk
      const published = repo.togglePublish(draft.id);
      if (!published || published.status !== 'Published') {
        throw new Error('togglePublish did not transition Draft -> Published');
      }

      const updated = repo.updateBlog(draft.id, {
        title: 'Mohali Aerocity Corridor Brief',
        featured: true,
      });
      if (!updated || updated.title !== 'Mohali Aerocity Corridor Brief' || !updated.featured) {
        throw new Error('updateBlog failed to apply field changes');
      }

      const freshRepo = new BlogRepository({ dataDir: tmpDir });
      const reloaded = freshRepo.getBlogById(draft.id);
      if (!reloaded || reloaded.title !== 'Mohali Aerocity Corridor Brief' || reloaded.status !== 'Published') {
        throw new Error('Updated blog did not survive disk reload');
      }

      // Clean delete
      const deletedA = freshRepo.deleteBlog(draft.id);
      const deletedB = freshRepo.deleteBlog(dup.id);
      if (!deletedA || !deletedB || freshRepo.getAllRawBlogs().length !== 0) {
        throw new Error('Blog deletion failed');
      }
    });

    await test('PostgreSQL Blog Sync: aligns with Drizzle schema columns and executes clean UPSERT', async () => {
      const schemaContent = fs.readFileSync(path.resolve(process.cwd(), 'src/db/schema.ts'), 'utf-8');
      for (const col of BLOGS_UPSERT_COLUMNS) {
        if (!schemaContent.includes(`'${col}'`) && col !== 'id' && col !== 'slug' && col !== 'title') {
          throw new Error(`Blog upsert column "${col}" not found in src/db/schema.ts`);
        }
      }

      const executedQueries: Array<{ text: string; params?: unknown[] }> = [];
      const mockPool = {
        async query(text: string, params?: unknown[]) {
          executedQueries.push({ text, params });
          return { rows: [] };
        },
      };

      const samplePost: BlogPost = {
        id: 'blog-pg-test-1',
        slug: 'tricity-commercial-outlook',
        title: 'Tricity Commercial Outlook',
        excerpt: 'IT City corridor commercial leasing trends.',
        content: 'Full editorial note.',
        category: 'Market Intelligence',
        tags: ['Mohali', 'Commercial'],
        featuredImage: '/assets/aistudio/logo-builds_more_aa2f07ab.jpeg',
        featuredImageAlt: 'Commercial tower',
        authorName: 'BUILDsmore Editorial Desk',
        authorRole: 'Advisory',
        status: 'Published',
        featured: true,
        readTimeMinutes: 2,
        seo: {
          metaTitle: 'Tricity Commercial Outlook – BUILDsmore Journal',
          metaDescription: 'IT City corridor commercial leasing trends.',
          keywords: ['Mohali', 'Commercial'],
        },
        publishedAt: '2026-04-01T10:00:00.000Z',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      };

      const syncRes = await syncBlogToPostgres(samplePost, mockPool);
      if (!syncRes.synced) {
        throw new Error(`syncBlogToPostgres failed: ${syncRes.error}`);
      }
      if (!executedQueries.some((q) => q.text.includes('INSERT INTO blogs'))) {
        throw new Error('Expected INSERT INTO blogs query to run');
      }
    });

    await test('Blog SEO & Sitemap: emits Blog/Article/BreadcrumbList JSON-LD and excludes Draft articles', () => {
      const publishedPost: BlogPost = {
        id: 'blog-seo-1',
        slug: 'chandigarh-heritage-villas',
        title: 'Chandigarh Heritage Sector Villas',
        excerpt: 'Low-density architectural residences in Sector 5.',
        content: 'Architectural study of modernist plots in Chandigarh.',
        category: 'Architecture & Design',
        tags: ['Chandigarh', 'Architecture'],
        featuredImage: '/assets/aistudio/logo-builds_more_aa2f07ab.jpeg',
        featuredImageAlt: 'Chandigarh Residence',
        authorName: 'BUILDsmore Editorial Desk',
        authorRole: 'Private Real Estate Advisory',
        status: 'Published',
        featured: true,
        readTimeMinutes: 3,
        seo: {
          metaTitle: 'Chandigarh Heritage Sector Villas – BUILDsmore Journal',
          metaDescription: 'Architectural study of modernist plots in Chandigarh.',
          keywords: ['Chandigarh'],
        },
        publishedAt: '2026-04-02T09:00:00.000Z',
        createdAt: '2026-04-02T09:00:00.000Z',
        updatedAt: '2026-04-02T09:00:00.000Z',
      };

      const draftPost: BlogPost = {
        ...publishedPost,
        id: 'blog-seo-2',
        slug: 'unpublished-draft-brief',
        title: 'Unpublished Draft Brief',
        status: 'Draft',
      };

      const listSeo = resolveSeoForRoute('/blog', {
        properties: [],
        collections: [],
        blogs: [publishedPost, draftPost],
      });
      if (listSeo.isNotFound) throw new Error('/blog should not be marked isNotFound');
      if (!listSeo.structuredData?.some((s) => s['@type'] === 'Blog')) {
        throw new Error('/blog SEO missing Blog JSON-LD');
      }

      const detailSeo = resolveSeoForRoute('/blog/chandigarh-heritage-villas', {
        properties: [],
        collections: [],
        blogs: [publishedPost, draftPost],
      });
      if (detailSeo.isNotFound) throw new Error('Published /blog/:slug marked 404');
      if (!detailSeo.structuredData?.some((s) => s['@type'] === 'Article')) {
        throw new Error('Published /blog/:slug missing Article JSON-LD');
      }
      if (!detailSeo.structuredData?.some((s) => s['@type'] === 'BreadcrumbList')) {
        throw new Error('Published /blog/:slug missing BreadcrumbList JSON-LD');
      }

      const draftSeo = resolveSeoForRoute('/blog/unpublished-draft-brief', {
        properties: [],
        collections: [],
        blogs: [publishedPost, draftPost],
      });
      if (!draftSeo.isNotFound || !draftSeo.robots.includes('noindex')) {
        throw new Error('Draft blog slug must return 404 with noindex, nofollow');
      }

      const sitemap = generateSitemapXml([], [], [publishedPost, draftPost]);
      if (!sitemap.includes('<loc>https://buildsmoremohali.com/blog</loc>')) {
        throw new Error('Sitemap missing /blog landing URL');
      }
      if (!sitemap.includes('<loc>https://buildsmoremohali.com/blog/chandigarh-heritage-villas</loc>')) {
        throw new Error('Sitemap missing published blog article URL');
      }
      if (sitemap.includes('unpublished-draft-brief')) {
        throw new Error('Sitemap leaked draft blog article');
      }
    });

    await test('Blog SSR: /blog renders Journal HTML (never 404), /blog/:slug renders Article, and missing slug renders 404', () => {
      const indexTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
      const publishedPost: BlogPost = {
        id: 'blog-ssr-1',
        slug: 'it-city-mohali-update',
        title: 'IT City Mohali Infrastructure Briefing',
        excerpt: 'Airport road institutional corridor review.',
        content: '## Key Highlights\n\nMixed-use commercial zoning across Sector 82A.',
        category: 'Tricity Spotlight',
        tags: ['Mohali'],
        featuredImage: '',
        authorName: 'BUILDsmore Editorial Desk',
        status: 'Published',
        featured: true,
        readTimeMinutes: 2,
        seo: { metaTitle: 'IT City Mohali Infrastructure Briefing', metaDescription: 'Review', keywords: ['Mohali'] },
        publishedAt: '2026-04-03T10:00:00.000Z',
        createdAt: '2026-04-03T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z',
      };

      const emptyData: InitialAppData = {
        properties: [],
        collections: [],
        locations: [],
        trophyHoldings: [],
        blogs: [],
      };
      const emptyBlogSeo = resolveSeoForRoute('/blog', emptyData);
      const emptyBlogHtml = injectSeoIntoHtml(indexTemplate, emptyBlogSeo, {
        appHtml: render('/blog', emptyData),
        initialData: emptyData,
      });
      if (!emptyBlogHtml.includes('The BUILDsmore Journal') || emptyBlogHtml.includes('THIS SPACE')) {
        throw new Error('SSR /blog rendered 404 instead of Journal page when empty');
      }

      const fullData: InitialAppData = { ...emptyData, blogs: [publishedPost] };
      const detailSeo = resolveSeoForRoute('/blog/it-city-mohali-update', fullData);
      const detailHtml = injectSeoIntoHtml(indexTemplate, detailSeo, {
        appHtml: render('/blog/it-city-mohali-update', fullData),
        initialData: fullData,
      });
      if (!detailHtml.includes('IT City Mohali Infrastructure Briefing') || !detailHtml.includes('"@type":"Article"')) {
        throw new Error('SSR /blog/:slug missing article heading or Article JSON-LD');
      }

      const missingSeo = resolveSeoForRoute('/blog/does-not-exist', fullData);
      const missingHtml = injectSeoIntoHtml(indexTemplate, missingSeo, {
        appHtml: render('/blog/does-not-exist', fullData),
        initialData: fullData,
      });
      if (!missingHtml.includes('Page Not Found') || !missingHtml.includes('content="noindex, nofollow"')) {
        throw new Error('Missing /blog/:slug did not render 404 NotFoundPage with noindex');
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
