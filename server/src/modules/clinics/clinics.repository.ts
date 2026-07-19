import { getPool, sql } from "../../config/db.js";

export type ClinicStatus = "Pending" | "Approved" | "Suspended" | "Inactive";

export interface ClinicRow {
  ClinicID: string;
  ClinicName: string;
  Address: string | null;
  Phone: string | null;
  Email: string | null;
  LogoUrl: string | null;
  Status: ClinicStatus;
  OperatingHours: string | null;
  TimeZone: string;
  Settings: string | null;
  SubscriptionPlanID: string | null;
  SubscriptionExpiry: Date | null;
  CreatedDate: Date;
  UpdatedAt: Date;
}

export interface ClinicListRow extends ClinicRow {
  PlanName: string | null;
  UserCount: number;
}

export interface ListClinicsParams {
  status?: ClinicStatus;
  search?: string;
  page: number;
  limit: number;
}

export async function listClinics(
  params: ListClinicsParams,
): Promise<{ rows: ClinicListRow[]; total: number }> {
  const pool = await getPool();
  const offset = (params.page - 1) * params.limit;

  const request = pool
    .request()
    .input("status", sql.NVarChar, params.status ?? null)
    .input("search", sql.NVarChar, params.search ? `%${params.search}%` : null)
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, params.limit);

  const where = `
    WHERE (@status IS NULL OR c.Status = @status)
      AND (@search IS NULL OR c.ClinicName LIKE @search OR c.Email LIKE @search)
  `;

  const rowsResult = await request.query<ClinicListRow>(`
    SELECT c.*, p.Name AS PlanName,
      (SELECT COUNT(*) FROM Users u WHERE u.ClinicID = c.ClinicID) AS UserCount
    FROM Clinics c
    LEFT JOIN SubscriptionPlans p ON p.PlanID = c.SubscriptionPlanID
    ${where}
    ORDER BY c.CreatedDate DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countResult = await pool
    .request()
    .input("status", sql.NVarChar, params.status ?? null)
    .input("search", sql.NVarChar, params.search ? `%${params.search}%` : null)
    .query<{ total: number }>(`SELECT COUNT(*) AS total FROM Clinics c ${where}`);

  return { rows: rowsResult.recordset, total: countResult.recordset[0].total };
}

export async function findClinicById(clinicId: string): Promise<ClinicListRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .query<ClinicListRow>(`
      SELECT c.*, p.Name AS PlanName,
        (SELECT COUNT(*) FROM Users u WHERE u.ClinicID = c.ClinicID) AS UserCount
      FROM Clinics c
      LEFT JOIN SubscriptionPlans p ON p.PlanID = c.SubscriptionPlanID
      WHERE c.ClinicID = @clinicId
    `);
  return result.recordset[0] ?? null;
}

export async function updateClinicStatus(
  clinicId: string,
  status: ClinicStatus,
): Promise<ClinicRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("status", sql.NVarChar, status)
    .query<ClinicRow>(`
      UPDATE Clinics SET Status = @status, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE ClinicID = @clinicId
    `);
  return result.recordset[0] ?? null;
}

export async function assignPlan(
  clinicId: string,
  planId: string,
  expiry: Date | null,
): Promise<ClinicRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("planId", sql.UniqueIdentifier, planId)
    .input("expiry", sql.DateTime2, expiry)
    .query<ClinicRow>(`
      UPDATE Clinics SET SubscriptionPlanID = @planId, SubscriptionExpiry = @expiry, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE ClinicID = @clinicId
    `);
  if (!result.recordset[0]) return null;

  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("planId", sql.UniqueIdentifier, planId)
    .input("expiry", sql.DateTime2, expiry)
    .query(`
      INSERT INTO ClinicSubscriptions (ClinicID, PlanID, Status, EndDate)
      VALUES (@clinicId, @planId, 'Active', @expiry)
    `);
  return result.recordset[0];
}
