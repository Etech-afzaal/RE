/**
 * Apply the property image category migration.
 * Run with `npm run migrate:image-category` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "004_property_image_category";
const INDEX_NAME = "idx_images_category";

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

async function columnExists(conn, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'property_images'
       AND COLUMN_NAME = ? LIMIT 1`,
    [column],
  );
  return rows.length > 0;
}

async function indexExists(conn, index) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'property_images'
       AND INDEX_NAME = ? LIMIT 1`,
    [index],
  );
  return rows.length > 0;
}

async function migrateUp(conn) {
  // image_title predates the migration system (added lazily by the upload
  // route), so place category after it only when it is actually there.
  if (!(await columnExists(conn, "category"))) {
    const after = (await columnExists(conn, "image_title"))
      ? " AFTER image_title"
      : "";
    await conn.query(
      `ALTER TABLE property_images ADD COLUMN category VARCHAR(40) NULL${after}`,
    );
    console.log("+ property_images.category");
  }

  if (!(await indexExists(conn, INDEX_NAME))) {
    await conn.query(
      `CREATE INDEX ${INDEX_NAME} ON property_images(property_id, category)`,
    );
    console.log(`+ ${INDEX_NAME}`);
  }

  const [rows] = await conn.query(
    "SELECT COUNT(*) AS total, SUM(category IS NULL) AS uncategorized FROM property_images",
  );
  console.log(
    `  ${rows[0].total} image(s) preserved, ${rows[0].uncategorized} uncategorized`,
  );

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Property image category migration complete.");
}

async function migrateDown(conn) {
  if (await indexExists(conn, INDEX_NAME)) {
    await conn.query(`DROP INDEX ${INDEX_NAME} ON property_images`);
    console.log(`- ${INDEX_NAME}`);
  }
  if (await columnExists(conn, "category")) {
    await conn.query("ALTER TABLE property_images DROP COLUMN category");
    console.log("- property_images.category");
  }
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Property image category migration rolled back.");
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
