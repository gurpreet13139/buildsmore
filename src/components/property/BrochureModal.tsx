import React from 'react';
import { Property } from '../../types/property';
import { useCurrency } from '../../context/CurrencyContext';
import { X, Printer, Download, CheckCircle2, ShieldCheck, MapPin } from 'lucide-react';
import { getPrimaryPropertyImage } from '../../utils/propertyImages';

interface BrochureModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

export const BrochureModal: React.FC<BrochureModalProps> = ({ property, isOpen, onClose }) => {
  const { formatPrice } = useCurrency();
  const [downloaded, setDownloaded] = React.useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F4B]/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 text-[#0D2558] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Modal Controls Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-[#0D2558] text-white">
          <div className="flex items-center gap-3">
            <div className="p-0.5 rounded-lg bg-[#0c0f12] border border-[#c5a059]/60">
              <img
                src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
                alt="BUILDsmore"
                className="w-9 h-9 rounded-md object-cover block"
              />
            </div>
            <div>
              <span className="text-base tracking-tight text-white font-extrabold block leading-none">
                BUILDsmore
              </span>
              <span className="text-[10px] text-sky-200 font-semibold uppercase mt-0.5 block">
                Let&apos;s Grow Together · Concierge: 977-987-8303
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs text-white bg-white/15 hover:bg-white/25 font-semibold rounded-full transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 text-xs text-white bg-[#DC1F26] hover:bg-[#B91C1C] font-bold rounded-full transition-colors cursor-pointer"
            >
              {downloaded ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloaded ? 'Brochure Generated' : 'Save PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close brochure"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Brochure Content (Printable Layout) */}
        <div className="p-6 sm:p-8 space-y-8 max-h-[80vh] overflow-y-auto">
          {/* Hero Banner inside Brochure */}
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100">
            {(() => {
              const primaryImg = getPrimaryPropertyImage(property);
              return (
                <img
                  src={primaryImg.url}
                  alt={property.title}
                  className={`w-full h-full ${
                    primaryImg.isLogo ? 'object-contain p-10 bg-[#0f141b]' : 'object-cover'
                  }`}
                />
              );
            })()}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D2558]/90 via-[#0D2558]/20 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200 block mb-1">
                  Confidential Property Dossier
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {property.title}
                </h2>
                <p className="text-xs text-slate-200 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#DC1F26]" />
                  {property.address}, {property.city}, {property.country}
                </p>
              </div>

              <div className="sm:text-right">
                <span className="text-[11px] text-sky-200 uppercase tracking-wider block font-bold">
                  Valuation
                </span>
                <span className="text-2xl font-extrabold text-white tabular-nums">
                  {formatPrice(property.price, property.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Key Facts Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#F7F9FC] border border-slate-200 rounded-xl text-center">
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">
                Bedrooms
              </span>
              <span className="text-lg font-extrabold text-[#0D2558]">
                {property.bedrooms || 'Bespoke'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">
                Bathrooms
              </span>
              <span className="text-lg font-extrabold text-[#0D2558]">
                {property.bathrooms || 'En-Suite'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">
                Interior Living
              </span>
              <span className="text-lg font-extrabold text-[#0D2558]">
                {property.interiorAreaSqFt
                  ? `${property.interiorAreaSqFt.toLocaleString()} Sq.Ft`
                  : 'Commercial'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">
                Energy Rating
              </span>
              <span className="text-lg font-extrabold text-[#DC1F26]">
                {property.energyRating || 'A+ Certified'}
              </span>
            </div>
          </div>

          {/* Editorial Overview */}
          <div>
            <h3 className="text-xl font-extrabold text-[#0D2558] mb-2.5">
              Architectural Overview &amp; Narrative
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{property.description}</p>
          </div>

          {/* Specifications Table */}
          <div>
            <h3 className="text-lg font-extrabold text-[#0D2558] mb-3">
              Technical Specifications &amp; Building Covenants
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {Object.entries(property.specifications).map(([key, val]) => (
                <div key={key} className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">{key}</span>
                  <span className="text-[#0D2558] font-bold text-right">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Curated Amenities */}
          <div>
            <h3 className="text-lg font-extrabold text-[#0D2558] mb-3">
              Private Amenities &amp; Estate Features
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-700">
              {property.amenities.map((amenity, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#163B8C] shrink-0" />
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer & Advisory Signature */}
          <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              <p className="font-semibold text-[#0D2558]">
                BUILDsmore Private Portfolio Advisory · Direct Hotline: 977-987-8303 ·
                info@buildsmoremohali.com
              </p>
              <p className="mt-0.5">
                Strictly confidential. Issued for private client inspection only under mutual NDA.
              </p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold uppercase tracking-wider text-[11px]">
                Verified Title Deed
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
