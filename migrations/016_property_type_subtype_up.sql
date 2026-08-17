-- Persist listing class (sale|rent|plot) and subtype (house|apartment|…).
-- Columns start nullable so existing rows can be backfilled safely by the
-- migrate script before any NOT NULL enforcement.
USE real_estate;

ALTER TABLE properties
  ADD COLUMN property_type ENUM('sale','rent','plot') NULL AFTER title,
  ADD COLUMN property_subtype VARCHAR(32) NULL AFTER property_type;

INSERT INTO schema_migrations (id) VALUES ('016_property_type_subtype')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
