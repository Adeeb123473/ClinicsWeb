import { ApiError } from "../../utils/ApiError.js";
import type { AccessTokenPayload } from "../../types/auth.js";
import { findConsultationByIdForClinic, type ConsultationRow } from "./consultations.repository.js";

/**
 * Nurses default to a summary-only view of past consultation notes (configurable per clinic
 * in a later phase); doctors and clinic admins see the full clinical record.
 */
function filterForRole(consultation: ConsultationRow, role: AccessTokenPayload["role"]): Partial<ConsultationRow> {
  if (role === "NURSE") {
    return {
      ConsultationID: consultation.ConsultationID,
      PatientID: consultation.PatientID,
      ChiefComplaint: consultation.ChiefComplaint,
      Diagnosis: consultation.Diagnosis,
      FollowUpDate: consultation.FollowUpDate,
    };
  }
  return consultation;
}

export async function getConsultationById(
  authUser: AccessTokenPayload,
  consultationId: string,
): Promise<Partial<ConsultationRow>> {
  // RECEPTIONIST and SUPER_ADMIN are already blocked at the route (authorize / tenantScope),
  // this is defense in depth in case the service is ever called from elsewhere.
  if (authUser.role === "SUPER_ADMIN" || authUser.role === "RECEPTIONIST") {
    throw ApiError.forbidden("You do not have permission to view consultation notes");
  }

  const consultation = await findConsultationByIdForClinic(authUser.clinicId as string, consultationId);
  if (!consultation) {
    throw ApiError.notFound("Consultation not found");
  }

  return filterForRole(consultation, authUser.role);
}
