import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { getPlatformStats, getPlatformAudit } from "./admin.repository.js";

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getPlatformStats();

  const totalClinics = stats.clinicsByStatus.reduce((sum, s) => sum + s.Cnt, 0);
  const pendingApprovals = stats.clinicsByStatus.find((s) => s.Status === "Pending")?.Cnt ?? 0;
  const activeUsers = stats.usersByRole.reduce((sum, r) => sum + r.Cnt, 0);
  const mrr = stats.planRevenue.reduce((sum, p) => sum + Number(p.Mrr), 0);

  sendSuccess(res, {
    totals: { totalClinics, pendingApprovals, activeUsers, appointmentsToday: stats.appointmentsToday, mrr },
    clinicsByStatus: stats.clinicsByStatus.map((s) => ({ status: s.Status, count: s.Cnt })),
    usersByRole: stats.usersByRole.map((r) => ({ role: r.Role, count: r.Cnt })),
    planRevenue: stats.planRevenue.map((p) => ({
      planName: p.PlanName,
      clinics: p.Clinics,
      mrr: Number(p.Mrr),
    })),
  });
});

export const auditLogView = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await getPlatformAudit(100);
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
