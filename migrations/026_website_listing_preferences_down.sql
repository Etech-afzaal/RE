USE real_estate;

ALTER TABLE users DROP COLUMN website_listing_preferences;

DELETE FROM schema_migrations WHERE id = '026_website_listing_preferences';
