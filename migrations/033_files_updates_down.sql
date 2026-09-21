USE real_estate;

DROP TABLE IF EXISTS agent_files_updates;
DROP TABLE IF EXISTS files_updates;

DELETE FROM schema_migrations WHERE id = '033_files_updates';
