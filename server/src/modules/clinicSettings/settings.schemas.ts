import { z } from "zod";

const dayHours = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  closed: z.boolean(),
});

export const updateSettingsSchema = z.object({
  clinicName: z.string().trim().min(2).max(255),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  timeZone: z.string().trim().min(1).max(100),
  operatingHours: z.record(z.string(), dayHours),
  settings: z
    .object({
      // Both placeholders are load-bearing: {seq} makes the number unique, {YYYY} scopes the
      // sequence to the current year. Saving a pre-filled literal like "MR-{2026}-{001}" would
      // give every patient in the clinic the same MR number.
      mrNoFormat: z
        .string()
        .trim()
        .min(1)
        .max(50)
        .refine(
          (v) => v.includes("{YYYY}") && v.includes("{seq}"),
          "MR No format must contain both the {YYYY} and {seq} placeholders, e.g. MR-{YYYY}-{seq}",
        ),
      tokenResetDaily: z.boolean(),
      taxPercent: z.number().min(0).max(100),
      currency: z.string().trim().min(1).max(10),
      // Prescriptions are printed from the per-doctor letterhead template, which carries its
      // own header artwork, so the old prescriptionHeader/Footer settings were replaced with
      // ones for the two documents that are still rendered by us: receipts and token slips.
      billingHeader: z.string().max(2000),
      billingFooter: z.string().max(2000),
      tokenHeader: z.string().max(2000),
      tokenFooter: z.string().max(2000),
      invoicePrefix: z.string().trim().min(1).max(20),
    })
    .partial(),
});

export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;
