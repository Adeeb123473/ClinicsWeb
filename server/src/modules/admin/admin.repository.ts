import { getPool } from "../../config/db.js";

export interface StatusCount {
  Status: string;
  Cnt: number;
}
export interface RoleCount {
  Role: string;
  Cnt: number;
}
export interface PlanRevenue {
  PlanName: string;
  Clinics: number;
  Mrr: number;
}

/**
 * Aggregate platform metrics only — never row-level patient/clinical data
 * (CLAUDE.md section 2 privacy boundary for SUPER_ADMIN).
 */
export async function getPlatformStats(): Promise<{
  clinicsByStatus: StatusCount[];
  usersByRole: RoleCount[];
  appointmentsToday: number;
  planRevenue: PlanRevenue[];
}> {
  const pool = await getPool();

  const clinicsByStatus = (
    await pool.request().query<StatusCount>(
      `SELECT Status, COUNT(*) AS Cnt FROM Clinics GROUP BY Status`,
    )
  ).recordset;

  const usersByRole = (
    await pool.request().query<RoleCount>(
      `SELECT Role, COUNT(*) AS Cnt FROM Users WHERE Status = 'Active' GROUP BY Role`,
    )
  ).recordset;

  const appointmentsToday = (
    await pool.request().query<{ Cnt: number }>(
      `SELECT COUNT(*) AS Cnt FROM Appointments WHERE AppointmentDate = CAST(SYSUTCDATETIME() AS DATE)`,
    )
  ).recordset[0].Cnt;

  const planRevenue = (
    await pool.request().query<PlanRevenue>(`
      SELECT p.Name AS PlanName,
             COUNT(c.ClinicID) AS Clinics,
             COUNT(c.ClinicID) * p.PriceMonthly AS Mrr
      FROM SubscriptionPlans p
      LEFT JOIN Clinics c ON c.SubscriptionPlanID = p.PlanID AND c.Status = 'Approved'
      GROUP BY p.Name, p.PriceMonthly
      ORDER BY Mrr DESC
    `)
  ).recordset;

  return { clinicsByStatus, usersByRole, appointmentsToday, planRevenue };
}

export interface AdminAuditRow {
  LogID: string;
  Action: string;
  Entity: string;
  EntityID: string | null;
  Username: string | null;
  IPAddress: string | null;
  Timestamp: Date;
}

/** Platform-level audit: logins and admin actions. Excludes clinical-read actions and clinic-scoped noise. */
export async function getPlatformAudit(limit: number): Promise<AdminAuditRow[]> {
  const pool = await getPool();
  const result = await pool.request().query<AdminAuditRow>(`
    SELECT TOP ${limit} a.LogID, a.Action, a.Entity, a.EntityID, u.Username, a.IPAddress, a.Timestamp
    FROM AuditLogs a
    LEFT JOIN Users u ON u.UserID = a.UserID
    WHERE a.Entity IN ('User','Clinic','SubscriptionPlan')
    ORDER BY a.Timestamp DESC
  `);
  return result.recordset;
}
