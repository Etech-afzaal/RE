USE real_estate;

ALTER TABLE customer_inquiries
  DROP COLUMN page_url;

DELETE FROM schema_migrations WHERE id = '013_inquiry_page_url';
