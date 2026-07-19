import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { createStaffSchema, updateStaffSchema, resetPasswordSchema } from "./staff.schemas.js";
import * as staffController from "./staff.controller.js";

const router = Router();

// Staff management is CLINIC_ADMIN only, always scoped to the admin's own clinic.
router.use(authenticate, tenantScope, authorize("CLINIC_ADMIN"));

router.get("/", staffController.list);
router.post("/", validateBody(createStaffSchema), auditLog("CREATE", "User"), staffController.create);
router.patch("/:id", validateBody(updateStaffSchema), auditLog("UPDATE", "User"), staffController.update);
router.post(
  "/:id/reset-password",
  validateBody(resetPasswordSchema),
  auditLog("RESET_PASSWORD", "User"),
  staffController.resetPassword,
);

export default router;
