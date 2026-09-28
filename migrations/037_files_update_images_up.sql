-- Track images embedded in an agent's Files Rates rich-content editor.
-- Each upload via /api/files-updates/content-image is recorded here so the
-- platform knows which content images belong to which agent (mirrors how
-- property images are tracked in property_images). files_update_id is
-- nullable because content images may be added before the record is saved.
USE real_estate;

CREATE TABLE IF NOT EXISTS agent_files_update_images (
  id INT NOT NULL AUTO_INCREMENT,
  agent_id INT NOT NULL,
  files_update_id INT NULL,
  image_url VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agent_files_update_images_agent (agent_id),
  KEY idx_agent_files_update_images_record (files_update_id),
  CONSTRAINT fk_agent_files_update_images_agent FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_files_update_images_record FOREIGN KEY (files_update_id) REFERENCES agent_files_updates (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (id) VALUES ('037_files_update_images')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
