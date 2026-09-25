-- Ads Network: formats, ads, stats and events. All DATETIME columns on ads/ad_events are UTC.
-- Apply with: npm run migrate:ads-network  (revert: npm run migrate:ads-network -- --revert)
USE real_estate;

-- Sizes/formats the customer side can request, e.g. "leaderboard_728x90".
CREATE TABLE IF NOT EXISTS ad_formats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  format_type ENUM('banner','native','sidebar','popup') NOT NULL DEFAULT 'banner',
  width SMALLINT UNSIGNED NOT NULL,
  height SMALLINT UNSIGNED NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,             -- inactive formats never serve
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,                -- internal name, never shown to customers
  tier ENUM('paid','free') NOT NULL,          -- paid always beats free
  status ENUM('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
  format_id INT NOT NULL,
  property_id INT NULL,                       -- optional linked property
  image_url VARCHAR(500) NULL,                -- uploaded creative; falls back to property image
  headline VARCHAR(120) NULL,
  alt_text VARCHAR(255) NULL,
  cta_text VARCHAR(40) NULL,
  click_url VARCHAR(500) NULL,                -- NULL = linked property page
  priority TINYINT UNSIGNED NOT NULL DEFAULT 5,   -- 1-10, higher wins within a tier
  weight SMALLINT UNSIGNED NOT NULL DEFAULT 100,  -- rotation share within a priority band
  start_at DATETIME NOT NULL,
  end_at DATETIME NULL,                       -- required for paid ads
  max_impressions INT UNSIGNED NULL,
  max_clicks INT UNSIGNED NULL,
  daily_impression_cap INT UNSIGNED NULL,
  viewer_cap_24h SMALLINT UNSIGNED NULL,      -- max impressions per viewer per rolling 24h
  advertiser_name VARCHAR(255) NULL,          -- payment details are tracked manually by admin
  advertiser_contact VARCHAR(255) NULL,
  amount_paid DECIMAL(12,2) NULL,
  payment_ref VARCHAR(100) NULL,
  notes TEXT NULL,
  total_impressions INT UNSIGNED NOT NULL DEFAULT 0,
  total_clicks INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (format_id) REFERENCES ad_formats(id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  INDEX idx_ads_serving (format_id, status, start_at, end_at)
);

-- One row per ad/day/placement; drives reports and daily caps.
CREATE TABLE IF NOT EXISTS ad_stats_daily (
  ad_id INT NOT NULL,
  stat_date DATE NOT NULL,
  placement VARCHAR(50) NOT NULL DEFAULT '',
  impressions INT UNSIGNED NOT NULL DEFAULT 0,
  clicks INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (ad_id, stat_date, placement),
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- Raw events. The unique key makes each served token count at most once
-- per event type, so replayed/forged beacons can't inflate numbers.
CREATE TABLE IF NOT EXISTS ad_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ad_id INT NOT NULL,
  event_type ENUM('impression','click') NOT NULL,
  token_id CHAR(16) NOT NULL,
  viewer_hash CHAR(32) NULL,
  placement VARCHAR(50) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_ad_events_token (token_id, event_type),
  INDEX idx_ad_events_viewer (viewer_hash, created_at),
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- How often each format was requested and what filled it (unsold inventory).
CREATE TABLE IF NOT EXISTS ad_fill_daily (
  format_id INT NOT NULL,
  stat_date DATE NOT NULL,
  paid_fills INT UNSIGNED NOT NULL DEFAULT 0,
  free_fills INT UNSIGNED NOT NULL DEFAULT 0,
  no_fills INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (format_id, stat_date),
  FOREIGN KEY (format_id) REFERENCES ad_formats(id) ON DELETE CASCADE
);

INSERT IGNORE INTO ad_formats (code, name, format_type, width, height) VALUES
('billboard_970x250',     'Billboard',              'banner',  970, 250),
('leaderboard_728x90',    'Leaderboard',            'banner',  728,  90),
('mobile_banner_320x100', 'Mobile banner',          'banner',  320, 100),
('rectangle_300x250',     'Medium rectangle',       'sidebar', 300, 250),
('skyscraper_300x600',    'Half-page skyscraper',   'sidebar', 300, 600),
('native_card_400x300',   'Native listing card',    'native',  400, 300);

INSERT INTO schema_migrations (id) VALUES ('035_ads_network')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
