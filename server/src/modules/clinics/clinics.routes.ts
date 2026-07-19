import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import {
  listClinicsQuerySchema,
  clinicActionSchema,
  assignPlanSchema,
} from "./clinics.schemas.js";
import * as clinicsController from "./clinics.controller.js";

const router = Router();

// Platform clinic administration is SUPER_ADMIN only.
router.use(authenticate, authorize("SUPER_ADMIN"));

router.get("/", validateQuery(listClinicsQuerySchema), clinicsController.list);
router.get("/:id", clinicsController.getOne);
router.post(
  "/:id/actions",
  validateBody(clinicActionSchema),
  auditLog("STATUS_CHANGE", "Clinic"),
  clinicsController.act,
);
router.post(
  "/:id/plan",
  validateBody(assignPlanSchema),
  auditLog("ASSIGN_PLAN", "Clinic"),
  clinicsController.setPlan,
);

export default router;
