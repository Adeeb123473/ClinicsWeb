import { getPool, sql } from "../../config/db.js";
import type { Role } from "../../types/auth.js";

export interface UserRow {
  UserID: string;
  ClinicID: string | null;
  Username: string;
  PasswordHash: string;
  Role: Role;
  FullName: string;
  Email: string | null;
  Phone: string | null;
  Status: "Active" | "Inactive" | "Locked";
  MustChangePassword: boolean;
  RefreshTokenHash: string | null;
  FailedLoginAttempts: number;
  LockedUntil: Date | null;
}

/** Not clinic-scoped: usernames are unique platform-wide, needed to resolve login before we know the tenant. */
export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("username", sql.NVarChar, username)
    .query<UserRow>(`SELECT * FROM Users WHERE Username = @username`);
  return result.recordset[0] ?? null;
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query<UserRow>(`SELECT * FROM Users WHERE UserID = @userId`);
  return result.recordset[0] ?? null;
}

export async function recordLoginSuccess(userId: string): Promise<void> {
  const pool = await getPool();
  await pool.request().input("userId", sql.UniqueIdentifier, userId).query(`
      UPDATE Users
      SET FailedLoginAttempts = 0, LockedUntil = NULL, LastLoginAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @userId
    `);
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** Returns true if this failure just locked the account. */
export async function recordLoginFailure(userId: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request().input("userId", sql.UniqueIdentifier, userId).query<{
    FailedLoginAttempts: number;
  }>(`
      UPDATE Users
      SET FailedLoginAttempts = FailedLoginAttempts + 1, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.FailedLoginAttempts
      WHERE UserID = @userId
    `);

  const attempts = result.recordset[0]?.FailedLoginAttempts ?? 0;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await pool
      .request()
      .input("userId", sql.UniqueIdentifier, userId)
      .input("lockedUntil", sql.DateTime2, new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000))
      .query(`UPDATE Users SET LockedUntil = @lockedUntil WHERE UserID = @userId`);
    return true;
  }
  return false;
}

export async function setRefreshTokenHash(userId: string, refreshTokenHash: string | null): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .input("hash", sql.NVarChar, refreshTokenHash)
    .query(`UPDATE Users SET RefreshTokenHash = @hash, UpdatedAt = SYSUTCDATETIME() WHERE UserID = @userId`);
}
