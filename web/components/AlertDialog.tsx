"use client";

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface AlertDialogProps {
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        );
      case 'error':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
            <XCircle className="h-5 w-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Info className="h-5 w-5" />
          </div>
        );
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'success':
        return 'Erfolgreich';
      case 'error':
        return 'Fehler aufgetreten';
      case 'warning':
        return 'Hinweis';
      default:
        return 'Information';
    }
  };

  const getButtonVariant = () => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'success':
      default:
        return 'primary';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          {renderIcon()}
          <ModalTitle>{getTitle()}</ModalTitle>
        </div>
      </ModalHeader>

      <ModalBody>
        <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">{message}</p>
      </ModalBody>

      <ModalFooter>
        <Button variant={getButtonVariant()} size="md" className="w-full" onClick={onClose}>
          Verstanden
        </Button>
      </ModalFooter>
    </Modal>
  );
}
