-- Approval workflow audit trail: who submitted a listing and when, plus who
-- rejected it. approved_by / approved_at / rejected_reason already exist.
USE real_estate;

ALTER TABLE properties
  ADD COLUMN submitted_at DATETIME NULL AFTER status,
  ADD COLUMN rejected_at DATETIME NULL AFTER rejected_reason,
  ADD COLUMN rejected_by VARCHAR(100) NULL AFTER rejected_at;

-- Any install that never ran 001 still stores the pre-Phase-1 'active' value.
-- Widen the enum, remap, then shrink to the final set.
ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'active','draft','pending_approval','approved','rejected','sold','hidden'
  ) NOT NULL DEFAULT 'draft';

UPDATE properties SET status = 'approved' WHERE status = 'active';

ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'draft','pending_approval','approved','rejected','sold','hidden'
  ) NOT NULL DEFAULT 'draft';

-- Listings that already left draft were submitted at some point; approximate it
-- so the approvals queue can sort by submission date.
UPDATE properties
SET submitted_at = COALESCE(approved_at, updated_at, created_at)
WHERE submitted_at IS NULL
  AND status IN ('pending_approval', 'approved', 'rejected', 'sold', 'hidden');

CREATE INDEX idx_properties_status ON properties(status);

INSERT INTO schema_migrations (id) VALUES ('003_property_approval')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
