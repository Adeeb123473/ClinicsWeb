import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import * as doctorsController from "./doctors.controller.js";

const router = Router();

// All clinic roles need to read doctors (booking, queues, schedules).
router.use(authenticate, tenantScope, authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"));

router.get("/", doctorsController.list);
router.get("/:id/slots", doctorsController.slots);
router.get("/:id/schedule", doctorsController.getScheduleView);

export default router;
