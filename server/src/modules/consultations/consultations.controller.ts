import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as consultationsService from "./consultations.service.js";
import type { ConsultationBody } from "./consultations.schemas.js";

export const getConsultation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await consultationsService.getConsultationById(req.authUser, req.params.id as string));
});

export const listForPatient = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const { patientId, appointmentId } = req.query as { patientId?: string; appointmentId?: string };
  if (appointmentId) {
    sendSuccess(res, await consultationsService.getConsultationByAppointment(req.authUser, appointmentId));
    return;
  }
  if (!patientId) throw ApiError.badRequest("patientId or appointmentId is required");
  sendSuccess(res, await consultationsService.getPatientConsultations(req.authUser, patientId));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const consultation = await consultationsService.createConsultation(req.authUser, req.body as ConsultationBody);
  sendSuccess(res, consultation, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const consultation = await consultationsService.editConsultation(
    req.authUser,
    req.params.id as string,
    req.body as ConsultationBody,
  );
  sendSuccess(res, consultation);
});
