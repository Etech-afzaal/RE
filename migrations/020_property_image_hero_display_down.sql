-- Roll back the property image hero display flag. Image rows and ordering are untouched.
USE real_estate;

ALTER TABLE property_images
  DROP COLUMN hero_display;

DELETE FROM schema_migrations WHERE id = '020_property_image_hero_display';