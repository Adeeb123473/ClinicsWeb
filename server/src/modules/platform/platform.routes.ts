import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { platformSettingsSchema, announcementSchema, toggleSchema } from "./platform.schemas.js";
import * as controller from "./platform.controller.js";

/** Super-Admin platform settings + announcement management. Mounted at /admin/platform. */
const adminRouter = Router();
adminRouter.use(authenticate, authorize("SUPER_ADMIN"));

adminRouter.get("/settings", controller.getSettings);
adminRouter.put("/settings", validateBody(platformSettingsSchema), auditLog("UPDATE", "PlatformSettings"), controller.updateSettings);

adminRouter.get("/announcements", controller.listAnnouncements);
adminRouter.post("/announcements", validateBody(announcementSchema), auditLog("CREATE", "Announcement"), controller.createAnnouncement);
adminRouter.patch("/announcements/:id", validateBody(toggleSchema), auditLog("UPDATE", "Announcement"), controller.toggleAnnouncement);
adminRouter.delete("/announcements/:id", auditLog("DELETE", "Announcement"), controller.deleteAnnouncement);

/** Clinic-facing active announcements for dashboard banners. Any authenticated user. */
const publicRouter = Router();
publicRouter.get("/active", authenticate, controller.activeAnnouncements);

export { adminRouter as platformAdminRoutes, publicRouter as announcementsRoutes };
