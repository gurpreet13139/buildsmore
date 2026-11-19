-- BUILDsmore Luxury Real Estate Platform
-- Initial PostgreSQL Migration v1.0.0

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Administrators
CREATE TABLE IF NOT EXISTS administrators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Analyst',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WordPress Source Websites
CREATE TABLE IF NOT EXISTS source_websites (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  site_url TEXT NOT NULL,
  rest_api_endpoint VARCHAR(255) NOT NULL DEFAULT '/wp-json/wp/v2/properties',
  post_type VARCHAR(64) NOT NULL DEFAULT 'properties',
  status VARCHAR(32) NOT NULL DEFAULT 'Active',
  auth_type VARCHAR(32) NOT NULL DEFAULT 'none',
  api_key_encrypted TEXT,
  field_mapping JSONB NOT NULL,
  sync_policy VARCHAR(32) NOT NULL DEFAULT 'preserve_central',
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sync_interval_hours INTEGER NOT NULL DEFAULT 12,
  last_sync_at TIMESTAMPTZ,
  property_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_websites_status ON source_websites(status);
CREATE INDEX IF NOT EXISTS idx_source_websites_autosync ON source_websites(auto_sync_enabled);

-- 3. Core Properties
CREATE TABLE IF NOT EXISTS properties (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL,
  price NUMERIC(16, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  category VARCHAR(64) NOT NULL,
  property_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Draft',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_new_development BOOLEAN NOT NULL DEFAULT FALSE,
  address TEXT NOT NULL,
  city VARCHAR(128) NOT NULL,
  state_region VARCHAR(128),
  country VARCHAR(128) NOT NULL,
  postal_code VARCHAR(32),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  interior_area_sqft INTEGER NOT NULL DEFAULT 0,
  lot_size_acres NUMERIC(8, 2),
  year_built INTEGER,
  parking_spaces INTEGER DEFAULT 0,
  energy_rating VARCHAR(8),
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo_meta_title VARCHAR(255),
  seo_meta_description TEXT,
  seo_keywords JSONB DEFAULT '[]'::jsonb,
  source_type VARCHAR(32) NOT NULL DEFAULT 'manual',
  source_website_id VARCHAR(64) REFERENCES source_websites(id) ON DELETE SET NULL,
  source_property_id VARCHAR(128),
  source_url TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_status_category ON properties(status, category);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_city_country ON properties(city, country);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(featured);
CREATE INDEX IF NOT EXISTS idx_properties_source_tracking ON properties(source_website_id, source_property_id);

-- 4. Property Images
CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id VARCHAR(64) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);

-- 5. Inquiries
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  preferred_contact_method VARCHAR(32) NOT NULL DEFAULT 'email',
  investment_budget VARCHAR(128),
  scheduled_tour_date VARCHAR(64),
  message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'New',
  notes TEXT DEFAULT '',
  assigned_advisor VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_email ON inquiries(email);

-- 6. Import Jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id VARCHAR(64) PRIMARY KEY,
  source_website_id VARCHAR(64) REFERENCES source_websites(id) ON DELETE SET NULL,
  source_name VARCHAR(255) NOT NULL,
  job_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  is_dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  new_records INTEGER NOT NULL DEFAULT 0,
  updated_records INTEGER NOT NULL DEFAULT 0,
  duplicate_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  report_summary TEXT,
  diff_preview JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 7. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_email VARCHAR(255) NOT NULL,
  action VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 8. Editorial Journal & Blog Posts
CREATE TABLE IF NOT EXISTS blogs (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  category VARCHAR(128) NOT NULL DEFAULT 'Market Intelligence',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured_image TEXT NOT NULL DEFAULT '',
  featured_image_alt VARCHAR(255),
  author_name VARCHAR(255) NOT NULL DEFAULT 'BUILDsmore Editorial Desk',
  author_role VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'Draft',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  read_time_minutes INTEGER NOT NULL DEFAULT 1,
  seo_meta_title VARCHAR(255),
  seo_meta_description TEXT,
  seo_keywords JSONB DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blogs_status_published ON blogs(status, published_at);
CREATE INDEX IF NOT EXISTS idx_blogs_category ON blogs(category);

