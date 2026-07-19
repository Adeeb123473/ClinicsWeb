import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import * as consultationsController from "./consultations.controller.js";

const router = Router();

router.get(
  "/:id",
  authenticate,
  tenantScope,
  authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"),
  auditLog("READ", "Consultation"),
  consultationsController.getConsultation,
);

export default router;
