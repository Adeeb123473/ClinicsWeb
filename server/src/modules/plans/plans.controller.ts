import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as plansService from "./plans.service.js";
import type { PlanBody } from "./plans.schemas.js";

export const listAll = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await plansService.getPlans());
});

export const listPublic = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await plansService.getPublicPlans());
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await plansService.getPlan(req.params.id as string));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const plan = await plansService.createPlan(req.body as PlanBody);
  sendSuccess(res, plan, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const plan = await plansService.editPlan(req.params.id as string, req.body as PlanBody);
  sendSuccess(res, plan);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await plansService.removePlan(req.params.id as string);
  sendSuccess(res, null);
});
