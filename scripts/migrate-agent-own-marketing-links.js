/**
 * Agent-owned property marketing links (subagent_id NULL).
 * Run with `npm run migrate:agent-own-marketing-links` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "029_agent_own_marketing_links";

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

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND INDEX_NAME = ? LIMIT 1`,
    [table, indexName],
  );
  return rows.length > 0;
}

async function foreignKeyExists(conn, table, constraintName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [table, constraintName],
  );
  return rows.length > 0;
}

async function migrateUp(conn) {
  if (await foreignKeyExists(conn, "property_marketing_links", "fk_marketing_links_subagent")) {
    await conn.query(
      "ALTER TABLE property_marketing_links DROP FOREIGN KEY fk_marketing_links_subagent",
    );
    console.log("  dropped fk_marketing_links_subagent");
  }

  if (await indexExists(conn, "property_marketing_links", "uq_marketing_links_property_subagent")) {
    await conn.query(
      "ALTER TABLE property_marketing_links DROP INDEX uq_marketing_links_property_subagent",
    );
    console.log("  dropped uq_marketing_links_property_subagent");
  }

  await conn.query(
    "ALTER TABLE property_marketing_links MODIFY subagent_id INT NULL",
  );
  console.log("+ property_marketing_links.subagent_id nullable");

  if (!(await columnExists(conn, "property_marketing_links", "subagent_id_key"))) {
    await conn.query(
      "ALTER TABLE property_marketing_links ADD COLUMN subagent_id_key INT GENERATED ALWAYS AS (IFNULL(subagent_id, -1)) STORED",
    );
    console.log("+ property_marketing_links.subagent_id_key");
  } else {
    console.log("  property_marketing_links.subagent_id_key already exists");
  }

  if (!(await indexExists(conn, "property_marketing_links", "uq_marketing_links_property_subagent"))) {
    await conn.query(
      "ALTER TABLE property_marketing_links ADD UNIQUE KEY uq_marketing_links_property_subagent (property_id, subagent_id_key)",
    );
    console.log("+ uq_marketing_links_property_subagent (property_id, subagent_id_key)");
  }

  if (!(await foreignKeyExists(conn, "property_marketing_links", "fk_marketing_links_subagent"))) {
    await conn.query(
      "ALTER TABLE property_marketing_links ADD CONSTRAINT fk_marketing_links_subagent FOREIGN KEY (subagent_id) REFERENCES subagents (id) ON DELETE RESTRICT",
    );
    console.log("+ fk_marketing_links_subagent");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Agent own marketing links migration complete.");
}

async function migrateDown(conn) {
  if (await foreignKeyExists(conn, "property_marketing_links", "fk_marketing_links_subagent")) {
    await conn.query(
      "ALTER TABLE property_marketing_links DROP FOREIGN KEY fk_marketing_links_subagent",
    );
  }

  if (await indexExists(conn, "property_marketing_links", "uq_marketing_links_property_subagent")) {
    await conn.query(
      "ALTER TABLE property_marketing_links DROP INDEX uq_marketing_links_property_subagent",
    );
  }

  if (await columnExists(conn, "property_marketing_links", "subagent_id_key")) {
    await conn.query(
      "ALTER TABLE property_marketing_links DROP COLUMN subagent_id_key",
    );
    console.log("- property_marketing_links.subagent_id_key");
  }

  await conn.query("DELETE FROM property_marketing_links WHERE subagent_id IS NULL");
  console.log("- agent-owned marketing links rows");

  await conn.query(
    "ALTER TABLE property_marketing_links MODIFY subagent_id INT NOT NULL",
  );

  await conn.query(
    "ALTER TABLE property_marketing_links ADD UNIQUE KEY uq_marketing_links_property_subagent (property_id, subagent_id)",
  );
  await conn.query(
    "ALTER TABLE property_marketing_links ADD CONSTRAINT fk_marketing_links_subagent FOREIGN KEY (subagent_id) REFERENCES subagents (id) ON DELETE RESTRICT",
  );

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Agent own marketing links migration rolled back.");
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
