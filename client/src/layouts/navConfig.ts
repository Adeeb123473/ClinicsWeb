import type { ComponentType, SVGProps } from "react";
import type { UserRole } from "../store/authStore";
import {
  CalendarIcon,
  ChartIcon,
  ClipboardIcon,
  CreditCardIcon,
  FlaskIcon,
  GridIcon,
  HistoryIcon,
  SettingsIcon,
  StethoscopeIcon,
  UsersIcon,
} from "../components/icons";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Matches only the exact path (used for the role's landing/index page). */
  end?: boolean;
}

/** Nav items for the Super Admin platform shell (`/admin/*`). */
export const superAdminNav: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: GridIcon, end: true },
  { label: "Clinics", to: "/admin/clinics", icon: UsersIcon },
  { label: "Subscription Plans", to: "/admin/plans", icon: CreditCardIcon },
  { label: "Settings", to: "/admin/settings", icon: SettingsIcon },
  { label: "Audit Log", to: "/admin/audit-log", icon: HistoryIcon },
];

/** Nav items for each clinic-tenant role, keyed by role (`/app/*`). */
export const clinicNavByRole: Record<
  Exclude<UserRole, "SUPER_ADMIN">,
  NavItem[]
> = {
  CLINIC_ADMIN: [
    { label: "Dashboard", to: "/app", icon: GridIcon, end: true },
    { label: "Staff", to: "/app/staff", icon: UsersIcon },
    { label: "Patients", to: "/app/patients", icon: ClipboardIcon },
    { label: "Appointments", to: "/app/appointments", icon: CalendarIcon },
    { label: "Reports", to: "/app/reports", icon: ChartIcon },
    { label: "Settings", to: "/app/settings", icon: SettingsIcon },
    { label: "Audit Log", to: "/app/audit-log", icon: HistoryIcon },
  ],
  DOCTOR: [
    { label: "My Day", to: "/app", icon: GridIcon, end: true },
    { label: "Patients", to: "/app/patients", icon: ClipboardIcon },
    { label: "Lab", to: "/app/lab", icon: FlaskIcon },
    { label: "Schedule", to: "/app/schedule", icon: CalendarIcon },
  ],
  RECEPTIONIST: [
    { label: "Queue", to: "/app", icon: GridIcon, end: true },
    { label: "Patients", to: "/app/patients", icon: ClipboardIcon },
    { label: "Appointments", to: "/app/appointments", icon: CalendarIcon },
    { label: "Billing", to: "/app/billing", icon: CreditCardIcon },
  ],
  NURSE: [
    { label: "Today", to: "/app", icon: GridIcon, end: true },
    { label: "Vitals", to: "/app/vitals", icon: StethoscopeIcon },
    { label: "Lab", to: "/app/lab", icon: FlaskIcon },
  ],
};
