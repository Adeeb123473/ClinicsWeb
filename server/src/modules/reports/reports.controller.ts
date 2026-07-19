import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as repo from "./reports.repository.js";
import { toCsv } from "../../utils/csv.js";

function clinicId(req: Request): string {
  if (!req.authUser?.clinicId) throw ApiError.unauthorized();
  return req.authUser.clinicId;
}

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const cid = clinicId(req);
  const [summary, trend, load, status] = await Promise.all([
    repo.dashboardSummary(cid),
    repo.appointmentTrend(cid, 14),
    repo.doctorLoad(cid),
    repo.statusMix(cid),
  ]);
  sendSuccess(res, {
    summary,
    appointmentTrend: trend.map((t) => ({ day: t.Day, count: t.Cnt })),
    doctorLoad: load.map((d) => ({ doctor: d.DoctorName, count: d.Cnt })),
    statusMix: status.map((s) => ({ status: s.Status, count: s.Cnt })),
  });
});

export const revenue = asyncHandler(async (req: Request, res: Response) => {
  const cid = clinicId(req);
  const days = Math.min(90, Math.max(7, parseInt((req.query.days as string) ?? "30", 10)));
  const rows = await repo.revenueByDay(cid, days);
  sendSuccess(res, rows.map((r) => ({ day: r.Day, total: r.Total })));
});

export const auditLogView = asyncHandler(async (req: Request, res: Response) => {
  const rows = await repo.clinicAudit(clinicId(req), 100);
  sendSuccess(
    res,
    rows.map((r) => ({
      logId: r.LogID,
      action: r.Action,
      entity: r.Entity,
      entityId: r.EntityID,
      username: r.Username,
      ipAddress: r.IPAddress,
      timestamp: r.Timestamp,
    })),
  );
});

export const exportPatients = asyncHandler(async (req: Request, res: Response) => {
  const rows = await repo.patientsForExport(clinicId(req));
  const csv = toCsv(
    ["MR No", "Name", "Gender", "Mobile", "CNIC", "Category", "Registered"],
    rows.map((r) => [
      r.MRNo,
      r.PatientName,
      r.Gender,
      r.MobileNo ?? "",
      r.CNIC ?? "",
      r.Category,
      new Date(r.RegistrationDate).toISOString().slice(0, 10),
    ]),
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="patients.csv"');
  res.send(csv);
});

export const exportAppointments = asyncHandler(async (req: Request, res: Response) => {
  const rows = await repo.appointmentsForExport(clinicId(req));
  const csv = toCsv(
    ["Date", "Time", "Token", "Patient", "MR No", "Doctor", "Visit Type", "Status"],
    rows.map((r) => [
      new Date(r.AppointmentDate).toISOString().slice(0, 10),
      r.AppointmentTime,
      String(r.TokenNo),
      r.PatientName,
      r.MRNo ?? "",
      r.DoctorName,
      r.VisitType,
      r.Status,
    ]),
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="appointments.csv"');
  res.send(csv);
});
