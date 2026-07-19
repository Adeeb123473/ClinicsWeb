import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as service from "./platform.service.js";
import type { PlatformSettingsBody, AnnouncementBody } from "./platform.schemas.js";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getPlatformSettings());
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await service.savePlatformSettings(req.body as PlatformSettingsBody, req.authUser.sub));
});

export const listAnnouncements = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getAnnouncements());
});

export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await service.createAnnouncement(req.body as AnnouncementBody, req.authUser.sub), 201);
});

export const toggleAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const isActive = Boolean((req.body as { isActive?: boolean }).isActive);
  sendSuccess(res, await service.toggleAnnouncement(req.params.id as string, isActive));
});

export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  await service.removeAnnouncement(req.params.id as string);
  sendSuccess(res, null);
});

/** Clinic-facing: active announcements for the dashboard banner (any authenticated user). */
export const activeAnnouncements = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getActiveAnnouncements());
});
