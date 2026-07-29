-- One optional, public-facing video URL per property.
USE real_estate;

ALTER TABLE properties
  ADD COLUMN video_url VARCHAR(500) NULL AFTER location;

INSERT INTO schema_migrations (id) VALUES ('002_property_video')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
