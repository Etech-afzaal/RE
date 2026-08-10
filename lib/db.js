import mysql from "mysql2/promise";

// A single shared connection pool, reused across requests.
// In dev, Next.js hot-reloads modules, so we stash the pool on `globalThis`
// to avoid creating a new pool (and exhausting connections) on every reload.
// Always read/write via getPool() so duplicate module instances and resets
// cannot keep using a closed pool reference.
// Stale remote connections can still hang forever without timeouts — those
// are enforced below so auth/API calls fail fast instead of spinning.

const QUERY_TIMEOUT_MS = 15_000;
const globalForMysql = globalThis;

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

function getPool() {
  if (!globalForMysql._mysqlPool) {
    globalForMysql._mysqlPool = createPool();
  }
  return globalForMysql._mysqlPool;
}

// Back-compat for any code that imports `{ pool }`.
export const pool = {
  execute: (...args) => getPool().execute(...args),
  query: (...args) => getPool().query(...args),
  getConnection: (...args) => getPool().getConnection(...args),
  end: (...args) => getPool().end(...args),
};

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

let resetPromise = null;

/** Drop a hung/stale pool so the next request opens fresh sockets. */
async function resetPool() {
  // Serialize resets so concurrent failed queries cannot end each other's
  // replacement pool (classic cause of sticky "Pool is closed" in Promise.all).
  if (resetPromise) {
    await resetPromise;
    return;
  }

  resetPromise = (async () => {
    const previous = globalForMysql._mysqlPool;
    const next = createPool();
    globalForMysql._mysqlPool = next;

    if (previous && previous !== next) {
      try {
        await previous.end();
      } catch {
        // Previous pool may already be dead.
      }
    }
  })();

  try {
    await resetPromise;
  } finally {
    resetPromise = null;
  }
}

function shouldResetPool(err) {
  const message = String(err?.message || err);
  const code = err?.code;
  return (
    message.includes("timed out") ||
    message.includes("Pool is closed") ||
    message.includes("Connection lost") ||
    message.includes("ECONNRESET") ||
    message.includes("ECONNREFUSED") ||
    message.includes("EHOSTUNREACH") ||
    message.includes("ENETUNREACH") ||
    message.includes("PROTOCOL_CONNECTION_LOST") ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "POOL_CLOSED"
  );
}

/** True when MySQL is unreachable / timed out (not an application query error). */
export function isDatabaseConnectivityError(err) {
  return shouldResetPool(err);
}

// Small helper so call sites don't need to know about mysql2's [rows, fields] tuple.
export async function query(sql, params = []) {
  try {
    const [rows] = await withTimeout(
      getPool().execute(sql, params),
      QUERY_TIMEOUT_MS,
      "Database query timed out. Please try again.",
    );
    return rows;
  } catch (err) {
    if (!shouldResetPool(err)) throw err;

    await resetPool();
    const [rows] = await withTimeout(
      getPool().execute(sql, params),
      QUERY_TIMEOUT_MS,
      "Database query timed out. Please try again.",
    );
    return rows;
  }
}
