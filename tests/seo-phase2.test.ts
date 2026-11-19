/**
 * BUILDsmore — Phase 2 SEO Test Suite
 * Verifies semantic <a href> links, Breadcrumb navigation + BreadcrumbList JSON-LD,
 * fixed category breadcrumb routes, and full SSR initial HTML content + metadata.
 */

import fs from 'fs';
import path from 'path';
import { render } from '../src/entry-server';
import { propertyRepository } from '../src/server/propertyRepository';
import {
  InitialAppData,
  getCategoryRoute,
  injectSeoIntoHtml,
  resolveSeoForRoute,
} from '../src/utils/seo';

export async function runPhase2SeoTests(): Promise<{
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

  const initialData: InitialAppData = {
    properties: propertyRepository.getAllProperties({ limit: 5000 }).items,
    collections: propertyRepository.getAllCollections(true),
    locations: propertyRepository.getAllLocations(false),
    trophyHoldings: propertyRepository.getTrophyHoldings(),
  };

  const indexTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');

  const renderFullDocument = (routePath: string): string => {
    const seo = resolveSeoForRoute(routePath, {
      properties: initialData.properties,
      collections: initialData.collections,
    });
    const appHtml = render(routePath, initialData);
    return injectSeoIntoHtml(indexTemplate, seo, { appHtml, initialData });
  };

  await test('Category Breadcrumb Routes: fixes Plots/Land -> /category/land & New Projects -> /category/developments', () => {
    const cases: Array<[string, string]> = [
      ['Residential', '/category/residential'],
      ['Commercial', '/category/commercial'],
      ['Plots/Land', '/category/land'],
      ['plotsland', '/category/land'],
      ['New Projects', '/category/developments'],
      ['newprojects', '/category/developments'],
    ];
    for (const [input, expected] of cases) {
      const actual = getCategoryRoute(input);
      if (actual !== expected) {
        throw new Error(`getCategoryRoute("${input}") returned "${actual}", expected "${expected}"`);
      }
    }
  });

  await test('Structured Data: emits BreadcrumbList, RealEstateListing & CollectionPage JSON-LD with production URLs', () => {
    const prop = initialData.properties.find((p) => p.category === 'Plots/Land') || initialData.properties[0];
    const propSeo = resolveSeoForRoute(`/property/${prop.slug}`, {
      properties: initialData.properties,
      collections: initialData.collections,
    });

    const breadcrumbLd = propSeo.structuredData?.find((s) => s['@type'] === 'BreadcrumbList') as any;
    const listingLd = propSeo.structuredData?.find((s) => s['@type'] === 'RealEstateListing') as any;
    if (!breadcrumbLd || !Array.isArray(breadcrumbLd.itemListElement) || breadcrumbLd.itemListElement.length < 4) {
      throw new Error('Property BreadcrumbList JSON-LD missing or incomplete');
    }
    if (prop.category === 'Plots/Land') {
      const catItem = breadcrumbLd.itemListElement[2]?.item;
      if (catItem !== 'https://buildsmoremohali.com/category/land') {
        throw new Error(`Property BreadcrumbList category URL broken: ${catItem}`);
      }
    }
    if (!listingLd || listingLd.name !== prop.title) {
      throw new Error('Property RealEstateListing JSON-LD missing');
    }

    const col = initialData.collections[0];
    const colSeo = resolveSeoForRoute(`/collection/${col.slug}`, {
      properties: initialData.properties,
      collections: initialData.collections,
    });
    const colLd = colSeo.structuredData?.find((s) => s['@type'] === 'CollectionPage') as any;
    const colBreadcrumb = colSeo.structuredData?.find((s) => s['@type'] === 'BreadcrumbList') as any;
    if (!colLd || !colBreadcrumb) {
      throw new Error('Collection structured data (CollectionPage + BreadcrumbList) missing');
    }
  });

  await test('True SSR Property Pages: initial HTML renders content, breadcrumbs, category <a href>, & metadata for ALL published properties', () => {
    const published = initialData.properties.filter((p) => p.status === 'Published');
    if (published.length === 0) throw new Error('No published properties available to test');

    for (const prop of published) {
      const route = `/property/${encodeURIComponent(prop.slug)}`;
      const html = renderFullDocument(route);
      const expectedCategoryHref = getCategoryRoute(prop.category);

      if (!html.includes('<nav aria-label="Breadcrumb"')) {
        throw new Error(`Missing semantic Breadcrumb nav on SSR property ${prop.slug}`);
      }
      if (!html.includes(`href="${expectedCategoryHref}"`)) {
        throw new Error(`Missing fixed category link ${expectedCategoryHref} on SSR property ${prop.slug}`);
      }
      if (html.includes('/category/plotsland') || html.includes('/category/new%20projects')) {
        throw new Error(`Broken legacy category breadcrumb link found on ${prop.slug}`);
      }
      if (!html.includes(prop.city) || !html.includes('Architectural Profile')) {
        throw new Error(`Missing rendered property dossier body content in SSR HTML for ${prop.slug}`);
      }
      if (!html.includes(`href="https://buildsmoremohali.com/property/${encodeURIComponent(prop.slug)}"`)) {
        throw new Error(`Missing production canonical URL in SSR HTML for ${prop.slug}`);
      }
      if (!html.includes('"@type":"BreadcrumbList"') || !html.includes('"@type":"RealEstateListing"')) {
        throw new Error(`Missing BreadcrumbList or RealEstateListing JSON-LD in SSR HTML for ${prop.slug}`);
      }
      if (!html.includes('id="__BUILDSMORE_INITIAL_DATA__"')) {
        throw new Error(`Missing hydration snapshot script on ${prop.slug}`);
      }
    }
  });

  await test('True SSR Collection & Category Pages: initial HTML renders H1, breadcrumbs, semantic property links & JSON-LD', () => {
    for (const catRoute of ['/category/residential', '/category/commercial', '/category/land', '/category/developments']) {
      const html = renderFullDocument(catRoute);
      if (!html.includes('<nav aria-label="Breadcrumb"')) {
        throw new Error(`Missing breadcrumb nav on ${catRoute}`);
      }
      if (!html.includes(`href="https://buildsmoremohali.com${catRoute}"`)) {
        throw new Error(`Missing canonical link on ${catRoute}`);
      }
      if (!html.includes('"@type":"BreadcrumbList"')) {
        throw new Error(`Missing BreadcrumbList JSON-LD on ${catRoute}`);
      }
    }

    const col = initialData.collections.find((c) => c.status === 'Published') || initialData.collections[0];
    const colRoute = `/collection/${encodeURIComponent(col.slug)}`;
    const colHtml = renderFullDocument(colRoute);
    if (!colHtml.includes(col.title) || !colHtml.includes('<nav aria-label="Breadcrumb"')) {
      throw new Error(`Missing SSR collection title/breadcrumbs on ${colRoute}`);
    }
    if (!colHtml.includes('"@type":"CollectionPage"') || !colHtml.includes('href="/property/')) {
      throw new Error(`Missing CollectionPage JSON-LD or property <a href> cards on ${colRoute}`);
    }
  });

  await test('Semantic Anchor Navigation: Homepage & Portfolio render crawlable <a href> links for nav, cards, collections & footer', () => {
    const homeHtml = renderFullDocument('/');
    const requiredHrefs = [
      'href="/properties"',
      'href="/category/residential"',
      'href="/category/commercial"',
      'href="/category/land"',
      'href="/category/developments"',
      'href="/contact"',
      'href="/blog"',
      'href="/privacy"',
      'href="/terms"',
      'href="/collection/',
      'href="/property/',
    ];
    for (const fragment of requiredHrefs) {
      if (!homeHtml.includes(fragment)) {
        throw new Error(`Homepage SSR HTML missing crawlable anchor fragment: ${fragment}`);
      }
    }
    if (homeHtml.includes('href="/about"')) {
      throw new Error('Homepage SSR HTML must not contain removed /about navigation link');
    }

    const portfolioHtml = renderFullDocument('/properties');
    if (!portfolioHtml.includes('<nav aria-label="Breadcrumb"') || !portfolioHtml.includes('href="/property/')) {
      throw new Error('/properties SSR HTML missing breadcrumbs or property links');
    }
  });

  await test('True SSR 404 & Blog Pages: /blog renders Journal while invalid slugs & removed /about render 404 NotFound + noindex', () => {
    const html = renderFullDocument('/property/invalid-slug-ssr-phase2-check');
    if (!html.includes('Property Dossier Unavailable') || !html.includes('content="noindex, nofollow"')) {
      throw new Error('Invalid property route did not SSR render 404 NotFoundPage with noindex');
    }
    if (html.includes('Architectural Landmarks &amp; Private Havens')) {
      throw new Error('Invalid property route erroneously rendered Homepage content');
    }

    const blogHtml = renderFullDocument('/blog');
    if (!blogHtml.includes('The BUILDsmore Journal') || blogHtml.includes('Page Not Found')) {
      throw new Error('/blog route did not SSR render Journal page');
    }

    for (const removedRoute of ['/about', '/blog/any-post']) {
      const removedHtml = renderFullDocument(removedRoute);
      if (!removedHtml.includes('Page Not Found') || !removedHtml.includes('content="noindex, nofollow"')) {
        throw new Error(`Removed or missing route ${removedRoute} did not SSR render 404 NotFoundPage with noindex`);
      }
    }
  });

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
