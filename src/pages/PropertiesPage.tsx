import React, { useState, useMemo } from 'react';
import { Property, PropertyCategory } from '../types/property';
import { PropertyCard } from '../components/property/PropertyCard';
import { PropertyFilterBar, FilterState } from '../components/property/PropertyFilterBar';
import { LocationTabs } from '../components/property/LocationTabs';
import { storage } from '../services/storage';
import { useCurrency } from '../context/CurrencyContext';
import { Building2, Bookmark, RotateCcw, ArrowRight } from 'lucide-react';
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
}

const ITEMS_PER_PAGE = 6;

export const PropertiesPage: React.FC<PropertiesPageProps> = ({
  properties,
  onSelectProperty,
  onNavigate,
  savedIds,
  onToggleSave,
  initialCategory = 'All',
}) => {
  const { formatPrice } = useCurrency();

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    category: initialCategory,
    priceRange: 'all',
    bedrooms: 'any',
    sortBy: 'newest',
    viewMode: 'grid',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }));
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
    return properties.filter((p) => {
      // Saved Only Filter
      if (showSavedOnly && !savedIds.includes(p.id)) {
        return false;
      }

      // Location Tab Filter
      if (selectedLocation !== 'all') {
        const managedLocs = storage.getLocations(false);
        const loc = managedLocs.find(l => 
          l.id === selectedLocation || 
          l.slug === selectedLocation || 
          l.name.toLowerCase() === selectedLocation.toLowerCase()
        );
        if (loc) {
          const locNameLower = loc.name.toLowerCase();
          const matchId = p.locationId && p.locationId === loc.id;
          const matchCity = p.city && p.city.toLowerCase() === locNameLower;
          const matchAlias = loc.aliases && loc.aliases.length > 0 && loc.aliases.some(a => 
            (p.city && p.city.toLowerCase().includes(a)) ||
            (p.locality && p.locality.toLowerCase().includes(a)) ||
            (p.address && p.address.toLowerCase().includes(a))
          );
          if (!matchId && !matchCity && !matchAlias) {
            return false;
          }
        } else {
          const qLoc = selectedLocation.toLowerCase();
          const directMatch = (p.locationId && p.locationId === selectedLocation) ||
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
      const ratesToINR: Record<string, number> = { INR: 1, USD: 86.5, EUR: 94.0, GBP: 110.5, AED: 23.55 };
      const priceINR = p.price * (ratesToINR[p.currency] || 1);

      if ((filters.priceRange === 'under_5cr' || filters.priceRange === 'under_20m') && priceINR > 50_000_000) return false;
      if ((filters.priceRange === '5cr_20cr' || filters.priceRange === '20m_40m') && (priceINR < 50_000_000 || priceINR > 200_000_000)) return false;
      if ((filters.priceRange === '20cr_50cr' || filters.priceRange === '40m_75m') && (priceINR < 200_000_000 || priceINR > 500_000_000)) return false;
      if ((filters.priceRange === 'over_50cr' || filters.priceRange === 'over_75m') && priceINR < 500_000_000) return false;

      return true;
    }).sort((a, b) => {
      const ratesToINR: Record<string, number> = { INR: 1, USD: 86.5, EUR: 94.0, GBP: 110.5, AED: 23.55 };
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
  }, [properties, filters, showSavedOnly, savedIds]);

  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const paginatedProperties = filteredProperties.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: 'Portfolio' }]}
        onNavigate={onNavigate}
      />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#202732]">
        <div>
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
            Prime Holdings Registry
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#f7f5f2]">
            International Portfolio
          </h1>
          <p className="text-xs text-[#8a909a] mt-1">
            Architectural residences, trophy commercial towers, and private vineyard estates worldwide.
          </p>
        </div>

        {/* Saved Favorites Shortcut Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSavedOnly(!showSavedOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-colors cursor-pointer border ${
              showSavedOnly
                ? 'bg-[#c5a059] text-[#0c0f12] font-semibold border-[#c5a059]'
                : 'bg-[#14181d] text-[#9ca3af] hover:text-[#f7f5f2] border-[#242b35]'
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
        properties={properties.filter(p => filters.category === 'All' || p.category === filters.category)}
        categoryTitle={filters.category === 'All' ? 'Portfolio' : filters.category}
      />

      {/* Main Properties Content */}
      {paginatedProperties.length > 0 ? (
        filters.viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                className="bg-[#101419] border border-[#202732] hover:border-[#c5a059]/50 transition-colors p-4 rounded-sm flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer group"
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-24 h-20 shrink-0 bg-[#14181d] rounded-sm overflow-hidden">
                    {(() => {
                      const primaryImg = getPrimaryPropertyImage(prop);
                      return primaryImg.url ? (
                        <img
                          src={primaryImg.url}
                          alt={prop.title}
                          className={`w-full h-full transition-transform ${
                            primaryImg.isLogo ? 'object-contain p-2 bg-[#0f141b]' : 'object-cover group-hover:scale-105'
                          }`}
                        />
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#c5a059] font-mono block">
                      {prop.category} · {prop.city}, {prop.country}
                    </span>
                    <h3 className="font-serif text-lg font-medium text-[#f7f5f2] group-hover:text-[#c5a059] transition-colors">
                      {prop.title}
                    </h3>
                    <p className="text-xs text-[#8a909a] font-mono mt-0.5">
                      {prop.bedrooms > 0 ? `${prop.bedrooms} Beds · ` : ''}
                      {prop.interiorAreaSqFt ? `${prop.interiorAreaSqFt.toLocaleString()} sq ft` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto pt-3 md:pt-0 border-t md:border-0 border-[#1c232d]">
                  <div className="text-right">
                    <span className="text-[10px] text-[#737a85] uppercase block font-mono">Valuation</span>
                    <span className="font-mono text-base font-bold text-[#f7f5f2] tabular-nums">
                      {formatPrice(prop.price, prop.currency)}
                    </span>
                  </div>

                  <span className="px-3 py-1.5 bg-[#181f2a] group-hover:bg-[#c5a059] group-hover:text-[#0c0f12] text-xs font-semibold rounded-sm transition-colors text-[#d1d5db] flex items-center gap-1">
                    Inspect <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </AppLink>
            ))}
          </div>
        )
      ) : (
        /* Empty State */
        <div className="text-center py-20 px-6 bg-[#101419] border border-[#202732] rounded-sm space-y-4 max-w-xl mx-auto my-12">
          <Building2 className="w-12 h-12 text-[#64748b] mx-auto" />
          <h3 className="font-serif text-2xl font-medium text-[#f7f5f2]">
            No Holdings Match Your Criteria
          </h3>
          <p className="text-xs text-[#8a909a] leading-relaxed max-w-sm mx-auto">
            Try adjusting your location, price boundaries, or bedroom thresholds to explore other available assets.
          </p>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#c5a059] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-[#d4af5f] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear All Filters
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-8 border-t border-[#1c232d]">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs text-[#9ca3af] disabled:opacity-40 hover:text-white bg-[#14181d] border border-[#242b35] rounded-sm cursor-pointer disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx + 1}
              onClick={() => setCurrentPage(idx + 1)}
              className={`w-8 h-8 text-xs font-mono rounded-sm transition-colors cursor-pointer ${
                currentPage === idx + 1
                  ? 'bg-[#c5a059] text-[#0c0f12] font-bold'
                  : 'bg-[#14181d] text-[#9ca3af] hover:text-white border border-[#242b35]'
              }`}
            >
              {idx + 1}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-xs text-[#9ca3af] disabled:opacity-40 hover:text-white bg-[#14181d] border border-[#242b35] rounded-sm cursor-pointer disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
};
