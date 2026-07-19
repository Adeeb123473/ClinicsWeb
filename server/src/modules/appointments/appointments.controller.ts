import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as service from "./appointments.service.js";
import type { BookBody, QueueQuery, StatusBody, RescheduleBody } from "./appointments.schemas.js";

function clinicId(req: Request): string {
  if (!req.authUser?.clinicId) throw ApiError.unauthorized();
  return req.authUser.clinicId;
}

export const queue = asyncHandler(async (req: Request, res: Response) => {
  const q = req.validatedQuery as QueueQuery;
  const date = q.date ?? new Date().toISOString().slice(0, 10);
  sendSuccess(res, await service.getQueue(clinicId(req), { date, doctorId: q.doctorId, status: q.status, patientId: q.patientId }));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getAppointment(clinicId(req), req.params.id as string));
});

export const book = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const appt = await service.bookAppointment(clinicId(req), req.authUser.sub, req.body as BookBody);
  sendSuccess(res, appt, 201);
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const { status } = req.body as StatusBody;
  sendSuccess(res, await service.changeStatus(clinicId(req), req.params.id as string, req.authUser.sub, status));
});

export const reschedule = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const { date, time } = req.body as RescheduleBody;
  sendSuccess(res, await service.rescheduleAppointment(clinicId(req), req.params.id as string, req.authUser.sub, date, time));
});
