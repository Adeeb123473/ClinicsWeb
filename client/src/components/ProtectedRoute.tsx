import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore, type UserRole } from "../store/authStore";

export interface ProtectedRouteProps {
  /** If omitted, any authenticated user may access the nested routes. */
  allowedRoles?: UserRole[];
}

/**
 * Route guard: redirects to `/login` when unauthenticated, or to
 * `/not-authorized` when the user's role isn't in `allowedRoles`.
 * This is a UX convenience only — the server enforces RBAC for real.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/not-authorized" replace />;
  }

  return <Outlet />;
}
