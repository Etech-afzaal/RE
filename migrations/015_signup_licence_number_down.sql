-- Roll back licence_number and estate_name width changes.
USE real_estate;

ALTER TABLE signup_requests
  DROP COLUMN licence_number;

ALTER TABLE signup_requests
  MODIFY COLUMN estate_name VARCHAR(20) NOT NULL;

ALTER TABLE users
  MODIFY COLUMN estate_name VARCHAR(20) UNIQUE NULL;

DELETE FROM schema_migrations WHERE id = '015_signup_licence_number';
