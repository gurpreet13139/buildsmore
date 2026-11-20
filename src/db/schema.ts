/**
 * BUILDsmore Luxury Real Estate Platform
 * PostgreSQL Database Schema (Drizzle ORM)
 * Normalized relational design with indexes, constraints, and audit logs.
 */

import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  boolean, 
  integer, 
  numeric, 
  jsonb, 
  index, 
  uuid 
} from 'drizzle-orm/pg-core';

/**
 * Administrators & Team Access Control (RBAC)
 */
export const administrators = pgTable('administrators', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('Analyst'), // SuperAdmin, PortfolioDirector, Analyst
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * WordPress External Source Websites Registry (~60+ sites scaling to 1,000s)
 */
export const sourceWebsites = pgTable('source_websites', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  siteUrl: text('site_url').notNull(),
  restApiEndpoint: varchar('rest_api_endpoint', { length: 255 }).notNull().default('/wp-json/wp/v2/properties'),
  postType: varchar('post_type', { length: 64 }).notNull().default('properties'),
  status: varchar('status', { length: 32 }).notNull().default('Active'), // Active, Paused, Error
  authType: varchar('auth_type', { length: 32 }).notNull().default('none'), // none, basic, bearer
  apiKeyEncrypted: text('api_key_encrypted'),
  fieldMapping: jsonb('field_mapping').notNull(),
  syncPolicy: varchar('sync_policy', { length: 32 }).notNull().default('preserve_central'), // preserve_central, update_existing, dry_run_only
  autoSyncEnabled: boolean('auto_sync_enabled').notNull().default(false),
  syncIntervalHours: integer('sync_interval_hours').notNull().default(12),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  propertyCount: integer('property_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_source_websites_status').on(table.status),
  index('idx_source_websites_autosync').on(table.autoSyncEnabled),
]);

/**
 * Normalized Properties Core Table
 */
export const properties = pgTable('properties', {
  id: varchar('id', { length: 64 }).primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  subtitle: text('subtitle'),
  description: text('description').notNull(),
  price: numeric('price', { precision: 16, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'), // INR, USD, EUR, GBP, AED
  category: varchar('category', { length: 64 }).notNull(), // Residential, Commercial, Plots/Land, New Projects
  propertyType: varchar('property_type', { length: 64 }).notNull(), // Villa, Penthouse, Chalet, Mansion, etc.
  status: varchar('status', { length: 32 }).notNull().default('Draft'), // Published, Draft, Under Offer, Sold
  featured: boolean('featured').notNull().default(false),
  isNewDevelopment: boolean('is_new_development').notNull().default(false),
  
  // Location
  address: text('address').notNull(),
  city: varchar('city', { length: 128 }).notNull(),
  stateRegion: varchar('state_region', { length: 128 }),
  country: varchar('country', { length: 128 }).notNull(),
  postalCode: varchar('postal_code', { length: 32 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),

  // Key Specifications
  bedrooms: integer('bedrooms').notNull().default(0),
  bathrooms: integer('bathrooms').notNull().default(0),
  interiorAreaSqFt: integer('interior_area_sqft').notNull().default(0),
  lotSizeAcres: numeric('lot_size_acres', { precision: 8, scale: 2 }),
  yearBuilt: integer('year_built'),
  parkingSpaces: integer('parking_spaces').default(0),
  energyRating: varchar('energy_rating', { length: 8 }),

  // Amenities & Specs (JSONB for rapid query flexibility)
  amenities: jsonb('amenities').$type<string[]>().notNull().default([]),
  specifications: jsonb('specifications').$type<Record<string, string>>().notNull().default({}),

  // SEO
  seoMetaTitle: varchar('seo_meta_title', { length: 255 }),
  seoMetaDescription: text('seo_meta_description'),
  seoKeywords: jsonb('seo_keywords').$type<string[]>().default([]),

  // Source Provenance Tracking
  sourceType: varchar('source_type', { length: 32 }).notNull().default('manual'), // manual, wordpress, csv
  sourceWebsiteId: varchar('source_website_id', { length: 64 }).references(() => sourceWebsites.id, { onDelete: 'set null' }),
  sourcePropertyId: varchar('source_property_id', { length: 128 }),
  sourceUrl: text('source_url'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_properties_status_category').on(table.status, table.category),
  index('idx_properties_price').on(table.price),
  index('idx_properties_city_country').on(table.city, table.country),
  index('idx_properties_featured').on(table.featured),
  index('idx_properties_source_tracking').on(table.sourceWebsiteId, table.sourcePropertyId),
]);

/**
 * Property Gallery Media
 */
export const propertyImages = pgTable('property_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: varchar('property_id', { length: 64 }).notNull().references(() => properties.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  caption: text('caption'),
  displayOrder: integer('display_order').notNull().default(0),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_property_images_property_id').on(table.propertyId),
]);

/**
 * Inquiries and Private Client Leads
 */
export const inquiries = pgTable('inquiries', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: varchar('property_id', { length: 64 }).references(() => properties.id, { onDelete: 'set null' }),
  clientName: varchar('client_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 64 }).notNull(),
  preferredContactMethod: varchar('preferred_contact_method', { length: 32 }).notNull().default('email'),
  investmentBudget: varchar('investment_budget', { length: 128 }),
  scheduledTourDate: varchar('scheduled_tour_date', { length: 64 }),
  message: text('message').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('New'), // New, Contacted, In Negotiation, Closed, Archived
  notes: text('notes').default(''),
  assignedAdvisor: varchar('assigned_advisor', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_inquiries_status').on(table.status),
  index('idx_inquiries_email').on(table.email),
  index('idx_inquiries_property').on(table.propertyId),
]);

/**
 * Asynchronous Background Import Jobs (WordPress & CSV)
 */
export const importJobs = pgTable('import_jobs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sourceWebsiteId: varchar('source_website_id', { length: 64 }).references(() => sourceWebsites.id, { onDelete: 'set null' }),
  sourceName: varchar('source_name', { length: 255 }).notNull(),
  jobType: varchar('job_type', { length: 32 }).notNull(), // wordpress, csv
  status: varchar('status', { length: 32 }).notNull(), // Pending, In Progress, Completed, Failed
  isDryRun: boolean('is_dry_run').notNull().default(false),
  totalRecords: integer('total_records').notNull().default(0),
  processedRecords: integer('processed_records').notNull().default(0),
  newRecords: integer('new_records').notNull().default(0),
  updatedRecords: integer('updated_records').notNull().default(0),
  duplicateRecords: integer('duplicate_records').notNull().default(0),
  failedRecords: integer('failed_records').notNull().default(0),
  reportSummary: text('report_summary'),
  diffPreview: jsonb('diff_preview'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/**
 * System Audit Logs for Compliance and Security Tracking
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorEmail: varchar('actor_email', { length: 255 }).notNull(),
  action: varchar('action', { length: 128 }).notNull(), // PROPERTY_CREATE, PROPERTY_UPDATE, SYNC_RUN, etc.
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: varchar('entity_id', { length: 128 }).notNull(),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_logs_actor').on(table.actorEmail),
  index('idx_audit_logs_created_at').on(table.createdAt),
]);

/**
 * Editorial Journal & Blog Posts
 */
export const blogs = pgTable('blogs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  excerpt: text('excerpt').notNull().default(''),
  content: text('content').notNull(),
  category: varchar('category', { length: 128 }).notNull().default('Market Intelligence'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  featuredImage: text('featured_image').notNull().default(''),
  featuredImageAlt: varchar('featured_image_alt', { length: 255 }),
  authorName: varchar('author_name', { length: 255 }).notNull().default('BUILDsmore Editorial Desk'),
  authorRole: varchar('author_role', { length: 255 }),
  status: varchar('status', { length: 32 }).notNull().default('Draft'), // Published, Draft
  featured: boolean('featured').notNull().default(false),
  readTimeMinutes: integer('read_time_minutes').notNull().default(1),
  seoMetaTitle: varchar('seo_meta_title', { length: 255 }),
  seoMetaDescription: text('seo_meta_description'),
  seoKeywords: jsonb('seo_keywords').$type<string[]>().default([]),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_blogs_status_published').on(table.status, table.publishedAt),
  index('idx_blogs_category').on(table.category),
]);

/**
 * Homepage Hero Banner Slides
 */
export const heroSlides = pgTable('hero_slides', {
  id: varchar('id', { length: 64 }).primaryKey(),
  imageUrl: text('image_url').notNull().default(''),
  heading: varchar('heading', { length: 255 }).notNull().default(''),
  description: text('description').notNull().default(''),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_hero_slides_display_order').on(table.displayOrder),
]);


