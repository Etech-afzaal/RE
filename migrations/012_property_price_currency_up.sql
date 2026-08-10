-- Store listing currency separately from the numeric price amount.
-- Existing rows default to PKR so public/admin display stays unchanged.
USE real_estate;

ALTER TABLE properties
  ADD COLUMN price_currency ENUM('PKR','USD') NOT NULL DEFAULT 'PKR' AFTER price;

INSERT INTO schema_migrations (id) VALUES ('012_property_price_currency')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
