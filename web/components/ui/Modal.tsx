import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
  className?: string;
  closeOnEsc?: boolean;
  closeOnBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'md',
  children,
  className,
  closeOnEsc = true,
  closeOnBackdropClick = true,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl',
    full: 'max-w-[96vw] h-[92vh]',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && closeOnBackdropClick) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full max-h-[92vh] flex flex-col bg-white border border-gray-200 rounded-xl shadow-xl dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden transform transition-all',
          sizeClasses[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
};

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ className, onClose, children, ...props }) => {
  return (
    <div
      className={cn(
        'py-3.5 px-4 sm:px-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-x-3 shrink-0',
        className
      )}
      {...props}
    >
      <div className="grow min-w-0">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center items-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label="Schließen"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export interface ModalTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const ModalTitle: React.FC<ModalTitleProps> = ({ className, children, ...props }) => {
  return (
    <h3
      className={cn('font-bold text-gray-800 dark:text-zinc-100 text-base sm:text-lg truncate', className)}
      {...props}
    >
      {children}
    </h3>
  );
};

export interface ModalDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const ModalDescription: React.FC<ModalDescriptionProps> = ({ className, children, ...props }) => {
  return (
    <p className={cn('text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-0.5', className)} {...props}>
      {children}
    </p>
  );
};

export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ModalBody: React.FC<ModalBodyProps> = ({ className, children, ...props }) => {
  return (
    <div className={cn('p-4 sm:p-6 overflow-y-auto grow', className)} {...props}>
      {children}
    </div>
  );
};

export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ModalFooter: React.FC<ModalFooterProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        'py-3 px-4 sm:px-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/75 dark:bg-zinc-800/30 flex items-center justify-end gap-x-2 shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
