-- Agent public website listing visibility preferences (single JSON blob).
USE real_estate;

ALTER TABLE users
  ADD COLUMN website_listing_preferences JSON NULL;

INSERT INTO schema_migrations (id) VALUES ('026_website_listing_preferences')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
