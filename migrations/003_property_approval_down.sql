-- Roll back the approval audit trail. Listing statuses are left untouched so no
-- approved listing silently disappears from the public site.
USE real_estate;

DROP INDEX idx_properties_status ON properties;

ALTER TABLE properties
  DROP COLUMN submitted_at,
  DROP COLUMN rejected_at,
  DROP COLUMN rejected_by;

ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'draft','pending_approval','approved','rejected','sold','hidden'
  ) NOT NULL DEFAULT 'approved';

DELETE FROM schema_migrations WHERE id = '003_property_approval';
