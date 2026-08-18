-- Remove unused property_images.image_title.
-- The category column is the source of truth for image labels.
USE real_estate;

ALTER TABLE property_images
  DROP COLUMN image_title;

INSERT INTO schema_migrations (id) VALUES ('021_drop_property_image_title')
ON DUPLICATE KEY UPDATE applied_at = applied_at;