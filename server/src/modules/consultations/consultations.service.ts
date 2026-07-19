import { ApiError } from "../../utils/ApiError.js";
import type { AccessTokenPayload, Role } from "../../types/auth.js";
import { findDoctorByUserId } from "../doctors/doctors.repository.js";
import { findAppointmentById } from "../appointments/appointments.repository.js";
import {
  findConsultationByIdForClinic,
  findByAppointment,
  listForPatient,
  insertConsultation,
  updateConsultation,
  type ConsultationRow,
  type ConsultationFields,
} from "./consultations.repository.js";

/**
 * Nurses default to a summary-only view of consultation notes (configurable per clinic);
 * doctors and clinic admins see the full clinical record.
 */
function filterForRole(consultation: ConsultationRow, role: Role): Partial<ConsultationRow> {
  if (role === "NURSE") {
    return {
      ConsultationID: consultation.ConsultationID,
      PatientID: consultation.PatientID,
      ChiefComplaint: consultation.ChiefComplaint,
      Diagnosis: consultation.Diagnosis,
      FollowUpDate: consultation.FollowUpDate,
      CreatedAt: consultation.CreatedAt,
      DoctorName: consultation.DoctorName,
    };
  }
  return consultation;
}

function assertClinical(role: Role): void {
  if (role === "SUPER_ADMIN" || role === "RECEPTIONIST") {
    throw ApiError.forbidden("You do not have permission to view consultation notes");
  }
}

export async function getConsultationById(authUser: AccessTokenPayload, consultationId: string) {
  assertClinical(authUser.role);
  const consultation = await findConsultationByIdForClinic(authUser.clinicId as string, consultationId);
  if (!consultation) throw ApiError.notFound("Consultation not found");
  return filterForRole(consultation, authUser.role);
}

export async function getConsultationByAppointment(authUser: AccessTokenPayload, appointmentId: string) {
  assertClinical(authUser.role);
  const consultation = await findByAppointment(authUser.clinicId as string, appointmentId);
  return consultation ? filterForRole(consultation, authUser.role) : null;
}

export async function getPatientConsultations(authUser: AccessTokenPayload, patientId: string) {
  assertClinical(authUser.role);
  const rows = await listForPatient(authUser.clinicId as string, patientId);
  return rows.map((r) => filterForRole(r, authUser.role));
}

function toFields(body: ConsultationBody): ConsultationFields {
  return {
    chiefComplaint: body.chiefComplaint ?? null,
    historyOfPresentIllness: body.historyOfPresentIllness ?? null,
    examinationNotes: body.examinationNotes ?? null,
    diagnosis: body.diagnosis ?? null,
    icd10Code: body.icd10Code ?? null,
    treatmentPlan: body.treatmentPlan ?? null,
    followUpDate: body.followUpDate ?? null,
  };
}

export interface ConsultationBody {
  appointmentId: string;
  chiefComplaint?: string | null;
  historyOfPresentIllness?: string | null;
  examinationNotes?: string | null;
  diagnosis?: string | null;
  icd10Code?: string | null;
  treatmentPlan?: string | null;
  followUpDate?: string | null;
}

export async function createConsultation(authUser: AccessTokenPayload, body: ConsultationBody) {
  const clinicId = authUser.clinicId as string;
  const doctor = await findDoctorByUserId(clinicId, authUser.sub);
  if (!doctor) throw ApiError.forbidden("Only a doctor can write a consultation");

  const appointment = await findAppointmentById(clinicId, body.appointmentId);
  if (!appointment) throw ApiError.notFound("Appointment not found");

  // Upsert on the appointment's unique consultation.
  const existing = await findByAppointment(clinicId, body.appointmentId);
  if (existing) {
    return (await updateConsultation(clinicId, existing.ConsultationID, toFields(body))) as ConsultationRow;
  }
  return insertConsultation(clinicId, body.appointmentId, appointment.PatientID, doctor.DoctorID, toFields(body));
}

export async function editConsultation(authUser: AccessTokenPayload, consultationId: string, body: ConsultationBody) {
  const clinicId = authUser.clinicId as string;
  const doctor = await findDoctorByUserId(clinicId, authUser.sub);
  if (!doctor && authUser.role !== "CLINIC_ADMIN") {
    throw ApiError.forbidden("Only a doctor can edit a consultation");
  }
  const updated = await updateConsultation(clinicId, consultationId, toFields(body));
  if (!updated) throw ApiError.notFound("Consultation not found");
  return updated;
}
