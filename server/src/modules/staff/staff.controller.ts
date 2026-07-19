import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as staffService from "./staff.service.js";
import type { CreateStaffBody, UpdateStaffBody, ResetPasswordBody } from "./staff.schemas.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await staffService.getStaff(req.authUser.clinicId as string));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const staff = await staffService.createStaff(
    req.authUser.clinicId as string,
    req.authUser.sub,
    req.body as CreateStaffBody,
  );
  sendSuccess(res, staff, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const staff = await staffService.editStaff(
    req.authUser.clinicId as string,
    req.authUser.sub,
    req.params.id as string,
    req.body as UpdateStaffBody,
  );
  sendSuccess(res, staff);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  await staffService.resetStaffPassword(
    req.authUser.clinicId as string,
    req.params.id as string,
    (req.body as ResetPasswordBody).password,
  );
  sendSuccess(res, null);
});
