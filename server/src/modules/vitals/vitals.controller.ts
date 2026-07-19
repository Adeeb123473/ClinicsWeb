import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as service from "./vitals.service.js";
import type { VitalsBody } from "./vitals.schemas.js";

function clinicId(req: Request): string {
  if (!req.authUser?.clinicId) throw ApiError.unauthorized();
  return req.authUser.clinicId;
}

export const record = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const vital = await service.recordVitals(clinicId(req), req.authUser.sub, req.body as VitalsBody);
  sendSuccess(res, vital, 201);
});

export const listForPatient = asyncHandler(async (req: Request, res: Response) => {
  const patientId = req.query.patientId as string | undefined;
  if (!patientId) throw ApiError.badRequest("patientId is required");
  sendSuccess(res, await service.getPatientVitals(clinicId(req), patientId));
});
