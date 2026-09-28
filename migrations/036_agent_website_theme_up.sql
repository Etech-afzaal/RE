-- Agent public website theme customization.
-- Stores the agent's chosen theme + optional custom palette.
-- Existing agents default to theme_id = 'default' so websites stay unchanged.
USE real_estate;

ALTER TABLE users
  ADD COLUMN theme_id VARCHAR(30) NOT NULL DEFAULT 'default',
  ADD COLUMN theme_settings JSON NULL;

INSERT INTO schema_migrations (id) VALUES ('036_agent_website_theme')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
