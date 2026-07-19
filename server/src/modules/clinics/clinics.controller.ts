import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as clinicsService from "./clinics.service.js";
import type { ListClinicsQuery, ClinicActionBody, AssignPlanBody } from "./clinics.schemas.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as ListClinicsQuery;
  const { clinics, total } = await clinicsService.getClinics(query);
  sendSuccess(res, clinics, 200, { page: query.page, limit: query.limit, total });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await clinicsService.getClinic(req.params.id as string));
});

export const act = asyncHandler(async (req: Request, res: Response) => {
  const { action } = req.body as ClinicActionBody;
  sendSuccess(res, await clinicsService.changeClinicStatus(req.params.id as string, action));
});

export const setPlan = asyncHandler(async (req: Request, res: Response) => {
  const { planId, expiry } = req.body as AssignPlanBody;
  sendSuccess(res, await clinicsService.setClinicPlan(req.params.id as string, planId, expiry));
});
