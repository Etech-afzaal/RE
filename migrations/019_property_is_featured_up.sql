-- Agent-controlled homepage featured listings (separate from media is_featured).
-- Existing rows default to false; does not alter approval or publication status.
USE real_estate;

ALTER TABLE properties
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE AFTER status;

CREATE INDEX idx_properties_agent_featured
  ON properties(agent_id, is_featured, status);

INSERT INTO schema_migrations (id) VALUES ('019_property_is_featured')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
