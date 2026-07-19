import { getPool, sql } from "../../config/db.js";

export interface AnnouncementRow {
  AnnouncementID: string;
  Title: string;
  Body: string | null;
  Level: string;
  IsActive: boolean;
  StartsAt: Date | null;
  EndsAt: Date | null;
  CreatedAt: Date;
}

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

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .query<AnnouncementRow>(`SELECT * FROM Announcements ORDER BY CreatedAt DESC`);
  return result.recordset;
}

/** Announcements currently active and within any start/end window — shown on clinic dashboards. */
export async function listActiveAnnouncements(): Promise<AnnouncementRow[]> {
  const pool = await getPool();
  const result = await pool.request().query<AnnouncementRow>(`
    SELECT * FROM Announcements
    WHERE IsActive = 1
      AND (StartsAt IS NULL OR StartsAt <= SYSUTCDATETIME())
      AND (EndsAt IS NULL OR EndsAt >= SYSUTCDATETIME())
    ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

export async function insertAnnouncement(
  title: string,
  body: string | null,
  level: string,
  startsAt: Date | null,
  endsAt: Date | null,
  createdBy: string | null,
): Promise<AnnouncementRow> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("title", sql.NVarChar, title)
    .input("body", sql.NVarChar, body)
    .input("level", sql.NVarChar, level)
    .input("startsAt", sql.DateTime2, startsAt)
    .input("endsAt", sql.DateTime2, endsAt)
    .input("createdBy", sql.UniqueIdentifier, createdBy)
    .query<AnnouncementRow>(`
      INSERT INTO Announcements (Title, Body, Level, StartsAt, EndsAt, CreatedBy)
      OUTPUT INSERTED.*
      VALUES (@title, @body, @level, @startsAt, @endsAt, @createdBy)
    `);
  return result.recordset[0];
}

export async function setAnnouncementActive(id: string, isActive: boolean): Promise<AnnouncementRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .input("isActive", sql.Bit, isActive)
    .query<AnnouncementRow>(`UPDATE Announcements SET IsActive = @isActive OUTPUT INSERTED.* WHERE AnnouncementID = @id`);
  return result.recordset[0] ?? null;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const pool = await getPool();
  await pool.request().input("id", sql.UniqueIdentifier, id).query(`DELETE FROM Announcements WHERE AnnouncementID = @id`);
}
