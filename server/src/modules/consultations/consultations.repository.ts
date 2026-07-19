import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface ConsultationRow {
  ConsultationID: string;
  ClinicID: string;
  AppointmentID: string;
  PatientID: string;
  DoctorID: string;
  ChiefComplaint: string | null;
  HistoryOfPresentIllness: string | null;
  ExaminationNotes: string | null;
  Diagnosis: string | null;
  ICD10Code: string | null;
  TreatmentPlan: string | null;
  FollowUpDate: Date | null;
  CreatedAt?: Date;
  DoctorName?: string;
}

export async function findConsultationByIdForClinic(
  clinicId: string,
  consultationId: string,
): Promise<ConsultationRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("consultationId", sql.UniqueIdentifier, consultationId)
    .query<ConsultationRow>(
      `SELECT * FROM Consultations WHERE ClinicID = @clinicId AND ConsultationID = @consultationId AND IsDeleted = 0`,
    );
  return result.recordset[0] ?? null;
}

export async function findByAppointment(clinicId: string, appointmentId: string): Promise<ConsultationRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("appointmentId", sql.UniqueIdentifier, appointmentId)
    .query<ConsultationRow>(
      `SELECT * FROM Consultations WHERE ClinicID = @clinicId AND AppointmentID = @appointmentId AND IsDeleted = 0`,
    );
  return result.recordset[0] ?? null;
}

export async function listForPatient(clinicId: string, patientId: string): Promise<ConsultationRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .query<ConsultationRow>(`
      SELECT c.*, d.DoctorName
      FROM Consultations c JOIN Doctors d ON d.DoctorID = c.DoctorID
      WHERE c.ClinicID = @clinicId AND c.PatientID = @patientId AND c.IsDeleted = 0
      ORDER BY c.CreatedAt DESC
    `);
  return result.recordset;
}

export interface ConsultationFields {
  chiefComplaint: string | null;
  historyOfPresentIllness: string | null;
  examinationNotes: string | null;
  diagnosis: string | null;
  icd10Code: string | null;
  treatmentPlan: string | null;
  followUpDate: string | null;
}

export async function insertConsultation(
  clinicId: string,
  appointmentId: string,
  patientId: string,
  doctorId: string,
  fields: ConsultationFields,
): Promise<ConsultationRow> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("appointmentId", sql.UniqueIdentifier, appointmentId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .input("chief", sql.NVarChar, fields.chiefComplaint)
    .input("hpi", sql.NVarChar(sql.MAX), fields.historyOfPresentIllness)
    .input("exam", sql.NVarChar(sql.MAX), fields.examinationNotes)
    .input("diagnosis", sql.NVarChar, fields.diagnosis)
    .input("icd10", sql.NVarChar, fields.icd10Code)
    .input("plan", sql.NVarChar(sql.MAX), fields.treatmentPlan)
    .input("followUp", sql.Date, fields.followUpDate)
    .query<ConsultationRow>(`
      INSERT INTO Consultations (ClinicID, AppointmentID, PatientID, DoctorID, ChiefComplaint,
        HistoryOfPresentIllness, ExaminationNotes, Diagnosis, ICD10Code, TreatmentPlan, FollowUpDate)
      OUTPUT INSERTED.*
      VALUES (@clinicId, @appointmentId, @patientId, @doctorId, @chief, @hpi, @exam, @diagnosis, @icd10, @plan, @followUp)
    `);
  return result.recordset[0];
}

export async function updateConsultation(
  clinicId: string,
  consultationId: string,
  fields: ConsultationFields,
): Promise<ConsultationRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("consultationId", sql.UniqueIdentifier, consultationId)
    .input("chief", sql.NVarChar, fields.chiefComplaint)
    .input("hpi", sql.NVarChar(sql.MAX), fields.historyOfPresentIllness)
    .input("exam", sql.NVarChar(sql.MAX), fields.examinationNotes)
    .input("diagnosis", sql.NVarChar, fields.diagnosis)
    .input("icd10", sql.NVarChar, fields.icd10Code)
    .input("plan", sql.NVarChar(sql.MAX), fields.treatmentPlan)
    .input("followUp", sql.Date, fields.followUpDate)
    .query<ConsultationRow>(`
      UPDATE Consultations SET ChiefComplaint = @chief, HistoryOfPresentIllness = @hpi, ExaminationNotes = @exam,
        Diagnosis = @diagnosis, ICD10Code = @icd10, TreatmentPlan = @plan, FollowUpDate = @followUp,
        UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE ClinicID = @clinicId AND ConsultationID = @consultationId AND IsDeleted = 0
    `);
  return result.recordset[0] ?? null;
}
