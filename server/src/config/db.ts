import sql from "mssql";
import { env } from "./env.js";

function poolConfig(database: string): sql.config {
  return {
    server: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database,
    options: {
      encrypt: env.db.encrypt,
      trustServerCertificate: env.db.trustServerCertificate,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;

/** Connects to the target application database (creates it first if missing). */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  if (connecting) return connecting;

  connecting = (async () => {
    await ensureDatabaseExists();
    const newPool = new sql.ConnectionPool(poolConfig(env.db.database));
    await newPool.connect();
    pool = newPool;
    return newPool;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

/** Connects to `master` and creates env.db.database if it does not already exist. */
export async function ensureDatabaseExists(): Promise<void> {
  const masterPool = new sql.ConnectionPool(poolConfig("master"));
  await masterPool.connect();
  try {
    // CREATE DATABASE cannot take a parameterized identifier; env.db.database comes
    // from trusted server config (.env), never from a client request.
    await masterPool
      .request()
      .input("dbName", sql.NVarChar, env.db.database)
      .query(
        `IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = @dbName)
         EXEC('CREATE DATABASE [' + @dbName + ']')`,
      );
  } finally {
    await masterPool.close();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export { sql };
