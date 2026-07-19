import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

/** All queries here are clinic-scoped aggregates for the Clinic Admin dashboard & reports. */

export async function dashboardSummary(clinicId: string): Promise<{
  appointmentsToday: number;
  newPatientsToday: number;
  revenueToday: number;
  revenueMonth: number;
  activePatients: number;
}> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const r = await pool.request().input("clinicId", sql.UniqueIdentifier, clinicId).query<{
    AppointmentsToday: number;
    NewPatientsToday: number;
    RevenueToday: number;
    RevenueMonth: number;
    ActivePatients: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM Appointments WHERE ClinicID = @clinicId AND AppointmentDate = CAST(SYSUTCDATETIME() AS DATE)) AS AppointmentsToday,
      (SELECT COUNT(*) FROM Patients WHERE ClinicID = @clinicId AND RegistrationDate = CAST(SYSUTCDATETIME() AS DATE) AND IsDeleted = 0) AS NewPatientsToday,
      (SELECT ISNULL(SUM(Amount),0) FROM Payments WHERE ClinicID = @clinicId AND CAST(PaidAt AS DATE) = CAST(SYSUTCDATETIME() AS DATE)) AS RevenueToday,
      (SELECT ISNULL(SUM(Amount),0) FROM Payments WHERE ClinicID = @clinicId AND MONTH(PaidAt) = MONTH(SYSUTCDATETIME()) AND YEAR(PaidAt) = YEAR(SYSUTCDATETIME())) AS RevenueMonth,
      (SELECT COUNT(*) FROM Patients WHERE ClinicID = @clinicId AND IsDeleted = 0 AND IsActive = 1) AS ActivePatients
  `);
  const row = r.recordset[0];
  return {
    appointmentsToday: row.AppointmentsToday,
    newPatientsToday: row.NewPatientsToday,
    revenueToday: Number(row.RevenueToday),
    revenueMonth: Number(row.RevenueMonth),
    activePatients: row.ActivePatients,
  };
}

export async function appointmentTrend(
  clinicId: string,
  days: number,
): Promise<{ Day: string; Cnt: number }[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const r = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("days", sql.Int, days)
    .query<{ Day: string; Cnt: number }>(`
      SELECT CONVERT(varchar(10), AppointmentDate, 23) AS Day, COUNT(*) AS Cnt
      FROM Appointments
      WHERE ClinicID = @clinicId AND AppointmentDate >= DATEADD(DAY, -@days, CAST(SYSUTCDATETIME() AS DATE))
      GROUP BY AppointmentDate
      ORDER BY AppointmentDate
    `);
  return r.recordset;
}

export async function doctorLoad(clinicId: string): Promise<{ DoctorName: string; Cnt: number }[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const r = await pool.request().input("clinicId", sql.UniqueIdentifier, clinicId).query<{
    DoctorName: string;
    Cnt: number;
  }>(`
    SELECT d.DoctorName, COUNT(a.AppointmentID) AS Cnt
    FROM Doctors d
    LEFT JOIN Appointments a ON a.DoctorID = d.DoctorID
      AND a.AppointmentDate >= DATEADD(DAY, -30, CAST(SYSUTCDATETIME() AS DATE))
    WHERE d.ClinicID = @clinicId
    GROUP BY d.DoctorName
    ORDER BY Cnt DESC
  `);
  return r.recordset;
}

export async function statusMix(clinicId: string): Promise<{ Status: string; Cnt: number }[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const r = await pool.request().input("clinicId", sql.UniqueIdentifier, clinicId).query<{
    Status: string;
    Cnt: number;
  }>(`
    SELECT Status, COUNT(*) AS Cnt FROM Appointments
    WHERE ClinicID = @clinicId AND AppointmentDate >= DATEADD(DAY, -30, CAST(SYSUTCDATETIME() AS DATE))
    GROUP BY Status
  `);
  return r.recordset;
}

export async function revenueByDay(clinicId: string, days: number): Promise<{ Day: string; Total: number }[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const r = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("days", sql.Int, days)
    .query<{ Day: string; Total: number }>(`
      SELECT CONVERT(varchar(10), CAST(PaidAt AS DATE), 23) AS Day, SUM(Amount) AS Total
      FROM Payments
      WHERE ClinicID = @clinicId AND PaidAt >= DATEADD(DAY, -@days, CAST(SYSUTCDATETIME() AS DATE))
      GROUP BY CAST(PaidAt AS DATE)
      ORDER BY CAST(PaidAt AS DATE)
    `);
  return r.recordset.map((x) => ({ Day: x.Day, Total: Number(x.Total) }));
}

export interface PatientExportRow {
  MRNo: string;
  PatientName: string;
  Gender: string;
  MobileNo: string | null;
  CNIC: string | null;
  Category: string;
  RegistrationDate: Date;
}

export async function patientsForExport(clinicId: string): Promise<PatientExportRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const r = await pool.request().input("clinicId", sql.UniqueIdentifier, clinicId).query<PatientExportRow>(`
    SELECT MRNo, PatientName, Gender, MobileNo, CNIC, Category, RegistrationDate
    FROM Patients WHERE ClinicID = @clinicId AND IsDeleted = 0
    ORDER BY RegistrationDate DESC
  `);
  return r.recordset;
}

export interface AppointmentExportRow {
  AppointmentDate: Date;
  AppointmentTime: string;
  TokenNo: number;
  PatientName: string;
  MRNo: string | null;
  DoctorName: string;
  VisitType: string;
  Status: string;
}

export async function appointmentsForExport(clinicId: string): Promise<AppointmentExportRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const r = await pool.request().input("clinicId", sql.UniqueIdentifier, clinicId).query<AppointmentExportRow>(`
    SELECT a.AppointmentDate, CONVERT(varchar(8), a.AppointmentTime, 108) AS AppointmentTime, a.TokenNo,
           p.PatientName, a.MRNo, d.DoctorName, a.VisitType, a.Status
    FROM Appointments a
    JOIN Patients p ON p.PatientID = a.PatientID
    JOIN Doctors d ON d.DoctorID = a.DoctorID
    WHERE a.ClinicID = @clinicId
    ORDER BY a.AppointmentDate DESC, a.TokenNo
  `);
  return r.recordset;
}

export interface ClinicAuditRow {
  LogID: string;
  Action: string;
  Entity: string;
  EntityID: string | null;
  Username: string | null;
  IPAddress: string | null;
  Timestamp: Date;
}

export async function clinicAudit(clinicId: string, limit: number): Promise<ClinicAuditRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const r = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .query<ClinicAuditRow>(`
      SELECT TOP ${limit} a.LogID, a.Action, a.Entity, a.EntityID, u.Username, a.IPAddress, a.Timestamp
      FROM AuditLogs a
      LEFT JOIN Users u ON u.UserID = a.UserID
      WHERE a.ClinicID = @clinicId
      ORDER BY a.Timestamp DESC
    `);
  return r.recordset;
}
