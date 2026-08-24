USE real_estate;

ALTER TABLE users DROP COLUMN secondary_phone;

DELETE FROM schema_migrations WHERE id = '025_agent_secondary_phone';
