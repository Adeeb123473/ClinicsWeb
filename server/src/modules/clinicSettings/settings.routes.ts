import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { updateSettingsSchema } from "./settings.schemas.js";
import * as settingsController from "./settings.controller.js";

const router = Router();

router.use(authenticate, tenantScope);

// Any clinic role may read settings (needed for prescription header, currency, etc.),
// but only CLINIC_ADMIN may change them.
router.get("/", settingsController.get);
router.put(
  "/",
  authorize("CLINIC_ADMIN"),
  validateBody(updateSettingsSchema),
  auditLog("UPDATE", "ClinicSettings"),
  settingsController.update,
);

export default router;
