import { z } from "zod";

export const planSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required").max(100),
  priceMonthly: z.number().min(0, "Price cannot be negative"),
  maxUsers: z.number().int().positive().nullable().default(null),
  maxPatients: z.number().int().positive().nullable().default(null),
  features: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true),
});

export type PlanBody = z.infer<typeof planSchema>;
