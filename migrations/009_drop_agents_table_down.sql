-- Rollback: re-require estate_name; cannot restore dropped agents data.
-- Applied via: npm run migrate:drop-agents -- --down

UPDATE users
SET estate_name = CONCAT('sa-', id)
WHERE user_type = 'superadmin'
  AND (estate_name IS NULL OR estate_name = '');

UPDATE users
SET estate_name = CONCAT('user-', id)
WHERE estate_name IS NULL OR estate_name = '';

ALTER TABLE users
  MODIFY COLUMN estate_name VARCHAR(20) NOT NULL;

-- agents table is not recreated; restore from backup if needed.
-- mysqldump backup taken before this migration is the recovery path.
