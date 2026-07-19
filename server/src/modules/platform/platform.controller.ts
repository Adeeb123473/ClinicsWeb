import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as service from "./platform.service.js";
import type { PlatformSettingsBody } from "./platform.schemas.js";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getPlatformSettings());
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await service.savePlatformSettings(req.body as PlatformSettingsBody, req.authUser.sub));
});
