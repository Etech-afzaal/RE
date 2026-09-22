const mysql = require("mysql2/promise");
require("@next/env").loadEnvConfig(process.cwd());

const MIGRATION_ID = "034_property_visibility";
const STATUS_ENUM = "ENUM('draft','pending_approval','approved','rejected','under_contract','sold')";
const LEGACY_STATUS_ENUM = "ENUM('draft','pending_approval','approved','rejected','under_contract','sold','hidden')";

async function columnExists(conn, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND COLUMN_NAME = ? LIMIT 1`,
    [column],
  );
  return rows.length > 0;
}

async function main() {
  const revert = process.argv.includes("--revert");
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

    if (revert) {
      if (!(await columnExists(conn, "is_hidden"))) {
        console.log("Property visibility migration is already reverted.");
        return;
      }
      await conn.query(`ALTER TABLE properties MODIFY COLUMN status ${LEGACY_STATUS_ENUM} NOT NULL DEFAULT 'draft'`);
      await conn.query("UPDATE properties SET status = 'hidden' WHERE is_hidden = TRUE");
      await conn.query("ALTER TABLE properties DROP COLUMN is_hidden");
      await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
      console.log("Reverted property visibility migration.");
      return;
    }

    const [applied] = await conn.query("SELECT id FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
    if (applied.length > 0 && (await columnExists(conn, "is_hidden"))) {
      console.log("Property visibility migration is already applied.");
      return;
    }

    if (!(await columnExists(conn, "is_hidden"))) {
      await conn.query("ALTER TABLE properties ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE AFTER status");
    }

    await conn.query("CREATE TEMPORARY TABLE legacy_hidden_property_status AS SELECT p.id, COALESCE((SELECT JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.old_status')) FROM audit_logs a WHERE a.entity_type = 'property' AND a.entity_id = p.id AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.new_status')) = 'hidden' AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.old_status')) IN ('approved', 'under_contract', 'sold') ORDER BY a.created_at DESC, a.id DESC LIMIT 1), 'approved') AS actual_status FROM properties p WHERE p.status = 'hidden'");
    await conn.query("UPDATE properties p JOIN legacy_hidden_property_status legacy ON legacy.id = p.id SET p.status = legacy.actual_status, p.is_hidden = TRUE");
    await conn.query("DROP TEMPORARY TABLE legacy_hidden_property_status");
    await conn.query(`ALTER TABLE properties MODIFY COLUMN status ${STATUS_ENUM} NOT NULL DEFAULT 'draft'`);
    await conn.query("INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at", [MIGRATION_ID]);
    console.log("Applied property visibility migration.");
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
