USE real_estate;

DROP TABLE IF EXISTS property_link_insights;
DROP TABLE IF EXISTS property_marketing_links;
DROP TABLE IF EXISTS subagents;

DELETE FROM schema_migrations WHERE id = '027_subagents_marketing_links';
