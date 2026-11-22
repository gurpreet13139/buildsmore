import React, { useState, useMemo, useEffect } from 'react';
import { Property, PropertyCategory } from '../types/property';
import { PropertyCard } from '../components/property/PropertyCard';
import { PropertyFilterBar, FilterState } from '../components/property/PropertyFilterBar';
import { LocationTabs } from '../components/property/LocationTabs';
import { storage } from '../services/storage';
import { useCurrency } from '../context/CurrencyContext';
import { Building2, Bookmark, RotateCcw, ArrowRight, MapPin } from 'lucide-react';
import { getPrimaryPropertyImage } from '../utils/propertyImages';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { AppLink } from '../components/common/AppLink';

interface PropertiesPageProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  onNavigate?: (path: string) => void;
  savedIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  initialCategory?: 'All' | PropertyCategory;
  initialLocation?: string;
  initialPriceRange?: string;
  initialSearchQuery?: string;
}

const ITEMS_PER_PAGE = 8;

export const PropertiesPage: React.FC<PropertiesPageProps> = ({
  properties,
  onSelectProperty,
  onNavigate,
  savedIds,
  onToggleSave,
  initialCategory = 'All',
  initialLocation = 'all',
  initialPriceRange = 'all',
  initialSearchQuery = '',
}) => {
  const { formatPrice } = useCurrency();

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: initialSearchQuery,
    category: initialCategory,
    priceRange: initialPriceRange,
    bedrooms: 'any',
    sortBy: 'newest',
    viewMode: 'grid',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>(initialLocation || 'all');

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      category: initialCategory,
      priceRange: initialPriceRange || 'all',
      searchQuery: initialSearchQuery || '',
    }));
    setSelectedLocation(initialLocation || 'all');
    setCurrentPage(1);
  }, [initialCategory, initialLocation, initialPriceRange, initialSearchQuery]);

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilters({
      searchQuery: '',
      category: 'All',
      priceRange: 'all',
      bedrooms: 'any',
      sortBy: 'newest',
      viewMode: 'grid',
    });
    setSelectedLocation('all');
    setShowSavedOnly(false);
    setCurrentPage(1);
  };

  // Filter & Sorting Logic
  const filteredProperties = useMemo(() => {
    return properties
      .filter((p) => {
        // Saved Only Filter
        if (showSavedOnly && !savedIds.includes(p.id)) {
          return false;
        }

        // Location Tab Filter
        if (selectedLocation !== 'all') {
          const managedLocs = storage.getLocations(false);
          const loc = managedLocs.find(
            (l) =>
              l.id === selectedLocation ||
              l.slug === selectedLocation ||
              l.name.toLowerCase() === selectedLocation.toLowerCase()
          );
          if (loc) {
            const locNameLower = loc.name.toLowerCase();
            const matchId = p.locationId && p.locationId === loc.id;
            const matchCity = p.city && p.city.toLowerCase() === locNameLower;
            const matchAlias =
              loc.aliases &&
              loc.aliases.length > 0 &&
              loc.aliases.some(
                (a) =>
                  (p.city && p.city.toLowerCase().includes(a)) ||
                  (p.locality && p.locality.toLowerCase().includes(a)) ||
                  (p.address && p.address.toLowerCase().includes(a))
              );
            if (!matchId && !matchCity && !matchAlias) {
              return false;
            }
          } else {
            const qLoc = selectedLocation.toLowerCase();
            const directMatch =
              (p.locationId && p.locationId === selectedLocation) ||
              (p.city && p.city.toLowerCase().includes(qLoc)) ||
              (p.locality && p.locality.toLowerCase().includes(qLoc)) ||
              (p.address && p.address.toLowerCase().includes(qLoc));
            if (!directMatch) return false;
          }
        }

        // Category
        if (filters.category !== 'All' && p.category !== filters.category) {
          return false;
        }

        // Keyword Search
        if (filters.searchQuery.trim()) {
          const query = filters.searchQuery.toLowerCase();
          const matchTitle = p.title.toLowerCase().includes(query);
          const matchCity = p.city.toLowerCase().includes(query);
          const matchCountry = p.country.toLowerCase().includes(query);
          const matchAddress = p.address.toLowerCase().includes(query);
          const matchDesc = p.description.toLowerCase().includes(query);
          const matchType = p.propertyType.toLowerCase().includes(query);
          if (!matchTitle && !matchCity && !matchCountry && !matchAddress && !matchDesc && !matchType) {
            return false;
          }
        }

        // Bedrooms
        if (filters.bedrooms !== 'any') {
          const minBeds = parseInt(filters.bedrooms, 10);
          if (p.bedrooms < minBeds) return false;
        }

        // Price Range (Normalized to INR)
        const ratesToINR: Record<string, number> = {
          INR: 1,
          USD: 86.5,
          EUR: 94.0,
          GBP: 110.5,
          AED: 23.55,
        };
        const priceINR = p.price * (ratesToINR[p.currency] || 1);

        if ((filters.priceRange === 'under_5cr' || filters.priceRange === 'under_20m') && priceINR > 50_000_000)
          return false;
        if (
          (filters.priceRange === '5cr_20cr' || filters.priceRange === '20m_40m') &&
          (priceINR < 50_000_000 || priceINR > 200_000_000)
        )
          return false;
        if (
          (filters.priceRange === '20cr_50cr' || filters.priceRange === '40m_75m') &&
          (priceINR < 200_000_000 || priceINR > 500_000_000)
        )
          return false;
        if ((filters.priceRange === 'over_50cr' || filters.priceRange === 'over_75m') && priceINR < 500_000_000)
          return false;

        return true;
      })
      .sort((a, b) => {
        const ratesToINR: Record<string, number> = {
          INR: 1,
          USD: 86.5,
          EUR: 94.0,
          GBP: 110.5,
          AED: 23.55,
        };
        const priceA = a.price * (ratesToINR[a.currency] || 1);
        const priceB = b.price * (ratesToINR[b.currency] || 1);

        const getTimestamp = (p: Property): number => {
          if (p.createdAt) {
            const t = new Date(p.createdAt).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          if (p.updatedAt) {
            const t = new Date(p.updatedAt).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          if (p.id && p.id.startsWith('prop-')) {
            const numericPart = parseInt(p.id.replace('prop-', ''), 10);
            if (!isNaN(numericPart) && numericPart > 1000000000000) {
              return numericPart;
            }
          }
          return 0;
        };

        if (filters.sortBy === 'newest') {
          return getTimestamp(b) - getTimestamp(a);
        }
        if (filters.sortBy === 'featured') {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return getTimestamp(b) - getTimestamp(a);
        }
        if (filters.sortBy === 'price_desc') return priceB - priceA;
        if (filters.sortBy === 'price_asc') return priceA - priceB;
        if (filters.sortBy === 'area_desc') return b.interiorAreaSqFt - a.interiorAreaSqFt;
        return getTimestamp(b) - getTimestamp(a);
      });
  }, [properties, filters, showSavedOnly, savedIds, selectedLocation]);

  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const paginatedProperties = filteredProperties.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-[#F7F9FC] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[{ label: 'Home', href: '/' }, { label: 'Portfolio' }]}
          onNavigate={onNavigate}
        />

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2.5">
              <span className="w-7 h-[2px] bg-[#DC1F26] rounded-full" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                Prime Holdings Registry
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0D2558] tracking-tight">
              Property <span className="text-[#DC1F26]">Portfolio</span>
            </h1>
            <p className="text-sm text-slate-600">
              Verified residential estates, commercial landmarks, investment plots, and new developments.
            </p>
          </div>

          {/* Saved Favorites Shortcut Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowSavedOnly(!showSavedOnly);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer border shadow-xs ${
                showSavedOnly
                  ? 'bg-[#DC1F26] text-white border-[#DC1F26]'
                  : 'bg-white text-[#0D2558] hover:border-[#0D2558] border-slate-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" fill={showSavedOnly ? 'currentColor' : 'none'} />
              <span>Saved Portfolio ({savedIds.length})</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <PropertyFilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
          totalResults={filteredProperties.length}
        />

        {/* Dynamic Location Filter Tabs */}
        <LocationTabs
          selectedLocation={selectedLocation}
          onSelectLocation={(loc) => {
            setSelectedLocation(loc);
            setCurrentPage(1);
          }}
          properties={properties.filter((p) => filters.category === 'All' || p.category === filters.category)}
          categoryTitle={filters.category === 'All' ? 'Portfolio' : filters.category}
        />

        {/* Main Properties Content */}
        {paginatedProperties.length > 0 ? (
          filters.viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {paginatedProperties.map((prop) => (
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
            /* Compact List View */
            <div className="space-y-4">
              {paginatedProperties.map((prop) => (
                <AppLink
                  key={prop.id}
                  href={`/property/${encodeURIComponent(prop.slug)}`}
                  onNavigate={() => onSelectProperty(prop)}
                  className="bg-white border border-slate-200/90 hover:border-[#163B8C]/40 hover:shadow-md transition-all p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer group"
                >
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-28 h-20 shrink-0 bg-slate-100 rounded-xl overflow-hidden">
                      {(() => {
                        const primaryImg = getPrimaryPropertyImage(prop);
                        return primaryImg.url ? (
                          <img
                            src={primaryImg.url}
                            alt={prop.title}
                            className={`w-full h-full transition-transform duration-500 ${
                              primaryImg.isLogo
                                ? 'object-contain p-2 bg-[#0f141b]'
                                : 'object-cover group-hover:scale-105'
                            }`}
                          />
                        ) : null;
                      })()}
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#163B8C] font-bold block">
                        {prop.category}
                      </span>
                      <h3 className="text-base sm:text-lg font-extrabold text-[#0D2558] group-hover:text-[#163B8C] transition-colors">
                        {prop.title}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#DC1F26] shrink-0" />
                        <span>
                          {prop.city}, {prop.country}
                        </span>
                        {prop.bedrooms > 0 ? ` · ${prop.bedrooms} Beds` : ''}
                        {prop.interiorAreaSqFt ? ` · ${prop.interiorAreaSqFt.toLocaleString()} Sq.Ft` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto pt-3 md:pt-0 border-t md:border-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Valuation
                      </span>
                      <span className="text-base font-extrabold text-[#0D2558] tabular-nums">
                        {formatPrice(prop.price, prop.currency)}
                      </span>
                    </div>

                    <span className="px-4 py-2 bg-[#0D2558] group-hover:bg-[#DC1F26] text-white text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shrink-0">
                      <span>Inspect</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </AppLink>
              ))}
            </div>
          )
        ) : (
          /* Empty State */
          <div className="text-center py-20 px-6 bg-white border border-slate-200 rounded-2xl space-y-4 max-w-xl mx-auto my-12 shadow-xs">
            <Building2 className="w-12 h-12 text-[#163B8C]/40 mx-auto" />
            <h3 className="text-2xl font-extrabold text-[#0D2558]">
              No Holdings Match Your Criteria
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              Try adjusting your location, price boundaries, or bedroom thresholds to explore other
              available assets.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All Filters</span>
            </button>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-xs font-bold text-[#0D2558] disabled:opacity-40 hover:bg-slate-100 bg-white border border-slate-200 rounded-full cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx + 1}
                type="button"
                onClick={() => setCurrentPage(idx + 1)}
                className={`w-9 h-9 text-xs font-bold rounded-full transition-colors cursor-pointer ${
                  currentPage === idx + 1
                    ? 'bg-[#DC1F26] text-white shadow-sm'
                    : 'bg-white text-[#0D2558] hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {idx + 1}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-xs font-bold text-[#0D2558] disabled:opacity-40 hover:bg-slate-100 bg-white border border-slate-200 rounded-full cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
