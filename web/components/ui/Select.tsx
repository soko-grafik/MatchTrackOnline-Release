import React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: { value: string | number; label: string; disabled?: boolean }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, id, disabled, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium mb-1.5 text-gray-800 dark:text-zinc-200">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={cn(
              'py-2 px-3 pe-9 block w-full border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-500 transition-colors shadow-2xs appearance-none cursor-pointer',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled} className="dark:bg-zinc-900 dark:text-zinc-100">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute inset-y-0 end-0 flex items-center pointer-events-none pe-3 text-gray-400 dark:text-zinc-500">
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
