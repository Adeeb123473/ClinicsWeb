import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "../utils/cn";
import { ChevronLeftIcon, LogoutIcon, MenuIcon } from "../components/icons";
import { useAuthStore } from "../store/authStore";
import { useLogoutMutation } from "../features/auth/useAuthMutations";
import type { NavItem } from "./navConfig";

export interface AppShellProps {
  /** Short label shown next to the logo mark, e.g. "ClinicOS Admin". */
  brandLabel: string;
  navItems: NavItem[];
}

/** Shared sidebar + topbar chrome used by both SuperAdminLayout and ClinicLayout. */
export function AppShell({ brandLabel, navItems }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync().catch(() => undefined);
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-svh bg-slate-50">
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: collapsed ? 76 : 248 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeInOut" }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out",
          "lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-slate-100 px-4">
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
                onClick={() => setMobileOpen(false)}
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

        {/* The mini-sidebar collapse toggle is a desktop-only affordance — on the mobile
            drawer the sidebar is either fully open or fully hidden (via mobileOpen). */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-10 items-center justify-center border-t border-slate-100 text-slate-400 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-700 lg:flex"
        >
          <ChevronLeftIcon
            className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")}
          />
        </button>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-800 lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="ml-auto flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium text-slate-800">{user?.fullName ?? "—"}</p>
              <p className="text-xs capitalize text-slate-400">
                {user?.role.toLowerCase().replace("_", " ") ?? ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              aria-label="Log out"
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-500 transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50 sm:px-3"
            >
              <LogoutIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
