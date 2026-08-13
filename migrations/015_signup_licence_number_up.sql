-- Add licence_number to signup requests and widen estate_name to 30 chars.
USE real_estate;

ALTER TABLE signup_requests
  MODIFY COLUMN estate_name VARCHAR(30) NOT NULL;

ALTER TABLE signup_requests
  ADD COLUMN licence_number VARCHAR(25) NULL AFTER phone;

ALTER TABLE users
  MODIFY COLUMN estate_name VARCHAR(30) UNIQUE NULL;

INSERT INTO schema_migrations (id) VALUES ('015_signup_licence_number')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
