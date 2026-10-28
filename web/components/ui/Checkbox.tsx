import React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, disabled, checked, defaultChecked, onChange, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;

    return (
      <label htmlFor={checkboxId} className={cn('inline-flex items-start gap-x-2.5 cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed', className)}>
        <input
          type="checkbox"
          id={checkboxId}
          ref={ref}
          disabled={disabled}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          className="shrink-0 mt-0.5 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-700 dark:checked:bg-emerald-500 dark:checked:border-emerald-500 dark:focus:ring-offset-zinc-900 cursor-pointer"
          {...props}
        />
        {(label || description) && (
          <div className="grow">
            {label && (
              <span className="block text-sm font-medium text-gray-800 dark:text-zinc-200">
                {label}
              </span>
            )}
            {description && (
              <span className="block text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
