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
      mrNoFormat: z.string().trim().min(1).max(50),
      tokenResetDaily: z.boolean(),
      taxPercent: z.number().min(0).max(100),
      currency: z.string().trim().min(1).max(10),
      prescriptionHeader: z.string().max(2000),
      prescriptionFooter: z.string().max(2000),
      invoicePrefix: z.string().trim().min(1).max(20),
    })
    .partial(),
});

export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;
