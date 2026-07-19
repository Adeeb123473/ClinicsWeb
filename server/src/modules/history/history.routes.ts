import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { patientHistory } from "./history.controller.js";

const router = Router();

// Clinical timeline — doctors, nurses (filtered), clinic admins. Receptionists blocked.
router.get(
  "/:id/history",
  authenticate,
  tenantScope,
  authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"),
  auditLog("READ", "PatientHistory"),
  patientHistory,
);

export default router;
