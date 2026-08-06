-- Drop obsolete agents table (users is the single source of truth).
-- Make users.estate_name nullable (agents require it; superadmins do not).
-- Applied via: npm run migrate:drop-agents

-- Pre-check (manual): no FKs should reference agents.
-- SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
-- FROM information_schema.KEY_COLUMN_USAGE
-- WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'agents';

DROP TABLE IF EXISTS agents;

ALTER TABLE users
  MODIFY COLUMN estate_name VARCHAR(20) NULL;

-- Clear fake URL slugs on superadmin rows.
UPDATE users
SET estate_name = NULL
WHERE user_type = 'superadmin';
