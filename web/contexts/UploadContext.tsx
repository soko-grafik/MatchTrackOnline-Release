"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { uploadFullMatch, replaceMatchVideo } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

export interface UploadTask {
  id: string;
  name: string;
  progress: number;
  loadedBytes?: number;
  totalBytes?: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  matchId?: string;
}

interface UploadContextType {
  activeUploads: UploadTask[];
  startUpload: (formData: FormData, matchName: string, replaceMatchId?: string) => Promise<string>;
  clearCompleted: () => void;
  removeUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType>({
  activeUploads: [],
  startUpload: async () => '',
  clearCompleted: () => {},
  removeUpload: () => {},
});

export const useUpload = () => useContext(UploadContext);

export const UploadProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeUploads, setActiveUploads] = useState<UploadTask[]>([]);
  const { toast } = useToast();

  const hasRunningUpload = activeUploads.some(task => task.status === 'uploading');

  // Warn user before closing or reloading browser tab while an upload is active
  useEffect(() => {
    if (!hasRunningUpload) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Ein Video-Upload läuft aktuell noch. Wenn du den Tab schließt oder neu lädst, wird der Upload abgebrochen.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasRunningUpload]);

  const startUpload = async (formData: FormData, matchName: string, replaceMatchId?: string): Promise<string> => {
    const uploadId = Math.random().toString(36).substring(2, 9);
    const displayName = replaceMatchId ? `Ersetze: ${matchName}` : matchName;

    const newTask: UploadTask = {
      id: uploadId,
      name: displayName,
      progress: 0,
      loadedBytes: 0,
      totalBytes: 0,
      status: 'uploading',
      matchId: replaceMatchId,
    };

    setActiveUploads(prev => [newTask, ...prev]);

    const updateProgress = (progressEvent: any) => {
      const loaded = typeof progressEvent?.loaded === 'number' ? progressEvent.loaded : 0;
      const total = typeof progressEvent?.total === 'number' && progressEvent.total > 0 ? progressEvent.total : 0;
      const percentCompleted = total > 0 ? Math.min(100, Math.round((loaded * 100) / total)) : 0;

      setActiveUploads(prev => prev.map(task =>
        task.id === uploadId
          ? {
              ...task,
              progress: percentCompleted,
              loadedBytes: loaded,
              totalBytes: total || task.totalBytes,
            }
          : task
      ));
    };

    // Run the HTTP upload asynchronously in the background so navigating away from /admin/upload never interrupts it
    (async () => {
      try {
        const response = replaceMatchId
          ? await replaceMatchVideo(replaceMatchId, formData, updateProgress)
          : await uploadFullMatch(formData, updateProgress);

        if (response?.error) {
          setActiveUploads(prev => prev.map(task =>
            task.id === uploadId
              ? { ...task, status: 'error', error: response.error }
              : task
          ));
          toast.error(`Upload fehlgeschlagen (${matchName}): ${response.error}`, 8000);
        } else {
          const resultMatchId = response?.id || response?.match_id || replaceMatchId;
          setActiveUploads(prev => prev.map(task =>
            task.id === uploadId
              ? { ...task, status: 'completed', progress: 100, matchId: resultMatchId }
              : task
          ));
          toast.success(`Upload abgeschlossen: "${matchName}" ist bereit!`, 6000);

          // Nach 10 Sekunden automatisch aus der Top-Bar entfernen, wenn erfolgreich
          setTimeout(() => {
            setActiveUploads(prev => prev.filter(task => task.id !== uploadId));
          }, 10000);
        }
      } catch (err: any) {
        const errorMsg = err?.message || 'Netzwerkfehler beim Upload';
        setActiveUploads(prev => prev.map(task =>
          task.id === uploadId
            ? { ...task, status: 'error', error: errorMsg }
            : task
        ));
        toast.error(`Upload fehlgeschlagen (${matchName}): ${errorMsg}`, 8000);
      }
    })();

    return uploadId;
  };

  const clearCompleted = () => {
    setActiveUploads(prev => prev.filter(task => task.status === 'uploading'));
  };

  const removeUpload = (id: string) => {
    setActiveUploads(prev => prev.filter(task => task.id !== id));
  };

  return (
    <UploadContext.Provider value={{ activeUploads, startUpload, clearCompleted, removeUpload }}>
      {children}
    </UploadContext.Provider>
  );
};
