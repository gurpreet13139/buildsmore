import React, { useEffect, useMemo, useState } from 'react';
import { CuratedCollection, HeroSlide, Property } from '../types/property';
import { PropertyCard } from '../components/property/PropertyCard';
import { HeroInquiryForm } from '../components/inquiry/HeroInquiryForm';
import { LocationTabs } from '../components/property/LocationTabs';
import { AppLink } from '../components/common/AppLink';
import { storage } from '../services/storage';
import { DEFAULT_HERO_FALLBACK_IMAGE_URL, resolveActiveHeroSlides } from '../utils/heroSlides';
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Layers,
  Gem,
  Handshake,
  Home,
  IndianRupee,
  Users,
  Award,
  Phone,
  PhoneCall,
} from 'lucide-react';

interface HomePageProps {
  properties: Property[];
  collections?: CuratedCollection[];
  trophyHoldings?: Property[];
  heroSlides?: HeroSlide[];
  onSelectProperty: (property: Property) => void;
  onNavigate: (path: string) => void;
  onOpenInquiry?: () => void;
  savedIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  properties,
  collections,
  trophyHoldings,
  heroSlides,
  onSelectProperty,
  onNavigate,
  onOpenInquiry,
  savedIds,
  onToggleSave,
}) => {
  // Dynamic Hero Banner Slider State (strictly falls back to exact default banner if empty/incomplete)
  const activeSlides = useMemo(() => resolveActiveHeroSlides(heroSlides), [heroSlides]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [hasSlideTransitioned, setHasSlideTransitioned] = useState(false);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [failedSlideIds, setFailedSlideIds] = useState<Record<string, boolean>>({});

  const safeSlideIndex = activeSlideIndex < activeSlides.length ? activeSlideIndex : 0;
  const currentHeroSlide = activeSlides[safeSlideIndex] || activeSlides[0];
  const hasMultipleSlides = activeSlides.length > 1;
  const isCurrentVideo =
    currentHeroSlide.mediaType === 'video' && !failedSlideIds[currentHeroSlide.id];

  useEffect(() => {
    if (activeSlideIndex >= activeSlides.length) {
      setActiveSlideIndex(0);
    }
  }, [activeSlides.length, activeSlideIndex]);

  useEffect(() => {
    if (!hasMultipleSlides || isHeroPaused) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setHasSlideTransitioned(true);
      setActiveSlideIndex((prev) => (prev + 1) % activeSlides.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [hasMultipleSlides, isHeroPaused, activeSlides.length]);

  const handleGoToSlide = (nextIdx: number) => {
    if (!hasMultipleSlides) return;
    const wrapped = (nextIdx + activeSlides.length) % activeSlides.length;
    if (wrapped !== safeSlideIndex) {
      setHasSlideTransitioned(true);
      setActiveSlideIndex(wrapped);
    }
  };

  // Location Tab Filter State
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  // Hero Quick Search State
  const [heroLocation, setHeroLocation] = useState('all');
  const [heroCategory, setHeroCategory] = useState<string>('All');
  const [heroMaxPrice, setHeroMaxPrice] = useState<string>('all');

  const managedLocations = storage.getLocations(true);
  const publishedProperties = properties.filter((p) => p.status === 'Published');

  const MAX_HOMEPAGE_FEATURED_PROPERTIES = 12;

  // Dynamic Trophy Holdings of the Season (connected directly to central database)
  const trophyProperties =
    trophyHoldings && trophyHoldings.length > 0
      ? trophyHoldings.filter((p) => p.status === 'Published')
      : storage.getTrophyHoldings();
  const displayTrophyProperties =
    trophyProperties.length > 0
      ? trophyProperties.slice(0, MAX_HOMEPAGE_FEATURED_PROPERTIES)
      : publishedProperties
          .filter((p) => p.featured || p.isTrophyHolding)
          .slice(0, MAX_HOMEPAGE_FEATURED_PROPERTIES);

  // Location Filtered Holdings
  const selectedLocObject =
    selectedLocation !== 'all'
      ? storage.getLocationBySlug(selectedLocation) || storage.getLocationById(selectedLocation)
      : null;
  const selectedLocationName = selectedLocObject ? selectedLocObject.name : selectedLocation;

  const matchingDisplayProperties =
    selectedLocation === 'all'
      ? displayTrophyProperties.length > 0
        ? displayTrophyProperties
        : publishedProperties
      : publishedProperties.filter((p) => {
          if (p.locationId && selectedLocObject && p.locationId === selectedLocObject.id) return true;
          if (p.city && p.city.toLowerCase() === selectedLocationName.toLowerCase()) return true;
          if (selectedLocObject?.aliases && selectedLocObject.aliases.length > 0) {
            return selectedLocObject.aliases.some(
              (a) =>
                (p.city && p.city.toLowerCase().includes(a)) ||
                (p.locality && p.locality.toLowerCase().includes(a)) ||
                (p.address && p.address.toLowerCase().includes(a))
            );
          }
          return false;
        });

  // Strictly display at most 12 properties (3 rows of 4 on desktop) on the homepage
  const displayProperties = matchingDisplayProperties.slice(0, MAX_HOMEPAGE_FEATURED_PROPERTIES);

  // Dynamic Curated Investment Collections (connected directly to central database)
  const curatedCollections =
    collections && collections.length > 0
      ? collections.filter((c) => c.status === 'Published')
      : storage.getCollections(false);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (heroCategory && heroCategory !== 'All') {
      params.set('category', heroCategory);
    }
    if (heroLocation && heroLocation !== 'all') {
      params.set('location', heroLocation);
    }
    if (heroMaxPrice && heroMaxPrice !== 'all') {
      params.set('budget', heroMaxPrice);
    }
    const qs = params.toString();
    onNavigate(qs ? `/properties?${qs}` : '/properties');
  };

  const handleEnquireAction = () => {
    if (onOpenInquiry) {
      onOpenInquiry();
      return;
    }
    if (typeof document !== 'undefined') {
      document.getElementById('homepage-inquiry')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white text-[#0D2558]">
      {/* 1. HERO SECTION — Architectural Marketplace Hero with Exclusive Image/Video Background & Floating Search */}
      <section
        className={`relative overflow-hidden border-b border-slate-200/70 ${
          isCurrentVideo ? 'bg-[#091A3E]' : 'bg-[#F4F8FD]'
        }`}
        onMouseEnter={() => setIsHeroPaused(true)}
        onMouseLeave={() => setIsHeroPaused(false)}
        onFocusCapture={() => setIsHeroPaused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsHeroPaused(false);
          }
        }}
      >
        {/* Background Media Layer: Strictly renders EITHER a Video OR an Image per slide (never both together) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className={`absolute inset-0 ${isCurrentVideo ? '' : 'hero-cinematic-stage'}`}>
            {activeSlides.map((slide, idx) => {
              const isActive = idx === safeSlideIndex;
              const isFailed = Boolean(failedSlideIds[slide.id]);
              const renderAsVideo = slide.mediaType === 'video' && !isFailed;

              if (renderAsVideo) {
                return (
                  <video
                    key={slide.id}
                    src={slide.imageUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload={isActive ? 'auto' : 'metadata'}
                    aria-label={slide.heading || 'BUILDsmore Luxury Architecture Video'}
                    ref={(el) => {
                      if (!el) return;
                      el.muted = true;
                      if (isActive) {
                        const playPromise = el.play();
                        if (playPromise && typeof playPromise.catch === 'function') {
                          playPromise.catch(() => {});
                        }
                      } else {
                        el.pause();
                      }
                    }}
                    onError={() => {
                      if (!failedSlideIds[slide.id]) {
                        setFailedSlideIds((prev) => ({ ...prev, [slide.id]: true }));
                      }
                    }}
                    className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                );
              }

              const imageSrc = isFailed ? DEFAULT_HERO_FALLBACK_IMAGE_URL : slide.imageUrl;
              return (
                <img
                  key={slide.id}
                  src={imageSrc}
                  alt={slide.heading || 'BUILDsmore Luxury Architecture'}
                  onError={() => {
                    if (!failedSlideIds[slide.id]) {
                      setFailedSlideIds((prev) => ({ ...prev, [slide.id]: true }));
                    }
                  }}
                  className={`absolute inset-0 w-full h-full object-cover object-right md:object-center transition-opacity duration-1000 ease-in-out ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              );
            })}

            {/* Sky-Masked Atmospheric Layers (strictly for image slides only) */}
            {!isCurrentVideo && (
              <div className="hero-living-sky-mask absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="hero-sun-glow" />
                <div className="hero-light-rays-primary" />
                <div className="hero-light-rays-secondary" />
                <div className="hero-cloud-haze" />
                <div className="hero-cloud-layer-far" />
                <div className="hero-cloud-layer-near" />
              </div>
            )}
          </div>

          {/* Adaptive Contrast Scrim: Sleek dark-navy cinematic veil for Video; Daylight mist for Image */}
          {isCurrentVideo ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-[#091A3E]/72 via-[#091A3E]/38 to-[#091A3E]/18" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#091A3E]/55 via-transparent to-[#091A3E]/20" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-[#F7FAFF] via-[#F7FAFF]/90 lg:via-[#F7FAFF]/78 to-[#0D2558]/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D2558]/25 via-transparent to-white/40" />
            </>
          )}

          {/* Signature Geometric Top-Right Royal Blue & Red Corner Ribbon */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-0 right-0 w-44 h-64 pointer-events-none overflow-hidden"
          >
            <div className="absolute -top-6 -right-16 w-48 h-72 bg-[#0D2558] rotate-[30deg] shadow-lg" />
            <div className="absolute -top-8 -right-12 w-3 h-72 bg-[#DC1F26] rotate-[30deg]" />
          </div>
        </div>

        {/* Hero Foreground Container: Left Hero Copy + Right Side Enquiry Form + Bottom Search Bar */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 lg:pt-16 pb-12 sm:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-10 items-center">
            {/* LEFT COLUMN: Hero Copy, CTAs & Slider Navigation */}
            <div className="lg:col-span-7 space-y-5">
              {/* Eyebrow Line + Label */}
              <div className="inline-flex items-center gap-3">
                <span className="w-8 h-[2.5px] bg-[#DC1F26] rounded-full" />
                <span
                  className={`text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.16em] pb-0.5 ${
                    isCurrentVideo
                      ? 'text-sky-200 border-b border-white/30 drop-shadow-xs'
                      : 'text-[#163B8C] border-b border-[#163B8C]/25'
                  }`}
                >
                  Premium Real Estate Solutions
                </span>
              </div>

              {/* Dynamic Slide Copy (heading rendered as intact text node for SSR & slider compatibility) */}
              <div
                key={currentHeroSlide.id}
                className={`space-y-4 ${hasSlideTransitioned ? 'hero-slide-copy-enter' : ''}`}
              >
                <h1
                  className={`text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.5rem] font-extrabold tracking-tight leading-[1.08] text-balance ${
                    isCurrentVideo ? 'text-white drop-shadow-md' : 'text-[#0D2558]'
                  }`}
                >
                  {currentHeroSlide.heading}
                </h1>

                <p
                  className={`text-sm sm:text-base lg:text-lg font-medium max-w-xl leading-relaxed ${
                    isCurrentVideo ? 'text-white/90 drop-shadow-sm' : 'text-slate-700'
                  }`}
                >
                  {currentHeroSlide.description}
                </p>
              </div>

              {/* Primary & Secondary Hero CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <AppLink
                  href="/properties"
                  onNavigate={onNavigate}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-sm font-bold rounded-full shadow-lg shadow-[#DC1F26]/25 transition-all cursor-pointer group"
                >
                  <span>Explore Properties</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </AppLink>

                <button
                  type="button"
                  onClick={handleEnquireAction}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-white/95 hover:bg-[#0D2558] text-[#0D2558] hover:text-white border border-[#0D2558]/25 hover:border-[#0D2558] text-sm font-bold rounded-full shadow-sm transition-all cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4 text-[#DC1F26]" />
                  <span>Private Consultation</span>
                </button>
              </div>

              {/* Subtle Slider Controls (rendered strictly when 2+ custom slides are configured) */}
              {hasMultipleSlides && (
                <div
                  className="pt-2 flex items-center gap-3.5"
                  aria-label="Hero banner slide navigation"
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleGoToSlide(safeSlideIndex - 1)}
                      aria-label="Previous hero slide"
                      className="w-8 h-8 rounded-full bg-white/90 hover:bg-[#0D2558] border border-slate-200 hover:border-[#0D2558] text-[#0D2558] hover:text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGoToSlide(safeSlideIndex + 1)}
                      aria-label="Next hero slide"
                      className="w-8 h-8 rounded-full bg-white/90 hover:bg-[#0D2558] border border-slate-200 hover:border-[#0D2558] text-[#0D2558] hover:text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2" role="tablist" aria-label="Select hero slide">
                    {activeSlides.map((slide, idx) => {
                      const isCurrent = idx === safeSlideIndex;
                      return (
                        <button
                          key={slide.id}
                          type="button"
                          role="tab"
                          aria-selected={isCurrent}
                          aria-label={`Go to slide ${idx + 1}: ${slide.heading}`}
                          onClick={() => handleGoToSlide(idx)}
                          className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                            isCurrent
                              ? 'w-8 bg-[#DC1F26]'
                              : isCurrentVideo
                                ? 'w-2 bg-white/50 hover:bg-white/80'
                                : 'w-2 bg-[#0D2558]/25 hover:bg-[#0D2558]/50'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      isCurrentVideo ? 'text-white/85' : 'text-slate-600'
                    }`}
                  >
                    {String(safeSlideIndex + 1).padStart(2, '0')} /{' '}
                    {String(activeSlides.length).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Compact Property Enquiry Form Card */}
            <div className="lg:col-span-5 xl:col-span-4 xl:col-start-9 w-full max-w-md mx-auto lg:max-w-none">
              <HeroInquiryForm />
            </div>
          </div>

          {/* Floating White Marketplace Property Search Bar */}
          <div className="mt-8 lg:mt-10 max-w-5xl mx-auto">
            <form
              onSubmit={handleHeroSearch}
              className="bg-white rounded-2xl shadow-xl shadow-[#0D2558]/10 border border-slate-200/90 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-0 items-center"
            >
              {/* Property Type */}
              <div className="md:col-span-3 px-3 py-1.5 md:border-r border-slate-200">
                <label
                  htmlFor="hero-search-category"
                  className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-0.5"
                >
                  <Home className="w-3.5 h-3.5 text-[#0D2558]" />
                  <span>Property Type</span>
                </label>
                <select
                  id="hero-search-category"
                  value={heroCategory}
                  onChange={(e) => setHeroCategory(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-[#0D2558] focus:outline-none cursor-pointer"
                >
                  <option value="All">All Types</option>
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Plots/Land">Plots &amp; Land</option>
                  <option value="New Projects">New Projects</option>
                </select>
              </div>

              {/* Location */}
              <div className="md:col-span-3 px-3 py-1.5 md:border-r border-slate-200">
                <label
                  htmlFor="hero-search-location"
                  className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-0.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#0D2558]" />
                  <span>Location</span>
                </label>
                <select
                  id="hero-search-location"
                  value={heroLocation}
                  onChange={(e) => setHeroLocation(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-[#0D2558] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Locations</option>
                  {managedLocations.map((loc) => (
                    <option key={loc.id} value={loc.slug}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Budget */}
              <div className="md:col-span-3 px-3 py-1.5">
                <label
                  htmlFor="hero-search-budget"
                  className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-0.5"
                >
                  <IndianRupee className="w-3.5 h-3.5 text-[#0D2558]" />
                  <span>Budget</span>
                </label>
                <select
                  id="hero-search-budget"
                  value={heroMaxPrice}
                  onChange={(e) => setHeroMaxPrice(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-[#0D2558] focus:outline-none cursor-pointer"
                >
                  <option value="all">Any Budget</option>
                  <option value="under_5cr">Up to ₹5 Cr</option>
                  <option value="5cr_20cr">₹5 Cr – ₹20 Cr</option>
                  <option value="20cr_50cr">₹20 Cr – ₹50 Cr</option>
                  <option value="over_50cr">₹50 Cr+</option>
                </select>
              </div>

              {/* Search Submit CTA */}
              <div className="md:col-span-3 md:pl-3">
                <button
                  type="submit"
                  className="w-full py-3.5 px-5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-sm font-bold rounded-xl shadow-md shadow-[#DC1F26]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>Search Properties</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 2. FOUR-PILLAR TRUST STRIP */}
      <section className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-200 gap-y-5 lg:gap-y-0">
            <div className="flex items-center justify-center gap-3.5 px-4 py-1">
              <div className="w-11 h-11 rounded-xl bg-[#EEF3FB] text-[#163B8C] flex items-center justify-center shrink-0">
                <Gem className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-[#0D2558] leading-snug block">
                  Premium
                </span>
                <span className="text-sm font-bold text-[#0D2558] leading-snug block">
                  Properties
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3.5 px-4 py-1">
              <div className="w-11 h-11 rounded-xl bg-[#EEF3FB] text-[#163B8C] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-[#0D2558] leading-snug block">
                  Trusted by
                </span>
                <span className="text-sm font-bold text-[#0D2558] leading-snug block">
                  Clients
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3.5 px-4 py-1">
              <div className="w-11 h-11 rounded-xl bg-[#EEF3FB] text-[#163B8C] flex items-center justify-center shrink-0">
                <Handshake className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-[#0D2558] leading-snug block">
                  Expert Advisory
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  RERA &amp; Title Verified
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3.5 px-4 py-1">
              <div className="w-11 h-11 rounded-xl bg-[#EEF3FB] text-[#163B8C] flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-[#0D2558] leading-snug block">
                  High Returns
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  Prime Growth Corridors
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FEATURED PROPERTIES / TROPHY HOLDINGS */}
      <section id="trophy-holdings" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2.5">
              <span className="w-7 h-[2px] bg-[#DC1F26] rounded-full" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                {selectedLocation === 'all'
                  ? 'Featured Properties'
                  : `Location Focus · ${selectedLocationName}`}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D2558] tracking-tight">
              {selectedLocation === 'all' ? (
                <>
                  Explore Our <span className="text-[#DC1F26]">Premium</span>{' '}
                  <span className="text-[#163B8C]">Properties</span>
                </>
              ) : (
                <>
                  Trophy Holdings in <span className="text-[#DC1F26]">{selectedLocationName}</span>
                </>
              )}
            </h2>
          </div>

          <AppLink
            href="/properties"
            onNavigate={onNavigate}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#DC1F26] hover:text-[#B91C1C] transition-colors cursor-pointer group shrink-0"
          >
            <span>View All Properties ({publishedProperties.length})</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </AppLink>
        </div>

        {/* Dynamic Location Filter Tabs */}
        <LocationTabs
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          properties={publishedProperties}
          categoryTitle="All Holdings"
        />

        {/* Responsive 4-Column Property Marketplace Grid (Max 12 items = 3 rows on desktop) */}
        {displayProperties.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayProperties.map((prop) => (
                <PropertyCard
                  key={prop.id}
                  property={prop}
                  onSelect={onSelectProperty}
                  isSaved={savedIds.includes(prop.id)}
                  onToggleSave={onToggleSave}
                />
              ))}
            </div>

            <div className="pt-2 flex justify-center">
              <AppLink
                href="/properties"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-[#0D2558] hover:bg-[#DC1F26] text-white text-sm font-bold rounded-full shadow-md shadow-[#0D2558]/15 transition-all cursor-pointer group"
              >
                <span>View All Properties</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </AppLink>
            </div>
          </>
        ) : (
          <div className="p-12 text-center bg-[#F7F9FC] border border-slate-200 rounded-2xl space-y-3">
            <MapPin className="w-8 h-8 text-[#DC1F26] mx-auto" />
            <h3 className="text-xl font-bold text-[#0D2558]">
              No Published Assets Found in {selectedLocationName}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Our acquisitions division is actively sourcing prime residential and commercial holdings
              in {selectedLocationName}.
            </p>
            <button
              type="button"
              onClick={() => setSelectedLocation('all')}
              className="mt-2 px-5 py-2.5 bg-[#0D2558] hover:bg-[#163B8C] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer"
            >
              Show All Locations
            </button>
          </div>
        )}
      </section>

      {/* 4. SIGNATURE ROYAL NAVY + RED ANGLED STATS & CTA BANNER */}
      <section className="relative bg-[#0D2558] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Left Architectural Skyline Image Panel with Diagonal Red Slash */}
            <div className="relative hidden lg:block lg:col-span-3 min-h-[150px] overflow-hidden">
              <img
                src="/assets/images/blog_tricity_skyline_1795014928867.jpg"
                alt="BUILDsmore Urban Skyline"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-[#0D2558]/35" />
              <div
                aria-hidden="true"
                className="absolute top-0 -right-10 bottom-0 w-20 bg-[#0D2558] -skew-x-12 border-l-[5px] border-[#DC1F26]"
              />
            </div>

            {/* Center Metrics Strip */}
            <div className="lg:col-span-6 px-6 py-9 sm:py-10 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 items-center sm:divide-x divide-white/15">
              <div className="flex items-center justify-center sm:justify-start gap-3.5 sm:px-3">
                <div className="w-11 h-11 rounded-xl bg-white/10 text-sky-300 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white block leading-none tabular-nums">
                    500+
                  </span>
                  <span className="text-xs text-slate-300 font-medium mt-1 block">
                    Properties Listed
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-3.5 sm:px-5">
                <div className="w-11 h-11 rounded-xl bg-white/10 text-indigo-300 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white block leading-none tabular-nums">
                    1,000+
                  </span>
                  <span className="text-xs text-slate-300 font-medium mt-1 block">
                    Happy Clients
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-3.5 sm:px-5">
                <div className="w-11 h-11 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white block leading-none tabular-nums">
                    15+
                  </span>
                  <span className="text-xs text-slate-300 font-medium mt-1 block">
                    Years of Trust
                  </span>
                </div>
              </div>
            </div>

            {/* Right Signature Red CTA Wedge */}
            <div className="relative lg:col-span-3 bg-[#DC1F26] px-6 py-8 lg:py-9 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-4 text-center sm:text-left">
              <div
                aria-hidden="true"
                className="hidden lg:block absolute top-0 -left-8 bottom-0 w-16 bg-[#DC1F26] -skew-x-12"
              />
              <div className="relative z-10">
                <span className="text-base sm:text-lg font-extrabold text-white leading-tight block">
                  Invest Smart.
                </span>
                <span className="text-base sm:text-lg font-extrabold text-white leading-tight block">
                  Grow Confident.
                </span>
              </div>

              <AppLink
                href="/contact"
                onNavigate={onNavigate}
                className="relative z-10 inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 text-[#DC1F26] text-xs font-extrabold rounded-full shadow-md transition-all cursor-pointer shrink-0"
              >
                <span>Contact Us</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </AppLink>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CURATED INVESTMENT COLLECTIONS */}
      {curatedCollections.length > 0 && (
        <section className="bg-[#F7F9FC] border-b border-slate-200/80 py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2.5">
                  <span className="w-7 h-[2px] bg-[#DC1F26] rounded-full" />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                    Asset Categorization
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D2558] tracking-tight">
                  Curated Investment <span className="text-[#163B8C]">Collections</span>
                </h2>
                <p className="text-sm text-slate-600 max-w-xl">
                  Targeted portfolio discovery across prime residential, commercial, plots, and new
                  development asset classes.
                </p>
              </div>

              <AppLink
                href="/properties"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#163B8C] hover:text-[#DC1F26] transition-colors cursor-pointer shrink-0"
              >
                <span>Browse Full Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </AppLink>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {curatedCollections.map((col, index) => {
                const isWide = index % 4 === 0 || index % 4 === 3;
                const colSpanClass = isWide ? 'md:col-span-7' : 'md:col-span-5';

                return (
                  <AppLink
                    key={col.id}
                    href={`/collection/${encodeURIComponent(col.slug)}`}
                    onNavigate={onNavigate}
                    className={`${colSpanClass} block relative h-80 sm:h-96 rounded-2xl overflow-hidden group cursor-pointer border border-slate-200 bg-[#0D2558] shadow-sm hover:shadow-xl transition-all duration-300`}
                  >
                    <img
                      src={
                        col.coverImageUrl ||
                        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
                      }
                      alt={col.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D2558]/95 via-[#0D2558]/40 to-transparent" />
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-[#0D2558] flex items-center gap-1.5 shadow-sm">
                      <Layers className="w-3.5 h-3.5 text-[#DC1F26]" />
                      <span>{col.propertyIds?.length || 0} Assets</span>
                    </div>
                    <div className="absolute bottom-6 left-6 right-6">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-200">
                        {col.subtitle || 'Investment Collection'}
                      </span>
                      <h3 className="text-2xl font-extrabold text-white mt-1 group-hover:text-sky-200 transition-colors">
                        {col.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-200 mt-1.5 max-w-md line-clamp-2">
                        {col.description}
                      </p>
                      <div className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#DC1F26] group-hover:bg-[#B91C1C] px-4 py-2 rounded-full transition-colors">
                        <span>View Collection</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </AppLink>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 6. FEATURED NEW DEVELOPMENT SPOTLIGHT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center">
            <div className="p-8 md:p-12 space-y-6">
              <div className="inline-flex items-center gap-2.5">
                <span className="w-7 h-[2px] bg-[#DC1F26] rounded-full" />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                  Featured New Development
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D2558] leading-tight tracking-tight">
                The Aurora Residences Zürichberg
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed">
                A limited commission of eight carbon-neutral private residences overlooking Lake
                Zurich and the Swiss Alps. Integrating deep geothermal heating, private solariums,
                and five-star hospitality concierge managed by The Dolder Grand.
              </p>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold uppercase tracking-wider block">
                    Delivery
                  </span>
                  <span className="text-[#0D2558] font-bold text-sm mt-0.5 block">
                    Q4 2026 Active Construction
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase tracking-wider block">
                    Starting From
                  </span>
                  <span className="text-[#DC1F26] font-extrabold text-sm mt-0.5 block tabular-nums">
                    €18,900,000
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3.5">
                <AppLink
                  href="/property/the-aurora-residences-zurichberg-switzerland"
                  onNavigate={onNavigate}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#0D2558] hover:bg-[#163B8C] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer shadow-sm"
                >
                  <span>View Residence Dossier</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </AppLink>
                <AppLink
                  href="/contact"
                  onNavigate={onNavigate}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-[#F7F9FC] text-[#0D2558] border border-slate-300 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer"
                >
                  <span>Register Early Interest</span>
                </AppLink>
              </div>
            </div>

            <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] bg-slate-100">
              <img
                src="https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80"
                alt="The Aurora Residences"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 7. PRE-FOOTER "GET IN TOUCH WITH BUILDSMORE" + INTEGRATED DIRECT INQUIRY FORM */}
      <section
        id="homepage-inquiry"
        className="relative overflow-hidden bg-gradient-to-b from-white via-[#F5F9FF] to-[#EBF2FC] border-t border-slate-200/80 py-16 lg:py-20"
      >
        {/* Subtle Architectural Skyline Watermark Accent */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-56 opacity-[0.12] pointer-events-none select-none overflow-hidden"
        >
          <img
            src="/assets/images/blog_tricity_skyline_1795014928867.jpg"
            alt=""
            className="w-full h-full object-cover object-bottom grayscale contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#F5F9FF]/60 to-[#F5F9FF]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2.5">
              <span className="w-8 h-[2.5px] bg-[#DC1F26] rounded-full" />
              <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                Let&apos;s Build Your Future
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0D2558] tracking-tight leading-[1.12]">
              Get in Touch with <span className="text-[#DC1F26]">Buildsmore</span>
            </h2>

            <p className="text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
              Our team is here to help you find the perfect property or investment opportunity across
              Mohali, Zirakpur, Dera Bassi, New Chandigarh, and prime global enclaves.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <AppLink
                href="/contact"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-sm font-bold rounded-full shadow-lg shadow-[#DC1F26]/20 transition-all cursor-pointer"
              >
                <span>Enquire Now</span>
                <ArrowRight className="w-4 h-4" />
              </AppLink>

              <a
                href="tel:9779878303"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-white hover:bg-[#0D2558] text-[#0D2558] hover:text-white border border-slate-200 hover:border-[#0D2558] text-sm font-bold rounded-full shadow-xs transition-all cursor-pointer"
              >
                <Phone className="w-4 h-4 text-[#DC1F26]" />
                <span className="tabular-nums">977-987-8303</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
