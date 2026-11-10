"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getMatches, cancelMatchHlsConversion, cancelAllHlsConversions } from '@/services/api';
import { Loader2, CheckCircle2, AlertCircle, UploadCloud, ChevronDown, X, ExternalLink, Film, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUpload } from '@/contexts/UploadContext';
import { useToast } from '@/contexts/ToastContext';

function formatBytesToMB(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

interface ConvertingMatchInfo {
  id: string;
  name: string;
  progress: number;
}

export default function ConversionStatus() {
  const { user } = useAuth();
  const { activeUploads, removeUpload } = useUpload();
  const { toast } = useToast();
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [processingCount, setProcessingCount] = useState(0);
  const [convertingMatches, setConvertingMatches] = useState<ConvertingMatchInfo[]>([]);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasActiveTasks = activeUploads.length > 0 || convertingMatches.length > 0 || status === 'processing';

  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      try {
        const matches = await getMatches();
        if (Array.isArray(matches)) {
          const processing = matches.filter(m =>
            m.heatmap_status === 'processing' || m.heatmap_status === 'queued'
          );

          const videoConverting = matches
            .filter(m => m.is_converting_video)
            .map(m => ({
              id: m.id,
              name: m.name || 'Match',
              progress: Math.round(m.video_conversion_progress || 10),
            }));

          setConvertingMatches(videoConverting);
          setProcessingCount(processing.length);
          setStatus(processing.length > 0 ? 'processing' : 'idle');
        }
      } catch (error) {
        console.error("Failed to fetch conversion status:", error);
      }
    };

    checkStatus();
    const pollIntervalMs = hasActiveTasks ? 5000 : 25000;
    const interval = setInterval(checkStatus, pollIntervalMs);

    return () => clearInterval(interval);
  }, [user, hasActiveTasks]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleCancelSingleHls = async (matchId: string, matchName: string) => {
    try {
      setConvertingMatches(prev => prev.filter(m => m.id !== matchId));
      await cancelMatchHlsConversion(matchId);
      toast.info(`HLS-Konvertierung für "${matchName}" abgebrochen.`);
    } catch (err) {
      console.error("Failed to cancel HLS conversion:", err);
      toast.error("Konnte HLS-Konvertierung nicht abbrechen.");
    }
  };

  const handleCancelAllHls = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      setConvertingMatches([]);
      await cancelAllHlsConversions();
      toast.success("Alle unvollständigen HLS-Tasks wurden abgebrochen und aus der Queue entfernt.");
      if (activeUploads.length === 0) {
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to cancel all HLS conversions:", err);
      toast.error("Fehler beim Leeren der HLS-Queue.");
    } finally {
      setIsCancelling(false);
    }
  };

  const hasUploads = activeUploads.length > 0;
  const hasVideoConversions = convertingMatches.length > 0;

  if (!hasUploads && !hasVideoConversions && status === 'idle') return null;

  // Determine primary item to feature in the top bar pill
  const uploadingTasks = activeUploads.filter(t => t.status === 'uploading');
  const errorTasks = activeUploads.filter(t => t.status === 'error');
  const primaryUpload = uploadingTasks[0] || errorTasks[0] || activeUploads[0];
  const primaryConversion = convertingMatches[0];
  const totalItems = activeUploads.length + convertingMatches.length;

  return (
    <div className="flex items-center gap-2 relative" ref={dropdownRef}>
      {(hasUploads || hasVideoConversions) && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all shadow-sm ${
              primaryUpload?.status === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                : primaryUpload?.status === 'completed' && !hasVideoConversions
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
            }`}
            title="Klicken für Upload- & Konvertierungs-Details"
          >
            {primaryUpload ? (
              primaryUpload.status === 'uploading' ? (
                <UploadCloud className="w-4 h-4 text-blue-400 animate-bounce shrink-0" />
              ) : primaryUpload.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )
            ) : (
              <Film className="w-4 h-4 text-blue-400 animate-pulse shrink-0" />
            )}

            <div className="flex flex-col items-start min-w-[95px] sm:min-w-[145px] max-w-[160px] sm:max-w-[230px]">
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider truncate text-gray-900 dark:text-zinc-100">
                  {primaryUpload
                    ? primaryUpload.name
                    : `HLS: ${primaryConversion?.name}`}
                </span>
                <span className="text-[10px] font-mono font-black tabular-nums shrink-0">
                  {primaryUpload
                    ? primaryUpload.status === 'uploading'
                      ? `${primaryUpload.progress}%`
                      : primaryUpload.status === 'completed'
                      ? 'FERTIG'
                      : 'FEHLER'
                    : `${primaryConversion?.progress || 10}%`}
                </span>
              </div>

              {/* Live Mini Progress Bar in Top Bar */}
              <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full transition-all duration-300 ease-out ${
                    primaryUpload?.status === 'error'
                      ? 'bg-red-500'
                      : primaryUpload?.status === 'completed' && !hasVideoConversions
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-blue-500 to-emerald-400'
                  }`}
                  style={{
                    width: `${Math.max(
                      4,
                      primaryUpload ? primaryUpload.progress : (primaryConversion?.progress || 10)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {totalItems > 1 && (
              <span className="px-1.5 py-0.5 text-[9px] font-black rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 tabular-nums">
                +{totalItems - 1}
              </span>
            )}

            <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Popover with Detailed Upload & HLS Conversion List */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 shadow-2xl p-4 z-[100] space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800/80 pb-2.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-800 dark:text-zinc-200 truncate">
                    Uploads & Optimierung ({totalItems})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasVideoConversions && (
                    <button
                      type="button"
                      onClick={handleCancelAllHls}
                      disabled={isCancelling}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 transition-colors"
                      title="Alle unvollständigen HLS-Tasks abbrechen und aus der Queue entfernen"
                    >
                      <Trash2 className="w-3 h-3" />
                      Alle abbrechen
                    </button>
                  )}
                  <Link
                    href="/admin/upload"
                    onClick={() => setIsOpen(false)}
                    className="text-[10px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1"
                  >
                    Upload <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {activeUploads.map(upload => (
                  <div
                    key={upload.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-zinc-100 truncate">
                          {upload.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 dark:text-zinc-400 font-mono">
                          {upload.status === 'uploading' ? (
                            <>
                              <span className="text-blue-400 font-bold">{upload.progress}%</span>
                              {upload.totalBytes ? (
                                <span>
                                  ({formatBytesToMB(upload.loadedBytes)} / {formatBytesToMB(upload.totalBytes)})
                                </span>
                              ) : null}
                              {upload.progress === 100 && (
                                <span className="text-amber-400 font-sans font-semibold">Server speichert...</span>
                              )}
                            </>
                          ) : upload.status === 'completed' ? (
                            <span className="text-emerald-400 font-sans font-bold">Upload abgeschlossen</span>
                          ) : (
                            <span className="text-red-400 font-sans font-bold">
                              {upload.error || 'Fehler beim Upload'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {upload.status === 'uploading' ? (
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeUpload(upload.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Aus Liste entfernen"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          upload.status === 'error'
                            ? 'bg-red-500'
                            : upload.status === 'completed'
                            ? 'bg-emerald-500'
                            : 'bg-gradient-to-r from-blue-600 to-emerald-400'
                        }`}
                        style={{ width: `${Math.max(3, upload.progress)}%` }}
                      />
                    </div>

                    {upload.status === 'completed' && upload.matchId && (
                      <div className="pt-1 flex justify-end">
                        <Link
                          href={`/matches/${upload.matchId}`}
                          onClick={() => setIsOpen(false)}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                        >
                          Zum Match öffnen <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                ))}

                {convertingMatches.map(cm => (
                  <div
                    key={cm.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-900/80 border border-blue-500/20 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-zinc-100 truncate">
                          {cm.name}
                        </p>
                        <p className="text-[10px] text-blue-400 font-semibold mt-0.5">
                          HLS / H.264 Stream-Optimierung: {cm.progress}%
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        <button
                          type="button"
                          onClick={() => handleCancelSingleHls(cm.id, cm.name)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="HLS-Konvertierung abbrechen / aus Queue entfernen"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500"
                        style={{ width: `${Math.max(5, cm.progress)}%` }}
                      />
                    </div>
                    <div className="pt-0.5 flex justify-end">
                      <Link
                        href={`/matches/${cm.id}`}
                        onClick={() => setIsOpen(false)}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        Zum Match <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'processing' && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {processingCount} Task{processingCount > 1 ? 's' : ''} läuft
          </span>
        </div>
      )}
    </div>
  );
}
