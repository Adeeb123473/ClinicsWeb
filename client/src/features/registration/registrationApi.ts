import { apiGet, apiPost } from "../../api/http";
import type { Plan } from "../admin/adminApi";

export interface RegisterClinicPayload {
  clinicName: string;
  address?: string;
  phone?: string;
  clinicEmail: string;
  adminFullName: string;
  adminUsername: string;
  adminEmail: string;
  password: string;
}

export interface RegistrationResult {
  clinicId: string;
  clinicName: string;
  status: string;
  adminUsername: string;
}

export const registrationApi = {
  publicPlans: () => apiGet<Plan[]>("/admin/plans/public"),
  register: (payload: RegisterClinicPayload) => apiPost<RegistrationResult>("/auth/register-clinic", payload),
};
