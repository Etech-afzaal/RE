/**
 * Apply or roll back Phase 1 database foundation migration.
 * Uses .env DB credentials (same pattern as scripts/seed.js).
 *
 * Usage:
 *   npm run migrate:phase1
 *   npm run migrate:phase1 -- --down
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "001_phase1_foundation";

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
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [table, indexName],
  );
  return rows.length > 0;
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function isApplied(conn) {
  const [rows] = await conn.query(
    "SELECT id FROM schema_migrations WHERE id = ? LIMIT 1",
    [MIGRATION_ID],
  );
  return rows.length > 0;
}

async function migrateUp(conn) {
  await ensureMigrationsTable(conn);

  if (await isApplied(conn)) {
    console.log(`Migration ${MIGRATION_ID} already applied. Nothing to do.`);
    return;
  }

  console.log(`Applying ${MIGRATION_ID}...`);

  // --- agents columns ---
  if (!(await columnExists(conn, "agents", "username"))) {
    await conn.query(
      "ALTER TABLE agents ADD COLUMN username VARCHAR(100) NULL AFTER estate_name",
    );
    console.log("  + agents.username");
  }
  if (!(await columnExists(conn, "agents", "profile_image"))) {
    await conn.query(
      "ALTER TABLE agents ADD COLUMN profile_image VARCHAR(500) NULL AFTER phone",
    );
    console.log("  + agents.profile_image");
  }
  if (!(await columnExists(conn, "agents", "description"))) {
    await conn.query(
      "ALTER TABLE agents ADD COLUMN description TEXT NULL AFTER profile_image",
    );
    console.log("  + agents.description");
  }
  if (!(await columnExists(conn, "agents", "areas_served"))) {
    await conn.query(
      "ALTER TABLE agents ADD COLUMN areas_served VARCHAR(500) NULL AFTER description",
    );
    console.log("  + agents.areas_served");
  }
  if (!(await columnExists(conn, "agents", "updated_at"))) {
    await conn.query(
      `ALTER TABLE agents
       ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
       ON UPDATE CURRENT_TIMESTAMP AFTER created_at`,
    );
    console.log("  + agents.updated_at");
  }

  await conn.query(
    "UPDATE agents SET username = estate_name WHERE username IS NULL OR username = ''",
  );

  if (!(await indexExists(conn, "agents", "uq_agents_username"))) {
    await conn.query(
      "ALTER TABLE agents ADD UNIQUE KEY uq_agents_username (username)",
    );
    console.log("  + uq_agents_username");
  }

  // Expand → remap → shrink agents.status
  await conn.query(`
    ALTER TABLE agents
    MODIFY COLUMN status ENUM(
      'active','disabled','pending','approved','rejected'
    ) NOT NULL DEFAULT 'active'
  `);
  const [agentRemap] = await conn.query(
    "UPDATE agents SET status = 'approved' WHERE status = 'active'",
  );
  console.log(`  ~ agents.status active→approved (${agentRemap.affectedRows} rows)`);
  await conn.query(`
    ALTER TABLE agents
    MODIFY COLUMN status ENUM(
      'pending','approved','rejected','disabled'
    ) NOT NULL DEFAULT 'approved'
  `);

  // --- properties approval columns ---
  if (!(await columnExists(conn, "properties", "approved_by"))) {
    await conn.query(
      "ALTER TABLE properties ADD COLUMN approved_by VARCHAR(100) NULL AFTER status",
    );
    console.log("  + properties.approved_by");
  }
  if (!(await columnExists(conn, "properties", "approved_at"))) {
    await conn.query(
      "ALTER TABLE properties ADD COLUMN approved_at DATETIME NULL AFTER approved_by",
    );
    console.log("  + properties.approved_at");
  }
  if (!(await columnExists(conn, "properties", "rejected_reason"))) {
    await conn.query(
      "ALTER TABLE properties ADD COLUMN rejected_reason TEXT NULL AFTER approved_at",
    );
    console.log("  + properties.rejected_reason");
  }

  await conn.query(`
    ALTER TABLE properties
    MODIFY COLUMN status ENUM(
      'active','sold','draft','pending_approval','approved','rejected','hidden'
    ) NOT NULL DEFAULT 'active'
  `);
  const [propRemap] = await conn.query(
    "UPDATE properties SET status = 'approved' WHERE status = 'active'",
  );
  console.log(
    `  ~ properties.status active→approved (${propRemap.affectedRows} rows)`,
  );
  await conn.query(`
    UPDATE properties
    SET
      approved_by = COALESCE(approved_by, 'legacy_migration'),
      approved_at = COALESCE(approved_at, created_at)
    WHERE status = 'approved'
  `);
  await conn.query(`
    ALTER TABLE properties
    MODIFY COLUMN status ENUM(
      'draft','pending_approval','approved','rejected','sold','hidden'
    ) NOT NULL DEFAULT 'approved'
  `);

  if (!(await columnExists(conn, "property_images", "updated_at"))) {
    await conn.query(`
      ALTER TABLE property_images
      ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP AFTER created_at
    `);
    console.log("  + property_images.updated_at");
  }

  await conn.query("INSERT INTO schema_migrations (id) VALUES (?)", [
    MIGRATION_ID,
  ]);

  const [[counts]] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM agents) AS agents,
      (SELECT COUNT(*) FROM properties) AS properties,
      (SELECT COUNT(*) FROM property_images) AS images,
      (SELECT COUNT(*) FROM agents WHERE status = 'approved') AS agents_approved,
      (SELECT COUNT(*) FROM properties WHERE status = 'approved') AS properties_approved
  `);

  console.log("Phase 1 migration complete.");
  console.log(
    `  Preserved: ${counts.agents} agents, ${counts.properties} properties, ${counts.images} images`,
  );
  console.log(
    `  Live statuses: ${counts.agents_approved} approved agents, ${counts.properties_approved} approved properties`,
  );
}

async function migrateDown(conn) {
  await ensureMigrationsTable(conn);

  if (!(await isApplied(conn))) {
    console.log(`Migration ${MIGRATION_ID} is not applied. Nothing to roll back.`);
    return;
  }

  console.log(`Rolling back ${MIGRATION_ID}...`);

  await conn.query(`
    ALTER TABLE properties
    MODIFY COLUMN status ENUM(
      'draft','pending_approval','approved','rejected','sold','hidden','active'
    ) NOT NULL DEFAULT 'approved'
  `);
  await conn.query(
    "UPDATE properties SET status = 'active' WHERE status = 'approved'",
  );
  await conn.query(
    "UPDATE properties SET status = 'draft' WHERE status IN ('pending_approval','rejected','hidden')",
  );
  await conn.query(`
    ALTER TABLE properties
    MODIFY COLUMN status ENUM('active','sold','draft') NOT NULL DEFAULT 'active'
  `);

  for (const col of ["rejected_reason", "approved_at", "approved_by"]) {
    if (await columnExists(conn, "properties", col)) {
      await conn.query(`ALTER TABLE properties DROP COLUMN ${col}`);
      console.log(`  - properties.${col}`);
    }
  }

  await conn.query(`
    ALTER TABLE agents
    MODIFY COLUMN status ENUM(
      'pending','approved','rejected','disabled','active'
    ) NOT NULL DEFAULT 'approved'
  `);
  await conn.query(
    "UPDATE agents SET status = 'active' WHERE status = 'approved'",
  );
  await conn.query(
    "UPDATE agents SET status = 'disabled' WHERE status IN ('pending','rejected')",
  );
  await conn.query(`
    ALTER TABLE agents
    MODIFY COLUMN status ENUM('active','disabled') NOT NULL DEFAULT 'active'
  `);

  if (await indexExists(conn, "agents", "uq_agents_username")) {
    await conn.query("ALTER TABLE agents DROP INDEX uq_agents_username");
  }
  for (const col of [
    "updated_at",
    "areas_served",
    "description",
    "profile_image",
    "username",
  ]) {
    if (await columnExists(conn, "agents", col)) {
      await conn.query(`ALTER TABLE agents DROP COLUMN ${col}`);
      console.log(`  - agents.${col}`);
    }
  }

  if (await columnExists(conn, "property_images", "updated_at")) {
    await conn.query("ALTER TABLE property_images DROP COLUMN updated_at");
    console.log("  - property_images.updated_at");
  }

  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [
    MIGRATION_ID,
  ]);
  console.log("Phase 1 rollback complete.");
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
