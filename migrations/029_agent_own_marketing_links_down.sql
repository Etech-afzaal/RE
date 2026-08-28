USE real_estate;

ALTER TABLE property_marketing_links
  DROP FOREIGN KEY fk_marketing_links_subagent;

ALTER TABLE property_marketing_links
  DROP INDEX uq_marketing_links_property_subagent;

ALTER TABLE property_marketing_links
  DROP COLUMN subagent_id_key;

DELETE FROM property_marketing_links WHERE subagent_id IS NULL;

ALTER TABLE property_marketing_links
  MODIFY subagent_id INT NOT NULL;

ALTER TABLE property_marketing_links
  ADD UNIQUE KEY uq_marketing_links_property_subagent (property_id, subagent_id);

ALTER TABLE property_marketing_links
  ADD CONSTRAINT fk_marketing_links_subagent
  FOREIGN KEY (subagent_id) REFERENCES subagents (id) ON DELETE RESTRICT;

DELETE FROM schema_migrations WHERE id = '029_agent_own_marketing_links';
