USE real_estate;

-- Preserve listings on rollback by returning contract listings to Published.
UPDATE properties SET status = 'approved' WHERE status = 'under_contract';

ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'draft','pending_approval','approved','rejected','sold','hidden'
  ) NOT NULL DEFAULT 'draft';

DELETE FROM schema_migrations WHERE id = '031_property_under_contract';
