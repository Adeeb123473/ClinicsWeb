import { type ReactNode, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card } from "./Card";
import { cn } from "../utils/cn";

export interface StatCardProps {
  label: string;
  value: number;
  /** Prefix (e.g. "$") rendered before the animated number. */
  prefix?: string;
  suffix?: string;
  icon?: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  /** Decimal places for the animated value. */
  decimals?: number;
}

const toneBg: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-info-50 text-info-600",
};

/** Dashboard stat tile with an animated counter. */
export function StatCard({ label, value, prefix, suffix, icon, tone = "primary", decimals = 0 }: StatCardProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) return;
    const start = performance.now();
    const duration = 700;
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, reduce]);

  // When motion is reduced, render the final value directly (no animation state).
  const shown = reduce ? value : display;
  const formatted = shown.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {prefix}
            {formatted}
            {suffix}
          </p>
        </div>
        {icon && (
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneBg[tone])}>{icon}</div>
        )}
      </Card>
    </motion.div>
  );
}
