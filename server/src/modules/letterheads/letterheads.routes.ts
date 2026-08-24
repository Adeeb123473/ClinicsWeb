import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { upsertTemplateSchema, uploadImageSchema } from "./letterheads.schemas.js";
import * as controller from "./letterheads.controller.js";

/**
 * Mounted at /api/v1/doctors alongside the doctors router (the same pattern /api/v1/patients
 * already uses for history + patients). Paths are /:doctorId/letterhead...
 */
const router = Router();

router.use(authenticate, tenantScope);

// Reading a letterhead is needed by whoever prints — reception prints slips, doctors print
// consultations — so all clinic roles may read. Writing is restricted below.
router.get(
  "/:doctorId/letterhead",
  authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"),
  controller.get,
);
router.get(
  "/:doctorId/letterhead/image/:kind",
  authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"),
  controller.image,
);

// Editing: doctors (their own) and clinic admins (any in the clinic). Ownership is enforced
// in the service, which also distinguishes "not in this clinic" (404) from "not yours" (403).
router.put(
  "/:doctorId/letterhead",
  authorize("CLINIC_ADMIN", "DOCTOR"),
  validateBody(upsertTemplateSchema),
  auditLog("UPDATE", "LetterheadTemplate"),
  controller.save,
);
router.post(
  "/:doctorId/letterhead/image",
  authorize("CLINIC_ADMIN", "DOCTOR"),
  validateBody(uploadImageSchema),
  auditLog("UPLOAD", "LetterheadImage"),
  controller.upload,
);
router.delete(
  "/:doctorId/letterhead",
  authorize("CLINIC_ADMIN", "DOCTOR"),
  auditLog("DELETE", "LetterheadTemplate"),
  controller.remove,
);

export default router;
