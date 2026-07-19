import { apiGet, apiGetWithMeta, apiPost, apiPut, apiPatch, apiDelete } from "../../api/http";

export interface Plan {
  planId: string;
  name: string;
  priceMonthly: number;
  maxUsers: number | null;
  maxPatients: number | null;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanInput {
  name: string;
  priceMonthly: number;
  maxUsers: number | null;
  maxPatients: number | null;
  features: string[];
  isActive: boolean;
}

export type ClinicStatus = "Pending" | "Approved" | "Suspended" | "Inactive";

export interface Clinic {
  clinicId: string;
  clinicName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: ClinicStatus;
  timeZone: string;
  planId: string | null;
  planName: string | null;
  subscriptionExpiry: string | null;
  userCount: number;
  createdDate: string;
}

export interface DashboardStats {
  totals: {
    totalClinics: number;
    pendingApprovals: number;
    activeUsers: number;
    appointmentsToday: number;
    mrr: number;
  };
  clinicsByStatus: { status: string; count: number }[];
  usersByRole: { role: string; count: number }[];
  planRevenue: { planName: string; clinics: number; mrr: number }[];
}

export interface AdminAuditEntry {
  logId: string;
  action: string;
  entity: string;
  entityId: string | null;
  username: string | null;
  ipAddress: string | null;
  timestamp: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  allowClinicRegistration: boolean;
  maintenanceMode: boolean;
}

export interface Announcement {
  announcementId: string;
  title: string;
  body: string | null;
  level: "info" | "warning" | "critical";
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export const adminApi = {
  dashboard: () => apiGet<DashboardStats>("/admin/dashboard"),
  auditLog: () => apiGet<AdminAuditEntry[]>("/admin/audit-log"),

  getPlatformSettings: () => apiGet<PlatformSettings>("/admin/platform/settings"),
  updatePlatformSettings: (input: PlatformSettings) => apiPut<PlatformSettings>("/admin/platform/settings", input),
  listAnnouncements: () => apiGet<Announcement[]>("/admin/platform/announcements"),
  createAnnouncement: (input: { title: string; body: string | null; level: string }) => apiPost<Announcement>("/admin/platform/announcements", input),
  toggleAnnouncement: (id: string, isActive: boolean) => apiPatch<Announcement>(`/admin/platform/announcements/${id}`, { isActive }),
  deleteAnnouncement: (id: string) => apiDelete<null>(`/admin/platform/announcements/${id}`),

  listPlans: () => apiGet<Plan[]>("/admin/plans"),
  createPlan: (input: PlanInput) => apiPost<Plan>("/admin/plans", input),
  updatePlan: (id: string, input: PlanInput) => apiPut<Plan>(`/admin/plans/${id}`, input),
  deletePlan: (id: string) => apiDelete<null>(`/admin/plans/${id}`),

  listClinics: (params: { status?: string; search?: string; page?: number; limit?: number }) =>
    apiGetWithMeta<Clinic[]>("/admin/clinics", params),
  clinicAction: (id: string, action: "approve" | "reject" | "suspend" | "reactivate") =>
    apiPost<Clinic>(`/admin/clinics/${id}/actions`, { action }),
  assignPlan: (id: string, planId: string, expiry: string | null) =>
    apiPost<Clinic>(`/admin/clinics/${id}/plan`, { planId, expiry }),
};
