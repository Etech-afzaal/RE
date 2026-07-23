/**
 * Load realistic demo data from seed.sql using .env DB credentials.
 * Usage: npm run seed
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

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

async function main() {
  loadEnv();
  const sqlPath = path.join(__dirname, "..", "seed.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  await conn.query(sql);

  const [[{ agents }]] = await conn.query("SELECT COUNT(*) AS agents FROM agents");
  const [[{ properties }]] = await conn.query(
    "SELECT COUNT(*) AS properties FROM properties",
  );
  const [[{ images }]] = await conn.query(
    "SELECT COUNT(*) AS images FROM property_images",
  );

  console.log(`Seeded ${agents} agents, ${properties} properties, ${images} images.`);
  console.log("Agent login password for all demo accounts: demo1234");
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
