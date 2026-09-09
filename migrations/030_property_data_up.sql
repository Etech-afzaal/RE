-- Add optional longer/type-specific property information without moving existing fields.
USE real_estate;

ALTER TABLE properties ADD COLUMN property_data JSON NULL;

INSERT INTO schema_migrations (id) VALUES ('030_property_data')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
