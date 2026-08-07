/**
 * Add structured city / area / phase / address columns on properties.
 * Run with `npm run migrate:property-location` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "010_property_location_fields";
const COLUMNS = [
  { name: "city", sql: "VARCHAR(100) NULL AFTER location" },
  { name: "area", sql: "VARCHAR(100) NULL AFTER city" },
  { name: "phase", sql: "VARCHAR(100) NULL AFTER area" },
  { name: "address", sql: "VARCHAR(255) NULL AFTER phase" },
];

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
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND COLUMN_NAME = ? LIMIT 1`,
    [column],
  );
  return rows.length > 0;
}

async function migrateUp(conn) {
  for (const column of COLUMNS) {
    if (await columnExists(conn, column.name)) {
      console.log(`= properties.${column.name} already exists`);
      continue;
    }
    await conn.query(
      `ALTER TABLE properties ADD COLUMN ${column.name} ${column.sql}`,
    );
    console.log(`+ properties.${column.name}`);
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Property location fields migration complete.");
}

async function migrateDown(conn) {
  for (const column of [...COLUMNS].reverse()) {
    if (!(await columnExists(conn, column.name))) continue;
    await conn.query(`ALTER TABLE properties DROP COLUMN ${column.name}`);
    console.log(`- properties.${column.name}`);
  }
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [
    MIGRATION_ID,
  ]);
  console.log("Property location fields migration rolled back.");
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
