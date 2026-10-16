/**
 * Add persistent agent/property Free Ads preferences and directional agent
 * website blocks. Run with `npm run migrate:free-ads` (add `-- --down` to
 * revert). Existing rows default to enabled so the migration is non-breaking.
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "038_free_ads";

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

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
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
  if (!(await columnExists(conn, "users", "free_ads_enabled"))) {
    await conn.query("ALTER TABLE users ADD COLUMN free_ads_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER theme_settings");
    console.log("+ users.free_ads_enabled");
  } else {
    console.log("  users.free_ads_enabled already exists");
  }

  if (!(await columnExists(conn, "properties", "free_ads_enabled"))) {
    await conn.query("ALTER TABLE properties ADD COLUMN free_ads_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER is_featured");
    console.log("+ properties.free_ads_enabled");
  } else {
    console.log("  properties.free_ads_enabled already exists");
  }

  if (!(await tableExists(conn, "agent_free_ad_blocks"))) {
    await conn.query(`
      CREATE TABLE agent_free_ad_blocks (
        advertiser_agent_id INT NOT NULL,
        blocked_host_agent_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (advertiser_agent_id, blocked_host_agent_id),
        KEY idx_agent_free_ad_blocks_host (blocked_host_agent_id),
        CONSTRAINT fk_agent_free_ad_blocks_advertiser
          FOREIGN KEY (advertiser_agent_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_agent_free_ad_blocks_host
          FOREIGN KEY (blocked_host_agent_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    );
    console.log("+ agent_free_ad_blocks");
  } else {
    console.log("  agent_free_ad_blocks already exists");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Free Ads migration complete.");
}

async function migrateDown(conn) {
  if (await tableExists(conn, "agent_free_ad_blocks")) {
    await conn.query("DROP TABLE agent_free_ad_blocks");
    console.log("- agent_free_ad_blocks");
  }
  if (await columnExists(conn, "properties", "free_ads_enabled")) {
    await conn.query("ALTER TABLE properties DROP COLUMN free_ads_enabled");
    console.log("- properties.free_ads_enabled");
  }
  if (await columnExists(conn, "users", "free_ads_enabled")) {
    await conn.query("ALTER TABLE users DROP COLUMN free_ads_enabled");
    console.log("- users.free_ads_enabled");
  }
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Free Ads migration rolled back.");
}

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await conn.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    );
    if (process.argv.includes("--down") || process.argv.includes("--revert")) await migrateDown(conn);
    else await migrateUp(conn);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
