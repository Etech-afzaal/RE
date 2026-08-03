/**
 * Rename agents to users and seed the one database-backed administrator.
 * ADMIN_EMAIL and ADMIN_PASSWORD are read only while this migration runs.
 * Usage: npm run migrate:users [-- --down]
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const MIGRATION_ID = "006_users_table";

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1",
    [table],
  );
  return rows.length > 0;
}

async function columnExists(conn, column) {
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ? LIMIT 1",
    [column],
  );
  return rows.length > 0;
}

async function up(conn) {
  if (await tableExists(conn, "agents")) await conn.query("RENAME TABLE agents TO users");
  if (!(await tableExists(conn, "users"))) throw new Error("Neither agents nor users table exists.");
  if (!(await columnExists(conn, "user_type"))) {
    await conn.query("ALTER TABLE users ADD COLUMN user_type ENUM('admin','agent') NOT NULL DEFAULT 'agent' AFTER password_hash");
  }
  await conn.query("UPDATE users SET user_type = 'agent' WHERE user_type IS NULL OR user_type != 'admin'");

  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required once to seed the administrator.");

  const [admins] = await conn.query("SELECT id FROM users WHERE email = ? AND user_type = 'admin' LIMIT 1", [email]);
  if (!admins.length) {
    const passwordHash = await bcrypt.hash(password, 10);
    await conn.query(
      "INSERT INTO users (estate_name, username, full_name, email, password_hash, must_reset_password, status, user_type) VALUES (?, ?, ?, ?, ?, FALSE, 'approved', 'admin')",
      [`admin-${Date.now()}`, null, "Admin", email, passwordHash],
    );
  }
  await conn.query("INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at", [MIGRATION_ID]);
}

async function down(conn) {
  if (!(await tableExists(conn, "users"))) return;
  if (await columnExists(conn, "user_type")) {
    await conn.query("DELETE FROM users WHERE user_type = 'admin'");
    await conn.query("ALTER TABLE users DROP COLUMN user_type");
  }
  await conn.query("RENAME TABLE users TO agents");
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
}

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  try {
    await conn.query("CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    if (process.argv.includes("--down")) await down(conn); else await up(conn);
  } finally {
    await conn.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
