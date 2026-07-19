import { apiGet, apiPost, apiPatch, apiPut } from "../../api/http";

export interface StaffMember {
  userId: string;
  username: string;
  role: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  doctor: {
    doctorId: string;
    specialization: string | null;
    consultationFee: number;
    followUpFee: number;
    roomNo: string | null;
  } | null;
}

export interface CreateStaffInput {
  username: string;
  password: string;
  role: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  specialization?: string | null;
  consultationFee?: number;
  followUpFee?: number;
  roomNo?: string | null;
}

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

export interface ClinicSettings {
  clinicId: string;
  clinicName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  status: string;
  timeZone: string;
  operatingHours: Record<string, DayHours>;
  settings: {
    mrNoFormat: string;
    tokenResetDaily: boolean;
    taxPercent: number;
    currency: string;
    prescriptionHeader: string;
    prescriptionFooter: string;
    invoicePrefix: string;
  };
}

export interface ClinicDashboard {
  summary: {
    appointmentsToday: number;
    newPatientsToday: number;
    revenueToday: number;
    revenueMonth: number;
    activePatients: number;
  };
  appointmentTrend: { day: string; count: number }[];
  doctorLoad: { doctor: string; count: number }[];
  statusMix: { status: string; count: number }[];
}

export interface AuditEntry {
  logId: string;
  action: string;
  entity: string;
  entityId: string | null;
  username: string | null;
  ipAddress: string | null;
  timestamp: string;
}

export const clinicAdminApi = {
  listStaff: () => apiGet<StaffMember[]>("/users"),
  createStaff: (input: CreateStaffInput) => apiPost<StaffMember>("/users", input),
  updateStaff: (id: string, input: Record<string, unknown>) => apiPatch<StaffMember>(`/users/${id}`, input),
  resetPassword: (id: string, password: string) => apiPost<null>(`/users/${id}/reset-password`, { password }),

  getSettings: () => apiGet<ClinicSettings>("/clinic-settings"),
  updateSettings: (input: Record<string, unknown>) => apiPut<ClinicSettings>("/clinic-settings", input),

  dashboard: () => apiGet<ClinicDashboard>("/reports/dashboard"),
  revenue: (days = 30) => apiGet<{ day: string; total: number }[]>("/reports/revenue", { days }),
  auditLog: () => apiGet<AuditEntry[]>("/reports/audit-log"),
};
