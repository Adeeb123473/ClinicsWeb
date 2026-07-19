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
