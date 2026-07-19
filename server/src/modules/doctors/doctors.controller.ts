import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as doctorsService from "./doctors.service.js";
import * as repo from "./doctors.repository.js";

function clinicId(req: Request): string {
  if (!req.authUser?.clinicId) throw ApiError.unauthorized();
  return req.authUser.clinicId;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await doctorsService.getDoctors(clinicId(req)));
});

export const slots = asyncHandler(async (req: Request, res: Response) => {
  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw ApiError.badRequest("Invalid date");
  sendSuccess(res, await doctorsService.getAvailableSlots(clinicId(req), req.params.id as string, date));
});

export const getScheduleView = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await repo.findDoctorById(clinicId(req), req.params.id as string);
  if (!doctor) throw ApiError.notFound("Doctor not found");
  const [schedule, leaves] = await Promise.all([
    repo.getSchedule(clinicId(req), req.params.id as string),
    repo.listLeaves(clinicId(req), req.params.id as string),
  ]);
  sendSuccess(res, {
    doctor: doctorsService.toDoctorDto(doctor),
    schedule: schedule.map((s) => ({
      scheduleId: s.ScheduleID,
      dayOfWeek: s.DayOfWeek,
      startTime: s.StartTime,
      endTime: s.EndTime,
      slotDurationMinutes: s.SlotDurationMinutes,
      maxTokens: s.MaxTokens,
    })),
    leaves: leaves.map((l) => ({ leaveId: l.LeaveID, leaveDate: l.LeaveDate, reason: l.Reason })),
  });
});
