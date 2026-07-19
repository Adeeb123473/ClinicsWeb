import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { apiGet } from "../../api/http";
import { AlertIcon, BellIcon, XIcon } from "../../components/icons";
import { cn } from "../../utils/cn";

interface Announcement {
  announcementId: string;
  title: string;
  body: string | null;
  level: "info" | "warning" | "critical";
}

const styles: Record<Announcement["level"], string> = {
  info: "bg-info-50 border-info-200 text-info-700",
  warning: "bg-warning-50 border-warning-200 text-warning-700",
  critical: "bg-danger-50 border-danger-200 text-danger-700",
};

/** Platform announcement banner shown at the top of clinic dashboards. Dismissible per session. */
export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { data } = useQuery({
    queryKey: ["announcements", "active"],
    queryFn: () => apiGet<Announcement[]>("/announcements/active"),
    refetchInterval: 5 * 60 * 1000,
  });

  const visible = (data ?? []).filter((a) => !dismissed.has(a.announcementId));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {visible.map((a) => (
          <motion.div
            key={a.announcementId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className={cn("flex items-start gap-3 rounded-xl border px-4 py-2.5", styles[a.level])}
          >
            {a.level === "info" ? <BellIcon className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{a.title}</p>
              {a.body && <p className="text-sm opacity-90">{a.body}</p>}
            </div>
            <button
              type="button"
              onClick={() => setDismissed((prev) => new Set(prev).add(a.announcementId))}
              aria-label="Dismiss"
              className="rounded-md p-0.5 opacity-70 hover:opacity-100"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
