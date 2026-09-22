USE real_estate;

ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'draft','pending_approval','approved','rejected','under_contract','sold','hidden'
  ) NOT NULL DEFAULT 'draft';

UPDATE properties SET status = 'hidden' WHERE is_hidden = TRUE;

ALTER TABLE properties DROP COLUMN is_hidden;
