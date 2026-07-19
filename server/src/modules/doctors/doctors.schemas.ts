import { z } from "zod";

export const scheduleSchema = z.object({
  slots: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        slotDurationMinutes: z.number().int().min(5).max(120),
        maxTokens: z.number().int().positive().max(200).nullable().default(null),
      }),
    )
    .max(21),
});

export const leaveSchema = z.object({
  leaveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  reason: z.string().trim().max(255).optional().nullable(),
});

export type ScheduleBody = z.infer<typeof scheduleSchema>;
export type LeaveBody = z.infer<typeof leaveSchema>;
