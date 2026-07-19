import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { platformSettingsSchema } from "./platform.schemas.js";
import * as controller from "./platform.controller.js";

/** Super-Admin platform settings. Mounted at /admin/platform. */
const router = Router();
router.use(authenticate, authorize("SUPER_ADMIN"));

router.get("/settings", controller.getSettings);
router.put("/settings", validateBody(platformSettingsSchema), auditLog("UPDATE", "PlatformSettings"), controller.updateSettings);

export default router;
