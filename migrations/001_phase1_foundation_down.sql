-- Phase 1 — Database Foundation Update (DOWN / rollback)
-- Restores pre-Phase-1 status enums and drops newly added columns.
-- WARNING: Values pending_approval / rejected / hidden on properties become draft.
--          Agent pending/rejected become disabled (except approved→active).
-- Run via: npm run migrate:phase1 -- --down
-- Or apply carefully with the migrate script (preferred).

USE real_estate;

-- properties: map new statuses back, restore old ENUM, drop approval columns
ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'sold',
    'hidden',
    'active'
  ) NOT NULL DEFAULT 'approved';

UPDATE properties SET status = 'active' WHERE status = 'approved';
UPDATE properties SET status = 'draft' WHERE status IN ('pending_approval', 'rejected', 'hidden');

ALTER TABLE properties
  MODIFY COLUMN status ENUM('active', 'sold', 'draft') NOT NULL DEFAULT 'active';

ALTER TABLE properties DROP COLUMN rejected_reason;
ALTER TABLE properties DROP COLUMN approved_at;
ALTER TABLE properties DROP COLUMN approved_by;

-- agents
ALTER TABLE agents
  MODIFY COLUMN status ENUM(
    'pending',
    'approved',
    'rejected',
    'disabled',
    'active'
  ) NOT NULL DEFAULT 'approved';

UPDATE agents SET status = 'active' WHERE status = 'approved';
UPDATE agents SET status = 'disabled' WHERE status IN ('pending', 'rejected');

ALTER TABLE agents
  MODIFY COLUMN status ENUM('active', 'disabled') NOT NULL DEFAULT 'active';

ALTER TABLE agents DROP INDEX uq_agents_username;
ALTER TABLE agents DROP COLUMN updated_at;
ALTER TABLE agents DROP COLUMN social_links;
ALTER TABLE agents DROP COLUMN office_address;
ALTER TABLE agents DROP COLUMN areas_served;
ALTER TABLE agents DROP COLUMN description;
ALTER TABLE agents DROP COLUMN company_name;
ALTER TABLE agents DROP COLUMN company_logo;
ALTER TABLE agents DROP COLUMN profile_image;
ALTER TABLE agents DROP COLUMN username;

ALTER TABLE property_images DROP COLUMN updated_at;

DELETE FROM schema_migrations WHERE id = '001_phase1_foundation';
