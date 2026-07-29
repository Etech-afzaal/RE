USE real_estate;

ALTER TABLE properties DROP COLUMN video_url;
DELETE FROM schema_migrations WHERE id = '002_property_video';
