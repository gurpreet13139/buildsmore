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
  Residential: {
    title: 'Prime Residential Estates & Penthouses',
    subtitle:
      'Waterfront architectural villas, alpine ski chalets, and skyline duplexes in premier global enclaves.',
    heroImg:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80',
  },
  Commercial: {
    title: 'Institutional Commercial Landmarks',
    subtitle:
      'Freehold corporate headquarters, private banking flagships, and prime retail assets with index-linked covenants.',
    heroImg:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=80',
  },
  'Plots/Land': {
    title: 'Prime Acreage & Investment Plots',
    subtitle:
      'Approved residential & commercial investment plots, development land banks, and private sovereign estates.',
    heroImg:
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=80',
  },
  'New Projects': {
    title: 'Architectural New Developments & Off-Plan',
    subtitle:
      'Sustainable new commissions, certified luxury residences, and bespoke off-plan estates.',
    heroImg:
      'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1800&q=80',
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
  const categoryProperties = useMemo(
    () => properties.filter((p) => p.category === category),
    [properties, category]
  );

  const filteredProperties = useMemo(() => {
    if (selectedLocation === 'all') return categoryProperties;
    const managedLocs = storage.getLocations(false);
    const loc = managedLocs.find(
      (l) =>
        l.id === selectedLocation ||
        l.slug === selectedLocation ||
        l.name.toLowerCase() === selectedLocation.toLowerCase()
    );
    if (loc) {
      const locNameLower = loc.name.toLowerCase();
      return categoryProperties.filter((p) => {
        if (p.locationId && p.locationId === loc.id) return true;
        if (p.city && p.city.toLowerCase() === locNameLower) return true;
        if (loc.aliases && loc.aliases.length > 0) {
          return loc.aliases.some(
            (a) =>
              (p.city && p.city.toLowerCase().includes(a)) ||
              (p.locality && p.locality.toLowerCase().includes(a)) ||
              (p.address && p.address.toLowerCase().includes(a))
          );
        }
        return false;
      });
    }

    const qLoc = selectedLocation.toLowerCase();
    return categoryProperties.filter(
      (p) =>
        (p.locationId && p.locationId === selectedLocation) ||
        (p.city && p.city.toLowerCase().includes(qLoc)) ||
        (p.locality && p.locality.toLowerCase().includes(qLoc)) ||
        (p.address && p.address.toLowerCase().includes(qLoc))
    );
  }, [categoryProperties, selectedLocation]);

  return (
    <div className="bg-[#F7F9FC] min-h-screen pb-20">
      {/* Category Hero Header */}
      <div className="relative min-h-[340px] flex items-center justify-center px-6 py-14 overflow-hidden bg-slate-900">
        <img
          src={info.heroImg}
          alt={info.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-[#0D2558]/30 to-slate-950/55" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Portfolio', href: '/properties' },
              {
                label:
                  category === 'Plots/Land'
                    ? 'Plots & Land'
                    : category === 'New Projects'
                      ? 'New Developments'
                      : category,
              },
            ]}
            align="center"
            variant="dark"
            onNavigate={(path) => {
              if (onNavigate) {
                onNavigate(path);
              } else if (path === '/') {
                onNavigateHome();
              }
            }}
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-sm">
            {info.title}
          </h1>
          <p className="text-sm sm:text-base text-white/90 max-w-2xl mx-auto leading-relaxed drop-shadow-xs">
            {info.subtitle}
          </p>
        </div>
      </div>

      {/* Dynamic Location Tabs for Category */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <LocationTabs
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          properties={categoryProperties}
          categoryTitle={category}
        />
      </div>

      {/* Grid of properties in this category */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 text-xs font-semibold text-slate-500">
          <span>
            Showing <strong className="text-[#0D2558]">{filteredProperties.length}</strong> of{' '}
            <strong className="text-[#0D2558]">{categoryProperties.length}</strong> {category} assets
          </span>
          <span className="text-[#163B8C]">Verified Registry Covenants</span>
        </div>

        {filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
            <p className="text-sm text-slate-600">
              No {category} properties currently listed for this location.
            </p>
            {selectedLocation !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedLocation('all')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>View All {category} Properties</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
