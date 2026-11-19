import React, { useState } from 'react';
import { Property } from '../../types/property';
import { useCurrency } from '../../context/CurrencyContext';
import { Bookmark, MapPin, ArrowUpRight } from 'lucide-react';
import { getPrimaryPropertyImage, isSafeDisplayImageUrl } from '../../utils/propertyImages';
import { AppLink } from '../common/AppLink';

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
  isSaved?: boolean;
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  onSelect,
  isSaved = false,
  onToggleSave,
}) => {
  const { formatPrice } = useCurrency();
  const [imgError, setImgError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const primary = getPrimaryPropertyImage(property);
  const canTrySourceLogoFallback =
    imgError &&
    !primary.isLogo &&
    !logoError &&
    Boolean(property.sourceLogoUrl && isSafeDisplayImageUrl(property.sourceLogoUrl) && property.sourceLogoUrl !== primary.url);

  const displayUrl = canTrySourceLogoFallback ? property.sourceLogoUrl : (!imgError ? primary.url : undefined);
  const isDisplayingLogo = canTrySourceLogoFallback || (!imgError && primary.isLogo);
  const propertyHref = `/property/${encodeURIComponent(property.slug)}`;

  return (
    <article className="group relative bg-[#101419] border border-[#202732] hover:border-[#c5a059]/50 transition-all duration-300 flex flex-col overflow-hidden rounded-sm">
      {/* Top Floating Control: Save / Bookmark (kept outside <a> for valid HTML) */}
      <div className="absolute top-3.5 right-3.5 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave?.(property.id, e);
          }}
          aria-label="Save property"
          className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer ${
            isSaved 
              ? 'bg-[#c5a059] text-[#0c0f12]' 
              : 'bg-[#0c0f12]/60 text-[#f7f5f2] hover:bg-[#c5a059] hover:text-[#0c0f12]'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <AppLink
        href={propertyHref}
        onNavigate={() => onSelect(property)}
        className="flex flex-col flex-1 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c5a059]"
      >
        {/* Visual Asset Container (65% height ratio) */}
        <div className={`relative aspect-[4/3] w-full overflow-hidden ${isDisplayingLogo ? 'bg-[#0f141b]' : 'bg-[#14181d]'}`}>
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={property.title}
              onError={() => {
                if (canTrySourceLogoFallback) {
                  setLogoError(true);
                } else {
                  setImgError(true);
                }
              }}
              referrerPolicy="no-referrer"
              loading="lazy"
              className={
                isDisplayingLogo
                  ? 'w-full h-full object-contain p-8 transition-transform duration-700 ease-out group-hover:scale-105'
                  : 'w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105'
              }
            />
          ) : (
            /* Zero-Broken-Image Fallback with Architectural Gradient & Motif */
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#1a212b] to-[#0c0f12] text-center">
              <div className="w-12 h-12 rounded-full border border-[#c5a059]/40 flex items-center justify-center text-[#c5a059] mb-3">
                <span className="font-serif text-lg font-bold">B</span>
              </div>
              <p className="font-serif text-sm text-[#f7f5f2] font-medium tracking-wide">
                {property.title}
              </p>
              <p className="text-[11px] text-[#8a909a] mt-1">{property.city}, {property.country}</p>
            </div>
          )}

          {/* Ambient Dark Gradient Scrim for Contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#101419] via-transparent to-black/20 pointer-events-none" />

          {/* Quiet Category Marker (No Pill, unboxed text) */}
          <div className="absolute top-3.5 left-3.5 z-10">
            <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#f7f5f2] bg-[#0c0f12]/70 backdrop-blur-sm px-2.5 py-1 rounded-sm border border-white/10">
              {property.category}
            </span>
          </div>
        </div>

        {/* Content & Metadata Section */}
        <div className="p-5 flex flex-col flex-1 justify-between">
          <div>
            {/* Unboxed Metadata Strip with Bullet Separators */}
            <div className="flex items-center gap-2 text-xs text-[#8a909a] mb-2 font-mono">
              {property.bedrooms > 0 && (
                <>
                  <span>{property.bedrooms} Beds</span>
                  <span aria-hidden="true" className="text-[#3b4452]">·</span>
                </>
              )}
              {property.bathrooms > 0 && (
                <>
                  <span>{property.bathrooms} Baths</span>
                  <span aria-hidden="true" className="text-[#3b4452]">·</span>
                </>
              )}
              {property.interiorAreaSqFt > 0 ? (
                <span>{property.interiorAreaSqFt.toLocaleString()} sq ft</span>
              ) : property.lotSizeAcres ? (
                <span>{property.lotSizeAcres} Acres</span>
              ) : (
                <span>Prime Footprint</span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-serif text-lg font-medium text-[#f7f5f2] group-hover:text-[#c5a059] transition-colors leading-snug line-clamp-1">
              {property.title}
            </h3>

            {/* Location */}
            <p className="text-xs text-[#9ba1ab] flex items-center gap-1.5 mt-1.5 line-clamp-1">
              <MapPin className="w-3 h-3 text-[#c5a059] shrink-0" />
              <span>{property.address ? `${property.address}, ` : ''}{property.city}, {property.country}</span>
            </p>
          </div>

          {/* Price & Action Row */}
          <div className="mt-5 pt-4 border-t border-[#1c232d] flex items-baseline justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#737a85] block font-mono">
                Asking Price
              </span>
              <span className="text-base font-semibold text-[#f7f5f2] font-mono tabular-nums tracking-tight">
                {formatPrice(property.price, property.currency)}
              </span>
            </div>

            <span className="text-xs text-[#c5a059] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform font-medium">
              Details
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>

        </div>
      </AppLink>
    </article>
  );
};
