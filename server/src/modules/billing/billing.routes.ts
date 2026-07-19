import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { auditLog } from "../../middleware/auditLog.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { createInvoiceSchema, paymentSchema, invoiceQuerySchema } from "./billing.schemas.js";
import * as controller from "./billing.controller.js";

const router = Router();

// Billing is a reception/admin responsibility; clinical roles have no access.
router.use(authenticate, tenantScope, authorize("CLINIC_ADMIN", "RECEPTIONIST"));

router.get("/invoices", validateQuery(invoiceQuerySchema), controller.list);
router.get("/invoices/:id", controller.getOne);
router.post("/invoices", validateBody(createInvoiceSchema), auditLog("CREATE", "Invoice"), controller.create);
router.post("/invoices/:id/payments", validateBody(paymentSchema), auditLog("PAYMENT", "Invoice"), controller.pay);

export default router;
