"use client";

import React, { createContext, useContext, useState } from 'react';
import { uploadFullMatch } from '@/services/api';

interface UploadTask {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface UploadContextType {
  activeUploads: UploadTask[];
  startUpload: (formData: FormData, matchName: string, replaceMatchId?: string) => Promise<void>;
  clearCompleted: () => void;
}

const UploadContext = createContext<UploadContextType>({
  activeUploads: [],
  startUpload: async () => {},
  clearCompleted: () => {},
});

export const useUpload = () => useContext(UploadContext);

export const UploadProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeUploads, setActiveUploads] = useState<UploadTask[]>([]);

  const startUpload = async (formData: FormData, matchName: string, replaceMatchId?: string) => {
    const uploadId = Math.random().toString(36).substring(7);
    
    const newTask: UploadTask = {
      id: uploadId,
      name: replaceMatchId ? `Ersetze: ${matchName}` : matchName,
      progress: 0,
      status: 'uploading'
    };

    setActiveUploads(prev => [...prev, newTask]);

    try {
      const { replaceMatchVideo } = await import('@/services/api');
      const apiCall = replaceMatchId 
        ? replaceMatchVideo(replaceMatchId, formData, (e: any) => updateProgress(e))
        : uploadFullMatch(formData, (e: any) => updateProgress(e));

      const updateProgress = (progressEvent: any) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setActiveUploads(prev => prev.map(task => 
          task.id === uploadId ? { ...task, progress: percentCompleted } : task
        ));
      };

      const response = await apiCall;

      if (response.error) {
        setActiveUploads(prev => prev.map(task => 
          task.id === uploadId ? { ...task, status: 'error', error: response.error } : task
        ));
      } else {
        setActiveUploads(prev => prev.map(task => 
          task.id === uploadId ? { ...task, status: 'completed', progress: 100 } : task
        ));
        
        // Nach 5 Sekunden automatisch aus der Liste entfernen, wenn erfolgreich
        setTimeout(() => {
          setActiveUploads(prev => prev.filter(task => task.id !== uploadId));
        }, 5000);
      }
    } catch (err: any) {
      setActiveUploads(prev => prev.map(task => 
        task.id === uploadId ? { ...task, status: 'error', error: err.message } : task
      ));
    }
  };

  const clearCompleted = () => {
    setActiveUploads(prev => prev.filter(task => task.status === 'uploading'));
  };

  return (
    <UploadContext.Provider value={{ activeUploads, startUpload, clearCompleted }}>
      {children}
    </UploadContext.Provider>
  );
};
