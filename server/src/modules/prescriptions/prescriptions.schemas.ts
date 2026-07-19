import { z } from "zod";

export const prescriptionItemSchema = z
  .object({
    medicineName: z.string().trim().min(1, "Medicine name is required").max(255),
    dosage: z.string().trim().max(100).optional().nullable(),
    frequency: z.string().trim().max(100).optional().nullable(),
    durationDays: z.number().int().positive().max(365).optional().nullable(),
    instructions: z.string().trim().max(500).optional().nullable(),
  })
  // Normalise optional -> null so the type matches the repository's PrescriptionItem exactly.
  .transform((v) => ({
    medicineName: v.medicineName,
    dosage: v.dosage ?? null,
    frequency: v.frequency ?? null,
    durationDays: v.durationDays ?? null,
    instructions: v.instructions ?? null,
  }));

export const savePrescriptionSchema = z.object({
  consultationId: z.string().uuid(),
  items: z.array(prescriptionItemSchema).max(50),
});

export const saveTemplateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(255),
  items: z.array(prescriptionItemSchema).min(1).max(50),
});

export type SavePrescriptionBody = z.infer<typeof savePrescriptionSchema>;
export type SaveTemplateBody = z.infer<typeof saveTemplateSchema>;
