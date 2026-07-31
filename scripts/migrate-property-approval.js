/**
 * Apply the property approval audit-trail migration.
 * Run with `npm run migrate:property-approval` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "003_property_approval";

const FINAL_STATUS_ENUM =
  "ENUM('draft','pending_approval','approved','rejected','sold','hidden')";
const WIDE_STATUS_ENUM =
  "ENUM('active','draft','pending_approval','approved','rejected','sold','hidden')";

const NEW_COLUMNS = [
  ["submitted_at", "DATETIME NULL AFTER status"],
  ["rejected_at", "DATETIME NULL AFTER rejected_reason"],
  ["rejected_by", "VARCHAR(100) NULL AFTER rejected_at"],
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

async function indexExists(conn, index) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND INDEX_NAME = ? LIMIT 1`,
    [index],
  );
  return rows.length > 0;
}

async function statusColumnType(conn) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND COLUMN_NAME = 'status' LIMIT 1`,
  );
  return rows[0]?.type || "";
}

async function migrateUp(conn) {
  for (const [column, definition] of NEW_COLUMNS) {
    if (await columnExists(conn, column)) continue;
    await conn.query(
      `ALTER TABLE properties ADD COLUMN ${column} ${definition}`,
    );
    console.log(`+ properties.${column}`);
  }

  // Installs that never ran 001 still carry the pre-Phase-1 'active' value.
  if ((await statusColumnType(conn)).includes("'active'")) {
    await conn.query(
      `ALTER TABLE properties MODIFY COLUMN status ${WIDE_STATUS_ENUM} NOT NULL DEFAULT 'draft'`,
    );
    const [remap] = await conn.query(
      "UPDATE properties SET status = 'approved' WHERE status = 'active'",
    );
    console.log(`~ remapped ${remap.affectedRows} active listing(s) to approved`);
  }

  await conn.query(
    `ALTER TABLE properties MODIFY COLUMN status ${FINAL_STATUS_ENUM} NOT NULL DEFAULT 'draft'`,
  );

  const [backfill] = await conn.query(
    `UPDATE properties
     SET submitted_at = COALESCE(approved_at, updated_at, created_at)
     WHERE submitted_at IS NULL
       AND status IN ('pending_approval','approved','rejected','sold','hidden')`,
  );
  if (backfill.affectedRows) {
    console.log(`~ backfilled submitted_at on ${backfill.affectedRows} listing(s)`);
  }

  if (!(await indexExists(conn, "idx_properties_status"))) {
    await conn.query(
      "CREATE INDEX idx_properties_status ON properties(status)",
    );
    console.log("+ idx_properties_status");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Property approval migration complete.");
}

async function migrateDown(conn) {
  if (await indexExists(conn, "idx_properties_status")) {
    await conn.query("DROP INDEX idx_properties_status ON properties");
    console.log("- idx_properties_status");
  }

  for (const [column] of NEW_COLUMNS) {
    if (!(await columnExists(conn, column))) continue;
    await conn.query(`ALTER TABLE properties DROP COLUMN ${column}`);
    console.log(`- properties.${column}`);
  }

  // Listing statuses are left as-is; only the pre-approval default is restored.
  await conn.query(
    `ALTER TABLE properties MODIFY COLUMN status ${FINAL_STATUS_ENUM} NOT NULL DEFAULT 'approved'`,
  );

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Property approval migration rolled back.");
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
    multipleStatements: false,
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
