USE real_estate;

ALTER TABLE properties
  ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE AFTER status;

-- Legacy hidden rows already lost their original status. Recover it from the
-- status-change audit trail when available; otherwise keep them private and
-- use Published as the least surprising legacy default.
CREATE TEMPORARY TABLE legacy_hidden_property_status AS
SELECT
  p.id,
  COALESCE(
    (
      SELECT JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.old_status'))
      FROM audit_logs a
      WHERE a.entity_type = 'property'
        AND a.entity_id = p.id
        AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.new_status')) = 'hidden'
        AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.old_status')) IN ('approved', 'under_contract', 'sold')
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 1
    ),
    'approved'
  ) AS actual_status
FROM properties p
WHERE p.status = 'hidden';

UPDATE properties p
JOIN legacy_hidden_property_status legacy ON legacy.id = p.id
SET p.status = legacy.actual_status,
    p.is_hidden = TRUE;

DROP TEMPORARY TABLE legacy_hidden_property_status;

ALTER TABLE properties
  MODIFY COLUMN status ENUM(
    'draft','pending_approval','approved','rejected','under_contract','sold'
  ) NOT NULL DEFAULT 'draft';

INSERT INTO schema_migrations (id) VALUES ('034_property_visibility')
ON DUPLICATE KEY UPDATE applied_at = applied_at;