const mysql = require("mysql2/promise");
require("@next/env").loadEnvConfig(process.cwd());

const MIGRATION_ID = "031_property_under_contract";
const STATUS_ENUM = "ENUM('draft','pending_approval','approved','rejected','under_contract','sold','hidden')";
const PREVIOUS_STATUS_ENUM = "ENUM('draft','pending_approval','approved','rejected','sold','hidden')";

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
    await conn.query("CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)");

    if (revert) {
      await conn.beginTransaction();
      await conn.query("UPDATE properties SET status = 'approved' WHERE status = 'under_contract'");
      await conn.query(`ALTER TABLE properties MODIFY COLUMN status ${PREVIOUS_STATUS_ENUM} NOT NULL DEFAULT 'draft'`);
      await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
      await conn.commit();
      console.log("Reverted property Under Contract status migration.");
      return;
    }

    const [applied] = await conn.query("SELECT id FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
    if (applied.length > 0) {
      console.log("Property Under Contract status migration is already applied.");
      return;
    }

    await conn.query(`ALTER TABLE properties MODIFY COLUMN status ${STATUS_ENUM} NOT NULL DEFAULT 'draft'`);
    await conn.query("INSERT INTO schema_migrations (id) VALUES (?)", [MIGRATION_ID]);
    console.log("Applied property Under Contract status migration.");
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
