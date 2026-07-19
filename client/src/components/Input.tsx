import { type InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "../utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800",
            "placeholder:text-slate-400 shadow-soft transition-colors duration-150",
            "focus:border-primary-400",
            error && "border-danger-400 focus:border-danger-500",
            props.disabled && "cursor-not-allowed bg-slate-50 text-slate-400",
            className,
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-danger-600">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-sm text-slate-400">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
