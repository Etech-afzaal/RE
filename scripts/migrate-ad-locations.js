/**
 * Ad locations: where on the site each ad shows (lib/ads/locations.js).
 *
 *   - new table ad_locations: one row per ad + location key
 *   - existing ads are assigned to every location, so nothing that is live
 *     today disappears; admins can narrow it down afterwards
 *
 * Run with `npm run migrate:ad-locations` (add `-- --down` to roll back).
 * Needs the ad variants migration (npm run migrate:ad-variants). Safe to re-run.
 */
const path = require("path");
const mysql = require("mysql2/promise");
require("@next/env").loadEnvConfig(path.join(__dirname, ".."));

const MIGRATION_ID = "037_ad_locations";

// Keep in sync with AD_LOCATIONS in lib/ads/locations.js.
const LOCATION_KEYS = [
  "home_above_hero",
  "home_below_hero",
  "agent_site_below_hero",
  "agent_site_after_listings",
  "property_below_hero",
  "property_before_gallery",
  "agent_dashboard_top",
];

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

async function migrateUp(conn) {
  if (!(await tableExists(conn, "ad_creatives"))) {
    throw new Error("Run `npm run migrate:ad-variants` first.");
  }

  const isNew = !(await tableExists(conn, "ad_locations"));
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ad_locations (
      ad_id INT NOT NULL,
      location VARCHAR(50) NOT NULL,
      PRIMARY KEY (ad_id, location),
      KEY idx_ad_locations_location (location),
      CONSTRAINT fk_ad_locations_ad FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
    )`);

  if (isNew) {
    const [ads] = await conn.query("SELECT id FROM ads");
    if (ads.length > 0) {
      const rows = ads.flatMap((ad) => LOCATION_KEYS.map((key) => [ad.id, key]));
      await conn.query("INSERT IGNORE INTO ad_locations (ad_id, location) VALUES ?", [rows]);
    }
    console.log(`+ ad_locations (${ads.length} existing ad(s) assigned to every location)`);
  } else {
    console.log("= ad_locations already exists");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Ad locations migration complete.");
}

async function migrateDown(conn) {
  await conn.query("DROP TABLE IF EXISTS ad_locations");
  console.log("- ad_locations");
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Ad locations migration rolled back.");
}

async function main() {
  const down = process.argv.includes("--down") || process.argv.includes("--revert");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await conn.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    );
    if (down) await migrateDown(conn);
    else await migrateUp(conn);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
