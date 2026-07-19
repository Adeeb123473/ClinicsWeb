import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as consultationsService from "./consultations.service.js";

export const getConsultation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const consultation = await consultationsService.getConsultationById(req.authUser, req.params.id as string);
  sendSuccess(res, consultation);
});
