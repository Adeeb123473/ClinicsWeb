export const ROLES = [
  "SUPER_ADMIN",
  "CLINIC_ADMIN",
  "DOCTOR",
  "RECEPTIONIST",
  "NURSE",
] as const;

export type Role = (typeof ROLES)[number];

export interface AuthUser {
  userId: string;
  username: string;
  fullName: string;
  role: Role;
  clinicId: string | null;
  mustChangePassword: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: Role;
  clinicId: string | null;
}
