import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { scheduleSchema, leaveSchema } from "./doctors.schemas.js";
import * as doctorsController from "./doctors.controller.js";

const router = Router();

router.use(authenticate, tenantScope);

// All clinic roles need to read doctors (booking, queues, schedules).
router.get("/", authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"), doctorsController.list);
router.get("/:id/slots", authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"), doctorsController.slots);
router.get("/:id/schedule", authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"), doctorsController.getScheduleView);

// Schedule & leave management: doctors (own) and clinic admins (any) — ownership enforced in controller.
router.put("/:id/schedule", authorize("DOCTOR", "CLINIC_ADMIN"), validateBody(scheduleSchema), auditLog("UPDATE", "DoctorSchedule"), doctorsController.setSchedule);
router.post("/:id/leaves", authorize("DOCTOR", "CLINIC_ADMIN"), validateBody(leaveSchema), auditLog("CREATE", "DoctorLeave"), doctorsController.addLeave);
router.delete("/:id/leaves/:leaveId", authorize("DOCTOR", "CLINIC_ADMIN"), auditLog("DELETE", "DoctorLeave"), doctorsController.removeLeave);

export default router;
