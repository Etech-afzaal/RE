USE real_estate;

DROP TABLE IF EXISTS audit_logs;

DELETE FROM schema_migrations WHERE id = '011_create_audit_logs';
