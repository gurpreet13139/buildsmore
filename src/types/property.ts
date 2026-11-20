/**
 * BUILDsmore Luxury Real Estate Platform
 * Core TypeScript Data Definitions
 */

export type PropertyCategory = 'Residential' | 'Commercial' | 'Plots/Land' | 'New Projects';

export type PropertyType = 
  | 'Villa'
  | 'Penthouse'
  | 'Chalet'
  | 'Mansion'
  | 'Historic Estate'
  | 'Waterfront Sanctuary'
  | 'Office Tower'
  | 'Retail Landmark'
  | 'Development Parcel';

export type PropertyStatus = 'Published' | 'Draft' | 'Under Offer' | 'Sold';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'AED' | 'INR';

export type PropertyImageOrigin =
  | 'manual'
  | 'wp_featured'
  | 'wp_scraped'
  | 'source_logo'
  | 'fallback';

export interface PropertyImage {
  id: string;
  url: string;
  caption?: string;
  isPrimary: boolean;
  aspectRatio?: string;
  origin?: PropertyImageOrigin;
  isManual?: boolean;
  isLogoFallback?: boolean;
}

export interface PropertyCoordinates {
  lat: number;
  lng: number;
}

export interface PropertySourceMeta {
  type: 'manual' | 'wordpress' | 'csv';
  sourceWebsiteId?: string;
  sourceWebsiteName?: string;
  sourcePropertyId?: string;
  sourceUrl?: string;
  lastSyncedAt?: string;
  checksum?: string;
}

export interface PropertySeo {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  canonicalUrl?: string;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  currency: CurrencyCode;
  category: PropertyCategory;
  propertyType: PropertyType;
  status: PropertyStatus;
  featured: boolean;
  isNewDevelopment: boolean;
  isTrophyHolding?: boolean;
  trophyOrder?: number;
  isLatestAdded?: boolean;
  displayOrder?: number;
  
  // Location
  locationId?: string;
  address: string;
  hasManualAddress?: boolean;
  locality?: string;
  city: string;
  stateRegion: string;
  country: string;
  postalCode?: string;
  coordinates: PropertyCoordinates;
  needsLocationReview?: boolean;

  // Key Specs
  bedrooms: number;
  bathrooms: number;
  interiorAreaSqFt: number;
  areaUnit?: string;
  lotSizeAcres?: number;
  yearBuilt?: number;
  parkingSpaces?: number;
  energyRating?: string;

  // Media
  images: PropertyImage[];
  sourceLogoUrl?: string;
  hasManualMainImage?: boolean;

  // Features, Highlights & Specifications
  highlights?: string[];
  amenities: string[];
  specifications: Record<string, string>;

  // Extended Project & One-Page Importer Fields
  reraNumber?: string;
  developerName?: string;
  possessionYear?: string;
  projectLandArea?: string;
  originalPriceText?: string;
  contactPhone?: string;
  contactEmail?: string;
  floorPlans?: Array<{ title: string; imageUrl: string }>;
  sourceSections?: Array<{ id: string; title: string; content: string; images?: string[] }>;

  // SEO & Source Tracking
  seo: PropertySeo;
  source: PropertySourceMeta;

  createdAt: string;
  updatedAt: string;
}

export interface CuratedCollection {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  coverImageUrl: string;
  status: 'Published' | 'Draft';
  displayOrder: number;
  propertyIds: string[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export type WebsiteImportStatus = 
  | 'Pending'
  | 'Scanning'
  | 'Imported'
  | 'Partial'
  | 'Failed'
  | 'Needs Review';

export interface ExtractedWebsiteData {
  sourceUrl: string;
  sourceType: 'wordpress_rest' | 'wordpress_elementor_html' | 'custom_html';
  wpJsonEndpoint?: string;
  title: string;
  subtitle?: string;
  description: string;
  developer?: string;
  reraNumber?: string;
  category: PropertyCategory;
  propertyType: PropertyType;
  price?: number;
  originalPriceText?: string;
  currency: CurrencyCode;
  priceInInr?: number;
  exchangeRateUsed?: number;
  address: string;
  city: string;
  stateRegion: string;
  country: string;
  phone?: string;
  email?: string;
  bedrooms?: number;
  bathrooms?: number;
  interiorAreaSqFt?: number;
  landArea?: string;
  possessionYear?: string;
  amenities: string[];
  specifications: Record<string, string>;
  images: PropertyImage[];
  sourceLogoUrl?: string;
  floorPlans: Array<{ title: string; imageUrl: string }>;
  sections: Array<{ id: string; title: string; content: string; images?: string[] }>;
  extractionConfidence: {
    title: boolean;
    price: boolean;
    location: boolean;
    images: boolean;
    rera: boolean;
    developer: boolean;
    amenities: boolean;
  };
  warnings: string[];
  scannedAt: string;
}

export interface WebsiteImportTask {
  id: string;
  url: string;
  normalizedUrl: string;
  status: WebsiteImportStatus;
  statusMessage?: string;
  error?: string;
  data?: ExtractedWebsiteData;
  createdPropertyId?: string;
  createdAt: string;
  updatedAt: string;
  diffAction?: 'create' | 'update' | 'skip_identical' | 'needs_review';
}

export type InquiryStatus = 'New' | 'Contacted' | 'In Negotiation' | 'Closed' | 'Archived';

export interface Inquiry {
  id: string;
  propertyId?: string;
  propertyTitle?: string;
  propertySlug?: string;
  clientName: string;
  email: string;
  phone: string;
  preferredContactMethod: 'email' | 'phone' | 'whatsapp';
  investmentBudget?: string;
  scheduledTourDate?: string;
  message: string;
  status: InquiryStatus;
  notes: string;
  createdAt: string;
  assignedAdvisor?: string;
}

export interface WordPressFieldMapping {
  titleField: string;
  descriptionField: string;
  priceField: string;
  currencyField: string;
  addressField: string;
  cityField: string;
  categoryField: string;
  bedroomsField: string;
  bathroomsField: string;
  areaField: string;
  imageField: string;
  customFields?: Record<string, string>;
}

export interface WordPressSource {
  id: string;
  name: string;
  siteUrl: string;
  restApiEndpoint: string;
  postType: string;
  status: 'Active' | 'Paused' | 'Error';
  authType: 'none' | 'basic' | 'bearer';
  apiKey?: string;
  lastSyncAt?: string;
  propertyCount: number;
  fieldMapping: WordPressFieldMapping;
  syncPolicy: 'preserve_central' | 'update_existing' | 'dry_run_only';
  autoSyncEnabled: boolean;
  syncIntervalHours: number;
  description?: string;
}

export interface ImportLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  recordId?: string;
  details?: Record<string, unknown>;
}

export interface ImportDiffRecord {
  sourceId: string;
  title: string;
  action: 'create' | 'update' | 'skip_identical' | 'stale_source' | 'error';
  price: number;
  currency: CurrencyCode;
  category: PropertyCategory;
  diffSummary?: string[];
  error?: string;
  data?: Partial<Property>;
}

export interface ImportJob {
  id: string;
  sourceWebsiteId?: string;
  sourceName: string;
  type: 'wordpress' | 'csv';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Failed';
  isDryRun: boolean;
  totalRecords: number;
  processedRecords: number;
  newRecords: number;
  updatedRecords: number;
  duplicateRecords: number;
  failedRecords: number;
  startedAt: string;
  completedAt?: string;
  logs: ImportLog[];
  reportSummary?: string;
  diffPreview?: ImportDiffRecord[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'SuperAdmin' | 'PortfolioDirector' | 'Analyst';
  avatar?: string;
  lastLoginAt: string;
}

export interface DashboardStats {
  totalProperties: number;
  publishedProperties: number;
  draftProperties: number;
  importedProperties: number;
  totalInquiries: number;
  newInquiriesCount: number;
  portfolioValueUSD: number;
  portfolioValueINR: number;
  connectedWordpressSites: number;
  totalLocations?: number;
}

export interface ManagedLocation {
  id: string;
  name: string;
  slug: string;
  stateRegion?: string;
  country?: string;
  aliases?: string[];
  displayOrder: number;
  isActive: boolean;
  propertyCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type BlogStatus = 'Published' | 'Draft';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  featuredImage: string;
  featuredImageAlt?: string;
  authorName: string;
  authorRole?: string;
  status: BlogStatus;
  featured?: boolean;
  readTimeMinutes?: number;
  seo?: PropertySeo;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeroSlide {
  id: string;
  imageUrl: string;
  heading: string;
  description: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}


