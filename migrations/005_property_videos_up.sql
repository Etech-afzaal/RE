-- Multi-video gallery for properties (categories, featured, display order).
-- Existing properties.video_url values are copied into this table as the
-- featured video so older single-video listings keep working.
USE real_estate;

CREATE TABLE IF NOT EXISTS property_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  video_url VARCHAR(500) NOT NULL,
  category VARCHAR(100) NULL,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX idx_videos_property ON property_videos(property_id);
CREATE INDEX idx_videos_category ON property_videos(property_id, category);

-- Backfill from the legacy single-video column when present.
INSERT INTO property_videos (property_id, video_url, category, is_featured, display_order)
SELECT p.id, p.video_url, NULL, TRUE, 0
FROM properties p
WHERE p.video_url IS NOT NULL
  AND p.video_url <> ''
  AND NOT EXISTS (
    SELECT 1 FROM property_videos pv WHERE pv.property_id = p.id
  );

INSERT INTO schema_migrations (id) VALUES ('005_property_videos')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
