-- Add YouTube as a second source for agent video posts.
USE real_estate;

ALTER TABLE video_posts
  ADD COLUMN video_source ENUM('UPLOAD','YOUTUBE') NOT NULL DEFAULT 'UPLOAD' AFTER description,
  ADD COLUMN youtube_video_id VARCHAR(32) NULL AFTER video_url;

INSERT INTO schema_migrations (id) VALUES ('033_agent_video_posts_youtube')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
