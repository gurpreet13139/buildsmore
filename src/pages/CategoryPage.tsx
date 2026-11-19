import React, { useState, useMemo } from 'react';
import { Property, PropertyCategory } from '../types/property';
import { PropertyCard } from '../components/property/PropertyCard';
import { LocationTabs } from '../components/property/LocationTabs';
import { storage } from '../services/storage';
import { RotateCcw } from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';

interface CategoryPageProps {
  category: PropertyCategory;
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  onNavigateHome: () => void;
  onNavigate?: (path: string) => void;
  savedIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
}

const CATEGORY_INFO: Record<PropertyCategory, { title: string; subtitle: string; heroImg: string }> = {
  'Residential': {
    title: 'Prime Residential Estates & Penthouses',
    subtitle: 'Waterfront architectural villas, alpine ski chalets, and skyline duplexes in premier global enclaves.',
    heroImg: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80',
  },
  'Commercial': {
    title: 'Institutional Commercial Landmarks',
    subtitle: 'Freehold corporate headquarters, private banking flagships, and prime retail assets with index-linked covenants.',
    heroImg: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=80',
  },
  'Plots/Land': {
    title: 'Prime Acreage & Heritage Terroirs',
    subtitle: 'Centuries-old Tuscan Brunello vineyards, coastal development peninsulas, and private sovereign estates.',
    heroImg: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=80',
  },
  'New Projects': {
    title: 'Architectural New Developments & Off-Plan',
    subtitle: 'Pritzker-laureate sustainable commissions, Minergie-P-ECO certified residences, and bespoke off-plan estates.',
    heroImg: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1800&q=80',
  },
};

export const CategoryPage: React.FC<CategoryPageProps> = ({
  category,
  properties,
  onSelectProperty,
  onNavigateHome,
  onNavigate,
  savedIds,
  onToggleSave,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const info = CATEGORY_INFO[category] || CATEGORY_INFO['Residential'];
  const categoryProperties = useMemo(() => properties.filter(p => p.category === category), [properties, category]);

  const filteredProperties = useMemo(() => {
    if (selectedLocation === 'all') return categoryProperties;
    const managedLocs = storage.getLocations(false);
    const loc = managedLocs.find(l => 
      l.id === selectedLocation || 
      l.slug === selectedLocation || 
      l.name.toLowerCase() === selectedLocation.toLowerCase()
    );
    if (loc) {
      const locNameLower = loc.name.toLowerCase();
      return categoryProperties.filter(p => {
        if (p.locationId && p.locationId === loc.id) return true;
        if (p.city && p.city.toLowerCase() === locNameLower) return true;
        if (loc.aliases && loc.aliases.length > 0) {
          return loc.aliases.some(a => 
            (p.city && p.city.toLowerCase().includes(a)) ||
            (p.locality && p.locality.toLowerCase().includes(a)) ||
            (p.address && p.address.toLowerCase().includes(a))
          );
        }
        return false;
      });
    }

    const qLoc = selectedLocation.toLowerCase();
    return categoryProperties.filter(p => 
      (p.locationId && p.locationId === selectedLocation) ||
      (p.city && p.city.toLowerCase().includes(qLoc)) ||
      (p.locality && p.locality.toLowerCase().includes(qLoc)) ||
      (p.address && p.address.toLowerCase().includes(qLoc))
    );
  }, [categoryProperties, selectedLocation]);

  return (
    <div className="space-y-12 pb-20">
      
      {/* Category Hero Header */}
      <div className="relative min-h-[380px] flex items-center justify-center px-6 overflow-hidden bg-[#101419]">
        <img
          src={info.heroImg}
          alt={info.title}
          className="absolute inset-0 w-full h-full object-cover filter brightness-[0.35]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f12] via-[#0c0f12]/50 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Portfolio', href: '/properties' },
              { label: category === 'Plots/Land' ? 'Plots & Land' : category === 'New Projects' ? 'New Developments' : category },
            ]}
            align="center"
            onNavigate={(path) => {
              if (onNavigate) {
                onNavigate(path);
              } else if (path === '/') {
                onNavigateHome();
              }
            }}
          />
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-white">
            {info.title}
          </h1>
          <p className="text-sm text-[#cbd5e1] max-w-xl mx-auto font-light leading-relaxed">
            {info.subtitle}
          </p>
        </div>
      </div>

      {/* Dynamic Location Tabs for Category */}
      <div className="max-w-7xl mx-auto px-6 -mt-4">
        <LocationTabs
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          properties={categoryProperties}
          categoryTitle={category}
        />
      </div>

      {/* Grid of properties in this category */}
      <div className="max-w-7xl mx-auto px-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#202732] text-xs font-mono text-[#8a909a]">
          <span>
            Showing <strong className="text-[#f7f5f2]">{filteredProperties.length}</strong> of{' '}
            <strong className="text-[#8a909a]">{categoryProperties.length}</strong> {category} assets
          </span>
          <span>Verified Registry Covenants</span>
        </div>

        {filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((prop) => (
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
            <p className="text-xs text-[#8a909a]">
              No {category} properties currently listed for this location.
            </p>
            {selectedLocation !== 'all' && (
              <button
                onClick={() => setSelectedLocation('all')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1b222c] hover:bg-[#c5a059] hover:text-[#0c0f12] text-xs font-mono uppercase tracking-wider text-[#d1d5db] rounded-sm transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                View All {category} Properties
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
