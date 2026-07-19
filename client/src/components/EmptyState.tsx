import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../utils/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const defaultIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-10 w-10">
    <rect x="3" y="5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 9.5h18" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** Standard empty/placeholder state: icon + title + optional description + CTA. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-500">
        {icon ?? defaultIcon}
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
