/**
 * Create customer_inquiries table for agent/property lead capture.
 * Usage:
 *   npm run migrate:customer-inquiries
 *   npm run migrate:customer-inquiries -- --down
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "007_customer_inquiries";

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
    `SELECT 1 AS ok
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

async function migrateUp(conn) {
  if (await tableExists(conn, "customer_inquiries")) {
    console.log("= customer_inquiries already exists");
  } else {
    const sqlPath = path.join(
      __dirname,
      "..",
      "migrations",
      "007_customer_inquiries_up.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await conn.query(statement);
    }
    console.log("+ customer_inquiries");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Customer inquiries migration complete.");
}

async function migrateDown(conn) {
  if (await tableExists(conn, "customer_inquiries")) {
    await conn.query("DROP TABLE customer_inquiries");
    console.log("- customer_inquiries");
  }

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [
    MIGRATION_ID,
  ]);
  console.log("Customer inquiries rollback complete.");
}

async function main() {
  loadEnv();
  const down = process.argv.includes("--down");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
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
