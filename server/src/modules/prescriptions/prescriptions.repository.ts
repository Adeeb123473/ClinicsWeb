import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface PrescriptionItem {
  medicineName: string;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  instructions: string | null;
}

export interface PrescriptionRow {
  PrescriptionID: string;
  ConsultationID: string;
  CreatedAt: Date;
}

/** Returns the prescription (with items) for a consultation, or null. */
export async function getPrescriptionForConsultation(
  clinicId: string,
  consultationId: string,
): Promise<{ prescriptionId: string; items: PrescriptionItem[] } | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const pres = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("consultationId", sql.UniqueIdentifier, consultationId)
    .query<PrescriptionRow>(
      `SELECT TOP 1 * FROM Prescriptions WHERE ClinicID = @clinicId AND ConsultationID = @consultationId AND IsDeleted = 0 ORDER BY CreatedAt DESC`,
    );
  const row = pres.recordset[0];
  if (!row) return null;

  const items = await pool
    .request()
    .input("prescriptionId", sql.UniqueIdentifier, row.PrescriptionID)
    .query<{
      MedicineName: string;
      Dosage: string | null;
      Frequency: string | null;
      DurationDays: number | null;
      Instructions: string | null;
    }>(`SELECT * FROM PrescriptionItems WHERE PrescriptionID = @prescriptionId ORDER BY SortOrder`);

  return {
    prescriptionId: row.PrescriptionID,
    items: items.recordset.map((i) => ({
      medicineName: i.MedicineName,
      dosage: i.Dosage,
      frequency: i.Frequency,
      durationDays: i.DurationDays,
      instructions: i.Instructions,
    })),
  };
}

/** Replaces the prescription for a consultation atomically (soft-deletes any prior one). */
export async function savePrescription(
  clinicId: string,
  consultationId: string,
  items: PrescriptionItem[],
): Promise<string> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("consultationId", sql.UniqueIdentifier, consultationId)
      .query(`UPDATE Prescriptions SET IsDeleted = 1 WHERE ClinicID = @clinicId AND ConsultationID = @consultationId`);

    const pres = await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("consultationId", sql.UniqueIdentifier, consultationId)
      .query<{ PrescriptionID: string }>(`
        INSERT INTO Prescriptions (ClinicID, ConsultationID) OUTPUT INSERTED.PrescriptionID VALUES (@clinicId, @consultationId)
      `);
    const prescriptionId = pres.recordset[0].PrescriptionID;

    let order = 0;
    for (const item of items) {
      await new sql.Request(transaction)
        .input("prescriptionId", sql.UniqueIdentifier, prescriptionId)
        .input("name", sql.NVarChar, item.medicineName)
        .input("dosage", sql.NVarChar, item.dosage)
        .input("frequency", sql.NVarChar, item.frequency)
        .input("duration", sql.Int, item.durationDays)
        .input("instructions", sql.NVarChar, item.instructions)
        .input("sortOrder", sql.Int, order++)
        .query(`
          INSERT INTO PrescriptionItems (PrescriptionID, MedicineName, Dosage, Frequency, DurationDays, Instructions, SortOrder)
          VALUES (@prescriptionId, @name, @dosage, @frequency, @duration, @instructions, @sortOrder)
        `);
    }
    await transaction.commit();
    return prescriptionId;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ---- Templates ----

export interface TemplateRow {
  TemplateID: string;
  Name: string;
  Items: string;
  CreatedAt: Date;
}

export async function listTemplates(clinicId: string, doctorId: string): Promise<TemplateRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<TemplateRow>(
      `SELECT * FROM PrescriptionTemplates WHERE ClinicID = @clinicId AND DoctorID = @doctorId ORDER BY Name`,
    );
  return result.recordset;
}

export async function insertTemplate(clinicId: string, doctorId: string, name: string, items: PrescriptionItem[]): Promise<string> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .input("name", sql.NVarChar, name)
    .input("items", sql.NVarChar(sql.MAX), JSON.stringify(items))
    .query<{ TemplateID: string }>(`
      INSERT INTO PrescriptionTemplates (ClinicID, DoctorID, Name, Items)
      OUTPUT INSERTED.TemplateID VALUES (@clinicId, @doctorId, @name, @items)
    `);
  return result.recordset[0].TemplateID;
}

export async function deleteTemplate(clinicId: string, doctorId: string, templateId: string): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .input("templateId", sql.UniqueIdentifier, templateId)
    .query(`DELETE FROM PrescriptionTemplates WHERE ClinicID = @clinicId AND DoctorID = @doctorId AND TemplateID = @templateId`);
}
