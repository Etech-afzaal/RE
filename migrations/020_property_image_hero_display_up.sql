-- New "Display on hero" flag for the Property Details hero slider.
-- Multiple images can be selected (no maximum), unlike the single featured image.
-- Existing rows default to 'no'; the featured-image safety fallback keeps
-- existing featured images in the hero without touching their stored value.
USE real_estate;

ALTER TABLE property_images
  ADD COLUMN hero_display ENUM('yes','no') NOT NULL DEFAULT 'no' AFTER is_featured;

INSERT INTO schema_migrations (id) VALUES ('020_property_image_hero_display')
ON DUPLICATE KEY UPDATE applied_at = applied_at;