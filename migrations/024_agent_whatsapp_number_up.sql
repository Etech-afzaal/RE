-- Separate WhatsApp contact number for agents (optional; wa.me falls back to phone).
USE real_estate;

ALTER TABLE users
  ADD COLUMN whatsapp_number VARCHAR(50) NULL AFTER phone;

INSERT INTO schema_migrations (id) VALUES ('024_agent_whatsapp_number')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
