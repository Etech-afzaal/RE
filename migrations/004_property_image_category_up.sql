-- Room/area label for each property image. Ordering already exists as
-- property_images.sort_order, so only the category is added here.
-- Existing rows stay NULL and are shown as "Uncategorized".
USE real_estate;

ALTER TABLE property_images
  ADD COLUMN category VARCHAR(40) NULL AFTER image_title;

CREATE INDEX idx_images_category ON property_images(property_id, category);

INSERT INTO schema_migrations (id) VALUES ('004_property_image_category')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
