USE real_estate;

ALTER TABLE properties
  ADD COLUMN video_url VARCHAR(500) NULL AFTER address;

DELETE FROM schema_migrations WHERE id = '018_drop_properties_video_url';
