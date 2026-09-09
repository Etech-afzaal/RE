/**
 * Add nullable properties.property_data for longer/type-specific information.
 * Run with `npm run migrate:property-data` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "030_property_data";

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

async function migrateUp(conn) {
  if (await columnExists(conn, "properties", "property_data")) {
    console.log("  properties.property_data already exists");
  } else {
    await conn.query(
      "ALTER TABLE properties ADD COLUMN property_data JSON NULL",
    );
    console.log("+ properties.property_data");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Property data migration complete.");
}

async function migrateDown(conn) {
  if (await columnExists(conn, "properties", "property_data")) {
    await conn.query("ALTER TABLE properties DROP COLUMN property_data");
    console.log("- properties.property_data");
  }

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Property data migration rolled back.");
}

async function main() {
  loadEnv();
  const down = process.argv.includes("--down");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    if (down) await migrateDown(conn);
    else await migrateUp(conn);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
