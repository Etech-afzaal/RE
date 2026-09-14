/**
 * Add nullable properties.property_data for longer/type-specific information.
 * Run with `npm run migrate:property-data` (add `-- --down` to roll back).
 */
const path = require("path");
const { loadEnvConfig } = require("@next/env");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "030_property_data";

function loadEnv() {
  loadEnvConfig(path.join(__dirname, ".."), process.env.NODE_ENV !== "production");
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
  const [before] = await conn.query("SHOW FULL COLUMNS FROM properties");
  if (await columnExists(conn, "properties", "property_data")) {
    console.log("  properties.property_data already exists");
  } else {
    await conn.query(
      "ALTER TABLE properties ADD COLUMN property_data JSON NULL",
    );
    console.log("+ properties.property_data");
  }

  const [after] = await conn.query("SHOW FULL COLUMNS FROM properties");
  const column = after.find(column => column.Field === "property_data");
  if (column?.Type !== "json" || column.Null !== "YES") {
    throw new Error("properties.property_data must be JSON NULL; migration was not recorded.");
  }
  if (JSON.stringify(before.filter(column => column.Field !== "property_data")) !==
      JSON.stringify(after.filter(column => column.Field !== "property_data"))) {
    throw new Error("Existing properties columns changed unexpectedly; migration was not recorded.");
  }
  console.log("Verified properties.property_data: JSON NULL; all existing columns unchanged.");

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
