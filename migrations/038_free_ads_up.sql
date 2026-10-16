-- Agent Free Ads preferences and directional website blocks.
-- Existing agents/properties default to enabled to preserve current behavior.
USE real_estate;

ALTER TABLE users
  ADD COLUMN free_ads_enabled BOOLEAN NOT NULL DEFAULT TRUE
  AFTER theme_settings;

ALTER TABLE properties
  ADD COLUMN free_ads_enabled BOOLEAN NOT NULL DEFAULT TRUE
  AFTER is_featured;

-- advertiser_agent_id owns the property/ad. blocked_host_agent_id owns the
-- public website where that advertiser's free ads must not appear.
CREATE TABLE agent_free_ad_blocks (
  advertiser_agent_id INT NOT NULL,
  blocked_host_agent_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (advertiser_agent_id, blocked_host_agent_id),
  KEY idx_agent_free_ad_blocks_host (blocked_host_agent_id),
  CONSTRAINT fk_agent_free_ad_blocks_advertiser
    FOREIGN KEY (advertiser_agent_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_free_ad_blocks_host
    FOREIGN KEY (blocked_host_agent_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO schema_migrations (id) VALUES ('038_free_ads')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
