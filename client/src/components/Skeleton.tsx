import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Renders a circular skeleton, useful for avatars. */
  circle?: boolean;
}

/** A pulsing placeholder block for loading states. Respects reduced-motion globally via CSS. */
export function Skeleton({ circle, className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-pulse bg-slate-200",
        circle ? "rounded-full" : "rounded-xl",
        className,
      )}
      {...props}
    />
  );
}
