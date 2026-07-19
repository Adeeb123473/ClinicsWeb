import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { vitalsSchema } from "./vitals.schemas.js";
import * as controller from "./vitals.controller.js";

const router = Router();

router.use(authenticate, tenantScope);

// Nurses record vitals; doctors can too. Clinical roles read; receptionists never touch vitals.
router.get("/", authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"), controller.listForPatient);
router.post(
  "/",
  authorize("NURSE", "DOCTOR", "CLINIC_ADMIN"),
  validateBody(vitalsSchema),
  auditLog("CREATE", "Vitals"),
  controller.record,
);

export default router;
