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
  estate_name VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  message TEXT,
  status ENUM('pending','approved','rejected','revoked') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- All authenticated accounts. Agents and administrators share this source.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estate_name VARCHAR(20) UNIQUE NOT NULL,          -- used in /re/{estate_name}
  username VARCHAR(100) UNIQUE,                    -- Phase 1: public/handle identity
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  profile_image VARCHAR(500) NULL,                 -- Phase 1
  company_logo VARCHAR(500) NULL,                  -- Agent brand profile company logo
  company_name VARCHAR(255) NULL,                  -- Public company display name
  description TEXT NULL,                           -- Phase 1
  areas_served VARCHAR(500) NULL,                  -- Phase 1
  office_address VARCHAR(500) NULL,                -- Company branding
  social_links VARCHAR(1000) NULL,                 -- Company branding (URLs)
  password_hash VARCHAR(255) NOT NULL,
  user_type ENUM('admin','agent') NOT NULL DEFAULT 'agent',
  must_reset_password BOOLEAN DEFAULT TRUE,
  -- Phase 1 + block: pending | approved | rejected | disabled | blocked
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
  location VARCHAR(255),
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
  category VARCHAR(40) NULL,               -- room/area label, e.g. master_bedroom (see lib/imageCategories.js)
  is_featured BOOLEAN DEFAULT FALSE,       -- marked as the main image for the property page
  sort_order INT DEFAULT 0,                -- display order within the gallery
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX idx_properties_agent ON properties(agent_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_images_property ON property_images(property_id);
CREATE INDEX idx_images_category ON property_images(property_id, category);

-- Demo / realistic listings live in seed.sql (agents, sale/rent/plot properties, images).
-- After creating tables, run:
--   mysql -u root -p real_estate < seed.sql
--
-- Existing databases: apply Phase 1 with:
--   npm run migrate:phase1
