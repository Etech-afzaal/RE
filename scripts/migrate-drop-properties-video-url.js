/**
 * Drop obsolete properties.video_url.
 * Videos are stored only in property_videos.
 * Run with `npm run migrate:drop-properties-video-url` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "018_drop_properties_video_url";

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

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function assertSafeToDrop(conn) {
  const [orphans] = await conn.query(`
    SELECT p.id, p.video_url
    FROM properties p
    LEFT JOIN property_videos pv ON pv.property_id = p.id
    WHERE p.video_url IS NOT NULL
      AND p.video_url <> ''
      AND pv.id IS NULL
  `);
  if (orphans.length > 0) {
    const sample = orphans
      .slice(0, 20)
      .map((row) => `id=${row.id} url=${row.video_url}`)
      .join("; ");
    throw new Error(
      `Refusing to drop properties.video_url: ${orphans.length} propert(ies) have legacy video URLs not present in property_videos. Sample: ${sample}`,
    );
  }
}

async function migrateUp(conn) {
  if (!(await columnExists(conn, "properties", "video_url"))) {
    console.log("= properties.video_url already absent");
  } else {
    await assertSafeToDrop(conn);
    await conn.query("ALTER TABLE properties DROP COLUMN video_url");
    console.log("- properties.video_url");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Drop properties.video_url migration complete.");
}

async function migrateDown(conn) {
  if (await columnExists(conn, "properties", "video_url")) {
    console.log("= properties.video_url already exists");
  } else {
    await conn.query(
      "ALTER TABLE properties ADD COLUMN video_url VARCHAR(500) NULL AFTER address",
    );
    console.log("+ properties.video_url");
  }

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [
    MIGRATION_ID,
  ]);
  console.log("Drop properties.video_url migration rolled back.");
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
