import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface NotificationRow {
  NotificationID: string;
  Type: string;
  Title: string;
  Message: string | null;
  IsRead: boolean;
  CreatedAt: Date;
}

/**
 * Fire-and-forget in-app notification. Callers should not await-block their main flow on it;
 * failures are swallowed so a notification write never breaks a booking/check-in/lab action.
 */
export async function notify(
  clinicId: string,
  userId: string,
  type: string,
  title: string,
  message: string | null = null,
): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("userId", sql.UniqueIdentifier, userId)
      .input("type", sql.NVarChar, type)
      .input("title", sql.NVarChar, title)
      .input("message", sql.NVarChar, message)
      .query(`
        INSERT INTO Notifications (ClinicID, UserID, Type, Title, Message)
        VALUES (@clinicId, @userId, @type, @title, @message)
      `);
  } catch (err) {
    console.error("notification write failed:", err);
  }
}

/** Resolves the Users.UserID for a doctor, used to target notifications at the treating doctor. */
export async function doctorUserId(clinicId: string, doctorId: string): Promise<string | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<{ UserID: string }>(`SELECT UserID FROM Doctors WHERE ClinicID = @clinicId AND DoctorID = @doctorId`);
  return result.recordset[0]?.UserID ?? null;
}

export async function listForUser(clinicId: string, userId: string): Promise<NotificationRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query<NotificationRow>(`
      SELECT TOP 50 NotificationID, Type, Title, Message, IsRead, CreatedAt
      FROM Notifications WHERE ClinicID = @clinicId AND UserID = @userId
      ORDER BY CreatedAt DESC
    `);
  return result.recordset;
}

export async function markRead(clinicId: string, userId: string, notificationId: string): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("id", sql.UniqueIdentifier, notificationId)
    .query(`UPDATE Notifications SET IsRead = 1 WHERE ClinicID = @clinicId AND UserID = @userId AND NotificationID = @id`);
}

export async function markAllRead(clinicId: string, userId: string): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`UPDATE Notifications SET IsRead = 1 WHERE ClinicID = @clinicId AND UserID = @userId AND IsRead = 0`);
}
