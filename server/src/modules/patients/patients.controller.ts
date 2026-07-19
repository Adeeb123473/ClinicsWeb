import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as patientsService from "./patients.service.js";

export const getPatient = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const patient = await patientsService.getPatientById(req.authUser, req.params.id as string);
  sendSuccess(res, patient);
});
