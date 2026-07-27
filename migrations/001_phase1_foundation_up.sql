-- Phase 1 — Database Foundation Update (UP)
-- Safe for existing data: adds columns, remaps statuses, does not delete rows.
-- Run via: npm run migrate:phase1
-- Or: mysql ... < migrations/001_phase1_foundation_up.sql

USE real_estate;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- agents: new profile / tenancy-prep columns
-- ---------------------------------------------------------------------------
-- username, profile_image, description, areas_served, updated_at
-- (Skip ADD if already present — runner checks; raw SQL assumes first apply.)

ALTER TABLE agents
  ADD COLUMN username VARCHAR(100) NULL AFTER estate_name;

ALTER TABLE agents
  ADD COLUMN profile_image VARCHAR(500) NULL AFTER phone;

ALTER TABLE agents
  ADD COLUMN description TEXT NULL AFTER profile_image;

ALTER TABLE agents
  ADD COLUMN areas_served VARCHAR(500) NULL AFTER description;

ALTER TABLE agents
  ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

UPDATE agents
SET username = estate_name
WHERE username IS NULL OR username = '';

ALTER TABLE agents
  ADD UNIQUE KEY uq_agents_username (username);

-- Expand ENUM → migrate active→approved → shrink ENUM
ALTER TABLE agents
  MODIFY COLUMN status ENUM(
    'active',
    'disabled',
    'pending',
    'approved',
    'rejected'
  ) NOT NULL DEFAULT 'active';

UPDATE agents SET status = 'approved' WHERE status = 'active';

ALTER TABLE agents
  MODIFY COLUMN status ENUM(
    'pending',
    'approved',
    'rejected',
    'disabled'
  ) NOT NULL DEFAULT 'approved';

-- ---------------------------------------------------------------------------
-- properties: approval workflow fields + status remap
-- ---------------------------------------------------------------------------
ALTER TABLE properties
  ADD COLUMN approved_by VARCHAR(100) NULL AFTER status;

ALTER TABLE properties
  ADD COLUMN approved_at DATETIME NULL AFTER approved_by;

ALTER TABLE properties
  ADD COLUMN rejected_reason TEXT NULL AFTER approved_at;

ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'active',
    'sold',
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'hidden'
  ) NOT NULL DEFAULT 'active';

UPDATE properties SET status = 'approved' WHERE status = 'active';

UPDATE properties
SET
  approved_by = COALESCE(approved_by, 'legacy_migration'),
  approved_at = COALESCE(approved_at, created_at)
WHERE status = 'approved';

ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'sold',
    'hidden'
  ) NOT NULL DEFAULT 'approved';

-- Ownership: agent_id already required with FK — no change.

-- ---------------------------------------------------------------------------
-- property_images: updated_at for future edits
-- ---------------------------------------------------------------------------
ALTER TABLE property_images
  ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

INSERT INTO schema_migrations (id) VALUES ('001_phase1_foundation')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
