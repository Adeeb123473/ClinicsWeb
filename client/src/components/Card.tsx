import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-100 bg-white p-5 shadow-soft",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
