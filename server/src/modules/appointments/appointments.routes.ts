import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { bookSchema, queueQuerySchema, statusSchema, rescheduleSchema } from "./appointments.schemas.js";
import * as controller from "./appointments.controller.js";

const router = Router();

router.use(authenticate, tenantScope);

// Reading the queue: all clinic roles.
router.get(
  "/",
  authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"),
  validateQuery(queueQuerySchema),
  controller.queue,
);
router.get("/:id", authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"), controller.getOne);

// Booking & scheduling: reception + admin.
router.post(
  "/",
  authorize("CLINIC_ADMIN", "RECEPTIONIST"),
  validateBody(bookSchema),
  auditLog("CREATE", "Appointment"),
  controller.book,
);
router.patch(
  "/:id/reschedule",
  authorize("CLINIC_ADMIN", "RECEPTIONIST"),
  validateBody(rescheduleSchema),
  auditLog("RESCHEDULE", "Appointment"),
  controller.reschedule,
);

// Status transitions: reception/admin drive check-in/cancel/no-show; doctors move to
// InConsultation/Completed. Authorize broadly and let the service enforce valid transitions.
router.patch(
  "/:id/status",
  authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"),
  validateBody(statusSchema),
  auditLog("STATUS_CHANGE", "Appointment"),
  controller.setStatus,
);

export default router;
