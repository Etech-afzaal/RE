USE real_estate;

ALTER TABLE users DROP COLUMN whatsapp_number;

DELETE FROM schema_migrations WHERE id = '024_agent_whatsapp_number';
