-- Remove YouTube source support from agent video posts.
USE real_estate;

ALTER TABLE video_posts
  DROP COLUMN youtube_video_id,
  DROP COLUMN video_source;

DELETE FROM schema_migrations WHERE id = '033_agent_video_posts_youtube';
