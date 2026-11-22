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
  const propMap = new Map(properties.map((p) => [p.id, p]));
  const collectionProperties = collection.propertyIds
    .map((id) => propMap.get(id))
    .filter((p): p is Property => p !== undefined && p.status === 'Published');

  // Total valuation calculation
  const totalValuation = collectionProperties.reduce((sum, p) => sum + (p.price || 0), 0);

  return (
    <div className="bg-[#F7F9FC] min-h-screen pb-20 animate-in fade-in duration-200">
      {/* 1. Collection Hero Header */}
      <div className="relative min-h-[380px] flex items-center justify-center px-6 py-14 overflow-hidden bg-slate-900">
        <img
          src={collection.coverImageUrl}
          alt={collection.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-[#0D2558]/30 to-slate-950/60" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Portfolio', href: '/properties' },
              { label: collection.title },
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

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#DC1F26] rounded-full text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
            <Layers className="w-3.5 h-3.5" />
            <span>Curated Investment Collection</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-sm">
            {collection.title}
          </h1>

          {collection.subtitle && (
            <p className="text-base sm:text-lg text-white font-medium max-w-2xl mx-auto leading-relaxed drop-shadow-xs">
              {collection.subtitle}
            </p>
          )}

          <p className="text-xs sm:text-sm text-white/90 max-w-2xl mx-auto leading-relaxed pt-1 drop-shadow-xs">
            {collection.description}
          </p>

          {/* Quick Metrics */}
          <div className="pt-4 inline-flex items-center justify-center gap-6 px-6 py-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 text-xs text-slate-200">
            <div>
              <span className="text-sky-200 block text-[10px] uppercase font-bold">
                Curated Assets
              </span>
              <strong className="text-white text-sm font-extrabold">
                {collectionProperties.length} Properties
              </strong>
            </div>
            <div className="h-6 w-[1px] bg-white/20" />
            <div>
              <span className="text-sky-200 block text-[10px] uppercase font-bold">
                Total Valuation
              </span>
              <strong className="text-white text-sm font-extrabold tabular-nums">
                {formatPrice(totalValuation, 'INR')}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Collection Properties Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 space-y-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 text-xs font-semibold text-slate-500">
          <span>
            Displaying <strong className="text-[#0D2558]">{collectionProperties.length}</strong>{' '}
            verified holdings in this portfolio
          </span>
          <span className="hidden sm:inline text-[#163B8C]">
            Strict INR Valuation · Direct Developer &amp; Owner Covenants
          </span>
        </div>

        {collectionProperties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <div className="py-16 px-6 bg-white border border-slate-200 rounded-2xl text-center space-y-3 max-w-lg mx-auto shadow-xs">
            <Building2 className="w-12 h-12 text-[#163B8C]/40 mx-auto" />
            <h3 className="text-xl font-extrabold text-[#0D2558]">No Properties Listed Yet</h3>
            <p className="text-sm text-slate-600">
              Holdings are being finalized by the advisory team for this collection.
            </p>
            <div className="pt-2">
              <AppLink
                href="/"
                onNavigate={onNavigate || (() => onNavigateHome())}
                className="inline-block px-5 py-2.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer transition-colors"
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
