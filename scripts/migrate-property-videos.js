/**
 * Create the property_videos gallery table and backfill from properties.video_url.
 * Run with `npm run migrate:property-videos` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "005_property_videos";

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
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
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND INDEX_NAME = ? LIMIT 1`,
    [table, index],
  );
  return rows.length > 0;
}

async function migrateUp(conn) {
  if (!(await tableExists(conn, "property_videos"))) {
    await conn.query(`
      CREATE TABLE property_videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        property_id INT NOT NULL,
        video_url VARCHAR(500) NOT NULL,
        category VARCHAR(100) NULL,
        is_featured BOOLEAN DEFAULT FALSE,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
      )
    `);
    console.log("+ property_videos");
  }

  if (!(await indexExists(conn, "property_videos", "idx_videos_property"))) {
    await conn.query(
      "CREATE INDEX idx_videos_property ON property_videos(property_id)",
    );
    console.log("+ idx_videos_property");
  }

  if (!(await indexExists(conn, "property_videos", "idx_videos_category"))) {
    await conn.query(
      "CREATE INDEX idx_videos_category ON property_videos(property_id, category)",
    );
    console.log("+ idx_videos_category");
  }

  const [backfill] = await conn.query(`
    INSERT INTO property_videos (property_id, video_url, category, is_featured, display_order)
    SELECT p.id, p.video_url, NULL, TRUE, 0
    FROM properties p
    WHERE p.video_url IS NOT NULL
      AND p.video_url <> ''
      AND NOT EXISTS (
        SELECT 1 FROM property_videos pv WHERE pv.property_id = p.id
      )
  `);
  console.log(`  backfilled ${backfill.affectedRows || 0} legacy video(s)`);

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Property videos migration complete.");
}

async function migrateDown(conn) {
  if (await tableExists(conn, "property_videos")) {
    await conn.query("DROP TABLE property_videos");
    console.log("- property_videos");
  }
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Property videos migration rolled back.");
}

async function main() {
  loadEnv();
  const down = process.argv.includes("--down");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    if (down) {
      await migrateDown(conn);
    } else {
      await migrateUp(conn);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
