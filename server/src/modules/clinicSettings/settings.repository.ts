import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface ClinicSettingsRow {
  ClinicID: string;
  ClinicName: string;
  Address: string | null;
  Phone: string | null;
  Email: string | null;
  LogoUrl: string | null;
  Status: string;
  OperatingHours: string | null;
  TimeZone: string;
  Settings: string | null;
}

export async function getClinicSettings(clinicId: string): Promise<ClinicSettingsRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .query<ClinicSettingsRow>(`
      SELECT ClinicID, ClinicName, Address, Phone, Email, LogoUrl, Status, OperatingHours, TimeZone, Settings
      FROM Clinics WHERE ClinicID = @clinicId
    `);
  return result.recordset[0] ?? null;
}

export async function updateClinicSettings(
  clinicId: string,
  fields: {
    clinicName: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    timeZone: string;
    operatingHours: string;
    settings: string;
  },
): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("clinicName", sql.NVarChar, fields.clinicName)
    .input("address", sql.NVarChar, fields.address)
    .input("phone", sql.NVarChar, fields.phone)
    .input("email", sql.NVarChar, fields.email)
    .input("timeZone", sql.NVarChar, fields.timeZone)
    .input("operatingHours", sql.NVarChar(sql.MAX), fields.operatingHours)
    .input("settings", sql.NVarChar(sql.MAX), fields.settings)
    .query(`
      UPDATE Clinics SET ClinicName = @clinicName, Address = @address, Phone = @phone, Email = @email,
        TimeZone = @timeZone, OperatingHours = @operatingHours, Settings = @settings, UpdatedAt = SYSUTCDATETIME()
      WHERE ClinicID = @clinicId
    `);
}
