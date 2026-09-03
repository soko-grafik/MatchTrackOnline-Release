"use client";

import { useEffect, useState } from 'react';
import { getMatches } from '@/services/api';
import { Loader2, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function ConversionStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      try {
        const matches = await getMatches();
        if (Array.isArray(matches)) {
          // Check for matches with processing heatmap or other statuses
          // Note: In a real app, you might have a dedicated endpoint for all active tasks
          const processing = matches.filter(m => 
            m.heatmap_status === 'processing' || m.heatmap_status === 'queued'
          );
          
          setProcessingCount(processing.length);
          setStatus(processing.length > 0 ? 'processing' : 'idle');
        }
      } catch (error) {
        console.error("Failed to fetch conversion status:", error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span className="text-[10px] font-bold uppercase tracking-wider">
        {processingCount} Task{processingCount > 1 ? 's' : ''} läuft
      </span>
    </div>
  );
}
