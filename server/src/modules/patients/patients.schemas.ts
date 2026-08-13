import { z } from "zod";

// CNIC format for the target market: 5 digits - 7 digits - 1 digit (e.g. 35202-1234567-1).
const cnicRegex = /^\d{5}-\d{7}-\d$/;

export const patientSchema = z
  .object({
    patientName: z.string().trim().min(2, "Patient name is required").max(255),
    fatherHusbandName: z.string().trim().max(255).optional().nullable(),
    gender: z.enum(["Male", "Female", "Other"]),
    actualDOB: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional().nullable(),
    estimatedDOB: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional().nullable(),
    ageAtRegistration: z.number().int().min(0).max(200).optional().nullable(),
    ageUnit: z.enum(["Years", "Months", "Days"]).optional().nullable(),
    mobileNo: z
      .string()
      .trim()
      .regex(/^\d{1,11}$/, "Mobile number must be digits only, up to 11 digits")
      .optional()
      .nullable()
      .or(z.literal("")),
    cnic: z
      .string()
      .trim()
      .regex(cnicRegex, "CNIC must be in the format 35202-1234567-1")
      .optional()
      .nullable()
      .or(z.literal("")),
    address: z.string().trim().max(500).optional().nullable(),
    category: z.enum(["General", "Deserving", "Staff", "Insurance"]).default("General"),
    bloodGroup: z.string().trim().max(5).optional().nullable(),
    allergies: z.string().trim().max(1000).optional().nullable(),
    chronicConditions: z.string().trim().max(1000).optional().nullable(),
    emergencyContactName: z.string().trim().max(255).optional().nullable(),
    emergencyContactPhone: z.string().trim().max(20).optional().nullable(),
    insuranceProvider: z.string().trim().max(255).optional().nullable(),
    insurancePolicyNo: z.string().trim().max(100).optional().nullable(),
    remarks: z.string().trim().max(1000).optional().nullable(),
    forceDuplicate: z.boolean().optional().default(false),
  })
  .transform((v) => ({ ...v, cnic: v.cnic === "" ? null : v.cnic, mobileNo: v.mobileNo === "" ? null : v.mobileNo }));

export const searchQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const duplicateQuerySchema = z.object({
  mobile: z.string().trim().optional(),
});

export type PatientBody = z.infer<typeof patientSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type DuplicateQuery = z.infer<typeof duplicateQuerySchema>;
