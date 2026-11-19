import { Property, PropertyImage } from '../types/property';

export const DEFAULT_ARCHITECTURAL_FALLBACK_URL =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80';

/**
 * Checks whether an image object represents an explicit admin manual upload / override.
 */
export function isManualPropertyImage(img?: PropertyImage | null): boolean {
  if (!img || !img.url) return false;
  if (img.isManual === true || img.origin === 'manual') return true;
  if (img.id?.startsWith('img-custom')) return true;
  if (img.url.startsWith('/uploads/') || img.url.startsWith('data:image/')) return true;
  return false;
}

/**
 * Validates that a display URL is a usable HTTP(S), relative (/uploads/, /assets/), or raster data URL,
 * avoiding SVG spinners, CSS strings, or invalid fragments.
 */
export function isSafeDisplayImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length < 4) return false;
  if (/[\s<>"{}|\\^`]/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:image/svg+xml')) return false;
  if (lower.startsWith('javascript:')) return false;

  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('/') ||
    lower.startsWith('data:image/')
  ) {
    return true;
  }
  return false;
}

/**
 * Heuristic detector for logo / brand-mark URLs vs architectural photos.
 */
export function looksLikeBrandLogoUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    /(?:^|[/_-])(logo|brand|site-icon|favicon|apple-touch-icon|header-logo|footer-logo|custom-logo|site-logo)(?:[._-]|$)/i.test(lower) ||
    lower.includes('/logo') ||
    lower.includes('logo-') ||
    lower.includes('-logo')
  );
}

/**
 * Determines if an image entry should be rendered as a website/brand logo fallback (object-contain)
 * rather than full-bleed cover photography.
 */
export function isLogoFallbackImage(img?: PropertyImage | null, property?: Partial<Property> | null): boolean {
  if (!img) return false;
  if (img.isLogoFallback === true || img.origin === 'source_logo') return true;
  if (isManualPropertyImage(img)) return false;
  if (property?.sourceLogoUrl && img.url === property.sourceLogoUrl) return true;
  if (looksLikeBrandLogoUrl(img.url)) return true;
  return false;
}

/**
 * Returns gallery images ordered so that manual override / primary cover image always comes first.
 */
export function orderPropertyImages(property?: Partial<Property> | null): PropertyImage[] {
  const raw = Array.isArray(property?.images) ? property!.images.filter(i => i && isSafeDisplayImageUrl(i.url)) : [];
  if (raw.length === 0) {
    if (property?.sourceLogoUrl && isSafeDisplayImageUrl(property.sourceLogoUrl)) {
      return [
        {
          id: 'img-source-logo',
          url: property.sourceLogoUrl,
          caption: `${property.title || 'Property'} Source Logo`,
          isPrimary: true,
          origin: 'source_logo',
          isLogoFallback: true,
        },
      ];
    }
    return [];
  }

  const manualPrimary = raw.find(img => isManualPropertyImage(img) && img.isPrimary) || raw.find(isManualPropertyImage);
  const flaggedPrimary = raw.find(img => img.isPrimary && !isLogoFallbackImage(img, property)) || raw.find(img => img.isPrimary);
  const firstArchitectural = raw.find(img => !isLogoFallbackImage(img, property));

  const primary = manualPrimary || (flaggedPrimary && !isLogoFallbackImage(flaggedPrimary, property) ? flaggedPrimary : firstArchitectural) || flaggedPrimary || raw[0];

  const ordered = [primary, ...raw.filter(img => img !== primary)].map((img, idx) => ({
    ...img,
    isPrimary: idx === 0,
  }));

  return ordered;
}

/**
 * Resolves the authoritative main image URL + presentation metadata for any property.
 */
export function getPrimaryPropertyImage(property?: Partial<Property> | null): {
  url: string | undefined;
  caption?: string;
  isLogo: boolean;
  isManual: boolean;
  origin: PropertyImage['origin'];
} {
  const ordered = orderPropertyImages(property);
  const primary = ordered[0];

  if (primary && isSafeDisplayImageUrl(primary.url)) {
    const manual = isManualPropertyImage(primary) || Boolean(property?.hasManualMainImage && primary.isPrimary);
    const isLogo = !manual && isLogoFallbackImage(primary, property);
    return {
      url: primary.url,
      caption: primary.caption || property?.title,
      isLogo,
      isManual: manual,
      origin: manual ? 'manual' : (primary.origin || (isLogo ? 'source_logo' : 'wp_scraped')),
    };
  }

  if (property?.sourceLogoUrl && isSafeDisplayImageUrl(property.sourceLogoUrl)) {
    return {
      url: property.sourceLogoUrl,
      caption: `${property.title || 'Property'} Website Logo`,
      isLogo: true,
      isManual: false,
      origin: 'source_logo',
    };
  }

  return {
    url: undefined,
    caption: property?.title,
    isLogo: false,
    isManual: false,
    origin: 'fallback',
  };
}

/**
 * Merges incoming re-imported images with existing property images while strictly preserving
 * manually uploaded/set images at highest priority (primary first).
 */
export function mergeImportedImages(
  existingImages: PropertyImage[] = [],
  incomingImages: PropertyImage[] = [],
  hasManualMainImage?: boolean
): { images: PropertyImage[]; hasManualMainImage: boolean } {
  const validExisting = (existingImages || []).filter(img => img && isSafeDisplayImageUrl(img.url));
  const validIncoming = (incomingImages || []).filter(img => img && isSafeDisplayImageUrl(img.url));

  const explicitManual = validExisting.filter(img => isManualPropertyImage(img));
  const shouldLockExistingPrimary =
    explicitManual.length > 0 || Boolean(hasManualMainImage && validExisting.some(img => img.isPrimary));

  // If the admin explicitly flagged hasManualMainImage on an existing primary URL (e.g. a manually typed CDN link),
  // keep that primary image pinned as manual too.
  const pinnedManual: PropertyImage[] = shouldLockExistingPrimary
    ? (explicitManual.length > 0
        ? explicitManual
        : validExisting.filter(img => img.isPrimary).slice(0, 1)
      ).map((img, idx) => ({
        ...img,
        isManual: true,
        origin: 'manual' as const,
        isLogoFallback: false,
        isPrimary: idx === 0,
      }))
    : [];

  const seenUrls = new Set<string>();
  const combined: PropertyImage[] = [];

  for (const img of pinnedManual) {
    if (!seenUrls.has(img.url)) {
      seenUrls.add(img.url);
      combined.push(img);
    }
  }

  // Filter incoming images so source logos don't crowd out real architectural photos
  const incomingNonLogo = validIncoming.filter(img => !isLogoFallbackImage(img));
  const incomingList = incomingNonLogo.length > 0 ? validIncoming : validIncoming;

  for (const img of incomingList) {
    if (!seenUrls.has(img.url)) {
      seenUrls.add(img.url);
      combined.push({
        ...img,
        isPrimary: pinnedManual.length === 0 && combined.length === 0,
      });
    }
  }

  // Fallback to existing gallery if incoming list is empty
  for (const img of validExisting) {
    if (!seenUrls.has(img.url)) {
      seenUrls.add(img.url);
      combined.push({
        ...img,
        isPrimary: pinnedManual.length === 0 && combined.length === 0,
      });
    }
  }

  if (combined.length > 0) {
    // Ensure exactly one image has isPrimary: true
    let primaryAssigned = false;
    const normalized = combined.map(img => {
      if (!primaryAssigned && (pinnedManual.length > 0 ? isManualPropertyImage(img) : img.isPrimary)) {
        primaryAssigned = true;
        return { ...img, isPrimary: true };
      }
      return { ...img, isPrimary: false };
    });
    if (!primaryAssigned && normalized.length > 0) {
      normalized[0].isPrimary = true;
    }
    return {
      images: normalized,
      hasManualMainImage: pinnedManual.length > 0,
    };
  }

  return {
    images: [],
    hasManualMainImage: false,
  };
}

/**
 * Strips raw WordPress HTML/Gutenberg/Elementor CSS classes and markup noise from extracted text fields
 * such as address, title, developer, or description.
 */
export function sanitizeWordPressText(input?: string): string {
  if (!input || typeof input !== 'string') return '';

  let cleaned = input
    // Decode HTML entities first
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&#8220;|&#8221;|&quot;/gi, '"')
    // Strip HTML tags & stray attribute fragments
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/\b(?:class|id|style|data-[a-z0-9_-]+|aria-[a-z0-9_-]+|srcset|sizes)\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/\b(?:class|style)\s*=\s*[^\s,;]+/gi, ' ');

  // Remove known WordPress / Gutenberg / Elementor CSS class tokens
  const wpNoiseTokenRegex =
    /\b(?:wp-block-[a-z0-9_-]+|wp-container-[a-z0-9_-]+|wp-elements-[a-z0-9_-]+|wp-image-\d+|wp-post-image|post-\d+|page-id-\d+|type-(?:post|page|property|[a-z0-9_-]+)|status-(?:publish|draft|pending|private|inherit)|format-(?:standard|aside|gallery|image)|hentry|has-post-thumbnail|category-[a-z0-9_-]+|tag-[a-z0-9_-]+|elementor-[a-z0-9_-]+|e-con[a-z0-9_-]*|alignwide|alignfull|attachment-[a-z0-9_-]+|size-(?:full|large|medium|thumbnail))\b/gi;

  cleaned = cleaned.replace(wpNoiseTokenRegex, ' ');

  // Clean orphaned punctuation / separators left behind
  cleaned = cleaned
    .replace(/^[\s,.;:|\-–—"'=]+/, '')
    .replace(/[\s,;|=]+$/, '')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

const GENERIC_OR_WP_ADDRESS_TOKENS = new Set([
  'post',
  'posts',
  'page',
  'pages',
  'attachment',
  'revision',
  'nav_menu_item',
  'custom_css',
  'customize_changeset',
  'wp_block',
  'wp_template',
  'wp_template_part',
  'wp_navigation',
  'oembed_cache',
  'user_request',
  'wp_global_styles',
  'hentry',
  'uncategorized',
  'publish',
  'draft',
  'pending',
  'private',
  'inherit',
  'standard',
  'aside',
  'gallery',
  'wordpress',
  'elementor',
  'blog',
  'home',
  'index',
  'default',
  'unknown',
  'address',
  'location',
  'site address',
  'property address',
  'none',
  'null',
  'undefined',
  'n/a',
  'na',
  'tbd',
  'test',
  'sample',
  'hello world',
]);

/**
 * Validates whether an extracted string still looks like raw CSS/code/WP token rather than human-readable address/text.
 */
export function looksLikeRawMarkupOrCss(text?: string): boolean {
  if (!text || !text.trim()) return true;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (GENERIC_OR_WP_ADDRESS_TOKENS.has(lower)) {
    return true;
  }
  if (
    /\b(?:wp-block-|wp-container-|wp-elements-|status-publish|type-post|type-page|format-standard|hentry|elementor-widget|elementor-element|category-uncategorized|has-post-thumbnail)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (/<[^>]+>/.test(trimmed) || /\b(?:class|style|id|data-[a-z0-9_-]+)=/i.test(trimmed)) {
    return true;
  }
  // Hyphenated lowercase slug/token string without spaces or commas (e.g. "my-property-slug", "post-1")
  if (/^[a-z0-9_-]+(?:-[a-z0-9_-]+)+$/.test(trimmed) && !/\s/.test(trimmed) && !/,/.test(trimmed)) {
    return true;
  }
  if (/^[a-z0-9_-]+(?:\s+[a-z0-9_-]+){4,}$/.test(trimmed) && !/[A-Z]/.test(trimmed)) {
    // e.g. lowercase space-separated CSS class dump with zero capitalized words
    return true;
  }
  return false;
}

/**
 * Strict validator ensuring a property address is an actual geographic address rather than
 * WordPress post types ("post", "page"), CSS classes, URL slugs, or placeholder words.
 */
export function isValidPropertyAddress(
  address?: string,
  context?: { slug?: string; postType?: string; title?: string }
): boolean {
  if (!address || typeof address !== 'string') return false;
  const cleaned = sanitizeWordPressText(address);
  if (!cleaned || cleaned.length < 4) return false;
  if (!/[a-zA-Z]/.test(cleaned)) return false;
  if (looksLikeRawMarkupOrCss(cleaned)) return false;

  const lower = cleaned.toLowerCase();
  if (context?.postType && lower === context.postType.trim().toLowerCase()) {
    return false;
  }
  if (context?.slug) {
    const slugLower = context.slug.trim().toLowerCase();
    if (lower === slugLower || lower === slugLower.replace(/-/g, ' ')) {
      return false;
    }
  }
  if (/^[\w.-]+\.(?:com|in|net|org|co\.in|uk|ae|ch|fr|es)$/i.test(lower)) {
    return false;
  }
  return true;
}

/**
 * Returns true if the address is just a generic fallback like "Zirakpur, India" or "Mohali, Punjab".
 */
export function isGenericFallbackAddress(address?: string, city?: string): boolean {
  if (!address) return true;
  const norm = address.trim().toLowerCase();
  if (!city) return false;
  const cityLower = city.trim().toLowerCase();
  return (
    norm === cityLower ||
    norm === `${cityLower}, india` ||
    norm === `${cityLower}, punjab` ||
    norm === `${cityLower}, punjab, india`
  );
}
