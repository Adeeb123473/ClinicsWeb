import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { refresh } from "./features/auth/authApi";
import { LoginPage } from "./features/auth/LoginPage";
import { NotAuthorizedPage } from "./pages/NotAuthorizedPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SuperAdminLayout } from "./layouts/SuperAdminLayout";
import { ClinicLayout } from "./layouts/ClinicLayout";

import { AdminDashboardPage } from "./pages/admin/DashboardPage";
import { ClinicsPage } from "./pages/admin/ClinicsPage";
import { PlansPage } from "./pages/admin/PlansPage";
import { AdminSettingsPage } from "./pages/admin/SettingsPage";
import { AdminAuditLogPage } from "./pages/admin/AuditLogPage";

import { DashboardPage } from "./pages/app/DashboardPage";
import { MyDayPage } from "./pages/app/MyDayPage";
import { QueuePage } from "./pages/app/QueuePage";
import { TodayPage } from "./pages/app/TodayPage";
import { StaffPage } from "./pages/app/StaffPage";
import { PatientsPage } from "./pages/app/PatientsPage";
import { AppointmentsPage } from "./pages/app/AppointmentsPage";
import { ReportsPage } from "./pages/app/ReportsPage";
import { ClinicSettingsPage } from "./pages/app/SettingsPage";
import { ClinicAuditLogPage } from "./pages/app/AuditLogPage";
import { SchedulePage } from "./pages/app/SchedulePage";
import { BillingPage } from "./pages/app/BillingPage";
import { VitalsPage } from "./pages/app/VitalsPage";

const CLINIC_ROLES = ["CLINIC_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"] as const;

function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50">
      <div
        role="status"
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"
      />
    </div>
  );
}

/**
 * `/` redirects based on current auth state: unauthenticated -> /login,
 * SUPER_ADMIN -> /admin, every other role -> /app.
 */
function RootRedirect() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "SUPER_ADMIN" ? "/admin" : "/app"} replace />;
}

/**
 * Renders a role-appropriate landing page under `/app` (index route), since
 * each clinic role has a different "home" nav item (Dashboard/My Day/Queue/Today).
 */
function ClinicHomePage() {
  const role = useAuthStore((state) => state.user?.role);
  switch (role) {
    case "DOCTOR":
      return <MyDayPage />;
    case "RECEPTIONIST":
      return <QueuePage />;
    case "NURSE":
      return <TodayPage />;
    case "CLINIC_ADMIN":
    default:
      return <DashboardPage />;
  }
}

function App() {
  // If a persisted user exists but we have no in-memory access token (fresh
  // page load), silently refresh once before rendering any routes.
  const [isBootstrapping, setIsBootstrapping] = useState(() => {
    const { user, accessToken } = useAuthStore.getState();
    return Boolean(user && !accessToken);
  });

  useEffect(() => {
    const { user, accessToken } = useAuthStore.getState();
    if (!user || accessToken) {
      // Nothing to do — the useState initializer above already reflects this.
      return;
    }

    let cancelled = false;
    refresh()
      .then((session) => {
        if (!cancelled) useAuthStore.getState().setSession(session.user, session.accessToken);
      })
      .catch(() => {
        if (!cancelled) useAuthStore.getState().clearSession();
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isBootstrapping) {
    return <FullPageSpinner />;
  }

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/not-authorized" element={<NotAuthorizedPage />} />

      <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />}>
        <Route path="/admin" element={<SuperAdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="clinics" element={<ClinicsPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="audit-log" element={<AdminAuditLogPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[...CLINIC_ROLES]} />}>
        <Route path="/app" element={<ClinicLayout />}>
          <Route index element={<ClinicHomePage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<ClinicSettingsPage />} />
          <Route path="audit-log" element={<ClinicAuditLogPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="vitals" element={<VitalsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default App;
