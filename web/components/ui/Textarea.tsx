import React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium mb-1.5 text-gray-800 dark:text-zinc-200">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          disabled={disabled}
          className={cn(
            'py-2 px-3 block w-full border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500 transition-colors shadow-2xs resize-y',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
