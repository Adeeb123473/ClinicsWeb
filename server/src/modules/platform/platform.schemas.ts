import { z } from "zod";

export const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(100),
  supportEmail: z.string().trim().email(),
  allowClinicRegistration: z.boolean(),
  maintenanceMode: z.boolean(),
});

export type PlatformSettingsBody = z.infer<typeof platformSettingsSchema>;
