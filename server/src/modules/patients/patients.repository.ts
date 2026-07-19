import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface PatientRow {
  PatientID: string;
  ClinicID: string;
  MRNo: string;
  PatientName: string;
  FatherHusbandName: string | null;
  Gender: string;
  ActualDOB: Date | null;
  EstimatedDOB: Date | null;
  MobileNo: string | null;
  CNIC: string | null;
  Address: string | null;
  Category: string;
  BloodGroup: string | null;
  Allergies: string | null;
  ChronicConditions: string | null;
  InsuranceProvider: string | null;
  InsurancePolicyNo: string | null;
  IsActive: boolean;
  IsDeleted: boolean;
}

/** Always filters by ClinicID from the authenticated JWT — never trust a client-supplied clinic id. */
export async function findPatientByIdForClinic(clinicId: string, patientId: string): Promise<PatientRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .query<PatientRow>(
      `SELECT * FROM Patients WHERE ClinicID = @clinicId AND PatientID = @patientId AND IsDeleted = 0`,
    );
  return result.recordset[0] ?? null;
}
