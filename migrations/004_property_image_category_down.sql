-- Roll back image categories. Image rows, files and ordering are untouched.
USE real_estate;

DROP INDEX idx_images_category ON property_images;

ALTER TABLE property_images
  DROP COLUMN category;

DELETE FROM schema_migrations WHERE id = '004_property_image_category';
