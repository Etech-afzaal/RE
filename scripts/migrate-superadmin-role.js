/**
 * Rename DB user_type admin → superadmin and ensure both superadmin accounts exist.
 * Usage:
 *   npm run migrate:superadmin-role
 *   npm run migrate:superadmin-role -- --down
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const MIGRATION_ID = "008_superadmin_role";

const SUPERADMINS = [
  {
    email: "etech.tanveer@gmail.com",
    fullName: "Admin",
  },
  {
    email: "etech.afzaal@gmail.com",
    fullName: "Admin",
  },
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

async function columnType(conn) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE AS columnType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'user_type'
     LIMIT 1`,
  );
  return rows[0]?.columnType || "";
}

async function ensureSuperadmin(conn, { email, fullName }, password) {
  const normalized = String(email).trim().toLowerCase();
  const [existing] = await conn.query(
    "SELECT id, user_type FROM users WHERE email = ? LIMIT 1",
    [normalized],
  );

  if (existing.length) {
    if (existing[0].user_type !== "superadmin") {
      await conn.query(
        "UPDATE users SET user_type = 'superadmin', status = 'approved', must_reset_password = FALSE WHERE id = ?",
        [existing[0].id],
      );
      console.log(`~ ${normalized} → user_type=superadmin`);
    } else {
      console.log(`= ${normalized} already superadmin`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // Superadmins do not need a public URL slug (estate_name may be NULL).
  await conn.query(
    `INSERT INTO users
      (estate_name, username, full_name, email, password_hash, must_reset_password, status, user_type)
     VALUES (?, ?, ?, ?, ?, FALSE, 'approved', 'superadmin')`,
    [null, null, fullName, normalized, passwordHash],
  );
  console.log(`+ ${normalized} created as superadmin`);
}

async function migrateUp(conn) {
  const type = await columnType(conn);
  if (!type) throw new Error("users.user_type column not found");

  if (type.includes("'admin'") && !type.includes("'superadmin'")) {
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN user_type ENUM('admin','superadmin','agent') NOT NULL DEFAULT 'agent'",
    );
    await conn.query(
      "UPDATE users SET user_type = 'superadmin' WHERE user_type = 'admin'",
    );
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN user_type ENUM('superadmin','agent') NOT NULL DEFAULT 'agent'",
    );
    console.log("~ user_type ENUM admin → superadmin");
  } else if (type.includes("'superadmin'") && type.includes("'admin'")) {
    await conn.query(
      "UPDATE users SET user_type = 'superadmin' WHERE user_type = 'admin'",
    );
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN user_type ENUM('superadmin','agent') NOT NULL DEFAULT 'agent'",
    );
    console.log("~ finished removing legacy admin from ENUM");
  } else if (type.includes("'superadmin'")) {
    console.log("= user_type ENUM already uses superadmin");
  } else {
    throw new Error(`Unexpected user_type ENUM: ${type}`);
  }

  const password =
    String(process.env.ADMIN_PASSWORD || "").trim() || "admin1234";

  for (const account of SUPERADMINS) {
    await ensureSuperadmin(conn, account, password);
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Superadmin role migration complete.");
}

async function migrateDown(conn) {
  const type = await columnType(conn);
  if (!type) return;

  if (type.includes("'superadmin'")) {
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN user_type ENUM('admin','superadmin','agent') NOT NULL DEFAULT 'agent'",
    );
    await conn.query(
      "UPDATE users SET user_type = 'admin' WHERE user_type = 'superadmin'",
    );
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN user_type ENUM('admin','agent') NOT NULL DEFAULT 'agent'",
    );
    console.log("~ user_type ENUM superadmin → admin");
  }

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [
    MIGRATION_ID,
  ]);
  console.log("Superadmin role rollback complete.");
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
  });

  try {
    await conn.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    );
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
