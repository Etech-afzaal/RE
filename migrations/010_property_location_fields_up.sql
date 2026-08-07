-- Structured location fields for properties.
-- Cards continue to use the denormalized `location` display string
-- ("{area} {phase}, {city}"). Existing rows keep NULL structured values.
USE real_estate;

ALTER TABLE properties
  ADD COLUMN city VARCHAR(100) NULL AFTER location,
  ADD COLUMN area VARCHAR(100) NULL AFTER city,
  ADD COLUMN phase VARCHAR(100) NULL AFTER area,
  ADD COLUMN address VARCHAR(255) NULL AFTER phase;

INSERT INTO schema_migrations (id) VALUES ('010_property_location_fields')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
