import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { apiGet, apiPost } from "../../api/http";
import { BellIcon } from "../../components/icons";
import { formatDateTime } from "../../utils/format";

interface Notification {
  notificationId: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<Notification[]>("/notifications"),
    refetchInterval: 30000,
  });

  const unread = (data ?? []).filter((n) => !n.isRead).length;

  const markAll = async () => {
    await apiPost("/notifications/read-all").catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const openAndRead = () => {
    setOpen((o) => !o);
    if (!open && unread > 0) markAll();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openAndRead}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-100 bg-white p-2 shadow-soft-lg"
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-sm font-semibold text-slate-800">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {(data ?? []).length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-400">No notifications</p>
                ) : (
                  data!.map((n) => (
                    <div key={n.notificationId} className="rounded-xl px-2 py-2 hover:bg-slate-50">
                      <p className="text-sm font-medium text-slate-700">{n.title}</p>
                      {n.message && <p className="text-xs text-slate-500">{n.message}</p>}
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
