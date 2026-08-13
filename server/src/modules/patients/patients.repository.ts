import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";
import { ApiError } from "../../utils/ApiError.js";

export interface PatientRow {
  PatientID: string;
  ClinicID: string;
  MRNo: string;
  RegistrationDate: Date;
  RegistrationTime: string;
  PatientName: string;
  FatherHusbandName: string | null;
  Gender: string;
  ActualDOB: Date | null;
  EstimatedDOB: Date | null;
  AgeAtRegistration: number | null;
  AgeUnit: string | null;
  MobileNo: string | null;
  CNIC: string | null;
  Address: string | null;
  Category: string;
  BloodGroup: string | null;
  Allergies: string | null;
  ChronicConditions: string | null;
  EmergencyContactName: string | null;
  EmergencyContactPhone: string | null;
  InsuranceProvider: string | null;
  InsurancePolicyNo: string | null;
  PhotoUrl: string | null;
  Remarks: string | null;
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

export interface SearchParams {
  clinicId: string;
  q?: string;
  page: number;
  limit: number;
}

export async function searchPatients(params: SearchParams): Promise<{ rows: PatientRow[]; total: number }> {
  assertClinicId(params.clinicId);
  const pool = await getPool();
  const offset = (params.page - 1) * params.limit;
  const like = params.q ? `%${params.q}%` : null;

  const where = `
    WHERE p.ClinicID = @clinicId AND p.IsDeleted = 0
      AND (@like IS NULL OR p.PatientName LIKE @like OR p.MRNo LIKE @like
           OR p.MobileNo LIKE @like OR p.CNIC LIKE @like)
  `;

  const rows = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, params.clinicId)
    .input("like", sql.NVarChar, like)
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, params.limit)
    .query<PatientRow>(`
      SELECT p.* FROM Patients p ${where}
      ORDER BY p.CreatedDate DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  const count = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, params.clinicId)
    .input("like", sql.NVarChar, like)
    .query<{ total: number }>(`SELECT COUNT(*) AS total FROM Patients p ${where}`);

  return { rows: rows.recordset, total: count.recordset[0].total };
}

/** Duplicate detection by exact mobile number within the clinic (CLAUDE.md reception rule). CNIC is not unique — the same CNIC may be registered for multiple patients. */
export async function findDuplicates(clinicId: string, mobile: string | null): Promise<PatientRow[]> {
  assertClinicId(clinicId);
  if (!mobile) return [];
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("mobile", sql.NVarChar, mobile)
    .query<PatientRow>(`
      SELECT * FROM Patients
      WHERE ClinicID = @clinicId AND IsDeleted = 0 AND MobileNo = @mobile
    `);
  return result.recordset;
}

export interface PatientWriteFields {
  patientName: string;
  fatherHusbandName: string | null;
  gender: string;
  actualDOB: string | null;
  estimatedDOB: string | null;
  ageAtRegistration: number | null;
  ageUnit: string | null;
  mobileNo: string | null;
  cnic: string | null;
  address: string | null;
  category: string;
  bloodGroup: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  insuranceProvider: string | null;
  insurancePolicyNo: string | null;
  remarks: string | null;
}

/** SQL Server duplicate-key error numbers (unique index / unique constraint). */
const SQL_UNIQUE_VIOLATION = new Set([2601, 2627]);

function isMrNoCollision(err: unknown): boolean {
  const e = err as { number?: number; message?: string } | null;
  return (
    SQL_UNIQUE_VIOLATION.has(e?.number ?? -1) && (e?.message ?? "").includes("UQ_Patients_Clinic_MRNo")
  );
}

/**
 * Builds the MR number for a clinic. Both placeholders are load-bearing: `{seq}` is what makes
 * the number unique, and `{YYYY}` is what lets the sequence query above scope to the current
 * year. A format missing either produces the *same* MR number for every patient in the clinic —
 * the first insert succeeds and every later one dies on UQ_Patients_Clinic_MRNo. Fail with an
 * actionable error rather than letting a raw driver error surface as a 500.
 */
export function buildMrNo(mrFormat: string, year: number, seq: number): string {
  if (!mrFormat.includes("{YYYY}") || !mrFormat.includes("{seq}")) {
    throw ApiError.badRequest(
      `This clinic's MR No format (${mrFormat}) is missing the {YYYY} and/or {seq} placeholder, so it cannot generate unique MR numbers. A clinic admin can correct it in Clinic Settings (e.g. MR-{YYYY}-{seq}).`,
      "MR_FORMAT_INVALID",
    );
  }
  return mrFormat.replace("{YYYY}", String(year)).replace("{seq}", String(seq).padStart(4, "0"));
}

const MAX_MR_ATTEMPTS = 3;

/**
 * Inserts a patient, generating a per-clinic MR number in a transaction. The MR sequence is
 * derived from the current max for the clinic in the target year, and the (ClinicID, MRNo)
 * unique constraint is the backstop — a genuine race is retried here rather than 500ing.
 */
export async function insertPatient(
  clinicId: string,
  createdBy: string,
  mrFormat: string,
  fields: PatientWriteFields,
): Promise<PatientRow> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await insertPatientOnce(clinicId, createdBy, mrFormat, fields);
    } catch (err) {
      if (isMrNoCollision(err) && attempt < MAX_MR_ATTEMPTS) continue;
      if (isMrNoCollision(err)) {
        throw ApiError.conflict(
          "Could not allocate a unique MR number for this patient. Please try again.",
          "MR_NO_COLLISION",
        );
      }
      throw err;
    }
  }
}

async function insertPatientOnce(
  clinicId: string,
  createdBy: string,
  mrFormat: string,
  fields: PatientWriteFields,
): Promise<PatientRow> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const year = new Date().getFullYear();

  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    // Next sequence for this clinic + year, based on existing MR numbers ending in a 4-digit seq.
    const seqResult = await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("yearPrefix", sql.NVarChar, `%${year}%`)
      .query<{ MaxSeq: number }>(`
        SELECT ISNULL(MAX(TRY_CONVERT(INT, RIGHT(MRNo, 4))), 0) AS MaxSeq
        FROM Patients WITH (UPDLOCK, HOLDLOCK)
        WHERE ClinicID = @clinicId AND MRNo LIKE @yearPrefix
      `);
    const seq = (seqResult.recordset[0].MaxSeq ?? 0) + 1;
    const mrNo = buildMrNo(mrFormat, year, seq);

    const result = await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("mrNo", sql.NVarChar, mrNo)
      .input("name", sql.NVarChar, fields.patientName)
      .input("father", sql.NVarChar, fields.fatherHusbandName)
      .input("gender", sql.NVarChar, fields.gender)
      .input("actualDOB", sql.Date, fields.actualDOB)
      .input("estimatedDOB", sql.Date, fields.estimatedDOB)
      .input("ageAtReg", sql.Int, fields.ageAtRegistration)
      .input("ageUnit", sql.NVarChar, fields.ageUnit)
      .input("mobile", sql.NVarChar, fields.mobileNo)
      .input("cnic", sql.NVarChar, fields.cnic)
      .input("address", sql.NVarChar, fields.address)
      .input("category", sql.NVarChar, fields.category)
      .input("bloodGroup", sql.NVarChar, fields.bloodGroup)
      .input("allergies", sql.NVarChar, fields.allergies)
      .input("chronic", sql.NVarChar, fields.chronicConditions)
      .input("emgName", sql.NVarChar, fields.emergencyContactName)
      .input("emgPhone", sql.NVarChar, fields.emergencyContactPhone)
      .input("insProvider", sql.NVarChar, fields.insuranceProvider)
      .input("insPolicy", sql.NVarChar, fields.insurancePolicyNo)
      .input("remarks", sql.NVarChar, fields.remarks)
      .input("createdBy", sql.UniqueIdentifier, createdBy)
      .query<PatientRow>(`
        INSERT INTO Patients (ClinicID, MRNo, PatientName, FatherHusbandName, Gender, ActualDOB, EstimatedDOB,
          AgeAtRegistration, AgeUnit, MobileNo, CNIC, Address, Category, BloodGroup, Allergies, ChronicConditions,
          EmergencyContactName, EmergencyContactPhone, InsuranceProvider, InsurancePolicyNo, Remarks, CreatedBy)
        OUTPUT INSERTED.*
        VALUES (@clinicId, @mrNo, @name, @father, @gender, @actualDOB, @estimatedDOB, @ageAtReg, @ageUnit, @mobile,
          @cnic, @address, @category, @bloodGroup, @allergies, @chronic, @emgName, @emgPhone, @insProvider, @insPolicy,
          @remarks, @createdBy)
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function updatePatient(
  clinicId: string,
  patientId: string,
  updatedBy: string,
  fields: PatientWriteFields,
): Promise<PatientRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .input("name", sql.NVarChar, fields.patientName)
    .input("father", sql.NVarChar, fields.fatherHusbandName)
    .input("gender", sql.NVarChar, fields.gender)
    .input("actualDOB", sql.Date, fields.actualDOB)
    .input("estimatedDOB", sql.Date, fields.estimatedDOB)
    .input("ageAtReg", sql.Int, fields.ageAtRegistration)
    .input("ageUnit", sql.NVarChar, fields.ageUnit)
    .input("mobile", sql.NVarChar, fields.mobileNo)
    .input("cnic", sql.NVarChar, fields.cnic)
    .input("address", sql.NVarChar, fields.address)
    .input("category", sql.NVarChar, fields.category)
    .input("bloodGroup", sql.NVarChar, fields.bloodGroup)
    .input("allergies", sql.NVarChar, fields.allergies)
    .input("chronic", sql.NVarChar, fields.chronicConditions)
    .input("emgName", sql.NVarChar, fields.emergencyContactName)
    .input("emgPhone", sql.NVarChar, fields.emergencyContactPhone)
    .input("insProvider", sql.NVarChar, fields.insuranceProvider)
    .input("insPolicy", sql.NVarChar, fields.insurancePolicyNo)
    .input("remarks", sql.NVarChar, fields.remarks)
    .input("updatedBy", sql.UniqueIdentifier, updatedBy)
    .query<PatientRow>(`
      UPDATE Patients SET PatientName = @name, FatherHusbandName = @father, Gender = @gender,
        ActualDOB = @actualDOB, EstimatedDOB = @estimatedDOB, AgeAtRegistration = @ageAtReg, AgeUnit = @ageUnit,
        MobileNo = @mobile, CNIC = @cnic, Address = @address, Category = @category, BloodGroup = @bloodGroup,
        Allergies = @allergies, ChronicConditions = @chronic, EmergencyContactName = @emgName,
        EmergencyContactPhone = @emgPhone, InsuranceProvider = @insProvider, InsurancePolicyNo = @insPolicy,
        Remarks = @remarks, UpdatedBy = @updatedBy, UpdatedDate = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE ClinicID = @clinicId AND PatientID = @patientId AND IsDeleted = 0
    `);
  return result.recordset[0] ?? null;
}
