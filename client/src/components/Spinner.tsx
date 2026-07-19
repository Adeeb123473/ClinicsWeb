import { cn } from "../utils/cn";

export interface SpinnerProps {
  className?: string;
  label?: string;
}

/** Small inline loading spinner. Respects reduced-motion via the global CSS rule. */
export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600",
        className,
      )}
    />
  );
}

/** Full-area centered spinner for page/section loading. */
export function CenterSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <Spinner className="h-8 w-8" />
    </div>
  );
}
