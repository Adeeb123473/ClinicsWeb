import { AnimatePresence, motion } from "framer-motion";
import { useToastStore, type ToastTone } from "../store/toastStore";
import { AlertIcon, CheckIcon, BellIcon, XIcon } from "./icons";

const toneStyles: Record<ToastTone, { bar: string; icon: typeof CheckIcon }> = {
  success: { bar: "bg-success-500", icon: CheckIcon },
  error: { bar: "bg-danger-500", icon: AlertIcon },
  info: { bar: "bg-info-500", icon: BellIcon },
};

/** Global toast container. Mount once near the app root. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { bar, icon: Icon } = toneStyles[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-soft-lg"
              role="status"
            >
              <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${bar} text-white`}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="flex-1 pt-0.5 text-sm text-slate-700">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="rounded-md p-0.5 text-slate-400 hover:text-slate-600"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
