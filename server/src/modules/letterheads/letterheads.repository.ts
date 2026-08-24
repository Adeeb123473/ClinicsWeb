import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface LetterheadTemplateRow {
  LetterheadTemplateID: string;
  ClinicID: string;
  DoctorID: string;
  Mode: string;
  PaperSize: string;
  PaperWidthMm: number;
  PaperHeightMm: number;
  CornerPoints: string | null;
  ImageWidthPx: number | null;
  ImageHeightPx: number | null;
  MmPerPx: number | null;
  GlobalOffsetXMm: number;
  GlobalOffsetYMm: number;
  Status: string;
  Fields: string;
  CreatedAt: Date;
  UpdatedAt: Date | null;
  /** Joined: which image kinds exist, so the API can advertise image URLs without the bytes. */
  HasOriginal: number;
  HasDewarped: number;
  DoctorName: string;
}

/**
 * Always filters by the ClinicID from the authenticated JWT, so a template belonging to
 * another clinic simply matches no rows — indistinguishable from "does not exist".
 */
const TEMPLATE_SELECT = `
  SELECT t.*, d.DoctorName,
    (SELECT COUNT(*) FROM LetterheadImages i WHERE i.LetterheadTemplateID = t.LetterheadTemplateID AND i.Kind = 'ORIGINAL') AS HasOriginal,
    (SELECT COUNT(*) FROM LetterheadImages i WHERE i.LetterheadTemplateID = t.LetterheadTemplateID AND i.Kind = 'DEWARPED') AS HasDewarped
  FROM LetterheadTemplates t
  JOIN Doctors d ON d.DoctorID = t.DoctorID
`;

export async function findTemplateByDoctor(
  clinicId: string,
  doctorId: string,
): Promise<LetterheadTemplateRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<LetterheadTemplateRow>(
      `${TEMPLATE_SELECT} WHERE t.ClinicID = @clinicId AND t.DoctorID = @doctorId`,
    );
  return result.recordset[0] ?? null;
}

/** Confirms the doctor exists inside this clinic before a template is created for them. */
export async function findDoctorInClinic(
  clinicId: string,
  doctorId: string,
): Promise<{ DoctorID: string; UserID: string; DoctorName: string } | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<{ DoctorID: string; UserID: string; DoctorName: string }>(
      `SELECT DoctorID, UserID, DoctorName FROM Doctors WHERE ClinicID = @clinicId AND DoctorID = @doctorId`,
    );
  return result.recordset[0] ?? null;
}

export interface UpsertTemplateInput {
  clinicId: string;
  doctorId: string;
  userId: string;
  mode: string;
  paperSize: string;
  paperWidthMm: number;
  paperHeightMm: number;
  cornerPoints: string | null;
  imageWidthPx: number | null;
  imageHeightPx: number | null;
  mmPerPx: number | null;
  globalOffsetXMm: number;
  globalOffsetYMm: number;
  status: string;
  fields: string;
}

/** Creates or updates the doctor's single template. */
export async function upsertTemplate(input: UpsertTemplateInput): Promise<string> {
  assertClinicId(input.clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, input.clinicId)
    .input("doctorId", sql.UniqueIdentifier, input.doctorId)
    .input("userId", sql.UniqueIdentifier, input.userId)
    .input("mode", sql.NVarChar, input.mode)
    .input("paperSize", sql.NVarChar, input.paperSize)
    .input("paperWidthMm", sql.Decimal(7, 2), input.paperWidthMm)
    .input("paperHeightMm", sql.Decimal(7, 2), input.paperHeightMm)
    .input("cornerPoints", sql.NVarChar(sql.MAX), input.cornerPoints)
    .input("imageWidthPx", sql.Int, input.imageWidthPx)
    .input("imageHeightPx", sql.Int, input.imageHeightPx)
    .input("mmPerPx", sql.Decimal(12, 8), input.mmPerPx)
    .input("offsetX", sql.Decimal(7, 2), input.globalOffsetXMm)
    .input("offsetY", sql.Decimal(7, 2), input.globalOffsetYMm)
    .input("status", sql.NVarChar, input.status)
    .input("fields", sql.NVarChar(sql.MAX), input.fields)
    .query<{ LetterheadTemplateID: string }>(`
      MERGE LetterheadTemplates AS target
      USING (SELECT @doctorId AS DoctorID) AS source
        ON target.DoctorID = source.DoctorID AND target.ClinicID = @clinicId
      WHEN MATCHED THEN UPDATE SET
        Mode = @mode, PaperSize = @paperSize, PaperWidthMm = @paperWidthMm,
        PaperHeightMm = @paperHeightMm, CornerPoints = @cornerPoints,
        ImageWidthPx = @imageWidthPx, ImageHeightPx = @imageHeightPx, MmPerPx = @mmPerPx,
        GlobalOffsetXMm = @offsetX, GlobalOffsetYMm = @offsetY, Status = @status,
        Fields = @fields, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @userId
      WHEN NOT MATCHED THEN INSERT
        (ClinicID, DoctorID, Mode, PaperSize, PaperWidthMm, PaperHeightMm, CornerPoints,
         ImageWidthPx, ImageHeightPx, MmPerPx, GlobalOffsetXMm, GlobalOffsetYMm, Status, Fields, CreatedBy)
        VALUES
        (@clinicId, @doctorId, @mode, @paperSize, @paperWidthMm, @paperHeightMm, @cornerPoints,
         @imageWidthPx, @imageHeightPx, @mmPerPx, @offsetX, @offsetY, @status, @fields, @userId)
      OUTPUT INSERTED.LetterheadTemplateID;
    `);
  return result.recordset[0].LetterheadTemplateID;
}

export async function deleteTemplate(clinicId: string, doctorId: string): Promise<boolean> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query(`
      DELETE FROM LetterheadImages
        WHERE LetterheadTemplateID IN (
          SELECT LetterheadTemplateID FROM LetterheadTemplates
          WHERE ClinicID = @clinicId AND DoctorID = @doctorId);
      DELETE FROM LetterheadTemplates WHERE ClinicID = @clinicId AND DoctorID = @doctorId;
      SELECT @@ROWCOUNT AS Affected;
    `);
  return (result.recordset[0]?.Affected ?? 0) > 0;
}

export async function saveImage(
  templateId: string,
  kind: string,
  contentType: string,
  bytes: Buffer,
  widthPx: number | null,
  heightPx: number | null,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("templateId", sql.UniqueIdentifier, templateId)
    .input("kind", sql.NVarChar, kind)
    .input("contentType", sql.NVarChar, contentType)
    .input("bytes", sql.VarBinary(sql.MAX), bytes)
    .input("widthPx", sql.Int, widthPx)
    .input("heightPx", sql.Int, heightPx)
    .input("sizeBytes", sql.Int, bytes.length)
    .query(`
      MERGE LetterheadImages AS target
      USING (SELECT @templateId AS TemplateID, @kind AS Kind) AS source
        ON target.LetterheadTemplateID = source.TemplateID AND target.Kind = source.Kind
      WHEN MATCHED THEN UPDATE SET
        ContentType = @contentType, Bytes = @bytes, WidthPx = @widthPx,
        HeightPx = @heightPx, SizeBytes = @sizeBytes, CreatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (LetterheadTemplateID, Kind, ContentType, Bytes, WidthPx, HeightPx, SizeBytes)
        VALUES (@templateId, @kind, @contentType, @bytes, @widthPx, @heightPx, @sizeBytes);
    `);
}

export interface LetterheadImageRow {
  ContentType: string;
  Bytes: Buffer;
  SizeBytes: number;
}

/** Reads image bytes, joining through the template so the clinic scope is enforced in SQL. */
export async function findImage(
  clinicId: string,
  doctorId: string,
  kind: string,
): Promise<LetterheadImageRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .input("kind", sql.NVarChar, kind)
    .query<LetterheadImageRow>(`
      SELECT i.ContentType, i.Bytes, i.SizeBytes
      FROM LetterheadImages i
      JOIN LetterheadTemplates t ON t.LetterheadTemplateID = i.LetterheadTemplateID
      WHERE t.ClinicID = @clinicId AND t.DoctorID = @doctorId AND i.Kind = @kind
    `);
  return result.recordset[0] ?? null;
}
