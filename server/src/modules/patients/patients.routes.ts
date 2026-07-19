import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import * as patientsController from "./patients.controller.js";

const router = Router();

router.get(
  "/:id",
  authenticate,
  tenantScope,
  authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"),
  auditLog("READ", "Patient"),
  patientsController.getPatient,
);

export default router;
