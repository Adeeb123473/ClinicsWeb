import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPool, sql } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__migrations')
    CREATE TABLE __migrations (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(255) NOT NULL UNIQUE,
      AppliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `);
}

async function getAppliedMigrations(pool: sql.ConnectionPool): Promise<Set<string>> {
  const result = await pool.request().query<{ Name: string }>(`SELECT Name FROM __migrations`);
  return new Set(result.recordset.map((r) => r.Name));
}

/** Idempotent: safe to call on every app/test startup, only applies migrations not yet recorded. */
export async function runMigrations(): Promise<number> {
  const pool = await getPool();

  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sqlText = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    // Split on GO batch separators (SQL Server tooling convention), ignore blank batches.
    const batches = sqlText
      .split(/^\s*GO\s*$/im)
      .map((b) => b.trim())
      .filter(Boolean);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const batch of batches) {
        await new sql.Request(transaction).query(batch);
      }
      await new sql.Request(transaction)
        .input("name", sql.NVarChar, file)
        .query(`INSERT INTO __migrations (Name) VALUES (@name)`);
      await transaction.commit();
      appliedCount++;
    } catch (err) {
      await transaction.rollback();
      throw new Error(`Migration failed: ${file}\n${(err as Error).message}`);
    }
  }

  return appliedCount;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const { closePool } = await import("../config/db.js");
  console.log("Connecting and ensuring database exists...");
  runMigrations()
    .then(async (count) => {
      console.log(count === 0 ? "No pending migrations. Database is up to date." : `Applied ${count} migration(s).`);
      await closePool();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
