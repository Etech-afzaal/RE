import mysql from "mysql2/promise";

// A single shared connection pool, reused across requests.
// In dev, Next.js hot-reloads modules, so we stash the pool on `global`
// to avoid creating a new pool (and exhausting connections) on every reload.

export const pool =
  global._mysqlPool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
  });

if (process.env.NODE_ENV !== "production") {
  global._mysqlPool = pool;
}

// Small helper so call sites don't need to know about mysql2's [rows, fields] tuple.
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
