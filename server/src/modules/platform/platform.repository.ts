import { getPool, sql } from "../../config/db.js";

export async function readSettings(): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request().query<{ Settings: string }>(`SELECT Settings FROM PlatformSettings WHERE Id = 1`);
  return result.recordset[0]?.Settings ?? null;
}

export async function writeSettings(settingsJson: string, updatedBy: string | null): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("settings", sql.NVarChar(sql.MAX), settingsJson)
    .input("updatedBy", sql.UniqueIdentifier, updatedBy)
    .query(`
      IF EXISTS (SELECT 1 FROM PlatformSettings WHERE Id = 1)
        UPDATE PlatformSettings SET Settings = @settings, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy WHERE Id = 1;
      ELSE
        INSERT INTO PlatformSettings (Id, Settings, UpdatedBy) VALUES (1, @settings, @updatedBy);
    `);
}
