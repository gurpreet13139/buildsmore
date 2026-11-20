/**
 * BUILDsmore — Homepage Hero Banner Slider Resolution & Fallback Guarantee
 * Guarantees the exact existing homepage hero banner renders whenever no slides exist
 * or when admin-configured slide fields are empty or incomplete.
 */

import { HeroSlide } from '../types/property';

export const DEFAULT_HERO_IMAGE_URL =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=85';

export const DEFAULT_HERO_HEADING = 'Architectural Landmarks & Private Havens';

export const DEFAULT_HERO_DESCRIPTION =
  'Representing the world’s most significant residential estates, sky penthouses, and commercial trophy assets with automated multi-registry synchronization.';

export interface ResolvedHeroSlide {
  id: string;
  imageUrl: string;
  heading: string;
  description: string;
  displayOrder: number;
  isDefault: boolean;
}

export const DEFAULT_HERO_SLIDE: ResolvedHeroSlide = {
  id: 'default-hero-slide',
  imageUrl: DEFAULT_HERO_IMAGE_URL,
  heading: DEFAULT_HERO_HEADING,
  description: DEFAULT_HERO_DESCRIPTION,
  displayOrder: 0,
  isDefault: true,
};

export function isValidHeroImageUrl(url?: string | null): boolean {
  const clean = (url || '').trim();
  if (!clean) return false;
  return clean.startsWith('/') || /^https?:\/\//i.test(clean);
}

/**
 * A slide is considered complete when all 3 editable fields (Banner Image, Heading, Description)
 * are present and non-empty.
 */
export function isHeroSlideComplete(slide?: Partial<HeroSlide> | null): boolean {
  if (!slide) return false;
  return (
    isValidHeroImageUrl(slide.imageUrl) &&
    typeof slide.heading === 'string' &&
    slide.heading.trim().length > 0 &&
    typeof slide.description === 'string' &&
    slide.description.trim().length > 0
  );
}

/**
 * Resolves the active ordered slides for the homepage hero slider.
 * Fallback rule: if no slides exist or no complete slides are configured,
 * returns [DEFAULT_HERO_SLIDE] so the exact default banner always displays and never goes blank.
 */
export function resolveActiveHeroSlides(slides?: HeroSlide[] | null): ResolvedHeroSlide[] {
  if (!Array.isArray(slides) || slides.length === 0) {
    return [DEFAULT_HERO_SLIDE];
  }

  const ordered = [...slides].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 0;
    const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0);
  });

  const completeSlides: ResolvedHeroSlide[] = ordered
    .filter((s) => isHeroSlideComplete(s))
    .map((s, idx) => ({
      id: s.id,
      imageUrl: s.imageUrl.trim(),
      heading: s.heading.trim(),
      description: s.description.trim(),
      displayOrder: idx,
      isDefault: false,
    }));

  if (completeSlides.length === 0) {
    return [DEFAULT_HERO_SLIDE];
  }

  return completeSlides;
}
