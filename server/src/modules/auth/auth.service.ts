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
import { findClinicStatus } from "../clinics/clinics.repository.js";
import type { AuthUser } from "../../types/auth.js";

const CLINIC_STATUS_MESSAGE: Record<string, string> = {
  Pending: "Your clinic's registration is still pending approval by the platform administrator.",
  Suspended: "Your clinic's account has been suspended. Please contact platform support.",
  Inactive: "Your clinic's account is inactive. Please contact platform support.",
};

/**
 * Staff of a clinic that isn't Approved must not be able to sign in — a clinic is fully
 * unusable until the Super Admin approves it (CLAUDE.md registration/approval flow).
 * SUPER_ADMIN has ClinicID = NULL and is exempt.
 */
async function assertClinicIsUsable(clinicId: string | null): Promise<void> {
  if (!clinicId) return;
  const status = await findClinicStatus(clinicId);
  if (status !== "Approved") {
    throw ApiError.forbidden(
      CLINIC_STATUS_MESSAGE[status ?? "Inactive"] ?? CLINIC_STATUS_MESSAGE.Inactive,
      "CLINIC_NOT_APPROVED",
    );
  }
}

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

  // Password is correct at this point — safe to reveal clinic-approval state (own account,
  // not an enumeration risk) rather than folding it into the generic invalid-credentials path.
  try {
    await assertClinicIsUsable(row.ClinicID);
  } catch (err) {
    await recordAuditLog({
      clinicId: row.ClinicID,
      userId: row.UserID,
      action: "LOGIN_BLOCKED_CLINIC_STATUS",
      entity: "User",
      entityId: row.UserID,
      ipAddress,
    });
    throw err;
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

  // A clinic suspended/deactivated after the session was issued must not be able to keep
  // refreshing — revoke the session so the next attempt requires a fresh login.
  try {
    await assertClinicIsUsable(row.ClinicID);
  } catch (err) {
    await setRefreshTokenHash(row.UserID, null);
    throw err;
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
