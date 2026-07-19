import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { requireFeature } from "../../middleware/planFeature.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as service from "./lab.service.js";

const router = Router();
router.use(authenticate, tenantScope, requireFeature("lab"));

function clinicId(req: import("express").Request): string {
  if (!req.authUser?.clinicId) throw ApiError.unauthorized();
  return req.authUser.clinicId;
}

const testSchema = z.object({
  name: z.string().trim().min(1).max(255),
  category: z.string().trim().max(100).optional().nullable(),
  price: z.number().min(0).default(0),
});
const orderSchema = z.object({
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional().nullable(),
  labTestId: z.string().uuid(),
});
const statusSchema = z.object({ status: z.enum(["Ordered", "Collected", "Completed", "Cancelled"]) });
const resultSchema = z.object({ resultText: z.string().trim().min(1).max(8000) });

// Tests master: clinical roles read; doctors/admins manage.
router.get("/tests", authorize("CLINIC_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getTests(clinicId(req)));
}));
router.post("/tests", authorize("CLINIC_ADMIN", "DOCTOR"), validateBody(testSchema), auditLog("CREATE", "LabTest"), asyncHandler(async (req, res) => {
  const b = req.body as z.infer<typeof testSchema>;
  sendSuccess(res, await service.createTest(clinicId(req), b.name, b.category ?? null, b.price), 201);
}));

// Orders: doctors order; nurses/admins record results/status.
router.get("/orders", authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getOrders(clinicId(req), req.query.patientId as string | undefined, req.query.status as string | undefined));
}));
router.post("/orders", authorize("DOCTOR"), validateBody(orderSchema), auditLog("CREATE", "LabOrder"), asyncHandler(async (req, res) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const b = req.body as z.infer<typeof orderSchema>;
  sendSuccess(res, await service.orderTest(req.authUser, b.patientId, b.consultationId ?? null, b.labTestId), 201);
}));
router.patch("/orders/:id/status", authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"), validateBody(statusSchema), auditLog("STATUS_CHANGE", "LabOrder"), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.updateOrderStatus(clinicId(req), req.params.id as string, (req.body as z.infer<typeof statusSchema>).status));
}));
router.post("/orders/:id/result", authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"), validateBody(resultSchema), auditLog("RESULT", "LabOrder"), asyncHandler(async (req, res) => {
  if (!req.authUser) throw ApiError.unauthorized();
  sendSuccess(res, await service.recordResult(clinicId(req), req.params.id as string, req.authUser.sub, (req.body as z.infer<typeof resultSchema>).resultText));
}));

export default router;
