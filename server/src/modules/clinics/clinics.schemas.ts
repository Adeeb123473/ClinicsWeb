import { z } from "zod";

const STATUSES = ["Pending", "Approved", "Suspended", "Inactive"] as const;

export const listClinicsQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const clinicActionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "reactivate"]),
});

export const assignPlanSchema = z.object({
  planId: z.string().uuid("A valid plan id is required"),
  expiry: z.coerce.date().nullable().default(null),
});

export type ListClinicsQuery = z.infer<typeof listClinicsQuerySchema>;
export type ClinicActionBody = z.infer<typeof clinicActionSchema>;
export type AssignPlanBody = z.infer<typeof assignPlanSchema>;
