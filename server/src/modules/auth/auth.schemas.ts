import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerClinicSchema = z.object({
  clinicName: z.string().trim().min(2, "Clinic name is required").max(255),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(50).optional(),
  clinicEmail: z.string().trim().email("A valid clinic email is required"),
  adminFullName: z.string().trim().min(2, "Administrator name is required").max(255),
  adminUsername: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, and . _ -"),
  adminEmail: z.string().trim().email("A valid administrator email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a digit"),
});

export type RegisterClinicInput = z.infer<typeof registerClinicSchema>;
