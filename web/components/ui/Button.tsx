import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center gap-x-2 font-semibold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variantClasses = {
      primary:
        'border-transparent bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 dark:focus:ring-offset-zinc-900 shadow-xs',
      secondary:
        'border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:ring-gray-200 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-zinc-700',
      destructive:
        'border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:focus:ring-offset-zinc-900 shadow-xs',
      outline:
        'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 focus:ring-emerald-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800',
      ghost:
        'border-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-200 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:ring-zinc-700',
    };

    const sizeClasses = {
      sm: 'py-1.5 px-2.5 text-xs',
      md: 'py-2 px-3.5 text-sm',
      lg: 'py-3 px-4 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      >
        {isLoading ? (
          <span
            className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            role="status"
            aria-label="loading"
          />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
