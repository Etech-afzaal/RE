-- Add optional agent-editable marketing sections (stored as JSON arrays).
-- All four columns are nullable so existing properties remain untouched.
USE real_estate;

ALTER TABLE properties
  ADD COLUMN property_highlights JSON NULL,
  ADD COLUMN why_this_home JSON NULL,
  ADD COLUMN location_advantages JSON NULL,
  ADD COLUMN investment_insights JSON NULL;

INSERT INTO schema_migrations (id) VALUES ('022_property_marketing_sections')
ON DUPLICATE KEY UPDATE applied_at = applied_at;