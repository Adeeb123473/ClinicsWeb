import { ApiError } from "../../utils/ApiError.js";
import type { AccessTokenPayload } from "../../types/auth.js";
import { findPatientByIdForClinic, type PatientRow } from "./patients.repository.js";

const CLINICAL_FIELDS = ["Allergies", "ChronicConditions", "BloodGroup"] as const;

/**
 * Server-side field filtering by role (RBAC rule 3). Receptionists handle registration and
 * billing, never clinical detail — those fields are stripped from the response entirely,
 * not just hidden in the UI.
 */
function filterForRole(patient: PatientRow, role: AccessTokenPayload["role"]): Partial<PatientRow> {
  if (role === "RECEPTIONIST") {
    const filtered: Partial<PatientRow> = { ...patient };
    for (const field of CLINICAL_FIELDS) delete filtered[field];
    return filtered;
  }
  return patient;
}

export async function getPatientById(authUser: AccessTokenPayload, patientId: string): Promise<Partial<PatientRow>> {
  if (authUser.role === "SUPER_ADMIN") {
    throw ApiError.forbidden("Super Admin cannot access patient records");
  }

  // Filtering by the authenticated user's ClinicID means a cross-clinic id simply matches
  // no rows — indistinguishable from "doesn't exist", which is what we want (no enumeration).
  const patient = await findPatientByIdForClinic(authUser.clinicId as string, patientId);
  if (!patient) {
    throw ApiError.notFound("Patient not found");
  }

  return filterForRole(patient, authUser.role);
}
