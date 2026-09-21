-- Agent-authored video posts shown on the agent public website.
-- Mirrors the blogs table ownership model: each video post belongs to one
-- agent and only `published` videos are visible publicly. The video file and
-- thumbnail are generated server-side via ffmpeg (validateAndProcessVideoBuffer)
-- and stored under /uploads/agents/{agentId}/video-posts/.
USE real_estate;

CREATE TABLE IF NOT EXISTS video_posts (
  id INT NOT NULL AUTO_INCREMENT,
  agent_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT NULL,
  video_url VARCHAR(500) NULL,
  thumbnail_url VARCHAR(500) NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_video_posts_agent_slug (agent_id, slug),
  KEY idx_video_posts_agent_id (agent_id),
  KEY idx_video_posts_agent_status (agent_id, status),
  KEY idx_video_posts_status (status),
  CONSTRAINT fk_video_posts_agent FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (id) VALUES ('032_agent_video_posts')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
