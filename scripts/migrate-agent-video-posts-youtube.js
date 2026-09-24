/**
 * Add YouTube source fields to agent video posts.
 * Run with `npm run migrate:agent-video-posts-youtube` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "033_agent_video_posts_youtube";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function columnExists(conn, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'video_posts' AND COLUMN_NAME = ?
     LIMIT 1`,
    [column],
  );
  return rows.length > 0;
}

async function migrateUp(conn) {
  if (!(await columnExists(conn, "video_source"))) {
    await conn.query("ALTER TABLE video_posts ADD COLUMN video_source ENUM('UPLOAD','YOUTUBE') NOT NULL DEFAULT 'UPLOAD' AFTER description");
  }
  if (!(await columnExists(conn, "youtube_video_id"))) {
    await conn.query("ALTER TABLE video_posts ADD COLUMN youtube_video_id VARCHAR(32) NULL AFTER video_url");
  }
  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Agent video post YouTube migration complete.");
}

async function migrateDown(conn) {
  if (await columnExists(conn, "youtube_video_id")) {
    await conn.query("ALTER TABLE video_posts DROP COLUMN youtube_video_id");
  }
  if (await columnExists(conn, "video_source")) {
    await conn.query("ALTER TABLE video_posts DROP COLUMN video_source");
  }
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [MIGRATION_ID]);
  console.log("Agent video post YouTube migration rolled back.");
}

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });
  try {
    if (process.argv.includes("--down")) await migrateDown(conn);
    else await migrateUp(conn);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
