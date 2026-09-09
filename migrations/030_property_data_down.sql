-- Roll back only the optional property_data column.
USE real_estate;

ALTER TABLE properties DROP COLUMN property_data;

DELETE FROM schema_migrations WHERE id = '030_property_data';
