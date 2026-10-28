"use client";

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Löschen",
  cancelText = "Abbrechen",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm">
      <ModalHeader onClose={onCancel}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <ModalTitle className="text-red-600 dark:text-red-400">{title}</ModalTitle>
        </div>
      </ModalHeader>

      <ModalBody>
        <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">{message}</p>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" size="md" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant="destructive" size="md" onClick={onConfirm}>
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
