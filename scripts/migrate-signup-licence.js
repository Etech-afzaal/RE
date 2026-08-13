/**
 * Add licence_number on signup_requests and widen estate_name to 30 chars.
 * Run with `npm run migrate:signup-licence` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "015_signup_licence_number";

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

async function getColumnType(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows[0]?.COLUMN_TYPE || null;
}

async function migrateUp(conn) {
  const signupEstateType = await getColumnType(
    conn,
    "signup_requests",
    "estate_name",
  );
  if (signupEstateType && !/varchar\(30\)/i.test(signupEstateType)) {
    await conn.query(
      "ALTER TABLE signup_requests MODIFY COLUMN estate_name VARCHAR(30) NOT NULL",
    );
    console.log("+ signup_requests.estate_name -> VARCHAR(30)");
  } else {
    console.log("= signup_requests.estate_name already VARCHAR(30)");
  }

  if (await columnExists(conn, "signup_requests", "licence_number")) {
    console.log("= signup_requests.licence_number already exists");
  } else {
    await conn.query(
      "ALTER TABLE signup_requests ADD COLUMN licence_number VARCHAR(25) NULL AFTER phone",
    );
    console.log("+ signup_requests.licence_number");
  }

  const usersEstateType = await getColumnType(conn, "users", "estate_name");
  if (usersEstateType && !/varchar\(30\)/i.test(usersEstateType)) {
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN estate_name VARCHAR(30) UNIQUE NULL",
    );
    console.log("+ users.estate_name -> VARCHAR(30)");
  } else {
    console.log("= users.estate_name already VARCHAR(30)");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Signup licence number migration complete.");
}

async function migrateDown(conn) {
  if (await columnExists(conn, "signup_requests", "licence_number")) {
    await conn.query("ALTER TABLE signup_requests DROP COLUMN licence_number");
    console.log("- signup_requests.licence_number");
  }

  await conn.query(
    "ALTER TABLE signup_requests MODIFY COLUMN estate_name VARCHAR(20) NOT NULL",
  );
  console.log("+ signup_requests.estate_name -> VARCHAR(20)");

  await conn.query(
    "ALTER TABLE users MODIFY COLUMN estate_name VARCHAR(20) UNIQUE NULL",
  );
  console.log("+ users.estate_name -> VARCHAR(20)");

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [
    MIGRATION_ID,
  ]);
  console.log("Signup licence number migration rolled back.");
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
