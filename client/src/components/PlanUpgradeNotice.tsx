import { motion, useReducedMotion } from "framer-motion";
import { CreditCardIcon } from "./icons";
import { cn } from "../utils/cn";

export interface PlanUpgradeNoticeProps {
  message?: string;
  className?: string;
}

/** Shown instead of an empty list/table when the clinic's subscription plan doesn't include the feature. */
export function PlanUpgradeNotice({ message, className }: PlanUpgradeNoticeProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-warning-200 bg-warning-50/40 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-100 text-warning-600">
        <CreditCardIcon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-slate-800">Not included in your plan</h3>
      <p className="max-w-sm text-sm text-slate-500">
        {message ?? "This feature isn't included in your clinic's current subscription plan. Ask your Clinic Admin to upgrade."}
      </p>
    </motion.div>
  );
}
