import React from 'react';
import { PropertyCategory } from '../../types/property';
import { Search, SlidersHorizontal, RotateCcw, LayoutGrid, List } from 'lucide-react';

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
    { label: 'All Price Tiers', value: 'all' },
    { label: 'Under ₹5 Cr', value: 'under_5cr' },
    { label: '₹5 Cr – ₹20 Cr', value: '5cr_20cr' },
    { label: '₹20 Cr – ₹50 Cr', value: '20cr_50cr' },
    { label: '₹50 Cr+', value: 'over_50cr' },
  ];

  const bedroomOptions = [
    { label: 'Any Beds', value: 'any' },
    { label: '4+ Suites', value: '4' },
    { label: '6+ Suites', value: '6' },
    { label: '8+ Suites', value: '8' },
  ];

  const sortOptions = [
    { label: 'Recently Added (Latest First)', value: 'newest' },
    { label: 'Featured Portfolio', value: 'featured' },
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
    <div className="bg-[#101419] border border-[#202732] p-5 rounded-sm mb-8 space-y-4 shadow-lg">
      
      {/* Top Search & Primary Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        
        {/* Keyword Search */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-[#8a909a] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
            placeholder="Search by city, country, architecture, or title..."
            className="w-full bg-[#161b22] border border-[#262f3d] focus:border-[#c5a059] rounded-sm pl-10 pr-4 py-2.5 text-xs text-[#f7f5f2] placeholder-[#6b7280] focus:outline-none transition-colors"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8a909a] hover:text-[#f7f5f2]"
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
            className="w-full bg-[#161b22] border border-[#262f3d] focus:border-[#c5a059] rounded-sm px-3 py-2.5 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
          >
            {priceOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#161b22] text-[#f7f5f2]">
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
            className="w-full bg-[#161b22] border border-[#262f3d] focus:border-[#c5a059] rounded-sm px-3 py-2.5 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
          >
            {bedroomOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#161b22] text-[#f7f5f2]">
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
            className="w-full bg-[#161b22] border border-[#262f3d] focus:border-[#c5a059] rounded-sm px-3 py-2.5 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#161b22] text-[#f7f5f2]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Category Segmented Tabs & Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#1c232d]">
        
        {/* Category Filter Buttons (Functional Tabs, conforming to Section 1A) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const isActive = filters.category === cat;
            return (
              <button
                key={cat}
                onClick={() => onChange({ category: cat })}
                className={`px-3 py-1.5 text-xs tracking-wider uppercase rounded-sm transition-all cursor-pointer font-medium ${
                  isActive
                    ? 'bg-[#c5a059] text-[#0c0f12] font-semibold shadow-sm'
                    : 'bg-[#161b22] text-[#9ca3af] hover:text-[#f7f5f2] border border-[#262f3d]'
                }`}
              >
                {cat === 'All' ? 'All Classes' : cat}
              </button>
            );
          })}
        </div>

        {/* Status Count, Reset & View Mode Controls */}
        <div className="flex items-center gap-4 text-xs text-[#8a909a]">
          <span className="font-mono tabular-nums text-[#d1d5db]">
            <strong className="text-[#f7f5f2]">{totalResults}</strong> {totalResults === 1 ? 'Property' : 'Properties'} Found
          </span>

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-[#c5a059] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center border border-[#262f3d] rounded-sm p-0.5 bg-[#161b22]">
            <button
              onClick={() => onChange({ viewMode: 'grid' })}
              aria-label="Grid View"
              className={`p-1.5 rounded-sm transition-colors cursor-pointer ${
                filters.viewMode === 'grid' ? 'bg-[#c5a059] text-[#0c0f12]' : 'text-[#8a909a] hover:text-[#f7f5f2]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onChange({ viewMode: 'list' })}
              aria-label="List View"
              className={`p-1.5 rounded-sm transition-colors cursor-pointer ${
                filters.viewMode === 'list' ? 'bg-[#c5a059] text-[#0c0f12]' : 'text-[#8a909a] hover:text-[#f7f5f2]'
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
