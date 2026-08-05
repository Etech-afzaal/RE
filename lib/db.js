import mysql from "mysql2/promise";

// A single shared connection pool, reused across requests.
// In dev, Next.js hot-reloads modules, so we stash the pool on `global`
// to avoid creating a new pool (and exhausting connections) on every reload.
// Stale remote connections can still hang forever without timeouts — those
// are enforced below so auth/API calls fail fast instead of spinning.

const QUERY_TIMEOUT_MS = 15_000;

function poolConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 50,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 5_000,
    dateStrings: true,
  };
}

function createPool() {
  return mysql.createPool(poolConfig());
}

export let pool = global._mysqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global._mysqlPool = pool;
}

async function withTimeout(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Drop a hung/stale pool so the next request opens fresh sockets. */
async function resetPool() {
  const previous = pool;
  pool = createPool();
  if (process.env.NODE_ENV !== "production") {
    global._mysqlPool = pool;
  }
  try {
    await previous.end();
  } catch {
    // Previous pool may already be dead.
  }
}

// Small helper so call sites don't need to know about mysql2's [rows, fields] tuple.
export async function query(sql, params = []) {
  try {
    const [rows] = await withTimeout(
      pool.execute(sql, params),
      QUERY_TIMEOUT_MS,
      "Database query timed out. Please try again.",
    );
    return rows;
  } catch (err) {
    const message = String(err?.message || err);
    const shouldReset =
      message.includes("timed out") ||
      message.includes("Connection lost") ||
      message.includes("ECONNRESET") ||
      message.includes("ECONNREFUSED") ||
      message.includes("PROTOCOL_CONNECTION_LOST") ||
      err?.code === "PROTOCOL_CONNECTION_LOST" ||
      err?.code === "ECONNRESET";

    if (!shouldReset) throw err;

    await resetPool();
    const [rows] = await withTimeout(
      pool.execute(sql, params),
      QUERY_TIMEOUT_MS,
      "Database query timed out. Please try again.",
    );
    return rows;
  }
}
