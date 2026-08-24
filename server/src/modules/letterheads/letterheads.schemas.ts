import { z } from "zod";

/** Paper is always A4 for now; stored explicitly so a future size is not a data migration. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** Field keys the print renderer knows how to fill. Extensible: unknown keys are rejected
 *  here rather than silently stored, so a typo cannot produce a field that never prints. */
export const FIELD_KEYS = [
  "patientName",
  "age",
  "gender",
  "date",
  "mrNo",
  "doctorName",
  "consultationBody",
] as const;

export const fieldSchema = z.object({
  key: z.enum(FIELD_KEYS),
  label: z.string().trim().max(100).optional().default(""),
  xMm: z.number().min(0).max(A4_WIDTH_MM),
  yMm: z.number().min(0).max(A4_HEIGHT_MM),
  widthMm: z.number().positive().max(A4_WIDTH_MM).optional().nullable(),
  /** Only meaningful for consultationBody, which wraps and can overflow to a second page. */
  heightMm: z.number().positive().max(A4_HEIGHT_MM).optional().nullable(),
  fontFamily: z.string().trim().max(80).optional().default("Arial"),
  fontSizePt: z.number().min(4).max(72).optional().default(11),
  fontWeight: z.enum(["normal", "bold"]).optional().default("normal"),
  align: z.enum(["left", "center", "right"]).optional().default("left"),
  uppercase: z.boolean().optional().default(false),
  prefix: z.string().max(40).optional().default(""),
  suffix: z.string().max(40).optional().default(""),
  visible: z.boolean().optional().default(true),
  /** Render appended to another field instead of in its own box (e.g. gender after the
   *  patient name on a pad that has no gender blank). */
  inlineWith: z.enum(FIELD_KEYS).optional().nullable(),
});

export type LetterheadField = z.infer<typeof fieldSchema>;

/**
 * Validates the field array as a whole: coordinates must fall inside the paper (including the
 * box extent, not just the origin), keys must be unique, and inlineWith must point at a real,
 * non-inlined field so composition cannot loop or dangle.
 */
const fieldsArraySchema = z
  .array(fieldSchema)
  .max(FIELD_KEYS.length)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    for (const f of fields) {
      if (seen.has(f.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate field key: ${f.key}` });
      }
      seen.add(f.key);
    }

    for (const f of fields) {
      if (f.widthMm != null && f.xMm + f.widthMm > A4_WIDTH_MM + 0.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field ${f.key} extends past the right edge of the paper`,
        });
      }
      if (f.heightMm != null && f.yMm + f.heightMm > A4_HEIGHT_MM + 0.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field ${f.key} extends past the bottom edge of the paper`,
        });
      }
    }

    for (const f of fields) {
      if (!f.inlineWith) continue;
      if (f.inlineWith === f.key) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Field ${f.key} cannot be inline with itself` });
        continue;
      }
      const target = fields.find((o) => o.key === f.inlineWith);
      if (!target) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field ${f.key} is inline with ${f.inlineWith}, which is not on this template`,
        });
        continue;
      }
      // One level only: an inlined field cannot itself be inlined into a third, which keeps
      // composition a simple append rather than a chain that has to be resolved recursively.
      if (target.inlineWith) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field ${f.key} is inline with ${f.inlineWith}, which is itself inline with another field`,
        });
      }
    }
  });

export const upsertTemplateSchema = z.object({
  mode: z.enum(["OVERLAY", "FULL"]),
  paperSize: z.literal("A4").optional().default("A4"),
  cornerPoints: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .length(4, "Exactly four corner points are required")
    .optional()
    .nullable(),
  imageWidthPx: z.number().int().positive().optional().nullable(),
  imageHeightPx: z.number().int().positive().optional().nullable(),
  mmPerPx: z.number().positive().optional().nullable(),
  globalOffsetXMm: z.number().min(-50).max(50).optional().default(0),
  globalOffsetYMm: z.number().min(-50).max(50).optional().default(0),
  status: z.enum(["DRAFT", "CALIBRATED"]).optional().default("DRAFT"),
  fields: fieldsArraySchema.optional().default([]),
});

export type UpsertTemplateBody = z.infer<typeof upsertTemplateSchema>;

/** Data URLs only: the client produces the dewarped image from a canvas, so this is the shape
 *  it already has, and it avoids introducing multipart parsing for a single endpoint. */
const DATA_URL = /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;

export const uploadImageSchema = z.object({
  kind: z.enum(["ORIGINAL", "DEWARPED"]),
  dataUrl: z
    .string()
    .regex(DATA_URL, "Expected a base64 data URL for a PNG, JPEG, WEBP or PDF")
    // ~12MB of base64 ≈ 9MB of bytes; the route's body limit is the real backstop.
    .max(12 * 1024 * 1024, "Image is too large"),
  widthPx: z.number().int().positive().optional().nullable(),
  heightPx: z.number().int().positive().optional().nullable(),
});

export type UploadImageBody = z.infer<typeof uploadImageSchema>;
