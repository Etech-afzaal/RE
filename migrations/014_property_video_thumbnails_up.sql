-- Add thumbnail_url for lazy-loaded property video posters.
USE real_estate;

ALTER TABLE property_videos
  ADD COLUMN thumbnail_url VARCHAR(500) NULL AFTER video_url;

INSERT INTO schema_migrations (id) VALUES ('014_property_video_thumbnails')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
