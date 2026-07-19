import { type TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "../utils/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const generatedId = useId();
    const areaId = id ?? generatedId;
    const describedBy = error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={areaId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            "min-h-[84px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-soft",
            "placeholder:text-slate-400 transition-colors duration-150 focus:border-primary-400",
            error && "border-danger-400 focus:border-danger-500",
            className,
          )}
          {...props}
        />
        {error && (
          <p id={`${areaId}-error`} className="text-sm text-danger-600">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${areaId}-hint`} className="text-sm text-slate-400">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
