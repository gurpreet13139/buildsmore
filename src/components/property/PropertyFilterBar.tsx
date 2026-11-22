import React from 'react';
import { PropertyCategory } from '../../types/property';
import { Search, RotateCcw, LayoutGrid, List } from 'lucide-react';

export interface FilterState {
  searchQuery: string;
  category: 'All' | PropertyCategory;
  priceRange: string;
  bedrooms: string;
  sortBy: 'featured' | 'price_desc' | 'price_asc' | 'area_desc' | 'newest';
  viewMode: 'grid' | 'list';
}

interface PropertyFilterBarProps {
  filters: FilterState;
  onChange: (updates: Partial<FilterState>) => void;
  onReset: () => void;
  totalResults: number;
}

export const PropertyFilterBar: React.FC<PropertyFilterBarProps> = ({
  filters,
  onChange,
  onReset,
  totalResults,
}) => {
  const categories: Array<'All' | PropertyCategory> = [
    'All',
    'Residential',
    'Commercial',
    'Plots/Land',
    'New Projects',
  ];

  const priceOptions = [
    { label: 'Any Budget', value: 'all' },
    { label: 'Under ₹5 Cr', value: 'under_5cr' },
    { label: '₹5 Cr – ₹20 Cr', value: '5cr_20cr' },
    { label: '₹20 Cr – ₹50 Cr', value: '20cr_50cr' },
    { label: '₹50 Cr+', value: 'over_50cr' },
  ];

  const bedroomOptions = [
    { label: 'Any Beds', value: 'any' },
    { label: '3+ Beds', value: '3' },
    { label: '4+ Beds', value: '4' },
    { label: '6+ Beds', value: '6' },
  ];

  const sortOptions = [
    { label: 'Recently Added', value: 'newest' },
    { label: 'Featured Properties', value: 'featured' },
    { label: 'Price: High to Low', value: 'price_desc' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Largest Living Area', value: 'area_desc' },
  ];

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.category !== 'All' ||
    filters.priceRange !== 'all' ||
    filters.bedrooms !== 'any' ||
    filters.sortBy !== 'newest';

  return (
    <div className="bg-white border border-slate-200/90 p-5 rounded-2xl mb-8 space-y-4 shadow-[0_8px_28px_rgba(13,37,88,0.06)]">
      {/* Top Search & Primary Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Keyword Search */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
            placeholder="Search by city, sector, project, or title..."
            className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white rounded-xl pl-10 pr-8 py-2.5 text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none transition-colors"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => onChange({ searchQuery: '' })}
              aria-label="Clear search query"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 hover:text-[#0D2558] cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Price Range */}
        <div className="md:col-span-3">
          <select
            value={filters.priceRange}
            onChange={(e) => onChange({ priceRange: e.target.value })}
            aria-label="Budget Range"
            className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-[#0D2558] font-medium focus:outline-none cursor-pointer"
          >
            {priceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bedrooms Filter */}
        <div className="md:col-span-2">
          <select
            value={filters.bedrooms}
            onChange={(e) => onChange({ bedrooms: e.target.value })}
            aria-label="Bedrooms"
            className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-[#0D2558] font-medium focus:outline-none cursor-pointer"
          >
            {bedroomOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sorting Dropdown */}
        <div className="md:col-span-2">
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ sortBy: e.target.value as FilterState['sortBy'] })}
            aria-label="Sort properties"
            className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-[#0D2558] font-medium focus:outline-none cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Segmented Tabs & Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const isActive = filters.category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onChange({ category: cat })}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#DC1F26] text-white shadow-sm'
                    : 'bg-[#F7F9FC] text-slate-600 hover:text-[#0D2558] border border-slate-200'
                }`}
              >
                {cat === 'All' ? 'All Types' : cat}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="tabular-nums font-medium">
            <strong className="text-[#0D2558]">{totalResults}</strong>{' '}
            {totalResults === 1 ? 'Property' : 'Properties'} Found
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#DC1F26] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}

          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-[#F7F9FC]">
            <button
              type="button"
              onClick={() => onChange({ viewMode: 'grid' })}
              aria-label="Grid View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                filters.viewMode === 'grid'
                  ? 'bg-[#0D2558] text-white'
                  : 'text-slate-500 hover:text-[#0D2558]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange({ viewMode: 'list' })}
              aria-label="List View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                filters.viewMode === 'list'
                  ? 'bg-[#0D2558] text-white'
                  : 'text-slate-500 hover:text-[#0D2558]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
