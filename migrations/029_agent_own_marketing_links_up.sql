-- Allow agent-owned property links (subagent_id NULL) for own-site insight tracking.
USE real_estate;

ALTER TABLE property_marketing_links
  DROP FOREIGN KEY fk_marketing_links_subagent;

ALTER TABLE property_marketing_links
  DROP INDEX uq_marketing_links_property_subagent;

ALTER TABLE property_marketing_links
  MODIFY subagent_id INT NULL;

ALTER TABLE property_marketing_links
  ADD COLUMN subagent_id_key INT GENERATED ALWAYS AS (IFNULL(subagent_id, -1)) STORED;

ALTER TABLE property_marketing_links
  ADD UNIQUE KEY uq_marketing_links_property_subagent (property_id, subagent_id_key);

ALTER TABLE property_marketing_links
  ADD CONSTRAINT fk_marketing_links_subagent
  FOREIGN KEY (subagent_id) REFERENCES subagents (id) ON DELETE RESTRICT;

INSERT INTO schema_migrations (id) VALUES ('029_agent_own_marketing_links')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
