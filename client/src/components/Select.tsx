import { type SelectHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "../utils/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, id, className, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-soft",
            "transition-colors duration-150 focus:border-primary-400",
            error && "border-danger-400 focus:border-danger-500",
            props.disabled && "cursor-not-allowed bg-slate-50 text-slate-400",
            className,
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-sm text-danger-600">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${selectId}-hint`} className="text-sm text-slate-400">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
