import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { patientSchema, searchQuerySchema, duplicateQuerySchema } from "./patients.schemas.js";
import * as patientsController from "./patients.controller.js";

const router = Router();

// All clinic roles may reach patient routes; field-level filtering (service layer) removes
// clinical fields for receptionists. SUPER_ADMIN is rejected by tenantScope.
router.use(authenticate, tenantScope, authorize("CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"));

router.get("/", validateQuery(searchQuerySchema), patientsController.listPatients);
router.get("/duplicates", validateQuery(duplicateQuerySchema), patientsController.checkDuplicates);

// Registration/editing is a reception/admin responsibility.
router.post(
  "/",
  authorize("CLINIC_ADMIN", "RECEPTIONIST"),
  validateBody(patientSchema),
  auditLog("CREATE", "Patient"),
  patientsController.registerPatient,
);
router.patch(
  "/:id",
  authorize("CLINIC_ADMIN", "RECEPTIONIST"),
  validateBody(patientSchema),
  auditLog("UPDATE", "Patient"),
  patientsController.updatePatient,
);

router.get("/:id", auditLog("READ", "Patient"), patientsController.getPatient);

export default router;
