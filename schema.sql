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
  city VARCHAR(100) NULL,
  area VARCHAR(100) NULL,
  phase VARCHAR(100) NULL,
  address VARCHAR(255) NULL,
  video_url VARCHAR(500) NULL,                     -- optional property walkthrough video
  -- Workflow: draft → pending_approval → approved | rejected; plus sold | hidden
  -- Only 'approved' is publicly visible, so new listings start as drafts.
  status ENUM('draft','pending_approval','approved','rejected','sold','hidden') NOT NULL DEFAULT 'draft',
  submitted_at DATETIME NULL,                      -- set when the agent submits for review
  approved_by VARCHAR(100) NULL,                   -- admin identifier (env admin has no users row)
  approved_at DATETIME NULL,
  rejected_reason TEXT NULL,
  rejected_at DATETIME NULL,
  rejected_by VARCHAR(100) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS property_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,          -- watermarked, public-facing
  image_title VARCHAR(255),                -- optional title for the property detail gallery
  category VARCHAR(100) NULL,               -- room/area label, e.g. master_bedroom or custom "Swimming Pool"
  is_featured BOOLEAN DEFAULT FALSE,       -- marked as the main image for the property page
  sort_order INT DEFAULT 0,                -- display order within the gallery
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Optional walkthrough videos (max 5 per property in the add flow).
-- properties.video_url stays as a legacy mirror of the featured video.
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

-- Demo / realistic listings live in seed.sql (agent users, sale/rent/plot properties, images).
-- After creating tables, run:
--   mysql -u root -p real_estate < seed.sql
--
-- Existing databases: apply migrations with npm run migrate:* scripts.
-- Drop obsolete agents snapshot (if present): npm run migrate:drop-agents
