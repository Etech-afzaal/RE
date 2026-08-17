USE real_estate;

ALTER TABLE properties
  DROP COLUMN property_subtype,
  DROP COLUMN property_type;

DELETE FROM schema_migrations WHERE id = '016_property_type_subtype';
