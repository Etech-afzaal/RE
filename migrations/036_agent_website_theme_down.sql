USE real_estate;

ALTER TABLE users
  DROP COLUMN theme_settings,
  DROP COLUMN theme_id;

DELETE FROM schema_migrations WHERE id = '036_agent_website_theme';
