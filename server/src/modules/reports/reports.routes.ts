import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import * as reportsController from "./reports.controller.js";

const router = Router();

// Reports are for CLINIC_ADMIN only, scoped to their clinic.
router.use(authenticate, tenantScope, authorize("CLINIC_ADMIN"));

router.get("/dashboard", reportsController.dashboard);
router.get("/revenue", reportsController.revenue);
router.get("/audit-log", reportsController.auditLogView);
router.get("/export/patients", reportsController.exportPatients);
router.get("/export/appointments", reportsController.exportAppointments);

export default router;
