USE real_estate;

DROP TABLE IF EXISTS agent_free_ad_blocks;

ALTER TABLE properties
  DROP COLUMN free_ads_enabled;

ALTER TABLE users
  DROP COLUMN free_ads_enabled;

DELETE FROM schema_migrations WHERE id = '038_free_ads';
