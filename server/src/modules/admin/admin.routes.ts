import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as adminController from "./admin.controller.js";

const router = Router();

router.use(authenticate, authorize("SUPER_ADMIN"));

router.get("/dashboard", adminController.dashboard);
router.get("/audit-log", adminController.auditLogView);

export default router;
