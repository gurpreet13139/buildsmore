import React, { useEffect, useMemo, useState } from 'react';
import { CuratedCollection, HeroSlide, Property } from '../types/property';
import { PropertyCard } from '../components/property/PropertyCard';
import { HeroInquiryForm } from '../components/inquiry/HeroInquiryForm';
import { LocationTabs } from '../components/property/LocationTabs';
import { AppLink } from '../components/common/AppLink';
import { useCurrency } from '../context/CurrencyContext';
import { storage } from '../services/storage';
import { DEFAULT_HERO_IMAGE_URL, resolveActiveHeroSlides } from '../utils/heroSlides';
import { 
  Search, 
  ArrowRight, 
  ShieldCheck, 
  Building2, 
  Compass, 
  Lock, 
  MapPin, 
  KeyRound, 
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Layers
} from 'lucide-react';

interface HomePageProps {
  properties: Property[];
  collections?: CuratedCollection[];
  trophyHoldings?: Property[];
  heroSlides?: HeroSlide[];
  onSelectProperty: (property: Property) => void;
  onNavigate: (path: string) => void;
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
  savedIds,
  onToggleSave,
}) => {
  const { formatPrice } = useCurrency();

  // Dynamic Hero Banner Slider State (strictly falls back to exact default banner if empty/incomplete)
  const activeSlides = useMemo(() => resolveActiveHeroSlides(heroSlides), [heroSlides]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [hasSlideTransitioned, setHasSlideTransitioned] = useState(false);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [failedSlideIds, setFailedSlideIds] = useState<Record<string, boolean>>({});

  const safeSlideIndex = activeSlideIndex < activeSlides.length ? activeSlideIndex : 0;
  const currentHeroSlide = activeSlides[safeSlideIndex] || activeSlides[0];
  const hasMultipleSlides = activeSlides.length > 1;

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
  const [heroLocation, setHeroLocation] = useState('');
  const [heroCategory, setHeroCategory] = useState<string>('All');
  const [heroMaxPrice, setHeroMaxPrice] = useState<string>('all');

  const publishedProperties = properties.filter(p => p.status === 'Published');

  // Dynamic Trophy Holdings of the Season (connected directly to central database)
  const trophyProperties = trophyHoldings && trophyHoldings.length > 0
    ? trophyHoldings.filter(p => p.status === 'Published')
    : storage.getTrophyHoldings();
  const displayTrophyProperties = trophyProperties.length > 0
    ? trophyProperties
    : properties.filter(p => p.featured || p.isTrophyHolding).slice(0, 3);

  // Location Filtered Holdings
  const selectedLocObject = selectedLocation !== 'all'
    ? storage.getLocationBySlug(selectedLocation) || storage.getLocationById(selectedLocation)
    : null;
  const selectedLocationName = selectedLocObject ? selectedLocObject.name : selectedLocation;

  const displayProperties = selectedLocation === 'all'
    ? displayTrophyProperties
    : publishedProperties.filter(p => {
        if (p.locationId && selectedLocObject && p.locationId === selectedLocObject.id) return true;
        if (p.city && p.city.toLowerCase() === selectedLocationName.toLowerCase()) return true;
        if (selectedLocObject?.aliases && selectedLocObject.aliases.length > 0) {
          return selectedLocObject.aliases.some(a => 
            (p.city && p.city.toLowerCase().includes(a)) ||
            (p.locality && p.locality.toLowerCase().includes(a)) ||
            (p.address && p.address.toLowerCase().includes(a))
          );
        }
        return false;
      });

  // Dynamic Curated Investment Collections (connected directly to central database)
  const curatedCollections = (collections && collections.length > 0
    ? collections.filter(c => c.status === 'Published')
    : storage.getCollections(false));
  const newDevelopments = properties.filter(p => p.isNewDevelopment || p.category === 'New Projects').slice(0, 2);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('/properties');
  };

  return (
    <div className="space-y-24 pb-20">
      
      {/* 1. Hero Section with Cinematic Background Slider & Search Interface */}
      <section
        className="relative min-h-[90vh] flex flex-col justify-center items-center px-6 pt-16 pb-24 overflow-hidden"
        onMouseEnter={() => setIsHeroPaused(true)}
        onMouseLeave={() => setIsHeroPaused(false)}
        onFocusCapture={() => setIsHeroPaused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsHeroPaused(false);
          }
        }}
      >
        
        {/* Background Image(s) with Cinematic 20s Breathing Zoom, Living-Sky Clouds/Sunlight & Deep Luxury Gradient Scrim */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="hero-cinematic-stage absolute inset-0">
            {activeSlides.map((slide, idx) => {
              const isActive = idx === safeSlideIndex;
              const resolvedSrc = failedSlideIds[slide.id]
                ? DEFAULT_HERO_IMAGE_URL
                : slide.imageUrl;

              return (
                <img
                  key={slide.id}
                  src={resolvedSrc}
                  alt={slide.heading || 'BUILDsmore Luxury Architecture'}
                  onError={() => {
                    if (!failedSlideIds[slide.id]) {
                      setFailedSlideIds((prev) => ({ ...prev, [slide.id]: true }));
                    }
                  }}
                  className={`absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.4] transition-opacity duration-1000 ease-in-out ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              );
            })}

            {/* Sky-Masked Atmospheric Layers (strictly confined to sky; architectural building stays completely stable & unchanged) */}
            <div className="hero-living-sky-mask absolute inset-0 overflow-hidden" aria-hidden="true">
              <div className="hero-sun-glow" />
              <div className="hero-light-rays-primary" />
              <div className="hero-light-rays-secondary" />
              <div className="hero-cloud-haze" />
              <div className="hero-cloud-layer-far" />
              <div className="hero-cloud-layer-near" />
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f12] via-[#0c0f12]/60 to-[#0c0f12]/30" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[#0c0f12]/80" />
        </div>

        {/* Hero Two-Column Layout (Desktop: Left ~75% Hero, Right ~25% Compact Inquiry Card; Mobile: Stacked) */}
        <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-10 items-center">
          
          {/* LEFT SIDE (approximately 75% width): Preserves all existing hero content, headline, description, search console, typography, and branding */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6 text-center lg:text-left">
            
            <div className="flex flex-col items-center lg:items-start justify-center gap-3">
              <img
                src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
                alt="BUILDsmore Logo"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-sm object-cover border border-[#c5a059]/50 shadow-2xl"
              />
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#c5a059] font-medium border-b border-[#c5a059]/40 pb-1.5">
                <span>BUILDsmore · Let's Grow Together</span>
              </div>
            </div>

            <div
              key={currentHeroSlide.id}
              className={`space-y-6 ${hasSlideTransitioned ? 'hero-slide-copy-enter' : ''}`}
            >
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-normal text-[#f7f5f2] tracking-tight leading-[1.08] text-balance">
                {currentHeroSlide.heading}
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-[#cbd5e1] font-light max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                {currentHeroSlide.description}
              </p>
            </div>

            {/* Integrated Search Console (Preserved unchanged) */}
            <div className="pt-4 w-full max-w-3xl mx-auto lg:mx-0">
              <form
                onSubmit={handleHeroSearch}
                className="bg-[#12161d]/90 backdrop-blur-xl border border-[#2b3543] p-3 sm:p-4 rounded-sm shadow-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 text-left"
              >
                {/* Location Input */}
                <div className="sm:col-span-5 relative">
                  <label className="text-[10px] uppercase tracking-wider text-[#8a909a] font-mono block mb-1">
                    Global Enclave or City
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-[#c5a059] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={heroLocation}
                      onChange={(e) => setHeroLocation(e.target.value)}
                      placeholder="e.g. Mallorca, Mayfair, Aspen, Zurich..."
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm pl-9 pr-3 py-2 text-xs text-[#f7f5f2] placeholder-[#64748b] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Asset Class */}
                <div className="sm:col-span-3">
                  <label className="text-[10px] uppercase tracking-wider text-[#8a909a] font-mono block mb-1">
                    Asset Class
                  </label>
                  <select
                    value={heroCategory}
                    onChange={(e) => setHeroCategory(e.target.value)}
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Plots/Land">Plots & Vineyards</option>
                    <option value="New Projects">New Developments</option>
                  </select>
                </div>

                {/* Price Tier */}
                <div className="sm:col-span-4 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wider text-[#8a909a] font-mono block mb-1">
                      Price Range
                    </label>
                    <select
                      value={heroMaxPrice}
                      onChange={(e) => setHeroMaxPrice(e.target.value)}
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                    >
                      <option value="all">Any Valuation</option>
                      <option value="under_5cr">Up to ₹5 Cr</option>
                      <option value="5cr_20cr">₹5 Cr – ₹20 Cr</option>
                      <option value="over_20cr">₹20 Cr+</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm transition-all flex items-center justify-center shrink-0 h-[34px] cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* Subtle Luxury Slider Controls (shown only when 2+ custom slides are active) */}
            {hasMultipleSlides && (
              <div
                className="pt-2 flex items-center justify-center lg:justify-start gap-4"
                aria-label="Hero banner slide navigation"
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleGoToSlide(safeSlideIndex - 1)}
                    aria-label="Previous hero slide"
                    className="w-8 h-8 rounded-sm bg-[#12161d]/80 hover:bg-[#1a222d] border border-[#2b3543] hover:border-[#c5a059]/70 text-[#cbd5e1] hover:text-[#c5a059] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoToSlide(safeSlideIndex + 1)}
                    aria-label="Next hero slide"
                    className="w-8 h-8 rounded-sm bg-[#12161d]/80 hover:bg-[#1a222d] border border-[#2b3543] hover:border-[#c5a059]/70 text-[#cbd5e1] hover:text-[#c5a059] flex items-center justify-center transition-colors cursor-pointer"
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
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          isCurrent
                            ? 'w-8 bg-[#c5a059]'
                            : 'w-2 bg-white/30 hover:bg-white/60'
                        }`}
                      />
                    );
                  })}
                </div>

                <span className="text-[11px] font-mono text-[#8a909a] tabular-nums">
                  {String(safeSlideIndex + 1).padStart(2, '0')} / {String(activeSlides.length).padStart(2, '0')}
                </span>
              </div>
            )}

          </div>

          {/* RIGHT SIDE (approximately 25% width): Professional compact property inquiry form card */}
          <div className="lg:col-span-4 xl:col-span-3 w-full max-w-md mx-auto lg:max-w-none">
            <HeroInquiryForm />
          </div>

        </div>

        {/* Claim-to-Proof Quantitative Strip */}
        <div className="relative z-10 w-full max-w-5xl mx-auto mt-16 pt-8 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="font-serif text-2xl sm:text-3xl font-bold text-white block tracking-tight font-mono tabular-nums">
              ₹32,000+ Cr
            </span>
            <span className="text-xs text-[#8a909a] tracking-wider uppercase font-mono mt-1 block">
              Active Portfolio Assets
            </span>
          </div>

          <div>
            <span className="font-serif text-2xl sm:text-3xl font-bold text-white block tracking-tight font-mono tabular-nums">
              60+
            </span>
            <span className="text-xs text-[#8a909a] tracking-wider uppercase font-mono mt-1 block">
              Synchronized Portals
            </span>
          </div>

          <div>
            <span className="font-serif text-2xl sm:text-3xl font-bold text-white block tracking-tight font-mono tabular-nums">
              100%
            </span>
            <span className="text-xs text-[#8a909a] tracking-wider uppercase font-mono mt-1 block">
              Verified Legal Title
            </span>
          </div>

          <div>
            <a href="tel:9779878303" className="block group cursor-pointer">
              <span className="font-serif text-2xl sm:text-3xl font-bold text-white group-hover:text-[#c5a059] transition-colors block tracking-tight font-mono tabular-nums">
                9779878303
              </span>
              <span className="text-xs text-[#c5a059] tracking-wider uppercase font-mono mt-1 block">
                Direct Advisory Hotline
              </span>
            </a>
          </div>
        </div>

      </section>

      {/* Dynamic Location Tabs Strip */}
      <section className="max-w-7xl mx-auto px-6 -mt-8">
        <LocationTabs
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          properties={publishedProperties}
          categoryTitle="All Holdings"
        />
      </section>

      {/* 2. Curated Marquee Highlights Section */}
      <section className="max-w-7xl mx-auto px-6">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-2">
              {selectedLocation === 'all' ? 'Curated Highlights' : `Location Focus · ${selectedLocationName}`}
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#f7f5f2]">
              {selectedLocation === 'all' ? 'Trophy Holdings of the Season' : `Trophy Holdings in ${selectedLocationName}`}
            </h2>
          </div>

          <AppLink
            href="/properties"
            onNavigate={onNavigate}
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#c5a059] hover:text-[#d4af5f] transition-colors cursor-pointer group"
          >
            <span>Explore Complete Portfolio ({properties.length})</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </AppLink>
        </div>

        {/* 3-Column Luxury Property Grid */}
        {displayProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
        ) : (
          <div className="p-12 text-center bg-[#101419] border border-[#202732] rounded-sm space-y-3">
            <MapPin className="w-8 h-8 text-[#c5a059] mx-auto opacity-70" />
            <h3 className="font-serif text-xl font-normal text-white">
              No Published Assets Found in {selectedLocationName}
            </h3>
            <p className="text-xs text-[#8a909a] max-w-md mx-auto">
              Our acquisitions division is actively sourcing prime residential and commercial holdings in {selectedLocationName}.
            </p>
            <button
              onClick={() => setSelectedLocation('all')}
              className="mt-2 px-4 py-2 bg-[#1b222d] hover:bg-[#c5a059] hover:text-[#0c0f12] text-xs font-mono uppercase tracking-wider rounded-sm transition-colors cursor-pointer"
            >
              Show All Locations
            </button>
          </div>
        )}

      </section>

      {/* 3. Architectural Collections (Asymmetric Bento Grid) */}
      <section className="max-w-7xl mx-auto px-6">
        
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-2">
            Asset Categorization
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#f7f5f2]">
            Curated Investment Collections
          </h2>
          <p className="text-sm text-[#8a909a] mt-2">
            Targeted portfolio discovery across prime residential, commercial, acreage, and development classes.
          </p>
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
                className={`${colSpanClass} block relative h-96 rounded-sm overflow-hidden group cursor-pointer border border-[#202732] bg-[#12161d] hover:border-[#c5a059]/40 transition-all duration-300`}
              >
                <img
                  src={col.coverImageUrl || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'}
                  alt={col.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter brightness-[0.55]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                <div className="absolute top-4 right-4 bg-[#0c0f12]/80 backdrop-blur-md px-3 py-1 rounded-sm border border-[#262f3c] text-[11px] font-mono text-[#c5a059] flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-[#c5a059]" />
                  <span>{col.propertyIds?.length || 0} Assets</span>
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059]">
                    {col.subtitle || 'Investment Collection'}
                  </span>
                  <h3 className="font-serif text-2xl font-medium text-white mt-1 group-hover:text-[#c5a059] transition-colors">
                    {col.title}
                  </h3>
                  <p className="text-xs text-[#cbd5e1] mt-1.5 max-w-md line-clamp-2">
                    {col.description}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#c5a059] font-medium group-hover:translate-x-1 transition-transform">
                    View Collection <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </AppLink>
            );
          })}
        </div>

      </section>

      {/* 4. New Projects Spotlight */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="bg-[#12161d] border border-[#242b36] p-8 md:p-12 rounded-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            
            <div className="space-y-6">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059]">
                Featured New Development
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#f7f5f2] leading-tight">
                The Aurora Residences Zürichberg
              </h2>
              <p className="text-sm text-[#9ca3af] leading-relaxed font-light">
                A limited commission of eight carbon-neutral private residences overlooking Lake Zurich and the Swiss Alps. 
                Integrating deep geothermal heating, private solariums, and five-star hospitality concierge managed by The Dolder Grand.
              </p>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-[#1f2631] text-xs">
                <div>
                  <span className="text-[#737a85] font-mono uppercase block">Delivery</span>
                  <span className="text-[#f7f5f2] font-semibold">Q4 2026 Active Construction</span>
                </div>
                <div>
                  <span className="text-[#737a85] font-mono uppercase block">Starting From</span>
                  <span className="text-[#c5a059] font-mono font-semibold">€18,900,000</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <AppLink
                  href="/property/the-aurora-residences-zurichberg-switzerland"
                  onNavigate={onNavigate}
                  className="inline-block px-6 py-2.5 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase tracking-wider font-semibold rounded-sm transition-all cursor-pointer"
                >
                  View Residence Dossier
                </AppLink>
                <AppLink
                  href="/contact"
                  onNavigate={onNavigate}
                  className="inline-block px-6 py-2.5 bg-[#181f2a] hover:bg-[#202937] text-[#f7f5f2] text-xs uppercase tracking-wider font-medium rounded-sm border border-[#2b3646] transition-all cursor-pointer"
                >
                  Register Early Interest
                </AppLink>
              </div>
            </div>

            <div className="relative aspect-[4/3] rounded-sm overflow-hidden border border-[#242b36]">
              <img
                src="https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80"
                alt="The Aurora Residences"
                className="w-full h-full object-cover"
              />
            </div>

          </div>
        </div>
      </section>

      {/* 5. Private Client Advisory & Institutional Standards */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-2">
            Discreet Representation
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#f7f5f2]">
            Private Client Wealth Advisory
          </h2>
          <p className="text-sm text-[#8a909a] mt-2">
            Comprehensive acquisition, disposal, and cross-border portfolio structuring for sovereign entities and family offices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-8 bg-[#101419] border border-[#202732] rounded-sm space-y-4">
            <div className="w-10 h-10 rounded-sm bg-[#161c24] border border-[#263140] flex items-center justify-center text-[#c5a059]">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-xl font-medium text-[#f7f5f2]">
              Strict Confidentiality & NDA
            </h3>
            <p className="text-xs text-[#8a909a] leading-relaxed">
              Every mandate operates under sovereign-grade non-disclosure protocols. Ultra-prime off-market properties are shared solely with pre-vetted family offices.
            </p>
          </div>

          <div className="p-8 bg-[#101419] border border-[#202732] rounded-sm space-y-4">
            <div className="w-10 h-10 rounded-sm bg-[#161c24] border border-[#263140] flex items-center justify-center text-[#c5a059]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-xl font-medium text-[#f7f5f2]">
              Multi-Source Network Sync
            </h3>
            <p className="text-xs text-[#8a909a] leading-relaxed">
              Consolidating listings across 60+ European and Middle Eastern WordPress partner registries into one verified, deduplicated database with live price diffing.
            </p>
          </div>

          <div className="p-8 bg-[#101419] border border-[#202732] rounded-sm space-y-4">
            <div className="w-10 h-10 rounded-sm bg-[#161c24] border border-[#263140] flex items-center justify-center text-[#c5a059]">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-xl font-medium text-[#f7f5f2]">
              Title & Covenants Audit
            </h3>
            <p className="text-xs text-[#8a909a] leading-relaxed">
              Independent architectural, zoning, and legal title review performed before any property enters the BUILDsmore central registry.
            </p>
          </div>

        </div>
      </section>

      {/* 6. Lead Capture Consultation CTA */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="relative overflow-hidden bg-gradient-to-r from-[#141a22] to-[#10141a] border border-[#2a3646] p-10 md:p-14 rounded-sm text-center space-y-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059]">
            Private Consultation
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal text-white max-w-xl mx-auto">
            Schedule a Confidential Consultation with a Senior Advisor
          </h2>
          <p className="text-xs sm:text-sm text-[#9ca3af] max-w-lg mx-auto">
            Whether seeking an off-market acquisition in Port d'Andratx or divesting a commercial asset in Mayfair, our principals are at your disposal.
          </p>
          <div className="pt-2">
            <AppLink
              href="/contact"
              onNavigate={onNavigate}
              className="inline-block px-8 py-3 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase tracking-widest font-semibold rounded-sm transition-all cursor-pointer shadow-lg"
            >
              Contact Concierge Desk
            </AppLink>
          </div>
        </div>
      </section>

    </div>
  );
};
