import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";
import type { Role } from "../../types/auth.js";

export interface StaffRow {
  UserID: string;
  ClinicID: string;
  Username: string;
  Role: Role;
  FullName: string;
  Email: string | null;
  Phone: string | null;
  Status: "Active" | "Inactive" | "Locked";
  LastLoginAt: Date | null;
  CreatedAt: Date;
  DoctorID: string | null;
  Specialization: string | null;
  ConsultationFee: number | null;
  FollowUpFee: number | null;
  RoomNo: string | null;
}

/** Lists all staff for a clinic, joining doctor profile fields when the user is a doctor. */
export async function listStaff(clinicId: string): Promise<StaffRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .query<StaffRow>(`
      SELECT u.UserID, u.ClinicID, u.Username, u.Role, u.FullName, u.Email, u.Phone, u.Status,
             u.LastLoginAt, u.CreatedAt,
             d.DoctorID, d.Specialization, d.ConsultationFee, d.FollowUpFee, d.RoomNo
      FROM Users u
      LEFT JOIN Doctors d ON d.UserID = u.UserID
      WHERE u.ClinicID = @clinicId
      ORDER BY u.CreatedAt DESC
    `);
  return result.recordset;
}

export async function findStaffById(clinicId: string, userId: string): Promise<StaffRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query<StaffRow>(`
      SELECT u.UserID, u.ClinicID, u.Username, u.Role, u.FullName, u.Email, u.Phone, u.Status,
             u.LastLoginAt, u.CreatedAt,
             d.DoctorID, d.Specialization, d.ConsultationFee, d.FollowUpFee, d.RoomNo
      FROM Users u
      LEFT JOIN Doctors d ON d.UserID = u.UserID
      WHERE u.ClinicID = @clinicId AND u.UserID = @userId
    `);
  return result.recordset[0] ?? null;
}

export interface CreateStaffInput {
  clinicId: string;
  username: string;
  passwordHash: string;
  role: Role;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdBy: string;
  doctor?: {
    specialization: string | null;
    consultationFee: number;
    followUpFee: number;
    roomNo: string | null;
    qualifications: string | null;
    licenseNo: string | null;
  };
}

/** Creates a clinic user; if role is DOCTOR, creates the linked Doctors row in the same transaction. */
export async function insertStaff(input: CreateStaffInput): Promise<string> {
  assertClinicId(input.clinicId);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const userResult = await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, input.clinicId)
      .input("username", sql.NVarChar, input.username)
      .input("passwordHash", sql.NVarChar, input.passwordHash)
      .input("role", sql.NVarChar, input.role)
      .input("fullName", sql.NVarChar, input.fullName)
      .input("email", sql.NVarChar, input.email)
      .input("phone", sql.NVarChar, input.phone)
      .input("createdBy", sql.UniqueIdentifier, input.createdBy)
      .query<{ UserID: string }>(`
        INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName, Email, Phone, MustChangePassword, CreatedBy)
        OUTPUT INSERTED.UserID
        VALUES (@clinicId, @username, @passwordHash, @role, @fullName, @email, @phone, 1, @createdBy)
      `);
    const userId = userResult.recordset[0].UserID;

    if (input.role === "DOCTOR" && input.doctor) {
      await new sql.Request(transaction)
        .input("clinicId", sql.UniqueIdentifier, input.clinicId)
        .input("userId", sql.UniqueIdentifier, userId)
        .input("doctorName", sql.NVarChar, input.fullName)
        .input("specialization", sql.NVarChar, input.doctor.specialization)
        .input("qualifications", sql.NVarChar, input.doctor.qualifications)
        .input("licenseNo", sql.NVarChar, input.doctor.licenseNo)
        .input("consultationFee", sql.Decimal(10, 2), input.doctor.consultationFee)
        .input("followUpFee", sql.Decimal(10, 2), input.doctor.followUpFee)
        .input("roomNo", sql.NVarChar, input.doctor.roomNo)
        .query(`
          INSERT INTO Doctors (ClinicID, UserID, DoctorName, Specialization, Qualifications, LicenseNo, ConsultationFee, FollowUpFee, RoomNo)
          VALUES (@clinicId, @userId, @doctorName, @specialization, @qualifications, @licenseNo, @consultationFee, @followUpFee, @roomNo)
        `);
    }

    await transaction.commit();
    return userId;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function updateStaff(
  clinicId: string,
  userId: string,
  fields: { fullName: string; email: string | null; phone: string | null; status: string },
): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("fullName", sql.NVarChar, fields.fullName)
    .input("email", sql.NVarChar, fields.email)
    .input("phone", sql.NVarChar, fields.phone)
    .input("status", sql.NVarChar, fields.status)
    .query(`
      UPDATE Users SET FullName = @fullName, Email = @email, Phone = @phone, Status = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE ClinicID = @clinicId AND UserID = @userId;
      UPDATE Doctors SET DoctorName = @fullName WHERE ClinicID = @clinicId AND UserID = @userId;
    `);
}

export async function updateDoctorProfile(
  clinicId: string,
  userId: string,
  fields: { specialization: string | null; consultationFee: number; followUpFee: number; roomNo: string | null },
): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("specialization", sql.NVarChar, fields.specialization)
    .input("consultationFee", sql.Decimal(10, 2), fields.consultationFee)
    .input("followUpFee", sql.Decimal(10, 2), fields.followUpFee)
    .input("roomNo", sql.NVarChar, fields.roomNo)
    .query(`
      UPDATE Doctors SET Specialization = @specialization, ConsultationFee = @consultationFee,
        FollowUpFee = @followUpFee, RoomNo = @roomNo
      WHERE ClinicID = @clinicId AND UserID = @userId
    `);
}

export async function setStaffPassword(clinicId: string, userId: string, passwordHash: string): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("hash", sql.NVarChar, passwordHash)
    .query(`
      UPDATE Users SET PasswordHash = @hash, MustChangePassword = 1, RefreshTokenHash = NULL,
        FailedLoginAttempts = 0, LockedUntil = NULL, UpdatedAt = SYSUTCDATETIME()
      WHERE ClinicID = @clinicId AND UserID = @userId
    `);
}
