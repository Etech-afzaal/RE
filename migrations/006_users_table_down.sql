-- The migration runner removes the seeded administrator before executing this.
ALTER TABLE users DROP COLUMN user_type;
RENAME TABLE users TO agents;
