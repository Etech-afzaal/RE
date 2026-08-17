USE real_estate;

DROP INDEX idx_properties_agent_featured ON properties;

ALTER TABLE properties
  DROP COLUMN is_featured;

DELETE FROM schema_migrations WHERE id = '019_property_is_featured';
