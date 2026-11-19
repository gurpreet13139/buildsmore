import React from 'react';
import { CuratedCollection, Property } from '../types/property';
import { PropertyCard } from '../components/property/PropertyCard';
import { useCurrency } from '../context/CurrencyContext';
import { Layers, Building2 } from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { AppLink } from '../components/common/AppLink';

interface CollectionDetailPageProps {
  collection: CuratedCollection;
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  onNavigateHome: () => void;
  onNavigate?: (path: string) => void;
  savedIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
}

export const CollectionDetailPage: React.FC<CollectionDetailPageProps> = ({
  collection,
  properties,
  onSelectProperty,
  onNavigateHome,
  onNavigate,
  savedIds,
  onToggleSave,
}) => {
  const { formatPrice } = useCurrency();

  // Find all matching published properties in the collection's defined order
  const propMap = new Map(properties.map(p => [p.id, p]));
  const collectionProperties = collection.propertyIds
    .map(id => propMap.get(id))
    .filter((p): p is Property => p !== undefined && p.status === 'Published');

  // Total valuation calculation
  const totalValuation = collectionProperties.reduce((sum, p) => sum + (p.price || 0), 0);

  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-200">
      
      {/* 1. Cinematic Collection Hero Header */}
      <div className="relative min-h-[420px] flex items-center justify-center px-6 overflow-hidden bg-[#101419]">
        <img
          src={collection.coverImageUrl}
          alt={collection.title}
          className="absolute inset-0 w-full h-full object-cover filter brightness-[0.35]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f12] via-[#0c0f12]/60 to-transparent" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#0c0f12]/80" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4 pt-12 pb-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Portfolio', href: '/properties' },
              { label: collection.title },
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

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#c5a059]/10 border border-[#c5a059]/30 rounded-sm text-[11px] font-mono uppercase tracking-[0.2em] text-[#c5a059]">
            <Layers className="w-3.5 h-3.5" />
            <span>Curated Investment Collection</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal text-white tracking-tight">
            {collection.title}
          </h1>

          {collection.subtitle && (
            <p className="text-base sm:text-lg text-[#cbd5e1] font-light max-w-2xl mx-auto leading-relaxed">
              {collection.subtitle}
            </p>
          )}

          <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl mx-auto leading-relaxed pt-2">
            {collection.description}
          </p>

          {/* Quick Metrics */}
          <div className="pt-4 flex items-center justify-center gap-6 text-xs font-mono text-[#cbd5e1]">
            <div>
              <span className="text-[#8a909a] block text-[10px] uppercase">Curated Assets</span>
              <strong className="text-white text-sm">{collectionProperties.length} Properties</strong>
            </div>
            <div className="h-6 w-[1px] bg-[#242c38]" />
            <div>
              <span className="text-[#8a909a] block text-[10px] uppercase">Total Valuation</span>
              <strong className="text-[#c5a059] text-sm">{formatPrice(totalValuation, 'INR')}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Collection Properties Grid */}
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#202732] text-xs font-mono text-[#8a909a]">
          <span>
            Displaying <strong className="text-white">{collectionProperties.length}</strong> verified holdings in this portfolio
          </span>
          <span className="hidden sm:inline">Strict INR Valuation · Direct Developer & Owner Covenants</span>
        </div>

        {collectionProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collectionProperties.map((prop) => (
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
          <div className="py-20 px-6 bg-[#101419] border border-[#202732] rounded-sm text-center space-y-3 max-w-lg mx-auto">
            <Building2 className="w-12 h-12 text-[#64748b] mx-auto" />
            <h3 className="font-serif text-xl text-white">No Properties Listed Yet</h3>
            <p className="text-xs text-[#8a909a]">
              Holdings are being finalized by the advisory team for this collection.
            </p>
            <div className="pt-2">
              <AppLink
                href="/"
                onNavigate={onNavigate || (() => onNavigateHome())}
                className="inline-block px-4 py-2 bg-[#c5a059] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm cursor-pointer"
              >
                Return to Homepage
              </AppLink>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
