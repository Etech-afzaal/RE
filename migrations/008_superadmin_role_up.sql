-- Rename users.user_type value admin → superadmin (keep agent unchanged).
-- Applied via scripts/migrate-superadmin-role.js (also seeds second superadmin).
ALTER TABLE users
  MODIFY COLUMN user_type ENUM('admin','superadmin','agent') NOT NULL DEFAULT 'agent';
UPDATE users SET user_type = 'superadmin' WHERE user_type = 'admin';
ALTER TABLE users
  MODIFY COLUMN user_type ENUM('superadmin','agent') NOT NULL DEFAULT 'agent';
