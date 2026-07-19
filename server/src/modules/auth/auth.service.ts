import { v4 as uuid } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { recordAuditLog } from "../../middleware/auditLog.js";
import {
  findUserByUsername,
  findUserById,
  recordLoginSuccess,
  recordLoginFailure,
  setRefreshTokenHash,
  type UserRow,
} from "../users/users.repository.js";
import type { AuthUser } from "../../types/auth.js";

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    userId: row.UserID,
    username: row.Username,
    fullName: row.FullName,
    role: row.Role,
    clinicId: row.ClinicID,
    mustChangePassword: row.MustChangePassword,
  };
}

async function issueSession(row: UserRow): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenId = uuid();
  await setRefreshTokenHash(row.UserID, await hashPassword(tokenId));

  const accessToken = signAccessToken({
    sub: row.UserID,
    username: row.Username,
    role: row.Role,
    clinicId: row.ClinicID,
  });
  const refreshToken = signRefreshToken({ sub: row.UserID, tokenId });

  return { accessToken, refreshToken };
}

export async function login(username: string, password: string, ipAddress: string | null): Promise<LoginResult> {
  const row = await findUserByUsername(username);

  // Constant-shaped failure path: don't reveal whether the username exists.
  if (!row || row.Status !== "Active") {
    if (row) {
      await recordAuditLog({
        clinicId: row.ClinicID,
        userId: row.UserID,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: row.UserID,
        ipAddress,
      });
    }
    throw ApiError.unauthorized("Invalid username or password");
  }

  if (row.LockedUntil && new Date(row.LockedUntil).getTime() > Date.now()) {
    throw ApiError.unauthorized("Account is temporarily locked due to repeated failed logins. Try again later.");
  }

  const valid = await verifyPassword(password, row.PasswordHash);
  if (!valid) {
    const justLocked = await recordLoginFailure(row.UserID);
    await recordAuditLog({
      clinicId: row.ClinicID,
      userId: row.UserID,
      action: "LOGIN_FAILED",
      entity: "User",
      entityId: row.UserID,
      ipAddress,
    });
    throw ApiError.unauthorized(
      justLocked
        ? "Account locked due to repeated failed logins. Try again in 15 minutes."
        : "Invalid username or password",
    );
  }

  await recordLoginSuccess(row.UserID);
  const { accessToken, refreshToken } = await issueSession(row);

  await recordAuditLog({
    clinicId: row.ClinicID,
    userId: row.UserID,
    action: "LOGIN_SUCCESS",
    entity: "User",
    entityId: row.UserID,
    ipAddress,
  });

  return { accessToken, refreshToken, user: toAuthUser(row) };
}

export async function refresh(refreshToken: string | undefined): Promise<LoginResult> {
  if (!refreshToken) {
    throw ApiError.unauthorized("No refresh token provided");
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const row = await findUserById(payload.sub);
  if (!row || row.Status !== "Active" || !row.RefreshTokenHash) {
    throw ApiError.unauthorized("Session no longer valid");
  }

  const isCurrentToken = await verifyPassword(payload.tokenId, row.RefreshTokenHash);
  if (!isCurrentToken) {
    // Token reuse / revoked session — invalidate the stored session defensively.
    await setRefreshTokenHash(row.UserID, null);
    throw ApiError.unauthorized("Session no longer valid");
  }

  const { accessToken, refreshToken: newRefreshToken } = await issueSession(row);
  return { accessToken, refreshToken: newRefreshToken, user: toAuthUser(row) };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await setRefreshTokenHash(payload.sub, null);
    await recordAuditLog({
      clinicId: null,
      userId: payload.sub,
      action: "LOGOUT",
      entity: "User",
      entityId: payload.sub,
      ipAddress: null,
    });
  } catch {
    // Already invalid/expired — nothing to revoke.
  }
}

export async function getProfile(userId: string): Promise<AuthUser> {
  const row = await findUserById(userId);
  if (!row) throw ApiError.unauthorized();
  return toAuthUser(row);
}
