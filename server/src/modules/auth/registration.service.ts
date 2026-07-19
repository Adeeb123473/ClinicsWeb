import { getPool, sql } from "../../config/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { hashPassword } from "../../utils/password.js";
import { recordAuditLog } from "../../middleware/auditLog.js";
import { findUserByUsername } from "../users/users.repository.js";
import { getPlatformSettings } from "../platform/platform.service.js";
import type { RegisterClinicInput } from "./auth.schemas.js";

export interface RegistrationResult {
  clinicId: string;
  clinicName: string;
  status: string;
  adminUsername: string;
}

/**
 * Public self-service registration. Creates a Pending clinic plus its first CLINIC_ADMIN
 * user in a single transaction. The clinic stays Pending until a Super Admin approves it.
 */
export async function registerClinic(input: RegisterClinicInput): Promise<RegistrationResult> {
  // Respect the platform-level toggle set by the Super Admin.
  const platform = await getPlatformSettings();
  if (!platform.allowClinicRegistration) {
    throw ApiError.forbidden("New clinic registrations are currently disabled", "REGISTRATION_DISABLED");
  }

  const existing = await findUserByUsername(input.adminUsername);
  if (existing) {
    throw ApiError.conflict("That username is already taken", "USERNAME_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const clinicResult = await new sql.Request(transaction)
      .input("name", sql.NVarChar, input.clinicName)
      .input("address", sql.NVarChar, input.address ?? null)
      .input("phone", sql.NVarChar, input.phone ?? null)
      .input("email", sql.NVarChar, input.clinicEmail)
      .query<{ ClinicID: string }>(`
        INSERT INTO Clinics (ClinicName, Address, Phone, Email, Status)
        OUTPUT INSERTED.ClinicID
        VALUES (@name, @address, @phone, @email, 'Pending')
      `);
    const clinicId = clinicResult.recordset[0].ClinicID;

    await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, input.adminUsername)
      .input("passwordHash", sql.NVarChar, passwordHash)
      .input("fullName", sql.NVarChar, input.adminFullName)
      .input("email", sql.NVarChar, input.adminEmail)
      .query(`
        INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName, Email)
        VALUES (@clinicId, @username, @passwordHash, 'CLINIC_ADMIN', @fullName, @email)
      `);

    await transaction.commit();

    await recordAuditLog({
      clinicId,
      userId: null,
      action: "CLINIC_REGISTERED",
      entity: "Clinic",
      entityId: clinicId,
      newValues: { clinicName: input.clinicName, adminUsername: input.adminUsername },
    });

    return {
      clinicId,
      clinicName: input.clinicName,
      status: "Pending",
      adminUsername: input.adminUsername,
    };
  } catch (err) {
    await transaction.rollback();
    // Unique constraint (username) race, etc. — don't leak driver detail.
    if (err instanceof ApiError) throw err;
    const message = (err as Error).message ?? "";
    if (message.includes("UQ_Users_Username")) {
      throw ApiError.conflict("That username is already taken", "USERNAME_TAKEN");
    }
    throw err;
  }
}
