/**
 * Subagents, property marketing links, and link insights tables.
 * Run with `npm run migrate:subagents-marketing-links` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "027_subagents_marketing_links";

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
  if (!(await tableExists(conn, "subagents"))) {
    await conn.query(`
      CREATE TABLE subagents (
        id INT NOT NULL AUTO_INCREMENT,
        agent_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        image VARCHAR(512) NULL,
        phone VARCHAR(32) NOT NULL,
        email VARCHAR(255) NOT NULL,
        description TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_subagents_agent_id (agent_id),
        KEY idx_subagents_agent_active (agent_id, is_active),
        CONSTRAINT fk_subagents_agent FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("+ subagents");
  } else {
    console.log("  subagents already exists");
  }

  if (!(await tableExists(conn, "property_marketing_links"))) {
    await conn.query(`
      CREATE TABLE property_marketing_links (
        id INT NOT NULL AUTO_INCREMENT,
        property_id INT NOT NULL,
        agent_id INT NOT NULL,
        subagent_id INT NOT NULL,
        unique_code VARCHAR(16) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_marketing_links_code (unique_code),
        UNIQUE KEY uq_marketing_links_property_subagent (property_id, subagent_id),
        KEY idx_marketing_links_property (property_id),
        KEY idx_marketing_links_agent (agent_id),
        CONSTRAINT fk_marketing_links_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
        CONSTRAINT fk_marketing_links_agent FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_marketing_links_subagent FOREIGN KEY (subagent_id) REFERENCES subagents (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("+ property_marketing_links");
  } else {
    console.log("  property_marketing_links already exists");
  }

  if (!(await tableExists(conn, "property_link_insights"))) {
    await conn.query(`
      CREATE TABLE property_link_insights (
        id BIGINT NOT NULL AUTO_INCREMENT,
        marketing_link_id INT NOT NULL,
        event_type ENUM('page_view', 'phone_click', 'whatsapp_click', 'email_sent') NOT NULL,
        metadata JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_link_insights_link (marketing_link_id),
        KEY idx_link_insights_link_event (marketing_link_id, event_type),
        KEY idx_link_insights_created (created_at),
        CONSTRAINT fk_link_insights_link FOREIGN KEY (marketing_link_id) REFERENCES property_marketing_links (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("+ property_link_insights");
  } else {
    console.log("  property_link_insights already exists");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Subagents marketing links migration complete.");
}

async function migrateDown(conn) {
  if (await tableExists(conn, "property_link_insights")) {
    await conn.query("DROP TABLE property_link_insights");
    console.log("- property_link_insights");
  }
  if (await tableExists(conn, "property_marketing_links")) {
    await conn.query("DROP TABLE property_marketing_links");
    console.log("- property_marketing_links");
  }
  if (await tableExists(conn, "subagents")) {
    await conn.query("DROP TABLE subagents");
    console.log("- subagents");
  }

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Subagents marketing links migration rolled back.");
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
