import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody } from "../../middleware/validate.js";
import { savePrescriptionSchema, saveTemplateSchema } from "./prescriptions.schemas.js";
import * as controller from "./prescriptions.controller.js";

const router = Router();

router.use(authenticate, tenantScope);

// Templates are per-doctor; declared before "/" so they don't collide with query reads.
router.get("/templates", authorize("DOCTOR"), controller.listTemplates);
router.post("/templates", authorize("DOCTOR"), validateBody(saveTemplateSchema), controller.createTemplate);
router.delete("/templates/:id", authorize("DOCTOR"), controller.deleteTemplate);

// Reading a prescription: clinical roles. Writing: doctors only.
router.get("/", authorize("CLINIC_ADMIN", "DOCTOR", "NURSE"), controller.getForConsultation);
router.post("/", authorize("DOCTOR"), validateBody(savePrescriptionSchema), auditLog("CREATE", "Prescription"), controller.save);

export default router;
