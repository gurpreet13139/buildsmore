import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { render } from '../src/entry-server';
import { propertyRepository } from '../src/server/propertyRepository';
import { blogRepository } from '../src/server/blogRepository';
import { AdminDashboard, VALID_ADMIN_TABS } from '../src/pages/admin/AdminDashboard';
import { CurrencyProvider } from '../src/context/CurrencyContext';
import { InitialAppData, resolveSeoForRoute } from '../src/utils/seo';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
}

export async function runRoutingTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const test = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      results.push({ name, success: true });
    } catch (err: unknown) {
      results.push({ name, success: false, error: (err as Error).message });
    }
  };

  const properties = propertyRepository.getAllProperties({ status: 'Published', limit: 5000 }).items;
  const collections = propertyRepository.getAllCollections(false);
  const locations = propertyRepository.getAllLocations(true);
  const trophyHoldings = propertyRepository.getTrophyHoldings();
  const blogs = blogRepository.getAllBlogs({ includeDrafts: false, limit: 500 }).items;

  const initialData: InitialAppData = {
    properties,
    collections,
    locations,
    trophyHoldings,
    blogs,
  };

  await test('React Router SSR: all public routes render distinct pages with crawlable <a href> navigation', () => {
    const publicRoutes: Array<{ path: string; expectedText: string }> = [
      { path: '/', expectedText: 'BUILDsmore' },
      { path: '/properties', expectedText: 'Portfolio' },
      { path: '/category/residential', expectedText: 'Residential' },
      { path: '/category/commercial', expectedText: 'Commercial' },
      { path: '/category/land', expectedText: 'Plots' },
      { path: '/category/developments', expectedText: 'Developments' },
      { path: '/blog', expectedText: 'The BUILDsmore Journal' },
      { path: '/contact', expectedText: 'Contact' },
      { path: '/privacy', expectedText: 'Privacy' },
      { path: '/terms', expectedText: 'Terms' },
    ];

    for (const route of publicRoutes) {
      const seo = resolveSeoForRoute(route.path, initialData);
      if (seo.isNotFound) {
        throw new Error(`Public route ${route.path} unexpectedly resolved as 404`);
      }
      const html = render(route.path, initialData);
      if (!html.includes(route.expectedText)) {
        throw new Error(`SSR for ${route.path} missing expected content "${route.expectedText}"`);
      }
      if (!html.includes('href="/properties"') || !html.includes('href="/contact"')) {
        throw new Error(`SSR for ${route.path} missing crawlable anchor navigation links`);
      }
    }
  });

  await test('React Router Dynamic Slugs: /property/:slug, /collection/:slug, and /blog/:slug render matching entities', () => {
    const normalizeRenderedText = (html: string) =>
      html
        .replace(/<!--\s*-->/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"');

    const prop = properties[0];
    if (!prop) throw new Error('Expected at least 1 published property');
    const propUrl = `/property/${encodeURIComponent(prop.slug)}`;
    const propHtml = normalizeRenderedText(render(propUrl, initialData));
    if (!propHtml.includes(prop.title)) {
      throw new Error(`SSR failed to render property title for ${propUrl}`);
    }

    const col = collections[0];
    if (col) {
      const colUrl = `/collection/${encodeURIComponent(col.slug)}`;
      const colHtml = normalizeRenderedText(render(colUrl, initialData));
      if (!colHtml.includes(col.title)) {
        throw new Error(`SSR failed to render collection title for ${colUrl}`);
      }
    }

    const blog = blogs[0];
    if (blog) {
      const blogUrl = `/blog/${encodeURIComponent(blog.slug)}`;
      const blogHtml = normalizeRenderedText(render(blogUrl, initialData));
      if (!blogHtml.includes(blog.title)) {
        throw new Error(`SSR failed to render blog article title for ${blogUrl}`);
      }
    }
  });

  await test('React Router Admin Routes: /admin and all /admin/:section routes resolve cleanly with noindex, invalid /admin/* returns 404', () => {
    const adminPaths = ['/admin', ...VALID_ADMIN_TABS.map((t) => `/admin/${t}`)];
    for (const path of adminPaths) {
      const seo = resolveSeoForRoute(path, initialData);
      if (seo.isNotFound) {
        throw new Error(`Valid admin route ${path} marked as 404`);
      }
      if (!seo.robots.includes('noindex')) {
        throw new Error(`Admin route ${path} missing noindex directive`);
      }
      const html = render(path, initialData);
      if (!html.includes('Restricted Administrative Terminal')) {
        throw new Error(`Unauthenticated SSR on ${path} did not render admin authentication gate`);
      }
    }

    const invalidAdminSeo = resolveSeoForRoute('/admin/not-a-real-tab', initialData);
    if (!invalidAdminSeo.isNotFound || !invalidAdminSeo.robots.includes('noindex')) {
      throw new Error('Invalid /admin/not-a-real-tab must resolve as 404 + noindex');
    }
    const invalidAdminHtml = render('/admin/not-a-real-tab', initialData);
    if (!invalidAdminHtml.includes('404')) {
      throw new Error('Invalid /admin/not-a-real-tab did not render NotFoundPage');
    }
  });

  await test('AdminDashboard Tabs: render crawlable <a href="/admin/..."> links for every admin section', () => {
    const html = renderToString(
      React.createElement(
        StaticRouter,
        { location: '/admin/blogs' },
        React.createElement(
          CurrencyProvider,
          null,
          React.createElement(AdminDashboard, {
            adminUser: {
              id: 'admin-1',
              email: 'admin@buildsmore.com',
              name: 'Admin',
              role: 'SuperAdmin',
              lastLoginAt: new Date().toISOString(),
            },
            onLogout: () => {},
            onViewProperty: () => {},
            properties,
            onRefreshProperties: () => {},
            blogs,
            onRefreshBlogs: () => {},
            activeTab: 'blogs',
          })
        )
      )
    );

    for (const tab of VALID_ADMIN_TABS) {
      if (!html.includes(`href="/admin/${tab}"`)) {
        throw new Error(`AdminDashboard missing anchor link href="/admin/${tab}"`);
      }
    }
    if (!html.includes('Editorial Journal')) {
      throw new Error('AdminDashboard did not render Blog & Journal panel when activeTab="blogs"');
    }
  });

  await test('React Router Query Params: /blog?tag=... preserves tag filter during SSR', () => {
    const html = render('/blog?tag=Mohali', initialData).replace(/<!--\s*-->/g, '');
    if (!html.includes('Tag: Mohali')) {
      throw new Error('SSR for /blog?tag=Mohali did not initialize active tag filter from URL query');
    }
  });

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
