import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { consultationSchema } from "./consultations.schemas.js";
import * as consultationsController from "./consultations.controller.js";

const router = Router();

router.use(authenticate, tenantScope);

// Reading consultation notes: doctors, nurses (summary), clinic admins. Receptionists blocked.
router.get(
  "/",
  authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"),
  auditLog("READ", "Consultation"),
  consultationsController.listForPatient,
);
router.get(
  "/:id",
  authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"),
  auditLog("READ", "Consultation"),
  consultationsController.getConsultation,
);

// Writing consultations: doctors only (admin may amend).
router.post(
  "/",
  authorize("DOCTOR"),
  validateBody(consultationSchema),
  auditLog("CREATE", "Consultation"),
  consultationsController.create,
);
router.patch(
  "/:id",
  authorize("DOCTOR", "CLINIC_ADMIN"),
  validateBody(consultationSchema),
  auditLog("UPDATE", "Consultation"),
  consultationsController.update,
);

export default router;
