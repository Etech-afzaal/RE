-- Roll back permanent agent block support.
-- Any blocked agents are returned to disabled so the ENUM can shrink safely.
USE real_estate;

UPDATE agents SET status = 'disabled' WHERE status = 'blocked';

ALTER TABLE agents
  DROP COLUMN blocked_by,
  DROP COLUMN blocked_at,
  DROP COLUMN blocked_reason;

ALTER TABLE agents
  MODIFY COLUMN status ENUM(
    'pending','approved','rejected','disabled'
  ) NOT NULL DEFAULT 'approved';

DELETE FROM schema_migrations WHERE id = '005_agent_block';
