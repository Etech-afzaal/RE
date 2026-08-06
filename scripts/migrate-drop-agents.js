/**
 * Drop obsolete agents table and allow NULL estate_name for superadmins.
 * Usage:
 *   npm run migrate:drop-agents
 *   npm run migrate:drop-agents -- --down
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "009_drop_agents_table";

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
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

async function fksReferencing(conn, table) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME = ?`,
    [table],
  );
  return rows;
}

async function columnNullable(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT IS_NULLABLE AS isNullable
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column],
  );
  return rows[0]?.isNullable === "YES";
}

async function migrateUp(conn) {
  if (await tableExists(conn, "agents")) {
    const fks = await fksReferencing(conn, "agents");
    if (fks.length) {
      throw new Error(
        `Refusing to drop agents: ${fks.length} foreign key(s) still reference it: ${JSON.stringify(fks)}`,
      );
    }

    const [[{ c: agentCount }]] = await conn.query(
      "SELECT COUNT(*) AS c FROM agents",
    );
    console.log(`~ agents table present (${agentCount} rows) — dropping`);
    await conn.query("DROP TABLE IF EXISTS agents");
    console.log("~ DROP TABLE agents");
  } else {
    console.log("= agents table already absent");
  }

  if (!(await columnNullable(conn, "users", "estate_name"))) {
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN estate_name VARCHAR(20) NULL",
    );
    console.log("~ users.estate_name → NULL allowed");
  } else {
    console.log("= users.estate_name already nullable");
  }

  const [result] = await conn.query(
    "UPDATE users SET estate_name = NULL WHERE user_type = 'superadmin' AND estate_name IS NOT NULL",
  );
  console.log(
    `~ cleared estate_name on ${result.affectedRows || 0} superadmin row(s)`,
  );

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("009_drop_agents_table complete.");
}

async function migrateDown(conn) {
  await conn.query(
    `UPDATE users
     SET estate_name = CONCAT('sa-', id)
     WHERE user_type = 'superadmin'
       AND (estate_name IS NULL OR estate_name = '')`,
  );
  await conn.query(
    `UPDATE users
     SET estate_name = CONCAT('user-', id)
     WHERE estate_name IS NULL OR estate_name = ''`,
  );

  if (await columnNullable(conn, "users", "estate_name")) {
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN estate_name VARCHAR(20) NOT NULL",
    );
    console.log("~ users.estate_name → NOT NULL");
  }

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [
    MIGRATION_ID,
  ]);
  console.log(
    "009 rollback complete (agents table not restored — use DB backup if needed).",
  );
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
