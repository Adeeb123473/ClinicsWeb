import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { planSchema } from "./plans.schemas.js";
import * as plansController from "./plans.controller.js";

const router = Router();

// Public pricing (used by the landing page) — no auth.
router.get("/public", plansController.listPublic);

// Everything else is SUPER_ADMIN only.
router.use(authenticate, authorize("SUPER_ADMIN"));

router.get("/", plansController.listAll);
router.get("/:id", plansController.getOne);
router.post("/", validateBody(planSchema), auditLog("CREATE", "SubscriptionPlan"), plansController.create);
router.put("/:id", validateBody(planSchema), auditLog("UPDATE", "SubscriptionPlan"), plansController.update);
router.delete("/:id", auditLog("DELETE", "SubscriptionPlan"), plansController.remove);

export default router;
