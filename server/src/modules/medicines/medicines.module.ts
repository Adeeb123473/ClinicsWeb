import { Router } from "express";
import { z } from "zod";
import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";
import { authenticate } from "../../middleware/authenticate.js";
import { tenantScope } from "../../middleware/tenantScope.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

interface MedicineRow {
  MedicineID: string;
  Name: string;
  GenericName: string | null;
  DefaultDosage: string | null;
}

async function search(clinicId: string, q: string | undefined): Promise<MedicineRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("q", sql.NVarChar, q ? `%${q}%` : null)
    .query<MedicineRow>(`
      SELECT TOP 20 MedicineID, Name, GenericName, DefaultDosage FROM Medicines
      WHERE ClinicID = @clinicId AND IsActive = 1 AND (@q IS NULL OR Name LIKE @q OR GenericName LIKE @q)
      ORDER BY Name
    `);
  return result.recordset;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  genericName: z.string().trim().max(255).optional().nullable(),
  defaultDosage: z.string().trim().max(100).optional().nullable(),
});

const router = Router();
router.use(authenticate, tenantScope, authorize("DOCTOR", "CLINIC_ADMIN", "NURSE"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw ApiError.unauthorized();
    const rows = await search(req.authUser.clinicId as string, req.query.q as string | undefined);
    sendSuccess(
      res,
      rows.map((m) => ({ medicineId: m.MedicineID, name: m.Name, genericName: m.GenericName, defaultDosage: m.DefaultDosage })),
    );
  }),
);

router.post(
  "/",
  authorize("DOCTOR", "CLINIC_ADMIN"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw ApiError.unauthorized();
    const body = req.body as z.infer<typeof createSchema>;
    const pool = await getPool();
    // Idempotent per (ClinicID, Name): ignore if it already exists.
    const result = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, req.authUser.clinicId)
      .input("name", sql.NVarChar, body.name)
      .input("generic", sql.NVarChar, body.genericName ?? null)
      .input("dosage", sql.NVarChar, body.defaultDosage ?? null)
      .query<{ MedicineID: string }>(`
        IF NOT EXISTS (SELECT 1 FROM Medicines WHERE ClinicID = @clinicId AND Name = @name)
          INSERT INTO Medicines (ClinicID, Name, GenericName, DefaultDosage)
          OUTPUT INSERTED.MedicineID VALUES (@clinicId, @name, @generic, @dosage);
        ELSE
          SELECT MedicineID FROM Medicines WHERE ClinicID = @clinicId AND Name = @name;
      `);
    sendSuccess(res, { medicineId: result.recordset[0]?.MedicineID, name: body.name }, 201);
  }),
);

export default router;
