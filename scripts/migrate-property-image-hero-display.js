/**
 * Apply the property image hero display migration.
 * Run with `npm run migrate:image-hero-display` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "020_property_image_hero_display";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

async function migrateUp(conn) {
  if (!(await columnExists(conn, "hero_display"))) {
    await conn.query(
      "ALTER TABLE property_images ADD COLUMN hero_display ENUM('yes','no') NOT NULL DEFAULT 'no' AFTER is_featured",
    );
    console.log("+ property_images.hero_display");
  } else {
    console.log("  property_images.hero_display already exists");
  }

  const [rows] = await conn.query(
    "SELECT COUNT(*) AS total, SUM(hero_display = 'yes') AS hero_count FROM property_images",
  );
  console.log(
    `  ${rows[0].total} image(s) preserved, ${rows[0].hero_count} marked for hero display`,
  );

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Property image hero display migration complete.");
}

async function migrateDown(conn) {
  if (await columnExists(conn, "hero_display")) {
    await conn.query("ALTER TABLE property_images DROP COLUMN hero_display");
    console.log("- property_images.hero_display");
  }
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Property image hero display migration rolled back.");
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