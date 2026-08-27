-- Subagents, property marketing links, and link insights tracking.
USE real_estate;

CREATE TABLE IF NOT EXISTS subagents (
  id INT NOT NULL AUTO_INCREMENT,
  agent_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  image VARCHAR(512) NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_subagents_agent_id (agent_id),
  KEY idx_subagents_agent_active (agent_id, is_active),
  CONSTRAINT fk_subagents_agent FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_marketing_links (
  id INT NOT NULL AUTO_INCREMENT,
  property_id INT NOT NULL,
  agent_id INT NOT NULL,
  subagent_id INT NOT NULL,
  unique_code VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marketing_links_code (unique_code),
  UNIQUE KEY uq_marketing_links_property_subagent (property_id, subagent_id),
  KEY idx_marketing_links_property (property_id),
  KEY idx_marketing_links_agent (agent_id),
  CONSTRAINT fk_marketing_links_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
  CONSTRAINT fk_marketing_links_agent FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_marketing_links_subagent FOREIGN KEY (subagent_id) REFERENCES subagents (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_link_insights (
  id BIGINT NOT NULL AUTO_INCREMENT,
  marketing_link_id INT NOT NULL,
  event_type ENUM('page_view', 'phone_click', 'whatsapp_click', 'email_sent') NOT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_link_insights_link (marketing_link_id),
  KEY idx_link_insights_link_event (marketing_link_id, event_type),
  KEY idx_link_insights_created (created_at),
  CONSTRAINT fk_link_insights_link FOREIGN KEY (marketing_link_id) REFERENCES property_marketing_links (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (id) VALUES ('027_subagents_marketing_links')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
