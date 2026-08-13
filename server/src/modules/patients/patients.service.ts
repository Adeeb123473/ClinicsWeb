import { ApiError } from "../../utils/ApiError.js";
import type { AccessTokenPayload, Role } from "../../types/auth.js";
import { loadClinicSettings } from "../clinicSettings/settings.service.js";
import {
  findPatientByIdForClinic,
  searchPatients as searchRepo,
  findDuplicates,
  insertPatient,
  updatePatient as updateRepo,
  type PatientRow,
  type PatientWriteFields,
} from "./patients.repository.js";

const CLINICAL_FIELDS = ["Allergies", "ChronicConditions", "BloodGroup"] as const;

/**
 * Server-side field filtering by role (RBAC rule 3). Receptionists handle registration and
 * billing, never clinical detail — those fields are stripped from the response entirely,
 * not just hidden in the UI.
 */
function filterForRole(patient: PatientRow, role: Role): Partial<PatientRow> {
  if (role === "RECEPTIONIST") {
    const filtered: Partial<PatientRow> = { ...patient };
    for (const field of CLINICAL_FIELDS) delete filtered[field];
    return filtered;
  }
  return patient;
}

/** Current age computed from DOB — never stored as source of truth (CLAUDE.md business rule). */
export function computeAge(dob: Date | string | null): { value: number; unit: "Years" | "Months" | "Days" } | null {
  if (!dob) return null;
  const birth = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 31) return { value: days, unit: "Days" };
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()) - (now.getDate() < birth.getDate() ? 1 : 0);
  if (months < 24) return { value: months, unit: "Months" };
  return { value: Math.floor(months / 12), unit: "Years" };
}

function withComputedAge<T extends Partial<PatientRow>>(patient: T): T & { currentAge: ReturnType<typeof computeAge> } {
  const dob = patient.ActualDOB ?? patient.EstimatedDOB ?? null;
  return { ...patient, currentAge: computeAge(dob) };
}

export async function getPatientById(authUser: AccessTokenPayload, patientId: string) {
  if (authUser.role === "SUPER_ADMIN") {
    throw ApiError.forbidden("Super Admin cannot access patient records");
  }
  // Filtering by the authenticated user's ClinicID means a cross-clinic id simply matches
  // no rows — indistinguishable from "doesn't exist", which is what we want (no enumeration).
  const patient = await findPatientByIdForClinic(authUser.clinicId as string, patientId);
  if (!patient) throw ApiError.notFound("Patient not found");
  return withComputedAge(filterForRole(patient, authUser.role));
}

export async function listPatients(
  authUser: AccessTokenPayload,
  q: string | undefined,
  page: number,
  limit: number,
) {
  const { rows, total } = await searchRepo({ clinicId: authUser.clinicId as string, q, page, limit });
  return { patients: rows.map((r) => withComputedAge(filterForRole(r, authUser.role))), total };
}

export async function checkDuplicates(clinicId: string, cnic: string | null, mobile: string | null) {
  const rows = await findDuplicates(clinicId, cnic, mobile);
  return rows.map((r) => ({
    patientId: r.PatientID,
    mrNo: r.MRNo,
    patientName: r.PatientName,
    fatherHusbandName: r.FatherHusbandName,
    mobileNo: r.MobileNo,
    cnic: r.CNIC,
    matchedOn: [cnic && r.CNIC === cnic ? "CNIC" : null, mobile && r.MobileNo === mobile ? "Mobile" : null].filter(Boolean),
  }));
}

function toWriteFields(body: PatientRegistrationInput): PatientWriteFields {
  return {
    patientName: body.patientName,
    fatherHusbandName: body.fatherHusbandName ?? null,
    gender: body.gender,
    actualDOB: body.actualDOB ?? null,
    estimatedDOB: body.estimatedDOB ?? null,
    ageAtRegistration: body.ageAtRegistration ?? null,
    ageUnit: body.ageUnit ?? null,
    mobileNo: body.mobileNo ?? null,
    cnic: body.cnic ?? null,
    address: body.address ?? null,
    category: body.category,
    bloodGroup: body.bloodGroup ?? null,
    allergies: body.allergies ?? null,
    chronicConditions: body.chronicConditions ?? null,
    emergencyContactName: body.emergencyContactName ?? null,
    emergencyContactPhone: body.emergencyContactPhone ?? null,
    insuranceProvider: body.insuranceProvider ?? null,
    insurancePolicyNo: body.insurancePolicyNo ?? null,
    remarks: body.remarks ?? null,
  };
}

export interface PatientRegistrationInput {
  patientName: string;
  fatherHusbandName?: string | null;
  gender: string;
  actualDOB?: string | null;
  estimatedDOB?: string | null;
  ageAtRegistration?: number | null;
  ageUnit?: string | null;
  mobileNo?: string | null;
  cnic?: string | null;
  address?: string | null;
  category: string;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNo?: string | null;
  remarks?: string | null;
  /** When true, register even if a duplicate CNIC/mobile is found. */
  forceDuplicate?: boolean;
}

export async function registerPatient(clinicId: string, createdBy: string, body: PatientRegistrationInput) {
  if (!body.actualDOB && !body.estimatedDOB) {
    throw ApiError.badRequest("Either an actual or an estimated date of birth is required");
  }

  if (!body.forceDuplicate) {
    const dupes = await findDuplicates(clinicId, body.cnic ?? null, body.mobileNo ?? null);
    if (dupes.length > 0) {
      throw ApiError.conflict(
        `A patient with this ${body.cnic && dupes.some((d) => d.CNIC === body.cnic) ? "CNIC" : "mobile number"} already exists (${dupes[0].MRNo}).`,
        "DUPLICATE_PATIENT",
      );
    }
  }

  const settings = await loadClinicSettings(clinicId);
  const row = await insertPatient(clinicId, createdBy, settings.mrNoFormat, toWriteFields(body));
  return withComputedAge(row);
}

export async function editPatient(
  clinicId: string,
  updatedBy: string,
  patientId: string,
  body: PatientRegistrationInput,
) {
  if (!body.actualDOB && !body.estimatedDOB) {
    throw ApiError.badRequest("Either an actual or an estimated date of birth is required");
  }
  const row = await updateRepo(clinicId, patientId, updatedBy, toWriteFields(body));
  if (!row) throw ApiError.notFound("Patient not found");
  return withComputedAge(row);
}
