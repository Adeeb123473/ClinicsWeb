import { AppShell } from "./AppShell";
import { clinicNavByRole } from "./navConfig";
import { useAuthStore } from "../store/authStore";

/**
 * Tenant-scoped shell for CLINIC_ADMIN/DOCTOR/RECEPTIONIST/NURSE. Renders only
 * the nav items permitted for the logged-in user's role (see navConfig.ts).
 */
export function ClinicLayout() {
  const role = useAuthStore((state) => state.user?.role);
  const navItems = role && role !== "SUPER_ADMIN" ? clinicNavByRole[role] : [];

  return <AppShell brandLabel="ClinicOS" navItems={navItems} />;
}
