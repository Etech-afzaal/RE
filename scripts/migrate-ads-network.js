/**
 * Ads Network tables (ad_formats, ads, ad_stats_daily, ad_events, ad_fill_daily).
 * Run with `npm run migrate:ads-network` (add `-- --down` to roll back).
 *
 * Executes migrations/035_ads_network_{up,down}.sql against DB_NAME from .env,
 * so the SQL files stay the single source of truth. Safe to re-run.
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("@next/env").loadEnvConfig(path.join(__dirname, ".."));

const MIGRATION_ID = "035_ads_network";

function readMigration(direction) {
  const file = path.join(__dirname, "..", "migrations", `${MIGRATION_ID}_${direction}.sql`);
  // Drop the `USE real_estate;` line so the script targets DB_NAME from .env.
  return fs
    .readFileSync(file, "utf8")
    .replace(/^\s*USE\s+\w+\s*;\s*$/gim, "");
}

async function main() {
  const down = process.argv.includes("--down") || process.argv.includes("--revert");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await conn.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    );
    await conn.query(readMigration(down ? "down" : "up"));
    console.log(down ? "Ads Network migration rolled back." : "Ads Network migration applied.");
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
