import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center gap-x-1.5 font-medium rounded-full border';

  const variantClasses = {
    default:
      'bg-gray-100 text-gray-800 border-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
    primary:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60',
    success:
      'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800/60',
    warning:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60',
    danger:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800/60',
    info:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60',
  };

  const dotColorClasses = {
    default: 'bg-gray-500 dark:bg-zinc-400',
    primary: 'bg-emerald-500',
    success: 'bg-teal-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
  };

  const sizeClasses = {
    sm: 'py-0.5 px-2 text-[11px]',
    md: 'py-1 px-2.5 text-xs',
    lg: 'py-1.5 px-3 text-sm',
  };

  return (
    <span className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)} {...props}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full inline-block', dotColorClasses[variant])} />}
      {children}
    </span>
  );
};
