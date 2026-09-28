/**
 * Ad sizes (variants): one ad can carry several sizes, e.g. 728×90 for
 * desktop and 320×100 for mobile, sharing one schedule, caps and stats.
 *
 *   - new table ad_creatives: one row per ad + format, holding that size's image
 *   - ads.master_image_url: the uploaded source image the sizes are made from
 *   - ad_stats_daily / ad_events get format_id, so reports can split by size
 *   - ads.format_id and ads.image_url move into ad_creatives and are dropped
 *
 * Run with `npm run migrate:ad-variants` (add `-- --down` to roll back).
 * Needs the Ads Network tables (npm run migrate:ads-network). Safe to re-run.
 */
const path = require("path");
const mysql = require("mysql2/promise");
require("@next/env").loadEnvConfig(path.join(__dirname, ".."));

const MIGRATION_ID = "036_ad_variants";

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

async function indexExists(conn, table, index) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, index],
  );
  return rows.length > 0;
}

// Name of the foreign key on table.column (unnamed FKs get generated names).
async function foreignKeyName(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1`,
    [table, column],
  );
  return rows[0]?.name || null;
}

async function migrateUp(conn) {
  if (!(await tableExists(conn, "ads"))) {
    throw new Error("The ads table is missing. Run `npm run migrate:ads-network` first.");
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS ad_creatives (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ad_id INT NOT NULL,
      format_id INT NOT NULL,
      image_url VARCHAR(500) NULL,
      fit ENUM('cover','contain') NOT NULL DEFAULT 'cover',
      source ENUM('upload','generated') NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ad_creatives_ad_format (ad_id, format_id),
      KEY idx_ad_creatives_format (format_id),
      CONSTRAINT fk_ad_creatives_ad FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
      CONSTRAINT fk_ad_creatives_format FOREIGN KEY (format_id) REFERENCES ad_formats(id)
    )`);
  console.log("= ad_creatives table ready");

  if (!(await columnExists(conn, "ads", "master_image_url"))) {
    await conn.query(
      "ALTER TABLE ads ADD COLUMN master_image_url VARCHAR(500) NULL AFTER property_id",
    );
    console.log("+ ads.master_image_url");
  }

  const hasLegacyFormat = await columnExists(conn, "ads", "format_id");

  // Every existing ad becomes an ad with one size; its upload counts as a
  // custom upload for that size.
  if (hasLegacyFormat) {
    const [result] = await conn.query(
      `INSERT IGNORE INTO ad_creatives (ad_id, format_id, image_url, source)
       SELECT id, format_id, image_url, IF(image_url IS NULL, NULL, 'upload') FROM ads`,
    );
    console.log(`~ copied ${result.affectedRows} ad(s) into ad_creatives`);
  }

  if (!(await columnExists(conn, "ad_stats_daily", "format_id"))) {
    await conn.query(
      "ALTER TABLE ad_stats_daily ADD COLUMN format_id INT NOT NULL DEFAULT 0 AFTER placement",
    );
    if (hasLegacyFormat) {
      await conn.query(
        "UPDATE ad_stats_daily s JOIN ads a ON a.id = s.ad_id SET s.format_id = a.format_id",
      );
    }
    await conn.query(
      "ALTER TABLE ad_stats_daily DROP PRIMARY KEY, ADD PRIMARY KEY (ad_id, stat_date, placement, format_id)",
    );
    console.log("+ ad_stats_daily.format_id (part of the primary key)");
  }

  if (!(await columnExists(conn, "ad_events", "format_id"))) {
    await conn.query("ALTER TABLE ad_events ADD COLUMN format_id INT NULL AFTER ad_id");
    if (hasLegacyFormat) {
      await conn.query(
        "UPDATE ad_events e JOIN ads a ON a.id = e.ad_id SET e.format_id = a.format_id",
      );
    }
    console.log("+ ad_events.format_id");
  }

  // Sizes now live in ad_creatives, so drop the single-size columns.
  if (hasLegacyFormat) {
    const fk = await foreignKeyName(conn, "ads", "format_id");
    if (fk) await conn.query(`ALTER TABLE ads DROP FOREIGN KEY \`${fk}\``);
    if (await indexExists(conn, "ads", "idx_ads_serving")) {
      await conn.query("ALTER TABLE ads DROP INDEX idx_ads_serving");
    }
    await conn.query("ALTER TABLE ads DROP COLUMN format_id, DROP COLUMN image_url");
    console.log("- ads.format_id, ads.image_url (moved to ad_creatives)");
  }
  if (!(await indexExists(conn, "ads", "idx_ads_serving"))) {
    await conn.query("ALTER TABLE ads ADD INDEX idx_ads_serving (status, start_at, end_at)");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Ad variants migration complete.");
}

// Back to one size per ad: each ad keeps its first size. Other sizes (and
// their stats split) are lost; totals are kept.
async function migrateDown(conn) {
  if (!(await columnExists(conn, "ads", "format_id"))) {
    await conn.query(
      `ALTER TABLE ads
         ADD COLUMN format_id INT NULL AFTER status,
         ADD COLUMN image_url VARCHAR(500) NULL AFTER property_id`,
    );
    if (await tableExists(conn, "ad_creatives")) {
      await conn.query(
        `UPDATE ads a
         JOIN (SELECT ad_id, MIN(id) AS id FROM ad_creatives GROUP BY ad_id) first ON first.ad_id = a.id
         JOIN ad_creatives c ON c.id = first.id
         SET a.format_id = c.format_id, a.image_url = c.image_url`,
      );
    }
    await conn.query(
      "UPDATE ads SET format_id = (SELECT MIN(id) FROM ad_formats) WHERE format_id IS NULL",
    );
    if (await indexExists(conn, "ads", "idx_ads_serving")) {
      await conn.query("ALTER TABLE ads DROP INDEX idx_ads_serving");
    }
    await conn.query(
      `ALTER TABLE ads
         MODIFY COLUMN format_id INT NOT NULL,
         ADD FOREIGN KEY (format_id) REFERENCES ad_formats(id),
         ADD INDEX idx_ads_serving (format_id, status, start_at, end_at)`,
    );
    console.log("+ ads.format_id, ads.image_url (first size of each ad)");
  }

  if (await columnExists(conn, "ad_stats_daily", "format_id")) {
    // Merge the per-size rows back into one row per ad/day/placement.
    await conn.query("DROP TEMPORARY TABLE IF EXISTS ad_stats_merge");
    await conn.query(
      `CREATE TEMPORARY TABLE ad_stats_merge AS
       SELECT ad_id, stat_date, placement, SUM(impressions) AS impressions, SUM(clicks) AS clicks
       FROM ad_stats_daily GROUP BY ad_id, stat_date, placement`,
    );
    await conn.query("DELETE FROM ad_stats_daily");
    await conn.query(
      "ALTER TABLE ad_stats_daily DROP PRIMARY KEY, DROP COLUMN format_id, ADD PRIMARY KEY (ad_id, stat_date, placement)",
    );
    await conn.query(
      `INSERT INTO ad_stats_daily (ad_id, stat_date, placement, impressions, clicks)
       SELECT ad_id, stat_date, placement, impressions, clicks FROM ad_stats_merge`,
    );
    await conn.query("DROP TEMPORARY TABLE ad_stats_merge");
    console.log("- ad_stats_daily.format_id");
  }

  if (await columnExists(conn, "ad_events", "format_id")) {
    await conn.query("ALTER TABLE ad_events DROP COLUMN format_id");
    console.log("- ad_events.format_id");
  }
  if (await columnExists(conn, "ads", "master_image_url")) {
    await conn.query("ALTER TABLE ads DROP COLUMN master_image_url");
    console.log("- ads.master_image_url");
  }
  await conn.query("DROP TABLE IF EXISTS ad_creatives");
  console.log("- ad_creatives");

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Ad variants migration rolled back.");
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
