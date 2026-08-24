-- Optional second phone number for agents (display only on public pages).
USE real_estate;

ALTER TABLE users
  ADD COLUMN secondary_phone VARCHAR(50) NULL AFTER phone;

INSERT INTO schema_migrations (id) VALUES ('025_agent_secondary_phone')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
