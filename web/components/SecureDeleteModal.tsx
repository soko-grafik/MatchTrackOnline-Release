"use client";

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

interface SecureDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SecureDeleteModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}: SecureDeleteModalProps) {
  const [confirmValue, setConfirmValue] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmValue('');
      setIsError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (confirmValue === 'DELETE') {
      onConfirm();
    } else {
      setIsError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm leading-relaxed text-zinc-300">{message}</p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Bestätige durch Eingabe von <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-white">DELETE</span>
            </label>
            <input
              type="text"
              value={confirmValue}
              onChange={(e) => {
                setConfirmValue(e.target.value);
                if (isError) setIsError(false);
              }}
              placeholder="DELETE eingeben"
              autoFocus
              className={`w-full rounded-lg border bg-zinc-900 p-3 text-center font-mono tracking-widest text-white transition-colors focus:outline-none ${
                isError ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary'
              }`}
            />
            {isError && (
              <p className="text-center text-xs font-medium text-red-400">
                Bitte tippe exakt "DELETE" ein (Großbuchstaben).
              </p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-zinc-800 bg-zinc-900/50 p-4">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" /> 
            Endgültig löschen
          </button>
        </div>
      </div>
    </div>
  );
}
