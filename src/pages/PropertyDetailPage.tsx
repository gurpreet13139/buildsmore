import React, { useState, useRef } from 'react';
import { Property } from '../types/property';
import { useCurrency } from '../context/CurrencyContext';
import { storage } from '../services/storage';
import { BrochureModal } from '../components/property/BrochureModal';
import { getPrimaryPropertyImage, isLogoFallbackImage, orderPropertyImages } from '../utils/propertyImages';
import { MortgageCalculator } from '../components/property/MortgageCalculator';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { AppLink } from '../components/common/AppLink';
import { getCategoryRoute } from '../utils/seo';
import { submitPublicInquiry, validateInquiryFields } from '../utils/inquiryValidation';
import { 
  MapPin, 
  Bed, 
  Bath, 
  Maximize2, 
  Car, 
  Zap, 
  ShieldCheck, 
  FileText, 
  Share2, 
  Bookmark, 
  Calendar, 
  Send, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Plane,
  Anchor,
  Sparkles,
  PhoneCall,
  Mail,
  Compass,
  ExternalLink,
  Layers,
  Building
} from 'lucide-react';

interface PropertyDetailPageProps {
  property: Property;
  onBack: () => void;
  onNavigateCategory: (category: string) => void;
  onNavigate?: (path: string) => void;
  isSaved: boolean;
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onSelectProperty: (property: Property) => void;
  allProperties: Property[];
}

export const PropertyDetailPage: React.FC<PropertyDetailPageProps> = ({
  property,
  onBack,
  onNavigateCategory,
  onNavigate,
  isSaved,
  onToggleSave,
  onSelectProperty,
  allProperties,
}) => {
  const { formatPrice } = useCurrency();

  // Gallery active index & Lightbox
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [brochureOpen, setBrochureOpen] = useState(false);

  // Inquiry form state
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredContact, setPreferredContact] = useState<'email' | 'phone' | 'whatsapp'>('email');
  const [investmentBudget, setInvestmentBudget] = useState('');
  const [tourDate, setTourDate] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const formStartedAt = useRef<number>(Date.now());
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquirySuccessNote, setInquirySuccessNote] = useState<string | null>(null);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  const ordered = orderPropertyImages(property);
  const images = ordered.length > 0
    ? ordered
    : [{ id: 'default', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80', isPrimary: true }];

  const currentImage = images[activeImageIndex] || images[0];
  const isCurrentLogo = isLogoFallbackImage(currentImage, property);

  // Similar properties recommendation
  const similarProperties = allProperties
    .filter(p => p.id !== property.id && (p.category === property.category || p.country === property.country))
    .slice(0, 3);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inquirySubmitting) return;

    const validationError = validateInquiryFields({
      fullName: clientName,
      phone,
      email,
      emailRequired: true,
      message,
      messageRequired: false,
    });
    if (validationError) {
      setInquiryError(validationError);
      return;
    }

    const trimmedName = clientName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const finalMessage =
      message.trim() || `Inquiry for private inspection of ${property.title}.`;

    setInquirySubmitting(true);
    setInquiryError('');

    try {
      const data = await submitPublicInquiry({
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        propertyId: property.id,
        propertyTitle: property.title,
        propertySlug: property.slug,
        propertyType: property.propertyType || property.category,
        budgetRange: investmentBudget || 'Disclosed upon NDA',
        preferredLocation: `${property.city}, ${property.country}`,
        preferredContactMethod: preferredContact,
        scheduledTourDate: tourDate || undefined,
        sourceForm: 'property_detail',
        message: finalMessage,
        website: honeypot,
        _formStartedAt: formStartedAt.current,
      });

      storage.createInquiry({
        propertyId: property.id,
        propertyTitle: property.title,
        propertySlug: property.slug,
        clientName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        preferredContactMethod: preferredContact,
        investmentBudget: investmentBudget || 'Disclosed upon NDA',
        scheduledTourDate: tourDate,
        message: finalMessage,
      });

      setInquirySuccessNote(data.message || null);
      setInquirySubmitted(true);
    } catch (err: unknown) {
      setInquiryError(
        err instanceof Error
          ? err.message
          : 'Unable to transmit your inquiry right now. Please try again or call +91 977-987-8303.'
      );
    } finally {
      setInquirySubmitting(false);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
      
      {/* 1. Breadcrumb Trail & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#202732] text-xs">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Portfolio', href: '/properties' },
            { label: property.category, href: getCategoryRoute(property.category) },
            { label: property.title },
          ]}
          onNavigate={(targetPath) => {
            if (onNavigate) {
              onNavigate(targetPath);
            } else if (targetPath === '/properties') {
              onBack();
            } else if (targetPath.startsWith('/category/')) {
              onNavigateCategory(property.category);
            }
          }}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => setBrochureOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14181d] border border-[#242b35] hover:border-[#c5a059] text-[#f7f5f2] rounded-sm transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#c5a059]" />
            <span>Brochure</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14181d] border border-[#242b35] hover:border-[#c5a059] text-[#f7f5f2] rounded-sm transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-[#c5a059]" />
            <span>{shareCopied ? 'Link Copied' : 'Share'}</span>
          </button>

          <button
            onClick={(e) => onToggleSave(property.id, e)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-sm transition-colors cursor-pointer ${
              isSaved 
                ? 'bg-[#c5a059] text-[#0c0f12] font-semibold border-[#c5a059]' 
                : 'bg-[#14181d] border-[#242b35] text-[#f7f5f2] hover:border-[#c5a059]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* 2. Property Title & Valuation Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-[0.2em] text-[#c5a059] block">
              {property.propertyType} · {property.category}
            </span>
            {property.developerName && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-sm bg-[#161c24] border border-[#2a3442] text-[#c5a059] flex items-center gap-1">
                <Building className="w-3 h-3 text-[#c5a059]" />
                <span>By {property.developerName}</span>
              </span>
            )}
            {property.reraNumber && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-sm bg-[#111a14] border border-emerald-900/60 text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>RERA: {property.reraNumber}</span>
              </span>
            )}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#f7f5f2] leading-tight">
            {property.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#9ca3af] font-light">
            <p className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#c5a059] shrink-0" />
              <span>{property.address}{property.locality ? `, ${property.locality}` : ''}, {property.city}, {property.country}</span>
            </p>
            {property.source?.sourceUrl && (
              <a
                href={property.source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#c5a059] hover:underline flex items-center gap-1 font-mono"
              >
                <span>Partner Source Website</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <div className="lg:text-right bg-[#12161d] p-5 rounded-sm border border-[#202732] shrink-0">
          <span className="text-[11px] uppercase tracking-wider text-[#8a909a] font-mono block">
            Acquisition Asking Price
          </span>
          <span className="font-serif text-3xl sm:text-4xl font-bold text-white font-mono tabular-nums">
            {formatPrice(property.price, property.currency)}
          </span>
          {property.originalPriceText ? (
            <span className="text-[11px] text-[#737a85] font-mono block mt-1">
              Source Listing: {property.originalPriceText}
            </span>
          ) : (
            <span className="text-[11px] text-[#737a85] font-mono block mt-1">
              Verified Direct Valuation (INR)
            </span>
          )}
        </div>
      </div>

      {/* 3. Cinematic Image Gallery & Thumbnails */}
      <div className="space-y-4">
        {/* Main Stage Image */}
        <div 
          onClick={() => setLightboxOpen(true)}
          className={`relative aspect-[16/9] w-full max-h-[640px] rounded-sm overflow-hidden border border-[#242b35] cursor-zoom-in group ${
            isCurrentLogo ? 'bg-[#0f141b]' : 'bg-[#14181d]'
          }`}
        >
          <img
            src={currentImage.url}
            alt={currentImage.caption || property.title}
            className={
              isCurrentLogo
                ? 'w-full h-full object-contain p-12 transition-transform duration-500 group-hover:scale-[1.02]'
                : 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]'
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Image Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-[#c5a059] text-white hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-[#c5a059] text-white hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Caption & Expand Hint */}
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-xs text-white">
            <span className="font-light truncate max-w-md">
              {currentImage.caption || property.subtitle}
            </span>
            <span className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-sm font-mono text-[11px]">
              <Maximize2 className="w-3.5 h-3.5" />
              {activeImageIndex + 1} of {images.length}
            </span>
          </div>
        </div>

        {/* Thumbnail Selector Strip */}
        {images.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {images.map((img, idx) => (
              <button
                key={img.id || idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`relative w-28 h-20 shrink-0 rounded-sm overflow-hidden border-2 transition-all cursor-pointer ${
                  activeImageIndex === idx ? 'border-[#c5a059] opacity-100' : 'border-[#242b35] opacity-50 hover:opacity-80'
                }`}
              >
                <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Specifications Matrix Strip (Unboxed, Tabular) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 p-6 bg-[#101419] border border-[#202732] rounded-sm text-center">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block mb-1">
            Bedrooms
          </span>
          <div className="flex items-center justify-center gap-1.5 text-base font-semibold text-[#f7f5f2] font-mono">
            <Bed className="w-4 h-4 text-[#c5a059]" />
            <span>{property.bedrooms || 'Bespoke'}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block mb-1">
            Bathrooms
          </span>
          <div className="flex items-center justify-center gap-1.5 text-base font-semibold text-[#f7f5f2] font-mono">
            <Bath className="w-4 h-4 text-[#c5a059]" />
            <span>{property.bathrooms || 'En-Suite'}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block mb-1">
            Interior Living
          </span>
          <div className="flex items-center justify-center gap-1.5 text-base font-semibold text-[#f7f5f2] font-mono">
            <Maximize2 className="w-4 h-4 text-[#c5a059]" />
            <span>{property.interiorAreaSqFt ? `${property.interiorAreaSqFt.toLocaleString()} sq ft` : 'Commercial'}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block mb-1">
            Private Lot
          </span>
          <div className="flex items-center justify-center gap-1.5 text-base font-semibold text-[#f7f5f2] font-mono">
            <span>{property.lotSizeAcres ? `${property.lotSizeAcres} Acres` : 'Urban'}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block mb-1">
            Secure Parking
          </span>
          <div className="flex items-center justify-center gap-1.5 text-base font-semibold text-[#f7f5f2] font-mono">
            <Car className="w-4 h-4 text-[#c5a059]" />
            <span>{property.parkingSpaces || 2} Bays</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block mb-1">
            Energy Rating
          </span>
          <div className="flex items-center justify-center gap-1.5 text-base font-semibold text-[#c5a059] font-mono">
            <Zap className="w-4 h-4 text-[#c5a059]" />
            <span>{property.energyRating || 'A+'}</span>
          </div>
        </div>
      </div>

      {/* 5. Main 2-Column Split: Narrative & Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* Left Column: Narrative, Amenities, Tech Specs, Map */}
        <div className="lg:col-span-7 space-y-10">
          
          {/* Architectural Narrative */}
          <div className="space-y-4">
            <h2 className="font-serif text-2xl font-normal text-[#f7f5f2]">
              Architectural Profile & Residence Overview
            </h2>
            <p className="text-sm text-[#cbd5e1] leading-relaxed font-light whitespace-pre-line">
              {property.description}
            </p>
          </div>

          {/* Key Architectural Highlights */}
          {property.highlights && property.highlights.length > 0 && (
            <div className="space-y-3 pt-6 border-t border-[#1c232d]">
              <h3 className="font-serif text-xl font-normal text-[#f7f5f2] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#c5a059]" />
                Key Architectural Highlights
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {property.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 bg-[#12161d] p-3 rounded-sm border border-[#202732]">
                    <span className="text-[#c5a059] font-mono font-bold text-xs mt-0.5">•</span>
                    <span className="text-xs text-[#e2e8f0] font-light leading-snug">{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verified Amenities */}
          <div className="space-y-4 pt-6 border-t border-[#1c232d]">
            <h3 className="font-serif text-xl font-normal text-[#f7f5f2]">
              Verified Estate Amenities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#d1d5db]">
              {property.amenities.map((amenity, idx) => (
                <div key={idx} className="flex items-center gap-2.5 p-2 bg-[#12161d] border border-[#202732] rounded-sm">
                  <ShieldCheck className="w-4 h-4 text-[#c5a059] shrink-0" />
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="space-y-4 pt-6 border-t border-[#1c232d]">
            <h3 className="font-serif text-xl font-normal text-[#f7f5f2]">
              Building & Material Specifications
            </h3>
            <div className="bg-[#101419] border border-[#202732] rounded-sm p-4 text-xs divide-y divide-[#1c232d]">
              {Object.entries(property.specifications).map(([key, val]) => (
                <div key={key} className="flex justify-between py-2.5">
                  <span className="text-[#8a909a] font-mono">{key}</span>
                  <span className="text-[#f7f5f2] font-medium text-right max-w-xs">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location & Luxury Landmarks Map Section */}
          <div className="space-y-4 pt-6 border-t border-[#1c232d]">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl font-normal text-[#f7f5f2]">
                Location & Luxury Infrastructure
              </h3>
              <span className="text-xs font-mono text-[#8a909a]">
                {property.coordinates.lat.toFixed(4)}° N, {property.coordinates.lng.toFixed(4)}° E
              </span>
            </div>

            {/* Stylized Dark Architectural Map Canvas */}
            <div className="relative aspect-[16/9] w-full rounded-sm overflow-hidden border border-[#242b35] bg-[#141a22] flex flex-col items-center justify-center p-8 text-center">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#c5a059_1px,transparent_1px)] [background-size:16px_16px]" />
              
              <div className="relative z-10 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#c5a059]/20 border border-[#c5a059] flex items-center justify-center text-[#c5a059] mx-auto animate-pulse">
                  <Compass className="w-6 h-6" />
                </div>
                <h4 className="font-serif text-lg font-medium text-[#f7f5f2]">
                  {property.city}, {property.country}
                </h4>
                <p className="text-xs text-[#8a909a] max-w-sm">
                  {property.address}
                </p>
              </div>

              {/* Surrounding Landmark Indicators */}
              <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 text-[10px] text-[#cbd5e1] font-mono">
                <div className="bg-[#0c0f12]/80 backdrop-blur-sm p-2 rounded-sm border border-[#242b35] flex items-center gap-1.5">
                  <Plane className="w-3 h-3 text-[#c5a059]" />
                  <span>Private FBO: ~18 min</span>
                </div>
                <div className="bg-[#0c0f12]/80 backdrop-blur-sm p-2 rounded-sm border border-[#242b35] flex items-center gap-1.5">
                  <Anchor className="w-3 h-3 text-[#c5a059]" />
                  <span>Superyacht Marina: ~8 min</span>
                </div>
                <div className="bg-[#0c0f12]/80 backdrop-blur-sm p-2 rounded-sm border border-[#242b35] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#c5a059]" />
                  <span>Michelin Dining: ~5 min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Floor Plans & Master Site Layout (If available) */}
          {property.floorPlans && property.floorPlans.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-[#1c232d]">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-normal text-[#f7f5f2] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#c5a059]" />
                  <span>Floor Plans & Master Site Layout</span>
                </h3>
                <span className="text-xs font-mono text-[#8a909a]">{property.floorPlans.length} Plans Available</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {property.floorPlans.map((fp, i) => (
                  <div key={i} className="bg-[#101419] border border-[#202732] rounded-sm overflow-hidden p-3 space-y-2">
                    <div className="aspect-[4/3] bg-black/40 rounded-sm overflow-hidden border border-[#1a212b]">
                      <img src={fp.imageUrl} alt={fp.title} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-xs text-white font-mono block truncate">{fp.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Imported Project Dossier & Section Highlights */}
          {property.sourceSections && property.sourceSections.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-[#1c232d]">
              <h3 className="font-serif text-xl font-normal text-[#f7f5f2] flex items-center gap-2">
                <Building className="w-5 h-5 text-[#c5a059]" />
                <span>Verified Project Dossier</span>
              </h3>
              <div className="space-y-3">
                {property.sourceSections.map((sec) => (
                  <div key={sec.id} className="p-4 bg-[#101419] border border-[#202732] rounded-sm space-y-1.5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-[#c5a059]">
                      {sec.title}
                    </h4>
                    <p className="text-xs text-[#cbd5e1] leading-relaxed font-light">
                      {sec.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mortgage Calculator */}
          <div className="pt-6 border-t border-[#1c232d]">
            <MortgageCalculator propertyPrice={property.price} currency={property.currency} />
          </div>

        </div>

        {/* Right Column: Contiguous Purchase / Inquiry Module (Sticky) */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          
          <div className="bg-[#12161d] border border-[#252f3e] p-6 rounded-sm shadow-xl space-y-6">
            
            <div className="border-b border-[#202733] pb-4">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
                Private Client Advisory
              </span>
              <h3 className="font-serif text-2xl font-medium text-[#f7f5f2]">
                Inquire or Schedule Inspection
              </h3>
              <p className="text-xs text-[#8a909a] mt-1">
                Direct access to the appointed managing partner under strict non-disclosure.
              </p>
            </div>

            {inquirySubmitted ? (
              <div className="p-6 bg-[#16221c] border border-emerald-500/30 rounded-sm text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="font-serif text-lg font-medium text-white">
                  Inquiry Received
                </h4>
                <p className="text-xs text-[#a7f3d0] leading-relaxed">
                  Thank you, {clientName}.{' '}
                  {inquirySuccessNote ||
                    `Your confidential dossier request for ${property.title} has been registered with our advisory desk.`}
                </p>
                <button
                  onClick={() => {
                    setInquirySubmitted(false);
                    setInquirySuccessNote(null);
                    setInquiryError('');
                    setHoneypot('');
                    formStartedAt.current = Date.now();
                  }}
                  className="mt-2 text-xs text-[#c5a059] underline cursor-pointer"
                >
                  Submit Additional Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-4" noValidate>
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="property-website-field">Website</label>
                  <input
                    id="property-website-field"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>
                
                {inquiryError && (
                  <div role="alert" className="p-3 bg-red-950/40 border border-red-800 text-xs text-red-200 rounded-sm">
                    {inquiryError}
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-mono text-[#8a909a] block mb-1 uppercase tracking-wider">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Lord Alistair Sterling / Elena Rostova"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-[#8a909a] block mb-1 uppercase tracking-wider">
                      Direct Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="client@familyoffice.com"
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-[#8a909a] block mb-1 uppercase tracking-wider">
                      Phone / Mobile *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+44 20 7946 ..."
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-[#8a909a] block mb-1 uppercase tracking-wider">
                      Contact Channel
                    </label>
                    <select
                      value={preferredContact}
                      onChange={(e) => setPreferredContact(e.target.value as any)}
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                    >
                      <option value="email">Direct Email</option>
                      <option value="phone">Private Phone Call</option>
                      <option value="whatsapp">Encrypted WhatsApp</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-[#8a909a] block mb-1 uppercase tracking-wider">
                      Target Inspection Date
                    </label>
                    <input
                      type="date"
                      value={tourDate}
                      onChange={(e) => setTourDate(e.target.value)}
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-[#8a909a] block mb-1 uppercase tracking-wider">
                    Confidential Requirements / Message
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Specify helicopter landing requirements, NDA requirements, or private viewing dates..."
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm p-3 text-xs text-[#f7f5f2] focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inquirySubmitting}
                  className="w-full py-3 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase tracking-widest font-semibold rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{inquirySubmitting ? 'Transmitting Request...' : 'Transmit Confidential Inquiry'}</span>
                </button>

                <p className="text-[10px] text-[#6b7280] text-center leading-normal">
                  Transmissions are strictly encrypted under our mutual international privacy covenant.
                </p>

              </form>
            )}

            {/* Direct Advisor Card with Hotline */}
            <div className="pt-4 border-t border-[#202733] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                  alt="Marcus Vance"
                  className="w-10 h-10 rounded-full object-cover border border-[#c5a059]/40"
                />
                <div className="text-xs">
                  <span className="text-[#f7f5f2] font-medium block">Marcus Vance</span>
                  <span className="text-[#8a909a] text-[11px]">Managing Partner, Advisory</span>
                </div>
              </div>

              <a
                href="tel:9779878303"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#181f2a] hover:bg-[#c5a059] hover:text-[#0c0f12] text-[#f7f5f2] border border-[#2a3442] rounded-sm text-xs font-mono transition-colors cursor-pointer"
                title="Direct Phone Call"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#c5a059]" />
                <span className="tabular-nums">9779878303</span>
              </a>
            </div>

          </div>

        </div>

      </div>

      {/* 6. Similar Properties Recommendations */}
      {similarProperties.length > 0 && (
        <div className="pt-16 border-t border-[#202732] space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
                Comparative Assets
              </span>
              <h3 className="font-serif text-2xl font-normal text-[#f7f5f2]">
                Similar Holdings in the Registry
              </h3>
            </div>
            <AppLink
              href="/properties"
              onNavigate={onNavigate || (() => onBack())}
              className="text-xs text-[#c5a059] hover:underline cursor-pointer"
            >
              View Full Portfolio
            </AppLink>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {similarProperties.map((p) => (
              <AppLink
                key={p.id}
                href={`/property/${encodeURIComponent(p.slug)}`}
                onNavigate={() => onSelectProperty(p)}
                className="block bg-[#101419] border border-[#202732] hover:border-[#c5a059]/50 transition-colors p-3 rounded-sm cursor-pointer group"
              >
                <div className="aspect-[4/3] rounded-sm overflow-hidden mb-3 bg-[#14181d]">
                  {(() => {
                    const simPrimary = getPrimaryPropertyImage(p);
                    return (
                      <img
                        src={simPrimary.url}
                        alt={p.title}
                        className={`w-full h-full transition-transform ${
                          simPrimary.isLogo ? 'object-contain p-6 bg-[#0f141b]' : 'object-cover group-hover:scale-105'
                        }`}
                      />
                    );
                  })()}
                </div>
                <span className="text-[10px] font-mono uppercase text-[#c5a059]">{p.city}, {p.country}</span>
                <h4 className="font-serif text-base font-medium text-[#f7f5f2] truncate group-hover:text-[#c5a059]">
                  {p.title}
                </h4>
                <p className="text-xs font-mono text-[#d1d5db] mt-1 tabular-nums">
                  {formatPrice(p.price, p.currency)}
                </p>
              </AppLink>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div 
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={currentImage.url}
            alt={property.title}
            className="max-w-full max-h-[90vh] object-contain"
          />
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 text-white text-lg font-mono bg-black/60 px-3 py-1 rounded-sm"
          >
            Close [Esc]
          </button>
        </div>
      )}

      {/* Brochure Modal */}
      <BrochureModal
        property={property}
        isOpen={brochureOpen}
        onClose={() => setBrochureOpen(false)}
      />

    </div>
  );
};
