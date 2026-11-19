/**
 * BUILDsmore — Phase 1 Technical SEO Test Suite
 * Verifies robots.txt, dynamic sitemap.xml, production domain canonicals (https://buildsmoremohali.com),
 * dynamic Open Graph / Twitter metadata, HTML head injection, and 404 detection.
 */

import fs from 'fs';
import path from 'path';
import {
  PRODUCTION_DOMAIN,
  generateRobotsTxt,
  generateSitemapXml,
  injectSeoIntoHtml,
  resolveSeoForRoute,
} from '../src/utils/seo';
import { propertyRepository } from '../src/server/propertyRepository';
import { CuratedCollection, Property } from '../src/types/property';

export async function runPhase1SeoTests(): Promise<{
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

  const allProps = propertyRepository.getAllProperties({ limit: 5000 }).items;
  const allCols = propertyRepository.getAllCollections(true);

  await test('Production Domain: strictly uses https://buildsmoremohali.com (never localhost)', () => {
    if (PRODUCTION_DOMAIN !== 'https://buildsmoremohali.com') {
      throw new Error(`Expected https://buildsmoremohali.com, got ${PRODUCTION_DOMAIN}`);
    }
  });

  await test('robots.txt: allows public routes, disallows /admin & /api, and references production sitemap', () => {
    const robots = generateRobotsTxt();
    if (!robots.includes('User-agent: *')) throw new Error('Missing User-agent directive');
    if (!robots.includes('Allow: /')) throw new Error('Missing Allow: / directive');
    if (!robots.includes('Disallow: /admin')) throw new Error('Missing Disallow: /admin');
    if (!robots.includes('Disallow: /api/')) throw new Error('Missing Disallow: /api/');
    if (!robots.includes('Sitemap: https://buildsmoremohali.com/sitemap.xml')) {
      throw new Error('Missing production Sitemap directive');
    }
    if (/localhost|127\.0\.0\.1/i.test(robots)) {
      throw new Error('robots.txt must never contain localhost');
    }
  });

  await test('sitemap.xml: includes all published properties, published collections & core public pages', () => {
    const draftProp: Property = {
      ...allProps[0],
      id: 'prop-draft-seo-test',
      slug: 'draft-hidden-property-seo-test',
      status: 'Draft',
    };
    const draftCol: CuratedCollection = {
      ...allCols[0],
      id: 'col-draft-seo-test',
      slug: 'draft-hidden-collection-seo-test',
      status: 'Draft',
    };

    const xml = generateSitemapXml([...allProps, draftProp], [...allCols, draftCol]);

    if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
      throw new Error('Invalid XML header in sitemap.xml');
    }
    if (/localhost|127\.0\.0\.1/i.test(xml)) {
      throw new Error('sitemap.xml must never include localhost URLs');
    }
    if (!xml.includes('<loc>https://buildsmoremohali.com/</loc>')) {
      throw new Error('Homepage URL missing from sitemap.xml');
    }
    if (!xml.includes('<loc>https://buildsmoremohali.com/properties</loc>')) {
      throw new Error('/properties missing from sitemap.xml');
    }
    if (!xml.includes('<loc>https://buildsmoremohali.com/category/residential</loc>')) {
      throw new Error('Category page missing from sitemap.xml');
    }

    const publishedProps = allProps.filter((p) => p.status === 'Published');
    for (const prop of publishedProps) {
      const expected = `<loc>https://buildsmoremohali.com/property/${encodeURIComponent(prop.slug)}</loc>`;
      if (!xml.includes(expected)) {
        throw new Error(`Published property missing from sitemap.xml: ${prop.slug}`);
      }
    }

    const publishedCols = allCols.filter((c) => c.status === 'Published');
    for (const col of publishedCols) {
      const expected = `<loc>https://buildsmoremohali.com/collection/${encodeURIComponent(col.slug)}</loc>`;
      if (!xml.includes(expected)) {
        throw new Error(`Published collection missing from sitemap.xml: ${col.slug}`);
      }
    }

    if (xml.includes('draft-hidden-property-seo-test') || xml.includes('draft-hidden-collection-seo-test')) {
      throw new Error('Draft property/collection leaked into sitemap.xml');
    }
    if (!xml.includes('<loc>https://buildsmoremohali.com/blog</loc>')) {
      throw new Error('/blog URL missing from sitemap.xml');
    }
    if (xml.includes('<loc>https://buildsmoremohali.com/about</loc>')) {
      throw new Error('Removed /about URL leaked into sitemap.xml');
    }
  });

  await test('Dynamic Property SEO: generates unique title, description, production canonical & cover og:image', () => {
    const sample = allProps.find((p) => p.slug === 'hlp-palmgreens-zirakpur-68747470') || allProps[0];
    const seo = resolveSeoForRoute(`/property/${sample.slug}`, { properties: allProps, collections: allCols });

    if (seo.isNotFound) throw new Error('Valid property incorrectly marked 404');
    if (seo.canonicalUrl !== `https://buildsmoremohali.com/property/${encodeURIComponent(sample.slug)}`) {
      throw new Error(`Expected production canonical URL, got ${seo.canonicalUrl}`);
    }
    if (/localhost|hlppalmgreen\.com/.test(seo.canonicalUrl || '')) {
      throw new Error(`Canonical URL leaked non-Buildsmore domain: ${seo.canonicalUrl}`);
    }
    if (!seo.title || seo.title === 'BUILDsmore Luxury Real Estate – Architectural Estates & Holdings') {
      throw new Error(`Property SEO title not customized: ${seo.title}`);
    }
    if (!seo.description || seo.description.length < 20) {
      throw new Error('Property meta description is empty or too short');
    }
    if (!seo.ogImage.startsWith('https://')) {
      throw new Error(`Expected absolute HTTPS og:image, got ${seo.ogImage}`);
    }
    if (seo.twitterCard !== 'summary_large_image' || seo.twitterImage !== seo.ogImage) {
      throw new Error('Twitter card image or card type mismatch');
    }
  });

  await test('Dynamic Collection & Public Page SEO: unique canonical URLs & metadata across pages', () => {
    const col = allCols[0];
    const colSeo = resolveSeoForRoute(`/collection/${col.slug}`, { properties: allProps, collections: allCols });
    if (colSeo.isNotFound || colSeo.canonicalUrl !== `https://buildsmoremohali.com/collection/${encodeURIComponent(col.slug)}`) {
      throw new Error(`Invalid collection SEO resolution: ${JSON.stringify(colSeo)}`);
    }

    const contactSeo = resolveSeoForRoute('/contact', { properties: allProps, collections: allCols });
    const propsSeo = resolveSeoForRoute('/properties', { properties: allProps, collections: allCols });
    if (propsSeo.title === contactSeo.title || propsSeo.canonicalUrl === contactSeo.canonicalUrl) {
      throw new Error('Static pages must have unique titles and canonical URLs');
    }

    const adminSeo = resolveSeoForRoute('/admin', { properties: allProps, collections: allCols });
    if (!adminSeo.robots.includes('noindex')) {
      throw new Error('/admin must be marked noindex');
    }
  });

  await test('404 Detection: invalid property, collection, removed /about, missing blog slug & unknown paths trigger 404 & noindex', () => {
    const invalidProp = resolveSeoForRoute('/property/does-not-exist-999', { properties: allProps, collections: allCols });
    const invalidCol = resolveSeoForRoute('/collection/non-existent-collection', { properties: allProps, collections: allCols });
    const removedAbout = resolveSeoForRoute('/about', { properties: allProps, collections: allCols });
    const validBlog = resolveSeoForRoute('/blog', { properties: allProps, collections: allCols });
    const missingBlogSlug = resolveSeoForRoute('/blog/any-article', { properties: allProps, collections: allCols });
    const unknownPage = resolveSeoForRoute('/random-nonexistent-page', { properties: allProps, collections: allCols });

    if (validBlog.isNotFound || validBlog.canonicalUrl !== 'https://buildsmoremohali.com/blog') {
      throw new Error('/blog must resolve cleanly as an indexable page');
    }

    for (const [label, res] of [
      ['invalidProp', invalidProp],
      ['invalidCol', invalidCol],
      ['removedAbout', removedAbout],
      ['missingBlogSlug', missingBlogSlug],
      ['unknownPage', unknownPage],
    ] as const) {
      if (!res.isNotFound) throw new Error(`${label} should have isNotFound: true`);
      if (!res.robots.includes('noindex')) throw new Error(`${label} should be noindex`);
      if (res.canonicalUrl) throw new Error(`${label} must not emit a homepage canonical`);
      if (res.title.includes('Architectural Estates & Holdings')) {
        throw new Error(`${label} must not reuse homepage title`);
      }
    }
  });

  await test('HTML Head Injector: cleanly replaces index.html head metadata without duplicate tags', () => {
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    const prop = allProps[0];
    const seo = resolveSeoForRoute(`/property/${prop.slug}`, { properties: allProps, collections: allCols });
    const injected = injectSeoIntoHtml(indexHtml, seo);

    const titleCount = (injected.match(/<title>/gi) || []).length;
    const canonicalCount = (injected.match(/rel="canonical"/gi) || []).length;
    const ogImgCount = (injected.match(/property="og:image"/gi) || []).length;
    if (titleCount !== 1 || canonicalCount !== 1 || ogImgCount !== 1) {
      throw new Error(`Expected exactly 1 title/canonical/og:image tag, got ${titleCount}/${canonicalCount}/${ogImgCount}`);
    }
    if (!injected.includes(`href="https://buildsmoremohali.com/property/${encodeURIComponent(prop.slug)}"`)) {
      throw new Error('Injected HTML missing expected property canonical tag');
    }
  });

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
