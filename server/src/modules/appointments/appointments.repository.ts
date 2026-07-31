import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface AppointmentRow {
  AppointmentID: string;
  ClinicID: string;
  PatientID: string;
  DoctorID: string;
  MRNo: string | null;
  AppointmentDate: Date;
  AppointmentTime: string;
  VisitType: string;
  TokenNo: number;
  Status: string;
  Remarks: string | null;
  ConsultationFee: number | null;
  PatientName: string;
  FatherHusbandName: string | null;
  Gender: string;
  MobileNo: string | null;
  DoctorName: string;
  RoomNo: string | null;
}

const SELECT = `
  SELECT a.AppointmentID, a.ClinicID, a.PatientID, a.DoctorID, a.MRNo, a.AppointmentDate,
    CONVERT(varchar(5), a.AppointmentTime, 108) AS AppointmentTime, a.VisitType, a.TokenNo, a.Status, a.Remarks,
    a.ConsultationFee,
    p.PatientName, p.FatherHusbandName, p.Gender, p.MobileNo,
    d.DoctorName, d.RoomNo
  FROM Appointments a
  JOIN Patients p ON p.PatientID = a.PatientID
  JOIN Doctors d ON d.DoctorID = a.DoctorID
`;

export interface QueueParams {
  clinicId: string;
  date: string;
  doctorId?: string;
  status?: string;
  patientId?: string;
}

export async function listAppointments(params: QueueParams): Promise<AppointmentRow[]> {
  assertClinicId(params.clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, params.clinicId)
    .input("date", sql.Date, params.date || null)
    .input("doctorId", sql.UniqueIdentifier, params.doctorId ?? null)
    .input("status", sql.NVarChar, params.status ?? null)
    .input("patientId", sql.UniqueIdentifier, params.patientId ?? null)
    .query<AppointmentRow>(`
      ${SELECT}
      WHERE a.ClinicID = @clinicId
        AND (@date IS NULL OR a.AppointmentDate = @date)
        AND (@doctorId IS NULL OR a.DoctorID = @doctorId)
        AND (@status IS NULL OR a.Status = @status)
        AND (@patientId IS NULL OR a.PatientID = @patientId)
      ORDER BY a.DoctorID, a.TokenNo
    `);
  return result.recordset;
}

export async function findAppointmentById(clinicId: string, appointmentId: string): Promise<AppointmentRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("appointmentId", sql.UniqueIdentifier, appointmentId)
    .query<AppointmentRow>(`${SELECT} WHERE a.ClinicID = @clinicId AND a.AppointmentID = @appointmentId`);
  return result.recordset[0] ?? null;
}

export interface BookInput {
  clinicId: string;
  patientId: string;
  doctorId: string;
  mrNo: string | null;
  date: string;
  time: string;
  visitType: string;
  remarks: string | null;
  consultationFee: number | null;
  createdBy: string;
}

/** Books an appointment, allocating the next token for that doctor+date atomically. */
export async function insertAppointment(input: BookInput): Promise<AppointmentRow> {
  assertClinicId(input.clinicId);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const tokenResult = await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, input.clinicId)
      .input("doctorId", sql.UniqueIdentifier, input.doctorId)
      .input("date", sql.Date, input.date)
      .query<{ NextToken: number }>(`
        SELECT ISNULL(MAX(TokenNo), 0) + 1 AS NextToken
        FROM Appointments WITH (UPDLOCK, HOLDLOCK)
        WHERE ClinicID = @clinicId AND DoctorID = @doctorId AND AppointmentDate = @date
      `);
    const tokenNo = tokenResult.recordset[0].NextToken;

    const result = await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, input.clinicId)
      .input("patientId", sql.UniqueIdentifier, input.patientId)
      .input("doctorId", sql.UniqueIdentifier, input.doctorId)
      .input("mrNo", sql.NVarChar, input.mrNo)
      .input("date", sql.Date, input.date)
      .input("time", sql.VarChar, input.time)
      .input("visitType", sql.NVarChar, input.visitType)
      .input("tokenNo", sql.Int, tokenNo)
      .input("remarks", sql.NVarChar, input.remarks)
      .input("consultationFee", sql.Decimal(10, 2), input.consultationFee)
      .input("createdBy", sql.UniqueIdentifier, input.createdBy)
      .query<{ AppointmentID: string }>(`
        INSERT INTO Appointments (ClinicID, PatientID, DoctorID, MRNo, AppointmentDate, AppointmentTime, VisitType, TokenNo, Status, Remarks, ConsultationFee, CreatedBy)
        OUTPUT INSERTED.AppointmentID
        VALUES (@clinicId, @patientId, @doctorId, @mrNo, @date, @time, @visitType, @tokenNo, 'Scheduled', @remarks, @consultationFee, @createdBy)
      `);
    await transaction.commit();
    const created = await findAppointmentById(input.clinicId, result.recordset[0].AppointmentID);
    return created as AppointmentRow;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function updateStatus(
  clinicId: string,
  appointmentId: string,
  status: string,
  updatedBy: string,
): Promise<AppointmentRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("appointmentId", sql.UniqueIdentifier, appointmentId)
    .input("status", sql.NVarChar, status)
    .input("updatedBy", sql.UniqueIdentifier, updatedBy)
    .query<{ AppointmentID: string }>(`
      UPDATE Appointments SET Status = @status, UpdatedBy = @updatedBy, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.AppointmentID
      WHERE ClinicID = @clinicId AND AppointmentID = @appointmentId
    `);
  if (!result.recordset[0]) return null;
  return findAppointmentById(clinicId, appointmentId);
}

export async function reschedule(
  clinicId: string,
  appointmentId: string,
  date: string,
  time: string,
  updatedBy: string,
): Promise<AppointmentRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("appointmentId", sql.UniqueIdentifier, appointmentId)
    .input("date", sql.Date, date)
    .input("time", sql.VarChar, time)
    .input("updatedBy", sql.UniqueIdentifier, updatedBy)
    .query<{ AppointmentID: string }>(`
      UPDATE Appointments SET AppointmentDate = @date, AppointmentTime = @time, Status = 'Scheduled',
        UpdatedBy = @updatedBy, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.AppointmentID
      WHERE ClinicID = @clinicId AND AppointmentID = @appointmentId
    `);
  if (!result.recordset[0]) return null;
  return findAppointmentById(clinicId, appointmentId);
}
