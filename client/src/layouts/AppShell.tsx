import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "../utils/cn";
import { ChevronLeftIcon, LogoutIcon } from "../components/icons";
import { useAuthStore } from "../store/authStore";
import { useLogoutMutation } from "../features/auth/useAuthMutations";
import { NotificationBell } from "../features/notifications/NotificationBell";
import type { NavItem } from "./navConfig";

export interface AppShellProps {
  /** Short label shown next to the logo mark, e.g. "ClinicOS Admin". */
  brandLabel: string;
  navItems: NavItem[];
  /** Whether to show the in-app notification bell (clinic roles only). */
  showNotifications?: boolean;
}

/** Shared sidebar + topbar chrome used by both SuperAdminLayout and ClinicLayout. */
export function AppShell({ brandLabel, navItems, showNotifications }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync().catch(() => undefined);
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-svh bg-slate-50">
      <motion.aside
        animate={{ width: collapsed ? 76 : 248 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeInOut" }}
        className="relative flex flex-shrink-0 flex-col border-r border-slate-200 bg-white"
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white">
            C
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="truncate text-sm font-semibold text-slate-800"
              >
                {brandLabel}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <motion.nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.04 } },
          }}
        >
          {navItems.map((item) => (
            <motion.div
              key={item.to}
              variants={{
                hidden: { opacity: 0, x: shouldReduceMotion ? 0 : -8 },
                visible: { opacity: 1, x: 0 },
              }}
              transition={{ duration: 0.2 }}
            >
              <NavLink
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            </motion.div>
          ))}
        </motion.nav>

        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-10 items-center justify-center border-t border-slate-100 text-slate-400 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronLeftIcon
            className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")}
          />
        </button>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-shrink-0 items-center justify-end gap-4 border-b border-slate-200 bg-white px-6">
          {showNotifications && <NotificationBell />}
          <div className="text-right">
            <p className="text-sm font-medium text-slate-800">{user?.fullName ?? "—"}</p>
            <p className="text-xs capitalize text-slate-400">
              {user?.role.toLowerCase().replace("_", " ") ?? ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
          >
            <LogoutIcon className="h-4 w-4" />
            Log out
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
