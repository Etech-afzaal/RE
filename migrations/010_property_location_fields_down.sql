USE real_estate;

ALTER TABLE properties
  DROP COLUMN address,
  DROP COLUMN phase,
  DROP COLUMN area,
  DROP COLUMN city;

DELETE FROM schema_migrations WHERE id = '010_property_location_fields';
