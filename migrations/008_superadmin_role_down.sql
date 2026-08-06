-- Revert users.user_type value superadmin → admin.
ALTER TABLE users
  MODIFY COLUMN user_type ENUM('admin','superadmin','agent') NOT NULL DEFAULT 'agent';
UPDATE users SET user_type = 'admin' WHERE user_type = 'superadmin';
ALTER TABLE users
  MODIFY COLUMN user_type ENUM('admin','agent') NOT NULL DEFAULT 'agent';
