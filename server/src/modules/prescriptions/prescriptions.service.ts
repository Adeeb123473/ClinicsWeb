import { ApiError } from "../../utils/ApiError.js";
import type { AccessTokenPayload, Role } from "../../types/auth.js";
import { findDoctorByUserId } from "../doctors/doctors.repository.js";
import { findConsultationByIdForClinic } from "../consultations/consultations.repository.js";
import {
  getPrescriptionForConsultation,
  savePrescription,
  listPrescriptionsForPatient,
  listTemplates,
  insertTemplate,
  deleteTemplate,
  type PrescriptionItem,
} from "./prescriptions.repository.js";

async function requireDoctor(authUser: AccessTokenPayload): Promise<string> {
  const doctor = await findDoctorByUserId(authUser.clinicId as string, authUser.sub);
  if (!doctor) throw ApiError.forbidden("Only a doctor can perform this action");
  return doctor.DoctorID;
}

/** Prescriptions are clinical data: receptionists and the platform super admin never see them. */
function assertClinical(role: Role): void {
  if (role === "SUPER_ADMIN" || role === "RECEPTIONIST") {
    throw ApiError.forbidden("You do not have permission to view prescriptions");
  }
}

export async function getPrescription(clinicId: string, consultationId: string) {
  const consultation = await findConsultationByIdForClinic(clinicId, consultationId);
  if (!consultation) throw ApiError.notFound("Consultation not found");
  return getPrescriptionForConsultation(clinicId, consultationId);
}

/** Full prescription history for a patient, across every consultation, newest first. */
export async function getPatientPrescriptions(authUser: AccessTokenPayload, patientId: string) {
  assertClinical(authUser.role);
  return listPrescriptionsForPatient(authUser.clinicId as string, patientId);
}

export async function upsertPrescription(
  authUser: AccessTokenPayload,
  consultationId: string,
  items: PrescriptionItem[],
) {
  await requireDoctor(authUser);
  const clinicId = authUser.clinicId as string;
  const consultation = await findConsultationByIdForClinic(clinicId, consultationId);
  if (!consultation) throw ApiError.notFound("Consultation not found");
  await savePrescription(clinicId, consultationId, items);
  return getPrescriptionForConsultation(clinicId, consultationId);
}

export async function getTemplates(authUser: AccessTokenPayload) {
  const doctorId = await requireDoctor(authUser);
  const rows = await listTemplates(authUser.clinicId as string, doctorId);
  return rows.map((r) => ({
    templateId: r.TemplateID,
    name: r.Name,
    items: JSON.parse(r.Items) as PrescriptionItem[],
    createdAt: r.CreatedAt,
  }));
}

export async function saveTemplate(authUser: AccessTokenPayload, name: string, items: PrescriptionItem[]) {
  const doctorId = await requireDoctor(authUser);
  const id = await insertTemplate(authUser.clinicId as string, doctorId, name, items);
  return { templateId: id, name, items };
}

export async function removeTemplate(authUser: AccessTokenPayload, templateId: string) {
  const doctorId = await requireDoctor(authUser);
  await deleteTemplate(authUser.clinicId as string, doctorId, templateId);
}
