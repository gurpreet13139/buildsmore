import React, { useState } from 'react';
import { Property } from '../../types/property';
import { useCurrency } from '../../context/CurrencyContext';
import { Heart, MapPin, Bed, Bath, Maximize2 } from 'lucide-react';
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
    Boolean(
      property.sourceLogoUrl &&
        isSafeDisplayImageUrl(property.sourceLogoUrl) &&
        property.sourceLogoUrl !== primary.url
    );

  const displayUrl = canTrySourceLogoFallback
    ? property.sourceLogoUrl
    : !imgError
    ? primary.url
    : undefined;
  const isDisplayingLogo = canTrySourceLogoFallback || (!imgError && primary.isLogo);
  const propertyHref = `/property/${encodeURIComponent(property.slug)}`;

  return (
    <article className="group relative bg-white border border-slate-200/80 hover:border-[#163B8C]/35 rounded-2xl shadow-[0_8px_28px_rgba(13,37,88,0.06)] hover:shadow-[0_16px_40px_rgba(13,37,88,0.13)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Top-Right Save / Heart Button (kept outside <a> for valid semantic HTML) */}
      <div className="absolute top-3.5 right-3.5 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave?.(property.id, e);
          }}
          aria-label={isSaved ? 'Remove property from saved list' : 'Save property'}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all cursor-pointer shadow-sm ${
            isSaved
              ? 'bg-[#DC1F26] text-white'
              : 'bg-white/90 text-[#0D2558] hover:bg-[#DC1F26] hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <AppLink
        href={propertyHref}
        onNavigate={() => onSelect(property)}
        className="flex flex-col flex-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#163B8C]"
      >
        {/* Property Image Container */}
        <div
          className={`relative aspect-[4/3] w-full overflow-hidden ${
            isDisplayingLogo ? 'bg-[#0D2558]' : 'bg-slate-100'
          }`}
        >
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
                  ? 'w-full h-full object-contain p-8 transition-transform duration-500 ease-out group-hover:scale-105'
                  : 'w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105'
              }
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#0D2558] to-[#163B8C] text-center">
              <div className="w-11 h-11 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white mb-2.5">
                <span className="text-lg font-extrabold">B</span>
              </div>
              <p className="text-sm text-white font-semibold line-clamp-1">{property.title}</p>
              <p className="text-[11px] text-blue-200 mt-0.5">
                {property.city}, {property.country}
              </p>
            </div>
          )}

          {/* Top-Left Deep Royal Blue Badge (Matches Screenshot "For Sale" pill on card media) */}
          <div className="absolute top-3.5 left-3.5 z-10">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#0D2558]/90 backdrop-blur-xs text-white text-[11px] font-semibold tracking-wide shadow-sm">
              {property.category === 'New Projects' ? 'New Project' : 'For Sale'}
            </span>
          </div>
        </div>

        {/* Crisp White Card Content */}
        <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between">
          <div>
            {/* Property Title */}
            <h3 className="text-base sm:text-[17px] font-bold text-[#0D2558] group-hover:text-[#DC1F26] transition-colors leading-snug line-clamp-1">
              {property.title}
            </h3>

            {/* Location with Red Map Pin */}
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1.5 line-clamp-1">
              <MapPin className="w-3.5 h-3.5 text-[#DC1F26] shrink-0" />
              <span className="truncate">
                {property.city}
                {property.stateRegion ? `, ${property.stateRegion}` : property.country ? `, ${property.country}` : ''}
              </span>
            </p>

            {/* Bold Royal Navy Price */}
            <div className="mt-3 text-lg sm:text-[19px] font-extrabold text-[#0D2558] tabular-nums tracking-tight">
              {formatPrice(property.price, property.currency)}
            </div>
          </div>

          {/* Bottom Property Specs Row (Matches Screenshot Beds · Baths · Sq.Ft) */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11.5px] font-medium text-slate-600">
            {property.bedrooms > 0 ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Bed className="w-3.5 h-3.5 text-[#163B8C] shrink-0" />
                <span className="tabular-nums">{property.bedrooms} Beds</span>
              </span>
            ) : (
              <span className="text-slate-500 truncate">{property.category}</span>
            )}

            {property.bathrooms > 0 && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Bath className="w-3.5 h-3.5 text-[#163B8C] shrink-0" />
                <span className="tabular-nums">{property.bathrooms} Baths</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Maximize2 className="w-3.5 h-3.5 text-[#163B8C] shrink-0" />
              <span className="tabular-nums">
                {property.interiorAreaSqFt > 0
                  ? `${property.interiorAreaSqFt.toLocaleString()} Sq.Ft`
                  : property.lotSizeAcres
                  ? `${property.lotSizeAcres} Acres`
                  : 'Prime Plot'}
              </span>
            </span>
          </div>
        </div>
      </AppLink>
    </article>
  );
};
