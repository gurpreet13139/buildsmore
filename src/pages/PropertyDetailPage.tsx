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
  Send,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plane,
  Anchor,
  Sparkles,
  PhoneCall,
  Compass,
  ExternalLink,
  Layers,
  Building,
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
  const [investmentBudget] = useState('');
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
  const images =
    ordered.length > 0
      ? ordered
      : [
          {
            id: 'default',
            url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
            isPrimary: true,
          },
        ];

  const currentImage = images[activeImageIndex] || images[0];
  const isCurrentLogo = isLogoFallbackImage(currentImage, property);

  // Similar properties recommendation
  const similarProperties = allProperties
    .filter((p) => p.id !== property.id && (p.category === property.category || p.country === property.country))
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
    <div className="bg-[#F7F9FC] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* 1. Breadcrumb Trail & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 text-xs">
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

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setBrochureOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-[#0D2558] text-[#0D2558] font-semibold rounded-full transition-colors cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-[#163B8C]" />
              <span>Brochure</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-[#0D2558] text-[#0D2558] font-semibold rounded-full transition-colors cursor-pointer shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5 text-[#163B8C]" />
              <span>{shareCopied ? 'Link Copied' : 'Share'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => onToggleSave(property.id, e)}
              className={`flex items-center gap-1.5 px-3.5 py-2 border font-bold rounded-full transition-colors cursor-pointer shadow-xs ${
                isSaved
                  ? 'bg-[#DC1F26] text-white border-[#DC1F26]'
                  : 'bg-white border-slate-200 text-[#0D2558] hover:border-[#DC1F26]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* 2. Property Title & Valuation Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#0D2558] text-white text-[11px] font-bold uppercase tracking-wider">
                {property.propertyType} · {property.category}
              </span>
              {property.developerName && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 text-[#163B8C] flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[#163B8C]" />
                  <span>By {property.developerName}</span>
                </span>
              )}
              {property.reraNumber && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>RERA: {property.reraNumber}</span>
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0D2558] leading-tight tracking-tight">
              {property.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <p className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#DC1F26] shrink-0" />
                <span>
                  {property.address}
                  {property.locality ? `, ${property.locality}` : ''}, {property.city},{' '}
                  {property.country}
                </span>
              </p>
              {property.source?.sourceUrl && (
                <a
                  href={property.source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#163B8C] hover:text-[#DC1F26] font-bold flex items-center gap-1"
                >
                  <span>Partner Source Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <div className="lg:text-right bg-white p-5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block">
              Acquisition Asking Price
            </span>
            <span className="text-3xl sm:text-4xl font-extrabold text-[#0D2558] tabular-nums block mt-0.5">
              {formatPrice(property.price, property.currency)}
            </span>
            {property.originalPriceText ? (
              <span className="text-[11px] text-slate-500 font-medium block mt-1">
                Source Listing: {property.originalPriceText}
              </span>
            ) : (
              <span className="text-[11px] text-[#163B8C] font-semibold block mt-1">
                Verified Direct Valuation (INR)
              </span>
            )}
          </div>
        </div>

        {/* 3. Image Gallery & Thumbnails */}
        <div className="space-y-4">
          <div
            onClick={() => setLightboxOpen(true)}
            className={`relative aspect-[16/9] w-full max-h-[620px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in group ${
              isCurrentLogo ? 'bg-[#0f141b]' : 'bg-slate-100'
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D2558]/60 via-transparent to-transparent pointer-events-none" />

            {/* Image Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-[#DC1F26] text-[#0D2558] hover:text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-[#DC1F26] text-[#0D2558] hover:text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Caption & Expand Hint */}
            <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-white">
              <span className="font-medium truncate max-w-md drop-shadow-xs">
                {currentImage.caption || property.subtitle}
              </span>
              <span className="flex items-center gap-1.5 bg-[#0D2558]/85 backdrop-blur-sm px-3 py-1 rounded-full font-bold text-[11px]">
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
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-28 h-20 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-[#DC1F26] opacity-100 shadow-sm'
                      : 'border-slate-200 opacity-65 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4. Specifications Matrix Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs text-center">
          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Bedrooms
            </span>
            <div className="flex items-center justify-center gap-1.5 text-base font-extrabold text-[#0D2558]">
              <Bed className="w-4 h-4 text-[#163B8C]" />
              <span>{property.bedrooms || 'Bespoke'}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Bathrooms
            </span>
            <div className="flex items-center justify-center gap-1.5 text-base font-extrabold text-[#0D2558]">
              <Bath className="w-4 h-4 text-[#163B8C]" />
              <span>{property.bathrooms || 'En-Suite'}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Interior Living
            </span>
            <div className="flex items-center justify-center gap-1.5 text-base font-extrabold text-[#0D2558]">
              <Maximize2 className="w-4 h-4 text-[#163B8C]" />
              <span>
                {property.interiorAreaSqFt
                  ? `${property.interiorAreaSqFt.toLocaleString()} Sq.Ft`
                  : 'Commercial'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Private Lot
            </span>
            <div className="flex items-center justify-center gap-1.5 text-base font-extrabold text-[#0D2558]">
              <span>{property.lotSizeAcres ? `${property.lotSizeAcres} Acres` : 'Urban'}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Secure Parking
            </span>
            <div className="flex items-center justify-center gap-1.5 text-base font-extrabold text-[#0D2558]">
              <Car className="w-4 h-4 text-[#163B8C]" />
              <span>{property.parkingSpaces || 2} Bays</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Energy Rating
            </span>
            <div className="flex items-center justify-center gap-1.5 text-base font-extrabold text-[#DC1F26]">
              <Zap className="w-4 h-4 text-[#DC1F26]" />
              <span>{property.energyRating || 'A+'}</span>
            </div>
          </div>
        </div>

        {/* 5. Main 2-Column Split: Narrative & Sticky Inquiry Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-8">
            {/* Architectural Narrative */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
              <h2 className="text-2xl font-extrabold text-[#0D2558] tracking-tight">
                Architectural Profile &amp; Residence Overview
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {property.description}
              </p>
            </div>

            {/* Key Architectural Highlights */}
            {property.highlights && property.highlights.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
                <h3 className="text-xl font-extrabold text-[#0D2558] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#DC1F26]" />
                  <span>Key Architectural Highlights</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {property.highlights.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 bg-[#F7F9FC] p-3.5 rounded-xl border border-slate-200/80"
                    >
                      <span className="text-[#DC1F26] font-extrabold text-sm leading-none mt-0.5">
                        •
                      </span>
                      <span className="text-xs sm:text-sm text-slate-700 leading-snug">{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Amenities */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
              <h3 className="text-xl font-extrabold text-[#0D2558]">Verified Estate Amenities</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-700">
                {property.amenities.map((amenity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 p-3 bg-[#F7F9FC] border border-slate-200/80 rounded-xl font-medium"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#163B8C] shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
              <h3 className="text-xl font-extrabold text-[#0D2558]">
                Building &amp; Material Specifications
              </h3>
              <div className="text-xs sm:text-sm divide-y divide-slate-100">
                {Object.entries(property.specifications).map(([key, val]) => (
                  <div key={key} className="flex justify-between gap-4 py-3">
                    <span className="text-slate-500 font-semibold">{key}</span>
                    <span className="text-[#0D2558] font-bold text-right max-w-xs">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Location & Infrastructure Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-xl font-extrabold text-[#0D2558]">
                  Location &amp; Luxury Infrastructure
                </h3>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  {property.coordinates.lat.toFixed(4)}° N, {property.coordinates.lng.toFixed(4)}° E
                </span>
              </div>

              <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-slate-200 bg-gradient-to-br from-[#0D2558] via-[#133378] to-[#0B1F4B] flex flex-col items-center justify-center p-8 text-center">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:18px_18px]" />

                <div className="relative z-10 space-y-2.5">
                  <div className="w-12 h-12 rounded-full bg-[#DC1F26]/20 border border-[#DC1F26] flex items-center justify-center text-white mx-auto">
                    <Compass className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-extrabold text-white">
                    {property.city}, {property.country}
                  </h4>
                  <p className="text-xs text-slate-200 max-w-sm">{property.address}</p>
                </div>

                <div className="absolute bottom-3 left-3 right-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-white font-semibold">
                  <div className="bg-[#0B1F4B]/80 backdrop-blur-sm p-2 rounded-lg border border-white/15 flex items-center justify-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-sky-300" />
                    <span>Airport Access: ~18 min</span>
                  </div>
                  <div className="bg-[#0B1F4B]/80 backdrop-blur-sm p-2 rounded-lg border border-white/15 flex items-center justify-center gap-1.5">
                    <Anchor className="w-3.5 h-3.5 text-sky-300" />
                    <span>Prime Corridor: ~8 min</span>
                  </div>
                  <div className="bg-[#0B1F4B]/80 backdrop-blur-sm p-2 rounded-lg border border-white/15 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                    <span>Fine Dining &amp; Retail: ~5 min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floor Plans & Master Site Layout */}
            {property.floorPlans && property.floorPlans.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-extrabold text-[#0D2558] flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#163B8C]" />
                    <span>Floor Plans &amp; Master Site Layout</span>
                  </h3>
                  <span className="text-xs font-bold text-[#163B8C]">
                    {property.floorPlans.length} Plans Available
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {property.floorPlans.map((fp, i) => (
                    <div
                      key={i}
                      className="bg-[#F7F9FC] border border-slate-200 rounded-xl overflow-hidden p-3 space-y-2"
                    >
                      <div className="aspect-[4/3] bg-white rounded-lg overflow-hidden border border-slate-200">
                        <img
                          src={fp.imageUrl}
                          alt={fp.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-xs text-[#0D2558] font-bold block truncate">
                        {fp.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Imported Project Dossier & Section Highlights */}
            {property.sourceSections && property.sourceSections.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
                <h3 className="text-xl font-extrabold text-[#0D2558] flex items-center gap-2">
                  <Building className="w-5 h-5 text-[#163B8C]" />
                  <span>Verified Project Dossier</span>
                </h3>
                <div className="space-y-3">
                  {property.sourceSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-4 bg-[#F7F9FC] border border-slate-200 rounded-xl space-y-1.5"
                    >
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#163B8C]">
                        {sec.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {sec.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mortgage Calculator */}
            <MortgageCalculator propertyPrice={property.price} currency={property.currency} />
          </div>

          {/* Right Column: Sticky Inquiry Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="bg-white border border-slate-200 p-6 sm:p-7 rounded-2xl shadow-lg shadow-[#0D2558]/8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#DC1F26] block mb-1">
                  Private Client Advisory
                </span>
                <h3 className="text-2xl font-extrabold text-[#0D2558]">
                  Inquire or Schedule Inspection
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Direct access to the appointed managing partner under strict non-disclosure.
                </p>
              </div>

              {inquirySubmitted ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto" />
                  <h4 className="text-lg font-extrabold text-[#0D2558]">Inquiry Received</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Thank you, <strong className="text-[#0D2558]">{clientName}</strong>.{' '}
                    {inquirySuccessNote ||
                      `Your confidential dossier request for ${property.title} has been registered with our advisory desk.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setInquirySubmitted(false);
                      setInquirySuccessNote(null);
                      setInquiryError('');
                      setHoneypot('');
                      formStartedAt.current = Date.now();
                    }}
                    className="mt-2 text-xs font-bold text-[#163B8C] hover:text-[#DC1F26] underline cursor-pointer"
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
                    <div
                      role="alert"
                      className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 font-medium rounded-xl"
                    >
                      {inquiryError}
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Full Legal Name <span className="text-[#DC1F26]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Vikramjit Singh"
                      className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-3.5 py-2.5 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Direct Email <span className="text-[#DC1F26]">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="client@familyoffice.com"
                        className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-3.5 py-2.5 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Phone / Mobile <span className="text-[#DC1F26]">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 977-987-8303"
                        className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-3.5 py-2.5 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Contact Channel
                      </label>
                      <select
                        value={preferredContact}
                        onChange={(e) =>
                          setPreferredContact(e.target.value as 'email' | 'phone' | 'whatsapp')
                        }
                        className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white rounded-xl px-3 py-2.5 text-xs font-medium text-[#0D2558] focus:outline-none cursor-pointer"
                      >
                        <option value="email">Direct Email</option>
                        <option value="phone">Private Phone Call</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Target Inspection Date
                      </label>
                      <input
                        type="date"
                        value={tourDate}
                        onChange={(e) => setTourDate(e.target.value)}
                        className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white rounded-xl px-3 py-2.5 text-xs font-medium text-[#0D2558] focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Confidential Requirements / Message
                    </label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Specify site visit preferences, financing questions, or bespoke requirements..."
                      className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl p-3 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={inquirySubmitting}
                    className="w-full py-3.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs uppercase tracking-[0.14em] font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#DC1F26]/20 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {inquirySubmitting ? 'Transmitting Request...' : 'Transmit Confidential Inquiry'}
                    </span>
                  </button>

                  <p className="text-[11px] text-slate-500 text-center leading-normal">
                    Transmissions are strictly confidential under our client privacy policy.
                  </p>
                </form>
              )}

              {/* Direct Advisor Card with Hotline */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                    alt="Marcus Vance"
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#0D2558]/20"
                  />
                  <div className="text-xs">
                    <span className="text-[#0D2558] font-bold block">Marcus Vance</span>
                    <span className="text-slate-500 text-[11px]">Managing Partner, Advisory</span>
                  </div>
                </div>

                <a
                  href="tel:9779878303"
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#0D2558] hover:bg-[#163B8C] text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
                  title="Direct Phone Call"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-sky-200" />
                  <span className="tabular-nums">9779878303</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Similar Properties Recommendations */}
        {similarProperties.length > 0 && (
          <div className="pt-12 border-t border-slate-200 space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#DC1F26] block mb-1">
                  Comparative Assets
                </span>
                <h3 className="text-2xl font-extrabold text-[#0D2558]">
                  Similar Holdings in the Registry
                </h3>
              </div>
              <AppLink
                href="/properties"
                onNavigate={onNavigate || (() => onBack())}
                className="text-xs font-bold text-[#DC1F26] hover:underline cursor-pointer"
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
                  className="block bg-white border border-slate-200 hover:border-[#163B8C]/40 hover:shadow-lg transition-all p-3.5 rounded-2xl cursor-pointer group"
                >
                  <div className="aspect-[4/3] rounded-xl overflow-hidden mb-3 bg-slate-100">
                    {(() => {
                      const simPrimary = getPrimaryPropertyImage(p);
                      return (
                        <img
                          src={simPrimary.url}
                          alt={p.title}
                          className={`w-full h-full transition-transform duration-500 ${
                            simPrimary.isLogo
                              ? 'object-contain p-6 bg-[#0f141b]'
                              : 'object-cover group-hover:scale-105'
                          }`}
                        />
                      );
                    })()}
                  </div>
                  <span className="text-[11px] font-bold text-[#DC1F26] flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {p.city}, {p.country}
                  </span>
                  <h4 className="text-base font-extrabold text-[#0D2558] truncate group-hover:text-[#163B8C] mt-0.5">
                    {p.title}
                  </h4>
                  <p className="text-sm font-extrabold text-[#0D2558] mt-1 tabular-nums">
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
            className="fixed inset-0 z-50 bg-[#0B1F4B]/95 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <img
              src={currentImage.url}
              alt={property.title}
              className="max-w-full max-h-[90vh] object-contain rounded-xl"
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-6 right-6 text-white text-sm font-bold bg-[#DC1F26] hover:bg-[#B91C1C] px-4 py-2 rounded-full cursor-pointer"
            >
              Close
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
    </div>
  );
};
