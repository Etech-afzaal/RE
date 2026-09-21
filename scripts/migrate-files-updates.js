/**
 * Agent files updates — single live market update page per agent.
 * Run with `npm run migrate:files-updates` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "033_files_updates";

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

async function migrateUp(conn) {
  // Drop old multi-post table if a prior migration attempt created it.
  if (await tableExists(conn, "files_updates")) {
    await conn.query("DROP TABLE files_updates");
    console.log("- files_updates (old multi-post table)");
  }

  if (!(await tableExists(conn, "agent_files_updates"))) {
    await conn.query(`
      CREATE TABLE agent_files_updates (
        id INT NOT NULL AUTO_INCREMENT,
        agent_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content LONGTEXT NULL,
        status ENUM('draft','published') NOT NULL DEFAULT 'draft',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_agent_files_updates_agent (agent_id),
        KEY idx_agent_files_updates_status (status),
        CONSTRAINT fk_agent_files_updates_agent FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("+ agent_files_updates");
  } else {
    console.log("  agent_files_updates already exists");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Agent files updates migration complete.");
}

async function migrateDown(conn) {
  if (await tableExists(conn, "agent_files_updates")) {
    await conn.query("DROP TABLE agent_files_updates");
    console.log("- agent_files_updates");
  }
  if (await tableExists(conn, "files_updates")) {
    await conn.query("DROP TABLE files_updates");
    console.log("- files_updates");
  }

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Agent files updates migration rolled back.");
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
