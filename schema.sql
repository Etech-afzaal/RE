-- Run this once against your MySQL database (e.g. `mysql -u root -p real_estate < schema.sql`)
-- Phase 1 foundation: agent profile fields + property approval workflow statuses.

CREATE DATABASE IF NOT EXISTS real_estate CHARACTER SET utf8mb4;
USE real_estate;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Requests submitted via the public "Sign up as agent" form.
-- Nothing here can log in yet — this is just a request for admin to review.
CREATE TABLE IF NOT EXISTS signup_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  estate_name VARCHAR(30) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  licence_number VARCHAR(25) NULL,
  message TEXT,
  status ENUM('pending','approved','rejected','revoked') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- All authenticated accounts. Agents and superadmins share this source.
-- There is no separate agents table — agent rows are users with user_type='agent'.
--
-- Branding fields (agents only in practice):
--   estate_name  — public URL identity (/re/{estate_name}); NULL for superadmins
--   username     — optional public handle (legacy; often equals estate_name)
--   company_name — display branding / watermark text
--   company_logo — brand logo
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estate_name VARCHAR(30) UNIQUE NULL,             -- URL slug; required for agents, NULL for superadmins
  username VARCHAR(100) UNIQUE,                    -- optional public handle (kept for compatibility)
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  profile_image VARCHAR(500) NULL,
  company_logo VARCHAR(500) NULL,                  -- Agent brand logo
  company_name VARCHAR(255) NULL,                  -- Display brand / watermark (not the URL slug)
  description TEXT NULL,
  areas_served VARCHAR(500) NULL,
  office_address VARCHAR(500) NULL,                -- Company branding
  social_links VARCHAR(1000) NULL,                 -- Company branding (URLs)
  website_listing_preferences JSON NULL,           -- Agent public website category visibility
  password_hash VARCHAR(255) NOT NULL,
  user_type ENUM('superadmin','agent') NOT NULL DEFAULT 'agent',
  must_reset_password BOOLEAN DEFAULT TRUE,
  -- pending | approved | rejected | disabled | blocked
  status ENUM('pending','approved','rejected','disabled','blocked') DEFAULT 'approved',
  blocked_reason TEXT NULL,                  -- required when permanently blocked
  blocked_at DATETIME NULL,
  blocked_by VARCHAR(100) NULL,              -- admin identifier
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  size_value DECIMAL(10,2),
  size_unit ENUM('marla','kanal','sqft') DEFAULT 'marla',
  price DECIMAL(15,2),
  price_currency ENUM('PKR','USD') NOT NULL DEFAULT 'PKR', -- amount is stored as-entered; no conversion
  location VARCHAR(255),                           -- denormalized display: "{area} {phase}, {city}"
  -- Workflow: draft → pending_approval → approved | rejected; approved → under_contract → sold
  status ENUM('draft','pending_approval','approved','rejected','under_contract','sold') NOT NULL DEFAULT 'draft',
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,        -- independent public-listing visibility
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,       -- agent homepage hero (max 10 approved per agent)
  submitted_at DATETIME NULL,                      -- set when the agent submits for review
  approved_by VARCHAR(100) NULL,                   -- admin identifier (env admin has no users row)
  approved_at DATETIME NULL,
  rejected_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  property_data JSON NULL,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS property_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,          -- watermarked, public-facing
  category VARCHAR(100) NULL,               -- room/area label, e.g. master_bedroom or custom "Swimming Pool"
  is_featured BOOLEAN DEFAULT FALSE,       -- marked as the main image for the property page
  hero_display ENUM('yes','no') NOT NULL DEFAULT 'no',  -- shown on Property Details hero (multiple allowed)
  sort_order INT DEFAULT 0,                -- display order within the gallery
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Optional walkthrough videos (max 5 per property in the add flow).
-- Source of truth for property videos; do not store video URLs on properties.
CREATE TABLE IF NOT EXISTS property_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  video_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500) NULL,         -- poster frame for lazy-loaded players
  category VARCHAR(100) NULL,               -- same room/area labels as property_images
  is_featured BOOLEAN DEFAULT FALSE,       -- main walkthrough for the property page
  display_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX idx_properties_agent ON properties(agent_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_agent_featured ON properties(agent_id, is_featured, status);

-- Platform audit trail (superadmin Logs page + Overview recent activities).
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id INT NULL,
  description TEXT NOT NULL,
  metadata JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- Customer inquiries sent from agent websites / property pages (email + future leads inbox).
CREATE TABLE IF NOT EXISTS customer_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  property_id INT NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NULL,
  message TEXT NOT NULL,
  page_url VARCHAR(500) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
);

CREATE INDEX idx_customer_inquiries_agent ON customer_inquiries(agent_id);
CREATE INDEX idx_customer_inquiries_property ON customer_inquiries(property_id);
CREATE INDEX idx_customer_inquiries_created ON customer_inquiries(created_at);
CREATE INDEX idx_images_property ON property_images(property_id);
CREATE INDEX idx_images_category ON property_images(property_id, category);
CREATE INDEX idx_videos_property ON property_videos(property_id);
CREATE INDEX idx_videos_category ON property_videos(property_id, category);

-- Agent-authored blog articles shown on the agent public website.
-- Mirrors the properties ownership model; only `published` blogs are public.
CREATE TABLE IF NOT EXISTS blogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  short_description VARCHAR(500) NULL,
  content LONGTEXT NULL,
  cover_image VARCHAR(500) NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_blogs_agent_slug (agent_id, slug),
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- dummy data

CREATE INDEX idx_blogs_agent ON blogs(agent_id);
CREATE INDEX idx_blogs_status ON blogs(status);
CREATE INDEX idx_blogs_agent_status ON blogs(agent_id, status);

-- Agent-authored video posts shown on the agent public website.
-- Mirrors the blogs ownership model; only `published` videos are public.
-- Video file + thumbnail are generated server-side via ffmpeg.
CREATE TABLE IF NOT EXISTS video_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT NULL,
  video_url VARCHAR(500) NULL,
  thumbnail_url VARCHAR(500) NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_video_posts_agent_slug (agent_id, slug),
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_video_posts_agent ON video_posts(agent_id);
CREATE INDEX idx_video_posts_status ON video_posts(status);
CREATE INDEX idx_video_posts_agent_status ON video_posts(agent_id, status);

-- Agent files updates — a SINGLE live market/file price update page per agent.
-- One row per agent (UNIQUE on agent_id). Content stores sanitized HTML from
-- the dashboard WYSIWYG editor (headings, paragraphs, lists, tables, images).
-- Only `published` content is visible on the public website.
CREATE TABLE IF NOT EXISTS agent_files_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_agent_files_updates_agent (agent_id),
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_files_updates_status ON agent_files_updates(status);

-- Demo / realistic listings live in seed.sql (agent users, sale/rent/plot properties, images).
-- ---------------------------------------------------------------
-- Ads Network (existing databases: npm run migrate:ads-network)
-- All DATETIME columns on ads/ad_events are stored in UTC.
-- ---------------------------------------------------------------

-- Sizes/formats the customer side can request, e.g. "leaderboard_728x90".
CREATE TABLE IF NOT EXISTS ad_formats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  format_type ENUM('banner','native','sidebar','popup') NOT NULL DEFAULT 'banner',
  width SMALLINT UNSIGNED NOT NULL,
  height SMALLINT UNSIGNED NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,             -- inactive formats never serve
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,                -- internal name, never shown to customers
  tier ENUM('paid','free') NOT NULL,          -- paid always beats free
  status ENUM('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
  format_id INT NOT NULL,
  property_id INT NULL,                       -- optional linked property
  image_url VARCHAR(500) NULL,                -- uploaded creative; falls back to property image
  headline VARCHAR(120) NULL,
  alt_text VARCHAR(255) NULL,
  cta_text VARCHAR(40) NULL,
  click_url VARCHAR(500) NULL,                -- NULL = linked property page
  priority TINYINT UNSIGNED NOT NULL DEFAULT 5,   -- 1-10, higher wins within a tier
  weight SMALLINT UNSIGNED NOT NULL DEFAULT 100,  -- rotation share within a priority band
  start_at DATETIME NOT NULL,
  end_at DATETIME NULL,                       -- required for paid ads
  max_impressions INT UNSIGNED NULL,
  max_clicks INT UNSIGNED NULL,
  daily_impression_cap INT UNSIGNED NULL,
  viewer_cap_24h SMALLINT UNSIGNED NULL,      -- max impressions per viewer per rolling 24h
  advertiser_name VARCHAR(255) NULL,          -- payment details are tracked manually by admin
  advertiser_contact VARCHAR(255) NULL,
  amount_paid DECIMAL(12,2) NULL,
  payment_ref VARCHAR(100) NULL,
  notes TEXT NULL,
  total_impressions INT UNSIGNED NOT NULL DEFAULT 0,
  total_clicks INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (format_id) REFERENCES ad_formats(id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  INDEX idx_ads_serving (format_id, status, start_at, end_at)
);

-- One row per ad/day/placement; drives reports and daily caps.
CREATE TABLE IF NOT EXISTS ad_stats_daily (
  ad_id INT NOT NULL,
  stat_date DATE NOT NULL,
  placement VARCHAR(50) NOT NULL DEFAULT '',
  impressions INT UNSIGNED NOT NULL DEFAULT 0,
  clicks INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (ad_id, stat_date, placement),
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- Raw events. The unique key makes each served token count at most once
-- per event type, so replayed/forged beacons can't inflate numbers.
CREATE TABLE IF NOT EXISTS ad_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ad_id INT NOT NULL,
  event_type ENUM('impression','click') NOT NULL,
  token_id CHAR(16) NOT NULL,
  viewer_hash CHAR(32) NULL,
  placement VARCHAR(50) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_ad_events_token (token_id, event_type),
  INDEX idx_ad_events_viewer (viewer_hash, created_at),
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- How often each format was requested and what filled it (unsold inventory).
CREATE TABLE IF NOT EXISTS ad_fill_daily (
  format_id INT NOT NULL,
  stat_date DATE NOT NULL,
  paid_fills INT UNSIGNED NOT NULL DEFAULT 0,
  free_fills INT UNSIGNED NOT NULL DEFAULT 0,
  no_fills INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (format_id, stat_date),
  FOREIGN KEY (format_id) REFERENCES ad_formats(id) ON DELETE CASCADE
);

INSERT IGNORE INTO ad_formats (code, name, format_type, width, height) VALUES
('billboard_970x250',     'Billboard',              'banner',  970, 250),
('leaderboard_728x90',    'Leaderboard',            'banner',  728,  90),
('mobile_banner_320x100', 'Mobile banner',          'banner',  320, 100),
('rectangle_300x250',     'Medium rectangle',       'sidebar', 300, 250),
('skyscraper_300x600',    'Half-page skyscraper',   'sidebar', 300, 600),
('native_card_400x300',   'Native listing card',    'native',  400, 300);

-- After creating tables, run:
--   mysql -u root -p real_estate < seed.sql
--
-- Existing databases: apply migrations with npm run migrate:* scripts.
-- Drop obsolete agents snapshot (if present): npm run migrate:drop-agents
