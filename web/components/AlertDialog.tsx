"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

interface AlertDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose: () => void;
}

export default function AlertDialog({
  isOpen,
  title,
  message,
  type = 'info',
  onClose,
}: AlertDialogProps) {
  if (!isOpen) return null;

  const renderIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        );
      case 'error':
        return (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <XCircle className="h-6 w-6" />
          </div>
        );
      case 'warning':
        return (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
        );
      default:
        return (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Info className="h-6 w-6" />
          </div>
        );
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'success': return 'Erfolgreich';
      case 'error': return 'Fehler aufgetreten';
      case 'warning': return 'Hinweis';
      default: return 'Information';
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-white animate-in zoom-in-95 duration-200">
        
        {/* Close Icon Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Dialog Content */}
        <div className="flex items-start gap-4 pr-6">
          {renderIcon()}
          <div className="min-w-0 flex-1 space-y-1 pt-1">
            <h3 className="text-base font-extrabold leading-snug text-white">
              {getTitle()}
            </h3>
            <p className="text-sm font-medium leading-relaxed text-zinc-400">
              {message}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className={`w-full rounded-lg px-5 py-3 text-sm font-bold tracking-wider text-white transition-all ${
              type === 'error'
                ? 'bg-rose-600 hover:bg-rose-700'
                : type === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : type === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
