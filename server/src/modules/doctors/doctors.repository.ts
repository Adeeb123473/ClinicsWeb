import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface DoctorRow {
  DoctorID: string;
  ClinicID: string;
  UserID: string;
  DoctorName: string;
  Specialization: string | null;
  Qualifications: string | null;
  LicenseNo: string | null;
  ConsultationFee: number;
  FollowUpFee: number;
  RoomNo: string | null;
  Status: string;
}

export async function listDoctors(clinicId: string, activeOnly = true): Promise<DoctorRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .query<DoctorRow>(`
      SELECT * FROM Doctors
      WHERE ClinicID = @clinicId ${activeOnly ? "AND Status = 'Active'" : ""}
      ORDER BY DoctorName
    `);
  return result.recordset;
}

export async function findDoctorById(clinicId: string, doctorId: string): Promise<DoctorRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<DoctorRow>(`SELECT * FROM Doctors WHERE ClinicID = @clinicId AND DoctorID = @doctorId`);
  return result.recordset[0] ?? null;
}

export async function findDoctorByUserId(clinicId: string, userId: string): Promise<DoctorRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query<DoctorRow>(`SELECT * FROM Doctors WHERE ClinicID = @clinicId AND UserID = @userId`);
  return result.recordset[0] ?? null;
}

export interface ScheduleRow {
  ScheduleID: string;
  DoctorID: string;
  DayOfWeek: number;
  StartTime: string;
  EndTime: string;
  SlotDurationMinutes: number;
  MaxTokens: number | null;
  IsActive: boolean;
}

export async function getSchedule(clinicId: string, doctorId: string): Promise<ScheduleRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<ScheduleRow>(`
      SELECT ScheduleID, DoctorID, DayOfWeek,
        CONVERT(varchar(5), StartTime, 108) AS StartTime,
        CONVERT(varchar(5), EndTime, 108) AS EndTime,
        SlotDurationMinutes, MaxTokens, IsActive
      FROM DoctorSchedules
      WHERE ClinicID = @clinicId AND DoctorID = @doctorId
      ORDER BY DayOfWeek
    `);
  return result.recordset;
}

export async function replaceSchedule(
  clinicId: string,
  doctorId: string,
  slots: { dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number; maxTokens: number | null }[],
): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("doctorId", sql.UniqueIdentifier, doctorId)
      .query(`DELETE FROM DoctorSchedules WHERE ClinicID = @clinicId AND DoctorID = @doctorId`);
    for (const s of slots) {
      await new sql.Request(transaction)
        .input("clinicId", sql.UniqueIdentifier, clinicId)
        .input("doctorId", sql.UniqueIdentifier, doctorId)
        .input("dow", sql.TinyInt, s.dayOfWeek)
        .input("start", sql.VarChar, s.startTime)
        .input("end", sql.VarChar, s.endTime)
        .input("dur", sql.Int, s.slotDurationMinutes)
        .input("max", sql.Int, s.maxTokens)
        .query(`
          INSERT INTO DoctorSchedules (ClinicID, DoctorID, DayOfWeek, StartTime, EndTime, SlotDurationMinutes, MaxTokens)
          VALUES (@clinicId, @doctorId, @dow, @start, @end, @dur, @max)
        `);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function getBookedTimes(clinicId: string, doctorId: string, date: string): Promise<string[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .input("date", sql.Date, date)
    .query<{ T: string }>(`
      SELECT CONVERT(varchar(5), AppointmentTime, 108) AS T
      FROM Appointments
      WHERE ClinicID = @clinicId AND DoctorID = @doctorId AND AppointmentDate = @date
        AND Status <> 'Cancelled'
    `);
  return result.recordset.map((r) => r.T);
}

export async function isOnLeave(clinicId: string, doctorId: string, date: string): Promise<boolean> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .input("date", sql.Date, date)
    .query<{ Cnt: number }>(`
      SELECT COUNT(*) AS Cnt FROM DoctorLeaves
      WHERE ClinicID = @clinicId AND DoctorID = @doctorId AND LeaveDate = @date
    `);
  return result.recordset[0].Cnt > 0;
}

export interface LeaveRow {
  LeaveID: string;
  LeaveDate: Date;
  Reason: string | null;
}

export async function listLeaves(clinicId: string, doctorId: string): Promise<LeaveRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<LeaveRow>(`
      SELECT LeaveID, LeaveDate, Reason FROM DoctorLeaves
      WHERE ClinicID = @clinicId AND DoctorID = @doctorId AND LeaveDate >= CAST(SYSUTCDATETIME() AS DATE)
      ORDER BY LeaveDate
    `);
  return result.recordset;
}

export async function addLeave(clinicId: string, doctorId: string, date: string, reason: string | null): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .input("date", sql.Date, date)
    .input("reason", sql.NVarChar, reason)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM DoctorLeaves WHERE ClinicID = @clinicId AND DoctorID = @doctorId AND LeaveDate = @date)
      INSERT INTO DoctorLeaves (ClinicID, DoctorID, LeaveDate, Reason) VALUES (@clinicId, @doctorId, @date, @reason)
    `);
}

export async function removeLeave(clinicId: string, doctorId: string, leaveId: string): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .input("leaveId", sql.UniqueIdentifier, leaveId)
    .query(`DELETE FROM DoctorLeaves WHERE ClinicID = @clinicId AND DoctorID = @doctorId AND LeaveID = @leaveId`);
}
