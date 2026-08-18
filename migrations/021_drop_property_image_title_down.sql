-- Roll back: restore property_images.image_title column.
USE real_estate;

ALTER TABLE property_images
  ADD COLUMN image_title VARCHAR(255) NULL AFTER image_url;

DELETE FROM schema_migrations WHERE id = '021_drop_property_image_title';