-- Apply through scripts/migrate-users.js so the admin password can be bcrypt-hashed.
RENAME TABLE agents TO users;
ALTER TABLE users
  ADD COLUMN user_type ENUM('admin','agent') NOT NULL DEFAULT 'agent' AFTER password_hash;
UPDATE users SET user_type = 'agent';
