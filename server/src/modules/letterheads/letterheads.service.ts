import { ApiError } from "../../utils/ApiError.js";
import type { AccessTokenPayload } from "../../types/auth.js";
import {
  findTemplateByDoctor,
  findDoctorInClinic,
  upsertTemplate,
  deleteTemplate,
  saveImage,
  findImage,
  type LetterheadTemplateRow,
} from "./letterheads.repository.js";
import { A4_HEIGHT_MM, A4_WIDTH_MM, type UpsertTemplateBody, type UploadImageBody } from "./letterheads.schemas.js";

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toDto(row: LetterheadTemplateRow) {
  const base = `/api/v1/doctors/${row.DoctorID}/letterhead/image`;
  return {
    letterheadTemplateId: row.LetterheadTemplateID,
    doctorId: row.DoctorID,
    doctorName: row.DoctorName,
    mode: row.Mode as "OVERLAY" | "FULL",
    paperSize: row.PaperSize,
    paperWidthMm: Number(row.PaperWidthMm),
    paperHeightMm: Number(row.PaperHeightMm),
    cornerPoints: parseJson<{ x: number; y: number }[] | null>(row.CornerPoints, null),
    imageCalibration:
      row.ImageWidthPx && row.ImageHeightPx && row.MmPerPx != null
        ? {
            imageWidthPx: row.ImageWidthPx,
            imageHeightPx: row.ImageHeightPx,
            mmPerPx: Number(row.MmPerPx),
          }
        : null,
    globalOffsetMm: { x: Number(row.GlobalOffsetXMm), y: Number(row.GlobalOffsetYMm) },
    status: row.Status as "DRAFT" | "CALIBRATED",
    fields: parseJson<unknown[]>(row.Fields, []),
    // Served through the API rather than a static path: the bytes live in the database.
    originalImageUrl: row.HasOriginal > 0 ? `${base}/original` : null,
    letterheadImageUrl: row.HasDewarped > 0 ? `${base}/dewarped` : null,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

/**
 * A doctor may only touch their own letterhead; a clinic admin may touch any within their
 * clinic. A doctor from another clinic gets 404 rather than 403, matching how the rest of the
 * app avoids confirming that a resource exists elsewhere.
 */
async function assertCanEdit(authUser: AccessTokenPayload, doctorId: string): Promise<void> {
  const clinicId = authUser.clinicId as string;
  const doctor = await findDoctorInClinic(clinicId, doctorId);
  if (!doctor) throw ApiError.notFound("Doctor not found");
  if (authUser.role === "CLINIC_ADMIN") return;
  if (authUser.role === "DOCTOR" && doctor.UserID.toLowerCase() === authUser.sub.toLowerCase()) return;
  throw ApiError.forbidden("You can only edit your own letterhead");
}

export async function getTemplate(authUser: AccessTokenPayload, doctorId: string) {
  const clinicId = authUser.clinicId as string;
  const doctor = await findDoctorInClinic(clinicId, doctorId);
  if (!doctor) throw ApiError.notFound("Doctor not found");
  const row = await findTemplateByDoctor(clinicId, doctorId);
  return row ? toDto(row) : null;
}

export async function saveTemplate(
  authUser: AccessTokenPayload,
  doctorId: string,
  body: UpsertTemplateBody,
) {
  await assertCanEdit(authUser, doctorId);
  const clinicId = authUser.clinicId as string;

  // A template can only be marked CALIBRATED once it actually has a dewarped image and at
  // least one visible field — otherwise "calibrated" would mean nothing at print time.
  if (body.status === "CALIBRATED") {
    const existing = await findTemplateByDoctor(clinicId, doctorId);
    if (!existing || existing.HasDewarped === 0) {
      throw ApiError.badRequest(
        "A letterhead cannot be marked calibrated before its image has been uploaded",
        "LETTERHEAD_NOT_READY",
      );
    }
  }

  await upsertTemplate({
    clinicId,
    doctorId,
    userId: authUser.sub,
    mode: body.mode,
    paperSize: body.paperSize,
    paperWidthMm: A4_WIDTH_MM,
    paperHeightMm: A4_HEIGHT_MM,
    cornerPoints: body.cornerPoints ? JSON.stringify(body.cornerPoints) : null,
    imageWidthPx: body.imageWidthPx ?? null,
    imageHeightPx: body.imageHeightPx ?? null,
    mmPerPx: body.mmPerPx ?? null,
    globalOffsetXMm: body.globalOffsetXMm,
    globalOffsetYMm: body.globalOffsetYMm,
    status: body.status,
    fields: JSON.stringify(body.fields),
  });

  const row = await findTemplateByDoctor(clinicId, doctorId);
  return toDto(row as LetterheadTemplateRow);
}

export async function removeTemplate(authUser: AccessTokenPayload, doctorId: string) {
  await assertCanEdit(authUser, doctorId);
  const removed = await deleteTemplate(authUser.clinicId as string, doctorId);
  if (!removed) throw ApiError.notFound("Letterhead not found");
}

const CONTENT_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/webp": "image/webp",
  "application/pdf": "application/pdf",
};

export async function uploadImage(
  authUser: AccessTokenPayload,
  doctorId: string,
  body: UploadImageBody,
) {
  await assertCanEdit(authUser, doctorId);
  const clinicId = authUser.clinicId as string;

  const match = /^data:([^;]+);base64,(.*)$/.exec(body.dataUrl);
  if (!match) throw ApiError.badRequest("Malformed data URL");
  const contentType = CONTENT_TYPES[match[1]];
  if (!contentType) throw ApiError.badRequest("Unsupported file type");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) throw ApiError.badRequest("Empty file");

  // An image can only be attached to a template that exists, so the caller creates the
  // template (even an empty DRAFT) first. Keeps the blob strictly owned by a template row.
  let template = await findTemplateByDoctor(clinicId, doctorId);
  if (!template) {
    await upsertTemplate({
      clinicId,
      doctorId,
      userId: authUser.sub,
      mode: "OVERLAY",
      paperSize: "A4",
      paperWidthMm: A4_WIDTH_MM,
      paperHeightMm: A4_HEIGHT_MM,
      cornerPoints: null,
      imageWidthPx: null,
      imageHeightPx: null,
      mmPerPx: null,
      globalOffsetXMm: 0,
      globalOffsetYMm: 0,
      status: "DRAFT",
      fields: "[]",
    });
    template = await findTemplateByDoctor(clinicId, doctorId);
  }

  await saveImage(
    (template as LetterheadTemplateRow).LetterheadTemplateID,
    body.kind,
    contentType,
    bytes,
    body.widthPx ?? null,
    body.heightPx ?? null,
  );

  const row = await findTemplateByDoctor(clinicId, doctorId);
  return toDto(row as LetterheadTemplateRow);
}

export async function getImage(authUser: AccessTokenPayload, doctorId: string, kind: string) {
  const image = await findImage(authUser.clinicId as string, doctorId, kind);
  if (!image) throw ApiError.notFound("Letterhead image not found");
  return image;
}
