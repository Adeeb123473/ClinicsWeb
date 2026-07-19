import { z } from "zod";

export const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(100),
  supportEmail: z.string().trim().email(),
  allowClinicRegistration: z.boolean(),
  maintenanceMode: z.boolean(),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  body: z.string().trim().max(2000).optional().nullable(),
  level: z.enum(["info", "warning", "critical"]).default("info"),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const toggleSchema = z.object({ isActive: z.boolean() });

export type PlatformSettingsBody = z.infer<typeof platformSettingsSchema>;
export type AnnouncementBody = z.infer<typeof announcementSchema>;
