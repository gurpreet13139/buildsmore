import React, { useState } from 'react';
import { Property, PropertyCategory, PropertyType, PropertyStatus, CurrencyCode, PropertyImage } from '../../types/property';
import { X, Save, Plus, Trash2, Image as ImageIcon, Star, MapPin, Tag, Upload, Sparkles, RefreshCw, Layers, ShieldCheck, AlertCircle } from 'lucide-react';
import { storage } from '../../services/storage';
import { getPrimaryPropertyImage, isLogoFallbackImage, isManualPropertyImage } from '../../utils/propertyImages';

interface PropertyFormModalProps {
  property?: Property | null;
  initialTab?: 'basics' | 'location' | 'media' | 'specs' | 'seo';
  isOpen: boolean;
  onClose: () => void;
  onSave: (property: Property) => Promise<void> | void;
}

export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  property,
  initialTab = 'basics',
  isOpen,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(property);

  const [activeTab, setActiveTab] = useState<'basics' | 'location' | 'media' | 'specs' | 'seo'>(initialTab);

  // Form State
  const [title, setTitle] = useState(property?.title || '');
  const [slug, setSlug] = useState(property?.slug || '');
  const [subtitle, setSubtitle] = useState(property?.subtitle || '');
  const [description, setDescription] = useState(property?.description || '');
  const [price, setPrice] = useState<number>(property?.price || 120000000);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [category, setCategory] = useState<PropertyCategory>(property?.category || 'Residential');
  const [propertyType, setPropertyType] = useState<PropertyType>(property?.propertyType || 'Villa');
  const [status, setStatus] = useState<PropertyStatus>(property?.status || 'Published');
  const [featured, setFeatured] = useState<boolean>(property?.featured || false);
  const [isTrophyHolding, setIsTrophyHolding] = useState<boolean>(property?.isTrophyHolding || false);
  const [trophyOrder, setTrophyOrder] = useState<number>(property?.trophyOrder || 1);
  const [isLatestAdded, setIsLatestAdded] = useState<boolean>(property?.isLatestAdded !== undefined ? property.isLatestAdded : true);
  const [displayOrder, setDisplayOrder] = useState<number>(property?.displayOrder || 0);
  const [isNewDevelopment, setIsNewDevelopment] = useState<boolean>(property?.isNewDevelopment || false);

  // Location
  const managedLocations = storage.getLocations(false);
  const [locationId, setLocationId] = useState<string>(() => {
    if (property?.locationId) return property.locationId;
    if (property?.city) {
      const match = storage.findMatchingLocation(property.city, property.address, property.locality);
      if (match) return match.id;
    }
    const def = storage.getLocations(false)[0];
    return def ? def.id : '';
  });
  const [address, setAddress] = useState(property?.address || '');
  const [locality, setLocality] = useState(property?.locality || '');
  const [city, setCity] = useState(property?.city || 'Chandigarh');
  const [stateRegion, setStateRegion] = useState(property?.stateRegion || 'Punjab / Tricity');
  const [country, setCountry] = useState(property?.country || 'India');
  const [lat, setLat] = useState<number>(property?.coordinates?.lat || 30.7333);
  const [lng, setLng] = useState<number>(property?.coordinates?.lng || 76.7794);

  // Specs
  const [bedrooms, setBedrooms] = useState<number>(property?.bedrooms || 4);
  const [bathrooms, setBathrooms] = useState<number>(property?.bathrooms || 5);
  const [interiorAreaSqFt, setInteriorAreaSqFt] = useState<number>(property?.interiorAreaSqFt || 6500);
  const [areaUnit, setAreaUnit] = useState<string>(property?.areaUnit || 'sq ft');
  const [lotSizeAcres, setLotSizeAcres] = useState<number>(property?.lotSizeAcres || 0.5);
  const [yearBuilt, setYearBuilt] = useState<number>(property?.yearBuilt || 2025);
  const [parkingSpaces, setParkingSpaces] = useState<number>(property?.parkingSpaces || 4);
  const [energyRating, setEnergyRating] = useState<string>(property?.energyRating || 'A+');

  // Media
  const [images, setImages] = useState<PropertyImage[]>(
    property?.images && property.images.length > 0
      ? property.images
      : [
          {
            id: `img-${Date.now()}`,
            url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
            caption: 'Primary Facade',
            isPrimary: true,
            origin: 'fallback',
          },
        ]
  );
  const [hasManualMainImage, setHasManualMainImage] = useState<boolean>(
    Boolean(property?.hasManualMainImage || property?.images?.some(img => isManualPropertyImage(img)))
  );
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Highlights
  const [highlights, setHighlights] = useState<string[]>(
    property?.highlights || [
      'Prime Landmark Location',
      '100% Verified Legal Title',
      'Exclusive Private Access',
    ]
  );
  const [newHighlight, setNewHighlight] = useState('');

  // Amenities
  const [amenities, setAmenities] = useState<string[]>(
    property?.amenities || [
      'Private Swimming Pool',
      'Panoramic Vistas',
      'Wine Cellar',
      'Subterranean Parking',
      'Smart Home Automation',
    ]
  );
  const [newAmenity, setNewAmenity] = useState('');

  // Specifications Key-Values
  const [specs, setSpecs] = useState<Array<{ key: string; val: string }>>(
    property?.specifications
      ? Object.entries(property.specifications).map(([key, val]) => ({ key, val }))
      : [
          { key: 'Architectural Style', val: 'Contemporary Minimalist' },
          { key: 'Structural System', val: 'Post-Tensioned Concrete & Steel' },
          { key: 'Ceiling Height', val: '3.8m Clear' },
        ]
  );
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecVal, setNewSpecVal] = useState('');

  // SEO
  const [metaTitle, setMetaTitle] = useState(property?.seo?.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(property?.seo?.metaDescription || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateSlug = () => {
    const generated = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setSlug(generated || `property-${Date.now()}`);
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMainImage(true);
    setUploadError(null);
    try {
      const url = await storage.uploadPhoto(file);
      const manualCover: PropertyImage = {
        id: `img-custom-${Date.now()}`,
        url,
        caption: `${title || property?.title || 'Property'} - Primary Cover`,
        isPrimary: true,
        origin: 'manual',
        isManual: true,
        isLogoFallback: false,
      };
      setImages(prev => [
        manualCover,
        ...prev.filter(img => img.url !== url).map(img => ({ ...img, isPrimary: false })),
      ]);
      setHasManualMainImage(true);
    } catch (err: any) {
      setUploadError(err.message || 'Main image upload failed');
    } finally {
      setUploadingMainImage(false);
      e.target.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setUploadingPhotos(true);
    setUploadError(null);
    try {
      const urls = await storage.uploadMultiplePhotos(files);
      const onlyLogoOrEmpty = images.length === 0 || images.every(img => isLogoFallbackImage(img, property || undefined));
      const newImgs: PropertyImage[] = urls.map((url, idx) => ({
        id: `img-custom-${Date.now()}-${idx}`,
        url,
        caption: `Gallery Photo ${images.length + idx + 1}`,
        isPrimary: onlyLogoOrEmpty && idx === 0,
        origin: 'manual',
        isManual: true,
        isLogoFallback: false,
      }));
      setImages(prev => {
        if (onlyLogoOrEmpty) {
          return [...newImgs, ...prev.map(p => ({ ...p, isPrimary: false }))];
        }
        return [...prev, ...newImgs];
      });
      if (onlyLogoOrEmpty) {
        setHasManualMainImage(true);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Photo upload failed');
    } finally {
      setUploadingPhotos(false);
      e.target.value = '';
    }
  };

  const handleAddHighlight = () => {
    if (!newHighlight.trim()) return;
    if (!highlights.includes(newHighlight.trim())) {
      setHighlights(prev => [...prev, newHighlight.trim()]);
    }
    setNewHighlight('');
  };

  const handleRemoveHighlight = (item: string) => {
    setHighlights(prev => prev.filter(h => h !== item));
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    const onlyLogoOrEmpty = images.length === 0 || images.every(img => isLogoFallbackImage(img, property || undefined));
    const addedImg: PropertyImage = {
      id: `img-custom-${Date.now()}`,
      url: newImageUrl.trim(),
      caption: newImageCaption.trim() || 'Residence View',
      isPrimary: onlyLogoOrEmpty,
      origin: 'manual',
      isManual: true,
      isLogoFallback: false,
    };
    setImages(prev => (onlyLogoOrEmpty ? [addedImg, ...prev.map(i => ({ ...i, isPrimary: false }))] : [...prev, addedImg]));
    if (onlyLogoOrEmpty) setHasManualMainImage(true);
    setNewImageUrl('');
    setNewImageCaption('');
  };

  const handleRemoveImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (filtered.length > 0 && !filtered.some(img => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      setHasManualMainImage(filtered.some(img => isManualPropertyImage(img) && img.isPrimary));
      return filtered;
    });
  };

  const handleSetPrimaryImage = (id: string) => {
    setImages(prev => {
      const selected = prev.find(img => img.id === id);
      if (!selected) return prev;
      const updatedSelected: PropertyImage = {
        ...selected,
        isPrimary: true,
        isManual: true,
        origin: 'manual',
        isLogoFallback: false,
      };
      return [
        updatedSelected,
        ...prev.filter(img => img.id !== id).map(img => ({ ...img, isPrimary: false })),
      ];
    });
    setHasManualMainImage(true);
  };

  const handleAddAmenity = () => {
    if (!newAmenity.trim()) return;
    if (!amenities.includes(newAmenity.trim())) {
      setAmenities(prev => [...prev, newAmenity.trim()]);
    }
    setNewAmenity('');
  };

  const handleRemoveAmenity = (item: string) => {
    setAmenities(prev => prev.filter(a => a !== item));
  };

  const handleAddSpec = () => {
    if (!newSpecKey.trim() || !newSpecVal.trim()) return;
    setSpecs(prev => [...prev, { key: newSpecKey.trim(), val: newSpecVal.trim() }]);
    setNewSpecKey('');
    setNewSpecVal('');
  };

  const handleRemoveSpec = (idx: number) => {
    setSpecs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);

    const specRecord: Record<string, string> = {};
    specs.forEach(s => {
      if (s.key.trim()) specRecord[s.key.trim()] = s.val.trim();
    });

    const finalSlug = (slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) || `property-${Date.now()}`;

    const saved: Property = {
      id: property?.id || `prop-${Date.now()}`,
      slug: finalSlug,
      title: title.trim(),
      subtitle: subtitle.trim() || `${bedrooms} Bedroom ${category} in ${city}`,
      description: description.trim(),
      price: Number(price),
      currency: 'INR',
      category,
      propertyType,
      status,
      featured,
      isTrophyHolding,
      trophyOrder: isTrophyHolding ? Number(trophyOrder) : undefined,
      isLatestAdded,
      displayOrder: Number(displayOrder) || 0,
      isNewDevelopment,
      locationId: locationId || undefined,
      address: address.trim(),
      locality: locality.trim() || undefined,
      city: city.trim(),
      stateRegion: stateRegion.trim(),
      country: country.trim(),
      coordinates: { lat: Number(lat), lng: Number(lng) },
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      interiorAreaSqFt: Number(interiorAreaSqFt),
      areaUnit,
      lotSizeAcres: Number(lotSizeAcres) || undefined,
      yearBuilt: Number(yearBuilt) || undefined,
      parkingSpaces: Number(parkingSpaces) || undefined,
      energyRating,
      images,
      sourceLogoUrl: property?.sourceLogoUrl,
      hasManualMainImage,
      highlights,
      amenities,
      specifications: specRecord,
      seo: {
        metaTitle: metaTitle.trim() || `${title} – BUILDsmore Luxury Real Estate`,
        metaDescription: metaDescription.trim() || description.slice(0, 150),
        keywords: [locality, city, country, category].filter(Boolean) as string[],
      },
      source: property?.source || {
        type: 'manual',
        lastSyncedAt: new Date().toISOString(),
      },
      createdAt: property?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await onSave(saved);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save property changes to server.';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#101419] border border-[#2b3543] text-[#f7f5f2] rounded-sm shadow-2xl flex flex-col max-h-[90vh] my-6">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#141a22] border-b border-[#242c38] shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block">
              Portfolio Management
            </span>
            <h2 className="font-serif text-xl font-medium text-white">
              {isEditing ? `Edit: ${property?.title}` : 'Register New Luxury Property'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#8a909a] hover:text-[#f7f5f2] rounded-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-[#12161d] border-b border-[#202732] shrink-0 text-xs font-mono uppercase">
          {[
            { id: 'basics', label: '1. Core Details' },
            { id: 'location', label: '2. Location' },
            { id: 'media', label: '3. Imagery' },
            { id: 'specs', label: '4. Specs & Amenities' },
            { id: 'seo', label: '5. SEO & Meta' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#c5a059] text-[#c5a059] font-bold'
                  : 'border-transparent text-[#8a909a] hover:text-[#f7f5f2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body Scroll Area */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          
          {/* TAB 1: Core Details */}
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Property Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. The Imperial Residence"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-sm text-[#f7f5f2] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono text-[#8a909a] uppercase block">
                      Unique Slug *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSlug}
                      className="text-[10px] text-[#c5a059] hover:underline flex items-center gap-1 cursor-pointer font-mono"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> Auto-Fill
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="the-imperial-residence"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  Subtitle / Architectural Headline
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Master-Crafted Triplex Penthouse Overlooking Sukhna Lake Enclave"
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Price in INR (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c5a059] font-mono font-bold">₹</span>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      placeholder="120000000"
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm pl-7 pr-3 py-2 text-xs text-[#f7f5f2] font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Registry Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PropertyStatus)}
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                  >
                    <option value="Published">Published (Public)</option>
                    <option value="Draft">Draft (Private)</option>
                    <option value="Under Offer">Under Offer</option>
                    <option value="Sold">Sold / Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Asset Class Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PropertyCategory)}
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Plots/Land">Plots/Land</option>
                    <option value="New Projects">New Projects</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Property Architectural Type
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                  >
                    <option value="Villa">Villa</option>
                    <option value="Penthouse">Penthouse</option>
                    <option value="Chalet">Chalet</option>
                    <option value="Mansion">Mansion</option>
                    <option value="Historic Estate">Historic Estate</option>
                    <option value="Office Tower">Office Tower</option>
                    <option value="Retail Landmark">Retail Landmark</option>
                    <option value="Development Parcel">Development Parcel</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  Comprehensive Description *
                </label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail architectural concept, materials, master planning, views, and covenants..."
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm p-3 text-xs text-[#f7f5f2] focus:outline-none leading-relaxed"
                />
              </div>

              {/* Status and Flags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 bg-[#141922] p-3 rounded-sm border border-[#202732]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="accent-[#c5a059] rounded"
                  />
                  <span className="text-white">Featured Asset</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLatestAdded}
                    onChange={(e) => setIsLatestAdded(e.target.checked)}
                    className="accent-[#c5a059] rounded"
                  />
                  <span className="text-white">Latest Added</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTrophyHolding}
                    onChange={(e) => setIsTrophyHolding(e.target.checked)}
                    className="accent-[#c5a059] rounded"
                  />
                  <span className="text-[#c5a059] font-medium">Trophy Holdings</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNewDevelopment}
                    onChange={(e) => setIsNewDevelopment(e.target.checked)}
                    className="accent-[#c5a059] rounded"
                  />
                  <span className="text-white">New Project</span>
                </label>
              </div>

              {isTrophyHolding && (
                <div className="p-3 bg-[#171f2b] border border-[#c5a059]/40 rounded-sm flex items-center justify-between gap-4">
                  <div className="text-xs text-[#c5a059]">
                    <span className="font-semibold block">Trophy Holdings of the Season</span>
                    <span className="text-[11px] text-[#8a909a]">This asset will appear in the curated marquee homepage section.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#8a909a]">Priority Order:</span>
                    <input
                      type="number"
                      value={trophyOrder}
                      onChange={(e) => setTrophyOrder(Number(e.target.value))}
                      className="w-16 bg-[#12161d] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-2 py-1 text-xs text-[#f7f5f2] font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Location */}
          {activeTab === 'location' && (
            <div className="space-y-4">
              
              {/* Admin-Managed Location Selector */}
              <div className="p-3.5 bg-[#141922] border border-[#c5a059]/40 rounded-sm space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[#c5a059] uppercase block font-semibold text-xs flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Admin-Managed Location *
                  </label>
                  <span className="text-[10px] text-[#8a909a] font-mono">
                    Dynamic Master Dropdown
                  </span>
                </div>
                <select
                  value={locationId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setLocationId(selId);
                    const selectedLoc = managedLocations.find(l => l.id === selId);
                    if (selectedLoc) {
                      setCity(selectedLoc.name);
                      if (selectedLoc.stateRegion) setStateRegion(selectedLoc.stateRegion);
                      if (selectedLoc.country) setCountry(selectedLoc.country);
                    }
                  }}
                  required
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Admin Location --</option>
                  {managedLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.stateRegion ? `(${loc.stateRegion})` : ''} - {loc.country || 'India'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#8a909a] pt-1">
                  Properties linked to this location automatically show up under that location's public tab on Homepage & Category pages.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Street Address / Estate Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 14 Himalayan Boulevard, Sector 8"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Locality / Sector / Neighborhood *
                  </label>
                  <input
                    type="text"
                    required
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Sector 8 / Sukhna Lake Enclave"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Chandigarh / Mohali / Mumbai"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">State / Region</label>
                  <input
                    type="text"
                    value={stateRegion}
                    onChange={(e) => setStateRegion(e.target.value)}
                    placeholder="e.g. Punjab / Chandigarh Tricity"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. India"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(Number(e.target.value))}
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Media & Photos */}
          {activeTab === 'media' && (() => {
            const resolvedPrimary = getPrimaryPropertyImage({
              ...property,
              title: title || property?.title,
              images,
              hasManualMainImage,
              sourceLogoUrl: property?.sourceLogoUrl,
            });
            return (
            <div className="space-y-6">

              {/* Dedicated Main Cover Image Override Panel */}
              <div className="p-5 bg-[#121821] border border-[#c5a059]/40 rounded-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-28 h-20 rounded-sm overflow-hidden border border-[#2a3442] shrink-0 flex items-center justify-center ${
                      resolvedPrimary.isLogo ? 'bg-[#0b0f14] p-2' : 'bg-[#161c24]'
                    }`}>
                      {resolvedPrimary.url ? (
                        <img
                          src={resolvedPrimary.url}
                          alt={title || 'Primary Cover'}
                          className={`w-full h-full ${resolvedPrimary.isLogo ? 'object-contain' : 'object-cover'}`}
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-[#64748b]" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-mono text-[#c5a059] uppercase font-semibold text-xs">
                          Main Cover Image
                        </h4>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm uppercase flex items-center gap-1 ${
                          hasManualMainImage
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            : resolvedPrimary.isLogo
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                            : 'bg-[#1a222d] text-[#cbd5e1] border border-[#2b3544]'
                        }`}>
                          {hasManualMainImage && <ShieldCheck className="w-3 h-3" />}
                          <span>
                            {hasManualMainImage
                              ? 'Manual Override (Locked on Sync)'
                              : resolvedPrimary.isLogo
                              ? 'Source Website Logo Fallback'
                              : resolvedPrimary.origin === 'wp_featured'
                              ? 'WordPress Featured Photo'
                              : 'Scraped Property Photo'}
                          </span>
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8a909a]">
                        Upload or change the main cover photo here. Manual images always take top priority and are never overwritten by WordPress syncs.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <label className={`inline-flex items-center gap-2 px-4 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm cursor-pointer shadow-sm transition-colors ${uploadingMainImage ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingMainImage ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload / Change Main Image</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleMainImageUpload}
                        className="hidden"
                        disabled={uploadingMainImage}
                      />
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Direct Multi-Photo File Uploader */}
              <div className="p-5 bg-[#141922] border border-[#262f3d] rounded-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-mono text-[#c5a059] uppercase font-semibold text-xs flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      Add Additional Gallery Photos
                    </h4>
                    <p className="text-[11px] text-[#8a909a]">
                      Select multiple photos from your local system (JPG, PNG, WebP) to add to the property gallery.
                    </p>
                  </div>
                  <div>
                    <label className={`inline-flex items-center gap-2 px-4 py-2 bg-[#1e2633] hover:bg-[#c5a059] hover:text-[#0c0f12] text-[#f7f5f2] text-xs font-semibold uppercase tracking-wider rounded-sm cursor-pointer shadow-sm transition-colors ${uploadingPhotos ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingPhotos ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Browse Files</span>
                        </>
                      )}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadingPhotos}
                      />
                    </label>
                  </div>
                </div>

                {uploadError && (
                  <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded border border-red-800/50">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Add Photo via URL */}
              <div className="p-4 bg-[#141922] border border-[#262f3d] rounded-sm space-y-3">
                <h4 className="font-mono text-[#8a909a] uppercase text-[11px]">Or Add Image by URL / CDN Link</h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-7">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... or asset URL"
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={newImageCaption}
                      onChange={(e) => setNewImageCaption(e.target.value)}
                      placeholder="Caption (e.g. Master Living Suite)"
                      className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddImage}
                      className="w-full py-2 bg-[#1e2633] hover:bg-[#c5a059] hover:text-[#0c0f12] font-semibold uppercase tracking-wider rounded-sm cursor-pointer flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add URL
                    </button>
                  </div>
                </div>
              </div>

              {/* Photos Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#8a909a] uppercase block">
                    Configured Gallery Photos ({images.length})
                  </span>
                  <span className="text-[11px] text-[#8a909a]">
                    Click star to set Cover Image
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className={`relative aspect-[4/3] rounded-sm overflow-hidden border-2 bg-[#161c24] group ${
                        img.isPrimary ? 'border-[#c5a059]' : 'border-[#263140]'
                      }`}
                    >
                      <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(img.id)}
                          className={`p-1.5 rounded-sm text-xs cursor-pointer ${
                            img.isPrimary ? 'bg-[#c5a059] text-[#0c0f12]' : 'bg-white/20 text-white hover:bg-[#c5a059]'
                          }`}
                          title="Set as Primary Cover"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.id)}
                          className="p-1.5 bg-red-600/80 text-white rounded-sm hover:bg-red-600 cursor-pointer"
                          title="Delete photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {img.isPrimary && (
                        <span className="absolute top-2 left-2 bg-[#c5a059] text-[#0c0f12] text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm">
                          Primary Cover
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
            );
          })()}

          {/* TAB 4: Specs, Amenities & Highlights */}
          {activeTab === 'specs' && (
            <div className="space-y-6">
              
              {/* Basic Quantities */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Bedrooms</label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    className="w-full bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Bathrooms</label>
                  <input
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    className="w-full bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Interior Area</label>
                  <input
                    type="number"
                    value={interiorAreaSqFt}
                    onChange={(e) => setInteriorAreaSqFt(Number(e.target.value))}
                    className="w-full bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Area Unit</label>
                  <select
                    value={areaUnit}
                    onChange={(e) => setAreaUnit(e.target.value)}
                    className="w-full bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] cursor-pointer"
                  >
                    <option value="sq ft">sq ft</option>
                    <option value="sq yd">sq yd (Gaj)</option>
                    <option value="acres">Acres</option>
                    <option value="sq m">sq m</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Lot Size (Acres)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={lotSizeAcres}
                    onChange={(e) => setLotSizeAcres(Number(e.target.value))}
                    className="w-full bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono"
                  />
                </div>
              </div>

              {/* Property Highlights */}
              <div className="space-y-3 pt-3 border-t border-[#202732]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#c5a059] uppercase block text-xs">
                    Key Architectural Highlights ({highlights.length})
                  </span>
                  <span className="text-[11px] text-[#8a909a]">Shown prominently on detail page</span>
                </div>
                <div className="space-y-1.5">
                  {highlights.map(h => (
                    <div key={h} className="flex items-center justify-between bg-[#141922] px-3 py-1.5 rounded-sm border border-[#222b37]">
                      <span className="text-[#f7f5f2] text-xs">• {h}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(h)}
                        className="text-[#8a909a] hover:text-red-400 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newHighlight}
                    onChange={(e) => setNewHighlight(e.target.value)}
                    placeholder="e.g. Unobstructed Himalayan Foothill Views / Rooftop Helipad..."
                    className="flex-1 bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="px-4 py-1.5 bg-[#1e2633] hover:bg-[#c5a059] hover:text-[#0c0f12] text-xs font-semibold rounded-sm cursor-pointer transition-colors"
                  >
                    Add Highlight
                  </button>
                </div>
              </div>

              {/* Amenities Management */}
              <div className="space-y-3 pt-3 border-t border-[#202732]">
                <span className="font-mono text-[#8a909a] uppercase block">
                  Estate Amenities Multi-Select ({amenities.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {amenities.map(a => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#181f2a] border border-[#263140] rounded-sm text-xs text-[#cbd5e1]"
                    >
                      <span>{a}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAmenity(a)}
                        className="text-[#8a909a] hover:text-red-400 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    placeholder="Add amenity (e.g. Private Helipad, Wine Cellar...)"
                    className="flex-1 bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddAmenity}
                    className="px-4 py-1.5 bg-[#1e2633] hover:bg-[#c5a059] hover:text-[#0c0f12] text-xs font-semibold rounded-sm cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Detailed Specifications Key-Values */}
              <div className="space-y-3 pt-3 border-t border-[#202732]">
                <span className="font-mono text-[#8a909a] uppercase block">
                  Technical Specifications
                </span>
                <div className="space-y-2">
                  {specs.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#141922] p-2 rounded-sm border border-[#222b37]">
                      <span className="font-mono text-[#c5a059] w-1/3 truncate">{s.key}</span>
                      <span className="text-[#f7f5f2] flex-1 truncate">{s.val}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpec(idx)}
                        className="text-[#8a909a] hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                  <input
                    type="text"
                    value={newSpecKey}
                    onChange={(e) => setNewSpecKey(e.target.value)}
                    placeholder="Specification Key (e.g. Ceiling Height)"
                    className="sm:col-span-5 bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newSpecVal}
                    onChange={(e) => setNewSpecVal(e.target.value)}
                    placeholder="Value (e.g. 4.2m Double Height)"
                    className="sm:col-span-5 bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSpec}
                    className="sm:col-span-2 py-1.5 bg-[#1e2633] hover:bg-[#c5a059] hover:text-[#0c0f12] text-xs font-semibold rounded-sm cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: SEO */}
          {activeTab === 'seo' && (
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  Meta Title Tag
                </label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="e.g. Villa Sol de Mar – Port d'Andratx Luxury Real Estate"
                  className="w-full bg-[#181f2a] border border-[#2a3442] rounded-sm px-3 py-2 text-xs text-[#f7f5f2]"
                />
              </div>

              <div>
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  Meta Description
                </label>
                <textarea
                  rows={3}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Summarize key architectural features and price for Google search snippets (120-160 chars)..."
                  className="w-full bg-[#181f2a] border border-[#2a3442] rounded-sm p-3 text-xs text-[#f7f5f2]"
                />
              </div>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-red-950/50 border border-red-700/80 rounded-sm text-xs text-red-200 flex items-start gap-2 font-mono">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#202732]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 bg-[#161c24] hover:bg-[#202732] disabled:opacity-50 text-[#cbd5e1] text-xs uppercase font-medium rounded-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#c5a059] hover:bg-[#d4af5f] disabled:opacity-60 text-[#0c0f12] text-xs uppercase tracking-widest font-semibold rounded-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : (isEditing ? 'Save Revisions' : 'Publish to Registry')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
