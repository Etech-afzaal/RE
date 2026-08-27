USE real_estate;

ALTER TABLE subagents
  DROP COLUMN whatsapp_number,
  DROP COLUMN secondary_phone;

DELETE FROM schema_migrations WHERE id = '028_subagent_contact_fields';
