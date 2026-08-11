-- Roll back property video thumbnail_url column.
USE real_estate;

ALTER TABLE property_videos
  DROP COLUMN thumbnail_url;

DELETE FROM schema_migrations WHERE id = '014_property_video_thumbnails';
