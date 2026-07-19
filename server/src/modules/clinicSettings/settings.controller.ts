import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as settingsService from "./settings.service.js";
import type { UpdateSettingsBody } from "./settings.schemas.js";

export const get = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await settingsService.getSettings(req.authUser.clinicId as string));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const body = req.body as UpdateSettingsBody;
  const result = await settingsService.saveSettings(req.authUser.clinicId as string, {
    clinicName: body.clinicName,
    address: body.address ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    timeZone: body.timeZone,
    operatingHours: body.operatingHours,
    settings: body.settings,
  });
  sendSuccess(res, result);
});
