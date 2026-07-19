import { AppShell } from "./AppShell";
import { superAdminNav } from "./navConfig";

export function SuperAdminLayout() {
  return <AppShell brandLabel="ClinicOS Admin" navItems={superAdminNav} />;
}
