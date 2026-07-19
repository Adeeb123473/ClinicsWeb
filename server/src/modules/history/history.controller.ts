import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { findPatientByIdForClinic } from "../patients/patients.repository.js";
import { getPatientConsultations } from "../consultations/consultations.service.js";
import { getPatientVitals } from "../vitals/vitals.service.js";

/**
 * Role-filtered patient timeline: demographics + consultations + vitals.
 * Consultation notes are already summarised for nurses by the consultations service;
 * receptionists are blocked at the route.
 */
export const patientHistory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const clinicId = req.authUser.clinicId as string;
  const patientId = req.params.id as string;

  const patient = await findPatientByIdForClinic(clinicId, patientId);
  if (!patient) throw ApiError.notFound("Patient not found");

  const [consultations, vitals] = await Promise.all([
    getPatientConsultations(req.authUser, patientId),
    getPatientVitals(clinicId, patientId),
  ]);

  sendSuccess(res, {
    patient: {
      patientId: patient.PatientID,
      mrNo: patient.MRNo,
      patientName: patient.PatientName,
      fatherHusbandName: patient.FatherHusbandName,
      gender: patient.Gender,
      allergies: patient.Allergies,
      chronicConditions: patient.ChronicConditions,
      bloodGroup: patient.BloodGroup,
    },
    consultations,
    vitals,
  });
});
