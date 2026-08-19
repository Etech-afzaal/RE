-- Roll back the optional agent-editable marketing section JSON columns.
USE real_estate;

ALTER TABLE properties
  DROP COLUMN property_highlights,
  DROP COLUMN why_this_home,
  DROP COLUMN location_advantages,
  DROP COLUMN investment_insights;

DELETE FROM schema_migrations WHERE id = '022_property_marketing_sections';