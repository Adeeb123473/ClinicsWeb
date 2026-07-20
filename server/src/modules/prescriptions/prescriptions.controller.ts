import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as service from "./prescriptions.service.js";
import type { SavePrescriptionBody, SaveTemplateBody } from "./prescriptions.schemas.js";

export const getForConsultation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const { consultationId, patientId } = req.query as { consultationId?: string; patientId?: string };
  if (patientId) {
    sendSuccess(res, await service.getPatientPrescriptions(req.authUser, patientId));
    return;
  }
  if (!consultationId) throw ApiError.badRequest("consultationId or patientId is required");
  sendSuccess(res, await service.getPrescription(req.authUser.clinicId as string, consultationId));
});

export const save = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const body = req.body as SavePrescriptionBody;
  sendSuccess(res, await service.upsertPrescription(req.authUser, body.consultationId, body.items), 201);
});

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await service.getTemplates(req.authUser));
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const body = req.body as SaveTemplateBody;
  sendSuccess(res, await service.saveTemplate(req.authUser, body.name, body.items), 201);
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  await service.removeTemplate(req.authUser, req.params.id as string);
  sendSuccess(res, null);
});
