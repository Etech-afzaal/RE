-- Roll back the property_videos gallery table.
USE real_estate;

DROP TABLE IF EXISTS property_videos;

DELETE FROM schema_migrations WHERE id = '005_property_videos';
