const mysql = require("mysql2/promise");
const fs = require("fs");
const env = {};
fs.readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  });

(async () => {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  const [rows] = await pool.query(
    'SELECT id, estate_name, full_name, status FROM users WHERE status = "active" AND user_type = "agent"',
  );
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
