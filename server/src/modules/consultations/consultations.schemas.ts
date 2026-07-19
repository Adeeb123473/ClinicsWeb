import { z } from "zod";

export const consultationSchema = z.object({
  appointmentId: z.string().uuid(),
  chiefComplaint: z.string().trim().max(1000).optional().nullable(),
  historyOfPresentIllness: z.string().trim().max(8000).optional().nullable(),
  examinationNotes: z.string().trim().max(8000).optional().nullable(),
  diagnosis: z.string().trim().max(1000).optional().nullable(),
  icd10Code: z.string().trim().max(20).optional().nullable(),
  treatmentPlan: z.string().trim().max(8000).optional().nullable(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export type ConsultationBody = z.infer<typeof consultationSchema>;
