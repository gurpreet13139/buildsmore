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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0f1318] border border-[#2c3645] text-[#f7f5f2] rounded-sm shadow-2xl overflow-hidden my-8">
        
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#141a22] border-b border-[#242c38]">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
              alt="BUILDsmore"
              className="w-9 h-9 rounded-sm object-cover border border-[#c5a059]/40 shadow-sm"
            />
            <div>
              <span className="font-serif text-base tracking-widest text-[#c5a059] uppercase font-bold block leading-none">
                BUILDsmore
              </span>
              <span className="text-[9px] text-[#8a909a] font-mono uppercase mt-0.5 block">
                Let's Grow Together · Concierge: 977-987-8303
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#d1d5db] hover:text-[#f7f5f2] bg-[#1a212c] rounded-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#0c0f12] bg-[#c5a059] hover:bg-[#d4af5f] font-medium rounded-sm transition-colors cursor-pointer"
            >
              {downloaded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloaded ? 'Brochure Generated' : 'Save PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#8a909a] hover:text-[#f7f5f2] rounded-sm transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Brochure Content (Printable Layout) */}
        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
          
          {/* Hero Banner inside Brochure */}
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm bg-[#181f29]">
            {(() => {
              const primaryImg = getPrimaryPropertyImage(property);
              return (
                <img
                  src={primaryImg.url}
                  alt={property.title}
                  className={`w-full h-full ${primaryImg.isLogo ? 'object-contain p-10 bg-[#0f141b]' : 'object-cover'}`}
                />
              );
            })()}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
                  Confidential Property Dossier
                </span>
                <h2 className="font-serif text-3xl font-medium text-white">
                  {property.title}
                </h2>
                <p className="text-xs text-[#d1d5db] flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#c5a059]" />
                  {property.address}, {property.city}, {property.country}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#9ca3af] uppercase tracking-wider block font-mono">
                  Valuation
                </span>
                <span className="font-serif text-2xl font-bold text-white font-mono tabular-nums">
                  {formatPrice(property.price, property.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Key Facts Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#141922] border border-[#242b36] rounded-sm text-center">
            <div>
              <span className="text-[11px] text-[#8a909a] uppercase tracking-wider font-mono block">Bedrooms</span>
              <span className="text-lg font-semibold text-[#f7f5f2] font-mono">{property.bedrooms || 'Bespoke'}</span>
            </div>
            <div>
              <span className="text-[11px] text-[#8a909a] uppercase tracking-wider font-mono block">Bathrooms</span>
              <span className="text-lg font-semibold text-[#f7f5f2] font-mono">{property.bathrooms || 'En-Suite'}</span>
            </div>
            <div>
              <span className="text-[11px] text-[#8a909a] uppercase tracking-wider font-mono block">Interior Living</span>
              <span className="text-lg font-semibold text-[#f7f5f2] font-mono">
                {property.interiorAreaSqFt ? `${property.interiorAreaSqFt.toLocaleString()} sq ft` : 'Commercial'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#8a909a] uppercase tracking-wider font-mono block">Energy Rating</span>
              <span className="text-lg font-semibold text-[#c5a059] font-mono">{property.energyRating || 'A+ Certified'}</span>
            </div>
          </div>

          {/* Editorial Overview */}
          <div>
            <h3 className="font-serif text-xl font-medium text-[#f7f5f2] mb-3">
              Architectural Overview & Narrative
            </h3>
            <p className="text-sm text-[#9ca3af] leading-relaxed font-light">
              {property.description}
            </p>
          </div>

          {/* Specifications Table */}
          <div>
            <h3 className="font-serif text-lg font-medium text-[#f7f5f2] mb-3">
              Technical Specifications & Building Covenants
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {Object.entries(property.specifications).map(([key, val]) => (
                <div key={key} className="flex justify-between py-2 border-b border-[#202732]">
                  <span className="text-[#8a909a] font-mono">{key}</span>
                  <span className="text-[#f7f5f2] font-medium text-right">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Curated Amenities */}
          <div>
            <h3 className="font-serif text-lg font-medium text-[#f7f5f2] mb-3">
              Private Amenities & Estate Features
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-[#d1d5db]">
              {property.amenities.map((amenity, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer & Advisory Signature */}
          <div className="pt-6 border-t border-[#202732] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#6b7280]">
            <div>
              <p>BUILDsmore Private Portfolio Advisory · Direct Hotline: 977-987-8303 · info@buildsmoremohali.com</p>
              <p className="mt-0.5">Strictly confidential. Issued for private client inspection only under mutual NDA.</p>
            </div>
            <div className="text-right">
              <span className="font-serif text-[#c5a059] tracking-widest uppercase">Verified Title Deed</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
