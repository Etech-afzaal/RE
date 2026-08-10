USE real_estate;

ALTER TABLE properties
  DROP COLUMN price_currency;

DELETE FROM schema_migrations WHERE id = '012_property_price_currency';
