-- Remove obsolete properties.video_url.
-- Property videos live in property_videos (source of truth).
USE real_estate;

ALTER TABLE properties
  DROP COLUMN video_url;

INSERT INTO schema_migrations (id) VALUES ('018_drop_properties_video_url')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
