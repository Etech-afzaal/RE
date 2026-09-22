USE real_estate;

ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'draft','pending_approval','approved','rejected','under_contract','sold','hidden'
  ) NOT NULL DEFAULT 'draft';

INSERT INTO schema_migrations (id) VALUES ('031_property_under_contract')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
