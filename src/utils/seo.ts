import { BlogPost, CuratedCollection, ManagedLocation, Property } from '../types/property';
import { getPrimaryPropertyImage } from './propertyImages';

export const PRODUCTION_DOMAIN = 'https://buildsmoremohali.com';
export const SITE_NAME = 'BUILDsmore';
export const DEFAULT_BRAND_TITLE =
  'Buildsmore | Residential | Commercial & Investment Plots in Mohali, Zirakpur, Dera Bassi & New Chandigarh';
export const DEFAULT_BRAND_DESCRIPTION =
  'Exclusive luxury real estate portfolio featuring architectural estates, penthouses, commercial landmarks, and curated investment holdings.';
export const DEFAULT_SOCIAL_IMAGE = `${PRODUCTION_DOMAIN}/assets/aistudio/logo-builds_more_aa2f07ab.jpeg`;

export interface InitialAppData {
  properties: Property[];
  collections: CuratedCollection[];
  locations: ManagedLocation[];
  trophyHoldings: Property[];
  blogs?: BlogPost[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalUrl?: string;
  robots: string;
  ogType: 'website' | 'article';
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  ogImageAlt: string;
  twitterCard: 'summary_large_image';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  isNotFound?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  structuredData?: Array<Record<string, unknown>>;
}

/**
 * Normalizes a pathname by stripping query/hash and trailing slash (except root '/').
 */
export function normalizePathname(rawPath: string): string {
  const clean = (rawPath || '/').split('?')[0].split('#')[0].replace(/\/{2,}/g, '/');
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean || '/';
}

/**
 * Maps any property category string or legacy category slug into a canonical public category route.
 * Fixes legacy mismatches such as "Plots/Land" -> "/category/land" and "New Projects" -> "/category/developments".
 */
export function getCategoryRoute(category?: string | null): string {
  const normalized = (category || '').toLowerCase().trim();
  if (!normalized) return '/properties';
  if (normalized === 'residential' || normalized.includes('villa') || normalized.includes('penthouse')) {
    return '/category/residential';
  }
  if (normalized === 'commercial' || normalized.includes('office') || normalized.includes('retail')) {
    return '/category/commercial';
  }
  if (
    normalized === 'plots/land' ||
    normalized === 'plotsland' ||
    normalized === 'plots & land' ||
    normalized === 'land' ||
    normalized.includes('plot') ||
    normalized.includes('acreage') ||
    normalized.includes('vineyard')
  ) {
    return '/category/land';
  }
  if (
    normalized === 'new projects' ||
    normalized === 'newprojects' ||
    normalized === 'developments' ||
    normalized.includes('project') ||
    normalized.includes('development')
  ) {
    return '/category/developments';
  }
  return '/properties';
}

export function getCategoryDisplayLabel(category?: string | null): string {
  const route = getCategoryRoute(category);
  switch (route) {
    case '/category/residential':
      return 'Residential';
    case '/category/commercial':
      return 'Commercial';
    case '/category/land':
      return 'Plots/Land';
    case '/category/developments':
      return 'New Projects';
    default:
      return category?.trim() || 'Portfolio';
  }
}

/**
 * Ensures any relative asset path or localhost URL resolves cleanly to an absolute URL
 * anchored on https://buildsmoremohali.com (never localhost).
 */
export function toAbsoluteProductionUrl(urlOrPath?: string | null, fallbackPath = '/'): string {
  const raw = (urlOrPath || '').trim();
  if (!raw) {
    return fallbackPath === '/' ? `${PRODUCTION_DOMAIN}/` : `${PRODUCTION_DOMAIN}${fallbackPath.startsWith('/') ? '' : '/'}${fallbackPath}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '0.0.0.0'
      ) {
        return `${PRODUCTION_DOMAIN}${parsed.pathname}${parsed.search}`;
      }
      return raw;
    } catch {
      return DEFAULT_SOCIAL_IMAGE;
    }
  }
  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }
  return `${PRODUCTION_DOMAIN}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function truncateDescription(text: string, maxLen = 160): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return DEFAULT_BRAND_DESCRIPTION;
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > 100 ? sliced.slice(0, lastSpace) : sliced).trim() + '…';
}

export function getBreadcrumbsForRoute(
  rawPathname: string,
  context: {
    properties: Property[];
    collections: CuratedCollection[];
    blogs?: BlogPost[];
  }
): BreadcrumbItem[] {
  const pathname = normalizePathname(rawPathname);

  if (pathname === '/' || pathname === '/admin') {
    return [];
  }
  if (pathname === '/properties') {
    return [{ label: 'Home', href: '/' }, { label: 'Portfolio' }];
  }
  if (pathname === '/category/residential') {
    return [{ label: 'Home', href: '/' }, { label: 'Portfolio', href: '/properties' }, { label: 'Residential' }];
  }
  if (pathname === '/category/commercial') {
    return [{ label: 'Home', href: '/' }, { label: 'Portfolio', href: '/properties' }, { label: 'Commercial' }];
  }
  if (pathname === '/category/land') {
    return [{ label: 'Home', href: '/' }, { label: 'Portfolio', href: '/properties' }, { label: 'Plots & Land' }];
  }
  if (pathname === '/category/developments') {
    return [{ label: 'Home', href: '/' }, { label: 'Portfolio', href: '/properties' }, { label: 'New Developments' }];
  }
  if (pathname === '/blog') {
    return [{ label: 'Home', href: '/' }, { label: 'Journal' }];
  }
  if (pathname === '/contact') {
    return [{ label: 'Home', href: '/' }, { label: 'Contact' }];
  }
  if (pathname === '/privacy') {
    return [{ label: 'Home', href: '/' }, { label: 'Privacy Policy' }];
  }
  if (pathname === '/terms') {
    return [{ label: 'Home', href: '/' }, { label: 'Terms of Service' }];
  }
  if (pathname.startsWith('/property/')) {
    const slugOrId = decodeURIComponent(pathname.slice('/property/'.length));
    const prop = context.properties.find((p) => p.slug === slugOrId || p.id === slugOrId);
    if (!prop) return [];
    return [
      { label: 'Home', href: '/' },
      { label: 'Portfolio', href: '/properties' },
      { label: prop.category || getCategoryDisplayLabel(prop.category), href: getCategoryRoute(prop.category) },
      { label: prop.title },
    ];
  }
  if (pathname.startsWith('/collection/')) {
    const slugOrId = decodeURIComponent(pathname.slice('/collection/'.length));
    const collection = context.collections.find((c) => c.slug === slugOrId || c.id === slugOrId);
    if (!collection) return [];
    return [
      { label: 'Home', href: '/' },
      { label: 'Portfolio', href: '/properties' },
      { label: collection.title },
    ];
  }
  if (pathname.startsWith('/blog/')) {
    const slugOrId = decodeURIComponent(pathname.slice('/blog/'.length));
    const post = (context.blogs || []).find((b) => b.slug === slugOrId || b.id === slugOrId);
    if (!post || post.status !== 'Published') return [];
    return [
      { label: 'Home', href: '/' },
      { label: 'Journal', href: '/blog' },
      { label: post.title },
    ];
  }
  return [];
}

export function buildBreadcrumbJsonLd(
  breadcrumbs: BreadcrumbItem[],
  currentCanonicalUrl: string
): Record<string, unknown> | null {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const itemUrl = crumb.href
        ? toAbsoluteProductionUrl(crumb.href)
        : currentCanonicalUrl;
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.label,
        ...(isLast && !crumb.href ? { item: currentCanonicalUrl } : { item: itemUrl }),
      };
    }),
  };
}

const STATIC_ROUTE_META: Record<
  string,
  {
    title: string;
    description: string;
    ogImage?: string;
    ogImageAlt?: string;
    robots?: string;
  }
> = {
  '/': {
    title: DEFAULT_BRAND_TITLE,
    description: DEFAULT_BRAND_DESCRIPTION,
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Luxury Real Estate',
  },
  '/properties': {
    title: 'International Property Portfolio – BUILDsmore Luxury Real Estate',
    description:
      'Browse verified luxury villas, sky penthouses, commercial landmarks, and prime real estate developments curated by BUILDsmore.',
    ogImage: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
    ogImageAlt: 'BUILDsmore International Property Portfolio',
  },
  '/category/residential': {
    title: 'Prime Residential Estates & Penthouses – BUILDsmore',
    description:
      'Explore waterfront architectural villas, alpine chalets, luxury residences, and skyline penthouses in premier enclaves.',
    ogImage: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
    ogImageAlt: 'BUILDsmore Prime Residential Estates',
  },
  '/category/commercial': {
    title: 'Institutional Commercial Landmarks – BUILDsmore',
    description:
      'Discover freehold corporate headquarters, Grade-A office towers, and prime commercial investment properties.',
    ogImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
    ogImageAlt: 'BUILDsmore Commercial Landmarks',
  },
  '/category/land': {
    title: 'Prime Acreage, Plots & Vineyards – BUILDsmore',
    description:
      'Explore prime land parcels, heritage vineyard estates, coastal development plots, and sovereign acreage.',
    ogImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
    ogImageAlt: 'BUILDsmore Prime Acreage and Land Parcels',
  },
  '/category/developments': {
    title: 'New Developments & Architectural Projects – BUILDsmore',
    description:
      'Preview newly launched architectural residences, RERA-verified developments, and off-plan luxury commissions.',
    ogImage: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1600&q=80',
    ogImageAlt: 'BUILDsmore New Architectural Developments',
  },
  '/blog': {
    title: 'The BUILDsmore Journal – Luxury Real Estate & Architecture Insights',
    description:
      'Editorial market intelligence, Mohali & Tricity investment advisory notes, RERA compliance guides, and architectural perspectives from BUILDsmore.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'The BUILDsmore Journal',
  },
  '/contact': {
    title: 'Contact & Advisory Desk – BUILDsmore Luxury Real Estate',
    description:
      'Connect with BUILDsmore senior property advisors in Mohali for private inspections, portfolio acquisitions, and valuations.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'Contact BUILDsmore Advisory',
  },
  '/privacy': {
    title: 'Global Privacy & Data Protection Policy – BUILDsmore',
    description:
      'Read the BUILDsmore global privacy and sovereign data protection policy governing confidential real estate inquiries.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Privacy Policy',
  },
  '/terms': {
    title: 'Terms of Platform Advisory & Access – BUILDsmore',
    description:
      'Review the BUILDsmore platform terms of advisory, listing verification standards, and non-disclosure covenants.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Terms of Service',
  },
  '/admin': {
    title: 'Administrative Terminal – BUILDsmore',
    description: 'Restricted BUILDsmore administrative management console.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/properties': {
    title: 'Properties Registry – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore administrative property portfolio management.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/trophy': {
    title: 'Trophy Holdings – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore administrative Trophy Holdings management.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/collections': {
    title: 'Curated Collections – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore administrative curated collections management.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/locations': {
    title: 'Locations – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore administrative locations management.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/blogs': {
    title: 'Blog & Journal – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore editorial journal and blog management.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/wordpress': {
    title: 'WordPress Import – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore WordPress synchronization hub.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/overview': {
    title: 'Dashboard & KPI – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore administrative portfolio analytics and KPIs.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/inquiries': {
    title: 'Client Inquiries – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore client inquiry lead management.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
  '/admin/csv': {
    title: 'CSV Tools – Admin Console – BUILDsmore',
    description: 'Restricted BUILDsmore CSV portfolio import and export tools.',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Admin Terminal',
    robots: 'noindex, nofollow',
  },
};

export function resolveSeoForRoute(
  rawPathname: string,
  context: {
    properties: Property[];
    collections: CuratedCollection[];
    blogs?: BlogPost[];
  }
): SeoMetadata {
  const pathname = normalizePathname(rawPathname);
  const breadcrumbs = getBreadcrumbsForRoute(pathname, context);

  // 1. Static known routes
  const staticEntry = STATIC_ROUTE_META[pathname];
  if (staticEntry) {
    const canonical = pathname === '/' ? `${PRODUCTION_DOMAIN}/` : `${PRODUCTION_DOMAIN}${pathname}`;
    const ogImage = toAbsoluteProductionUrl(staticEntry.ogImage || DEFAULT_SOCIAL_IMAGE);
    const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbs, canonical);
    const structuredData: Array<Record<string, unknown>> = [];
    if (breadcrumbLd) structuredData.push(breadcrumbLd);
    if (pathname === '/blog') {
      const publishedPosts = (context.blogs || []).filter((b) => b.status === 'Published');
      structuredData.push({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'The BUILDsmore Journal',
        description: truncateDescription(staticEntry.description),
        url: canonical,
        publisher: {
          '@type': 'Organization',
          name: SITE_NAME,
          url: `${PRODUCTION_DOMAIN}/`,
        },
        blogPost: publishedPosts.slice(0, 10).map((post) => ({
          '@type': 'BlogPosting',
          headline: post.title,
          url: `${PRODUCTION_DOMAIN}/blog/${encodeURIComponent(post.slug)}`,
          datePublished: post.publishedAt || post.createdAt,
          author: {
            '@type': 'Person',
            name: post.authorName || 'BUILDsmore Editorial Desk',
          },
        })),
      });
    }

    return {
      title: staticEntry.title,
      description: truncateDescription(staticEntry.description),
      canonicalUrl: canonical,
      robots: staticEntry.robots || 'index, follow',
      ogType: 'website',
      ogTitle: staticEntry.title,
      ogDescription: truncateDescription(staticEntry.description),
      ogUrl: canonical,
      ogImage,
      ogImageAlt: staticEntry.ogImageAlt || staticEntry.title,
      twitterCard: 'summary_large_image',
      twitterTitle: staticEntry.title,
      twitterDescription: truncateDescription(staticEntry.description),
      twitterImage: ogImage,
      isNotFound: false,
      breadcrumbs,
      structuredData,
    };
  }

  // 2. Dynamic Property Route: /property/:slug
  if (pathname.startsWith('/property/')) {
    const slugOrId = decodeURIComponent(pathname.slice('/property/'.length));
    const prop = context.properties.find((p) => p.slug === slugOrId || p.id === slugOrId);

    if (!prop) {
      return buildNotFoundSeo(pathname, 'Property Not Found (404) – BUILDsmore Luxury Real Estate');
    }

    const canonical = `${PRODUCTION_DOMAIN}/property/${encodeURIComponent(prop.slug)}`;
    const primaryImg = getPrimaryPropertyImage(prop);
    const ogImage = toAbsoluteProductionUrl(primaryImg.url || DEFAULT_SOCIAL_IMAGE);

    const rawTitle = prop.seo?.metaTitle?.trim();
    const title = rawTitle || `${prop.title} – BUILDsmore Luxury Real Estate`;

    const fallbackDesc = `${prop.title} in ${prop.city}${prop.country ? `, ${prop.country}` : ''}. ${
      prop.bedrooms > 0 ? `${prop.bedrooms} bedrooms, ` : ''
    }${prop.category} holding represented by BUILDsmore.`;
    const description = truncateDescription(prop.seo?.metaDescription?.trim() || prop.description || fallbackDesc);

    const structuredData: Array<Record<string, unknown>> = [];
    const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbs, canonical);
    if (breadcrumbLd) structuredData.push(breadcrumbLd);

    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: prop.title,
      description,
      url: canonical,
      image: [ogImage],
      datePosted: prop.createdAt,
      ...(prop.price > 0
        ? {
            offers: {
              '@type': 'Offer',
              price: prop.price,
              priceCurrency: prop.currency || 'INR',
              availability: prop.status === 'Sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
              url: canonical,
            },
          }
        : {}),
      address: {
        '@type': 'PostalAddress',
        streetAddress: prop.address || prop.locality || prop.city,
        addressLocality: prop.city,
        addressRegion: prop.stateRegion,
        addressCountry: prop.country,
      },
      ...(prop.bedrooms > 0 ? { numberOfRooms: prop.bedrooms } : {}),
      ...(prop.interiorAreaSqFt > 0
        ? {
            floorSize: {
              '@type': 'QuantitativeValue',
              value: prop.interiorAreaSqFt,
              unitCode: 'FTK',
            },
          }
        : {}),
    });

    return {
      title,
      description,
      canonicalUrl: canonical,
      robots: prop.status === 'Draft' ? 'noindex, nofollow' : 'index, follow',
      ogType: 'article',
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonical,
      ogImage,
      ogImageAlt: prop.title,
      twitterCard: 'summary_large_image',
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: ogImage,
      isNotFound: false,
      breadcrumbs,
      structuredData,
    };
  }

  // 3. Dynamic Curated Collection Route: /collection/:slug
  if (pathname.startsWith('/collection/')) {
    const slugOrId = decodeURIComponent(pathname.slice('/collection/'.length));
    const collection = context.collections.find((c) => c.slug === slugOrId || c.id === slugOrId);

    if (!collection) {
      return buildNotFoundSeo(pathname, 'Collection Not Found (404) – BUILDsmore Luxury Real Estate');
    }

    const canonical = `${PRODUCTION_DOMAIN}/collection/${encodeURIComponent(collection.slug)}`;
    const ogImage = toAbsoluteProductionUrl(collection.coverImageUrl || DEFAULT_SOCIAL_IMAGE);
    const title = collection.seo?.metaTitle?.trim() || `${collection.title} – BUILDsmore Curated Collection`;
    const description = truncateDescription(
      collection.seo?.metaDescription?.trim() || collection.description || collection.subtitle || DEFAULT_BRAND_DESCRIPTION
    );

    const structuredData: Array<Record<string, unknown>> = [];
    const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbs, canonical);
    if (breadcrumbLd) structuredData.push(breadcrumbLd);
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: collection.title,
      description,
      url: canonical,
      image: ogImage,
      numberOfItems: collection.propertyIds?.length || 0,
    });

    return {
      title,
      description,
      canonicalUrl: canonical,
      robots: collection.status === 'Draft' ? 'noindex, nofollow' : 'index, follow',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonical,
      ogImage,
      ogImageAlt: collection.title,
      twitterCard: 'summary_large_image',
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: ogImage,
      isNotFound: false,
      breadcrumbs,
      structuredData,
    };
  }

  // 3.5. Dynamic Blog Article Route: /blog/:slug
  if (pathname.startsWith('/blog/')) {
    const slugOrId = decodeURIComponent(pathname.slice('/blog/'.length));
    const post = (context.blogs || []).find(
      (b) => (b.slug === slugOrId || b.id === slugOrId) && b.status === 'Published'
    );

    if (!post) {
      return buildNotFoundSeo(pathname, 'Article Not Found (404) – The BUILDsmore Journal');
    }

    const canonical = `${PRODUCTION_DOMAIN}/blog/${encodeURIComponent(post.slug)}`;
    const ogImage = toAbsoluteProductionUrl(post.featuredImage || DEFAULT_SOCIAL_IMAGE);
    const title = post.seo?.metaTitle?.trim() || `${post.title} – BUILDsmore Journal`;
    const description = truncateDescription(
      post.seo?.metaDescription?.trim() || post.excerpt || post.content
    );

    const structuredData: Array<Record<string, unknown>> = [];
    const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbs, canonical);
    if (breadcrumbLd) structuredData.push(breadcrumbLd);

    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description,
      image: [ogImage],
      url: canonical,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonical,
      },
      articleSection: post.category,
      keywords: (post.seo?.keywords && post.seo.keywords.length > 0 ? post.seo.keywords : post.tags).join(', '),
      datePublished: post.publishedAt || post.createdAt,
      dateModified: post.updatedAt || post.publishedAt || post.createdAt,
      author: {
        '@type': 'Person',
        name: post.authorName || 'BUILDsmore Editorial Desk',
      },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: `${PRODUCTION_DOMAIN}/`,
        logo: {
          '@type': 'ImageObject',
          url: DEFAULT_SOCIAL_IMAGE,
        },
      },
    });

    return {
      title,
      description,
      canonicalUrl: canonical,
      robots: 'index, follow',
      ogType: 'article',
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonical,
      ogImage,
      ogImageAlt: post.featuredImageAlt || post.title,
      twitterCard: 'summary_large_image',
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: ogImage,
      isNotFound: false,
      breadcrumbs,
      structuredData,
    };
  }

  // 4. Genuine 404 for unknown paths
  return buildNotFoundSeo(pathname);
}

function buildNotFoundSeo(pathname: string, customTitle?: string): SeoMetadata {
  const title = customTitle || 'Page Not Found (404) – BUILDsmore Luxury Real Estate';
  const description = 'The requested property, collection, or page could not be found in the BUILDsmore portfolio.';
  const pageUrl = `${PRODUCTION_DOMAIN}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  return {
    title,
    description,
    canonicalUrl: undefined,
    robots: 'noindex, nofollow',
    ogType: 'website',
    ogTitle: title,
    ogDescription: description,
    ogUrl: pageUrl,
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: 'BUILDsmore Luxury Real Estate',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: DEFAULT_SOCIAL_IMAGE,
    isNotFound: true,
    breadcrumbs: [],
    structuredData: [],
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function serializeJsonSafely(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function generateRobotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    `Sitemap: ${PRODUCTION_DOMAIN}/sitemap.xml`,
    '',
  ].join('\n');
}

export function generateSitemapXml(
  properties: Property[],
  collections: CuratedCollection[],
  blogs: BlogPost[] = []
): string {
  interface SitemapUrl {
    loc: string;
    lastmod?: string;
    changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    priority: string;
  }

  const urls: SitemapUrl[] = [
    { loc: `${PRODUCTION_DOMAIN}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${PRODUCTION_DOMAIN}/properties`, changefreq: 'daily', priority: '0.9' },
    { loc: `${PRODUCTION_DOMAIN}/category/residential`, changefreq: 'daily', priority: '0.8' },
    { loc: `${PRODUCTION_DOMAIN}/category/commercial`, changefreq: 'daily', priority: '0.8' },
    { loc: `${PRODUCTION_DOMAIN}/category/land`, changefreq: 'daily', priority: '0.8' },
    { loc: `${PRODUCTION_DOMAIN}/category/developments`, changefreq: 'daily', priority: '0.8' },
    { loc: `${PRODUCTION_DOMAIN}/blog`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${PRODUCTION_DOMAIN}/contact`, changefreq: 'monthly', priority: '0.7' },
    { loc: `${PRODUCTION_DOMAIN}/privacy`, changefreq: 'yearly', priority: '0.3' },
    { loc: `${PRODUCTION_DOMAIN}/terms`, changefreq: 'yearly', priority: '0.3' },
  ];

  const seenLocs = new Set(urls.map((u) => u.loc));

  for (const col of collections) {
    if (col.status !== 'Published' || !col.slug) continue;
    const loc = `${PRODUCTION_DOMAIN}/collection/${encodeURIComponent(col.slug)}`;
    if (seenLocs.has(loc)) continue;
    seenLocs.add(loc);
    urls.push({
      loc,
      lastmod: toIsoDate(col.updatedAt || col.createdAt),
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  for (const prop of properties) {
    if (prop.status !== 'Published' || !prop.slug) continue;
    const loc = `${PRODUCTION_DOMAIN}/property/${encodeURIComponent(prop.slug)}`;
    if (seenLocs.has(loc)) continue;
    seenLocs.add(loc);
    urls.push({
      loc,
      lastmod: toIsoDate(prop.updatedAt || prop.createdAt),
      changefreq: 'weekly',
      priority: '0.9',
    });
  }

  for (const blog of blogs) {
    if (blog.status !== 'Published' || !blog.slug) continue;
    const loc = `${PRODUCTION_DOMAIN}/blog/${encodeURIComponent(blog.slug)}`;
    if (seenLocs.has(loc)) continue;
    seenLocs.add(loc);
    urls.push({
      loc,
      lastmod: toIsoDate(blog.updatedAt || blog.publishedAt || blog.createdAt),
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  const entries = urls
    .map((u) => {
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(u.loc)}</loc>`,
        u.lastmod ? `    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : null,
        `    <changefreq>${u.changefreq}</changefreq>`,
        `    <priority>${u.priority}</priority>`,
        '  </url>',
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Injects per-route <head> SEO tags, route JSON-LD (BreadcrumbList / RealEstateListing / CollectionPage),
 * optional SSR-rendered #root HTML, and optional hydration data into the HTML shell.
 */
export function injectSeoIntoHtml(
  html: string,
  seo: SeoMetadata,
  options?: {
    appHtml?: string;
    initialData?: InitialAppData;
  }
): string {
  const canonicalTag = seo.canonicalUrl
    ? `<link rel="canonical" href="${escapeHtmlAttr(seo.canonicalUrl)}" />`
    : '';

  const structuredDataBlock =
    seo.structuredData && seo.structuredData.length > 0
      ? `    <script id="buildsmore-route-jsonld" type="application/ld+json">${serializeJsonSafely(
          seo.structuredData.length === 1 ? seo.structuredData[0] : seo.structuredData
        )}</script>`
      : '';

  const managedHeadBlock = [
    `<title>${escapeHtmlText(seo.title)}</title>`,
    `    <meta name="description" content="${escapeHtmlAttr(seo.description)}" />`,
    `    <meta name="robots" content="${escapeHtmlAttr(seo.robots)}" />`,
    canonicalTag ? `    ${canonicalTag}` : null,
    `    <meta property="og:title" content="${escapeHtmlAttr(seo.ogTitle)}" />`,
    `    <meta property="og:description" content="${escapeHtmlAttr(seo.ogDescription)}" />`,
    `    <meta property="og:type" content="${escapeHtmlAttr(seo.ogType)}" />`,
    `    <meta property="og:url" content="${escapeHtmlAttr(seo.ogUrl)}" />`,
    `    <meta property="og:site_name" content="${escapeHtmlAttr(SITE_NAME)}" />`,
    `    <meta property="og:image" content="${escapeHtmlAttr(seo.ogImage)}" />`,
    `    <meta property="og:image:alt" content="${escapeHtmlAttr(seo.ogImageAlt)}" />`,
    `    <meta name="twitter:card" content="${escapeHtmlAttr(seo.twitterCard)}" />`,
    `    <meta name="twitter:title" content="${escapeHtmlAttr(seo.twitterTitle)}" />`,
    `    <meta name="twitter:description" content="${escapeHtmlAttr(seo.twitterDescription)}" />`,
    `    <meta name="twitter:image" content="${escapeHtmlAttr(seo.twitterImage)}" />`,
    structuredDataBlock || null,
  ]
    .filter(Boolean)
    .join('\n');

  let updated = html;

  // Strip existing managed tags to avoid duplicates
  updated = updated
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+[^>]*name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+[^>]*name=["']robots["'][^>]*>/gi, '')
    .replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\s+[^>]*property=["']og:(?:title|description|type|url|site_name|image|image:alt)["'][^>]*>/gi, '')
    .replace(/<meta\s+[^>]*name=["']twitter:(?:card|title|description|image)["'][^>]*>/gi, '')
    .replace(/<script\s+[^>]*id=["']buildsmore-route-jsonld["'][^>]*>[\s\S]*?<\/script>/gi, '');

  // Insert right after <meta name="viewport" ...> or <head>
  if (/<meta\s+[^>]*name=["']viewport["'][^>]*>/i.test(updated)) {
    updated = updated.replace(
      /(<meta\s+[^>]*name=["']viewport["'][^>]*>)/i,
      (_match, p1) => `${p1}\n    ${managedHeadBlock}`
    );
  } else {
    updated = updated.replace(/<head[^>]*>/i, (match) => `${match}\n    ${managedHeadBlock}`);
  }

  // Inject SSR rendered body inside <div id="root"></div> if provided
  if (options?.appHtml !== undefined) {
    updated = updated.replace(
      /<div id=["']root["']><\/div>/i,
      () => `<div id="root">${options.appHtml}</div>`
    );
  }

  // Inject hydration payload right before closing </body>
  if (options?.initialData !== undefined) {
    updated = updated.replace(
      /<script\s+[^>]*id=["']__BUILDSMORE_INITIAL_DATA__["'][^>]*>[\s\S]*?<\/script>/gi,
      ''
    );
    const dataScript = `    <script id="__BUILDSMORE_INITIAL_DATA__" type="application/json">${serializeJsonSafely(
      options.initialData
    )}</script>`;
    updated = updated.replace(/<\/body>/i, () => `${dataScript}\n  </body>`);
  }

  return updated;
}

/**
 * Reads SSR hydration payload from DOM during client bootstrap.
 */
export function readInitialAppDataFromDom(): InitialAppData | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const el = document.getElementById('__BUILDSMORE_INITIAL_DATA__');
    if (!el || !el.textContent) return undefined;
    return JSON.parse(el.textContent) as InitialAppData;
  } catch {
    return undefined;
  }
}

/**
 * Updates document.head metadata and route JSON-LD during client-side SPA navigation.
 */
export function applyDocumentSeo(seo: SeoMetadata): void {
  if (typeof document === 'undefined') return;

  document.title = seo.title;

  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('name', 'description', seo.description);
  setMeta('name', 'robots', seo.robots);
  setMeta('property', 'og:title', seo.ogTitle);
  setMeta('property', 'og:description', seo.ogDescription);
  setMeta('property', 'og:type', seo.ogType);
  setMeta('property', 'og:url', seo.ogUrl);
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:image', seo.ogImage);
  setMeta('property', 'og:image:alt', seo.ogImageAlt);
  setMeta('name', 'twitter:card', seo.twitterCard);
  setMeta('name', 'twitter:title', seo.twitterTitle);
  setMeta('name', 'twitter:description', seo.twitterDescription);
  setMeta('name', 'twitter:image', seo.twitterImage);

  let canonicalEl = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (seo.canonicalUrl) {
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', seo.canonicalUrl);
  } else if (canonicalEl) {
    canonicalEl.remove();
  }

  let jsonLdEl = document.getElementById('buildsmore-route-jsonld') as HTMLScriptElement | null;
  if (seo.structuredData && seo.structuredData.length > 0) {
    if (!jsonLdEl) {
      jsonLdEl = document.createElement('script');
      jsonLdEl.id = 'buildsmore-route-jsonld';
      jsonLdEl.type = 'application/ld+json';
      document.head.appendChild(jsonLdEl);
    }
    jsonLdEl.textContent = JSON.stringify(
      seo.structuredData.length === 1 ? seo.structuredData[0] : seo.structuredData
    );
  } else if (jsonLdEl) {
    jsonLdEl.remove();
  }
}
