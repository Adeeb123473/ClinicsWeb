import { z } from "zod";

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a digit");

export const createStaffSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(100)
      .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, and . _ -"),
    password: passwordField,
    role: z.enum(["CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"]),
    fullName: z.string().trim().min(2, "Full name is required").max(255),
    email: z.string().trim().email().optional().nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    specialization: z.string().trim().max(255).optional().nullable(),
    consultationFee: z.number().min(0).optional(),
    followUpFee: z.number().min(0).optional(),
    roomNo: z.string().trim().max(50).optional().nullable(),
    qualifications: z.string().trim().max(500).optional().nullable(),
    licenseNo: z.string().trim().max(100).optional().nullable(),
  })
  .refine((v) => v.role !== "DOCTOR" || v.specialization !== undefined, {
    message: "Specialization is recommended for doctors",
    path: ["specialization"],
  });

export const updateStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  status: z.enum(["Active", "Inactive"]),
  specialization: z.string().trim().max(255).optional().nullable(),
  consultationFee: z.number().min(0).optional(),
  followUpFee: z.number().min(0).optional(),
  roomNo: z.string().trim().max(50).optional().nullable(),
});

export const resetPasswordSchema = z.object({
  password: passwordField,
});

export type CreateStaffBody = z.infer<typeof createStaffSchema>;
export type UpdateStaffBody = z.infer<typeof updateStaffSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
