-- Track which public page generated each customer inquiry.
USE real_estate;

ALTER TABLE customer_inquiries
  ADD COLUMN page_url VARCHAR(500) NULL AFTER message;

INSERT INTO schema_migrations (id) VALUES ('013_inquiry_page_url')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
