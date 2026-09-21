-- Agent files updates — a SINGLE live market/file price update page per agent.
-- One row per agent enforced by UNIQUE(agent_id). The agent maintains the
-- latest market update; editing overwrites the same row. The public page
-- always shows the latest published content.
USE real_estate;

-- Drop the old multi-post table if it was created by a prior migration attempt.
DROP TABLE IF EXISTS files_updates;

CREATE TABLE IF NOT EXISTS agent_files_updates (
  id INT NOT NULL AUTO_INCREMENT,
  agent_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agent_files_updates_agent (agent_id),
  KEY idx_agent_files_updates_status (status),
  CONSTRAINT fk_agent_files_updates_agent FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (id) VALUES ('033_files_updates')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
