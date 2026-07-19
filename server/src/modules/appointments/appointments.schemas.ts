import { z } from "zod";

export const bookSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time").optional(),
  visitType: z.enum(["Deserving", "Private", "FollowUp", "Emergency", "Insurance"]).default("Private"),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export const queueQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  doctorId: z.string().uuid().optional(),
  status: z.enum(["Scheduled", "CheckedIn", "InConsultation", "Completed", "Cancelled", "NoShow"]).optional(),
  patientId: z.string().uuid().optional(),
});

export const statusSchema = z.object({
  status: z.enum(["CheckedIn", "InConsultation", "Completed", "Cancelled", "NoShow", "Scheduled"]),
});

export const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
});

export type BookBody = z.infer<typeof bookSchema>;
export type QueueQuery = z.infer<typeof queueQuerySchema>;
export type StatusBody = z.infer<typeof statusSchema>;
export type RescheduleBody = z.infer<typeof rescheduleSchema>;
