USE real_estate;

DROP TABLE IF EXISTS ad_fill_daily;
DROP TABLE IF EXISTS ad_events;
DROP TABLE IF EXISTS ad_stats_daily;
DROP TABLE IF EXISTS ads;
DROP TABLE IF EXISTS ad_formats;

DELETE FROM schema_migrations WHERE id = '035_ads_network';
