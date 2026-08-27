-- Secondary phone and WhatsApp for subagent marketing profiles.
USE real_estate;

ALTER TABLE subagents
  ADD COLUMN secondary_phone VARCHAR(50) NULL AFTER phone,
  ADD COLUMN whatsapp_number VARCHAR(50) NULL AFTER secondary_phone;

INSERT INTO schema_migrations (id) VALUES ('028_subagent_contact_fields')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
