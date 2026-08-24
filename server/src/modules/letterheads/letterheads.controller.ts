import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as service from "./letterheads.service.js";
import type { UpsertTemplateBody, UploadImageBody } from "./letterheads.schemas.js";

function doctorId(req: Request): string {
  const id = req.params.doctorId;
  if (!id) throw ApiError.badRequest("doctorId is required");
  return id;
}

export const get = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await service.getTemplate(req.authUser, doctorId(req)));
});

export const save = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await service.saveTemplate(req.authUser, doctorId(req), req.body as UpsertTemplateBody));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  await service.removeTemplate(req.authUser, doctorId(req));
  sendSuccess(res, { deleted: true });
});

export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await service.uploadImage(req.authUser, doctorId(req), req.body as UploadImageBody), 201);
});

/**
 * Serves the stored bytes. Deliberately not wrapped in the JSON envelope — the browser needs a
 * real image response so it can be used as an <img> src and drawn to a canvas.
 */
export const image = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const kind = req.params.kind === "original" ? "ORIGINAL" : "DEWARPED";
  const img = await service.getImage(req.authUser, doctorId(req), kind);
  res.setHeader("Content-Type", img.ContentType);
  res.setHeader("Content-Length", String(img.SizeBytes));
  // Private: this is clinic data behind auth, so it must not land in a shared cache.
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(img.Bytes);
});
