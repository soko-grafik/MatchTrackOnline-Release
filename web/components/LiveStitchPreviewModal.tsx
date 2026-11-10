"use client";

import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
  X, Sliders, Play, Pause, Disc, Square, Check, RefreshCw, 
  Eye, Sun, Layers, MoveHorizontal, MoveVertical, AlertCircle, 
  Radio, Film, ShieldCheck, Sparkles 
} from 'lucide-react';
import { api } from '@/services/api';

interface LiveStitchPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRecordings?: () => void;
}

export default function LiveStitchPreviewModal({
  isOpen,
  onClose,
  onOpenRecordings
}: LiveStitchPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Settings State
  const [isPublished, setIsPublished] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [savePermanently, setSavePermanently] = useState(true);
  const [isTogglingRec, setIsTogglingRec] = useState(false);

  // Stitching Parameters
  const [overlapPx, setOverlapPx] = useState(320);
  const [yOffsetPx, setYOffsetPx] = useState(0);
  const [featherWidthPx, setFeatherWidthPx] = useState(80);
  const [cam2Brightness, setCam2Brightness] = useState(0.0);
  const [cam2Contrast, setCam2Contrast] = useState(1.0);
  const [syncOffsetMs, setSyncOffsetMs] = useState(0);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [autoSyncMsg, setAutoSyncMsg] = useState<string | null>(null);

  const [videoStatus, setVideoStatus] = useState<'loading' | 'live' | 'offline'>('loading');

  // 1. Einstellungen laden
  useEffect(() => {
    if (!isOpen) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/livestream');
      if (res.data) {
        setIsPublished(!!res.data.is_published);
        setIsRecording(!!res.data.is_recording);
        setRecDuration(res.data.recording_duration || 0);
        if (res.data.save_recording !== undefined) setSavePermanently(!!res.data.save_recording);

        const cfg = res.data.stitch_config || {};
        if (cfg.overlap_px !== undefined) setOverlapPx(cfg.overlap_px);
        if (cfg.y_offset_px !== undefined) setYOffsetPx(cfg.y_offset_px);
        if (cfg.feather_width_px !== undefined) setFeatherWidthPx(cfg.feather_width_px);
        if (cfg.cam2_brightness !== undefined) setCam2Brightness(cfg.cam2_brightness);
        if (cfg.cam2_contrast !== undefined) setCam2Contrast(cfg.cam2_contrast);
        if (cfg.sync_offset_ms !== undefined) setSyncOffsetMs(cfg.sync_offset_ms);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Regie-Einstellungen:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Aufnahme-Timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  // 3. HLS Player für Preview Stream (/live/stitched)
  useEffect(() => {
    if (!isOpen) return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    let isSubscribed = true;
    let retryTimer: NodeJS.Timeout | null = null;

    const streamUrl = "/live/stitched/index.m3u8";

    const loadStream = () => {
      if (!isSubscribed) return;

      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = streamUrl;
        videoEl.muted = true;
        videoEl.play().then(() => {
          if (isSubscribed) setVideoStatus('live');
        }).catch(() => {
          if (isSubscribed) {
            setVideoStatus('offline');
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(loadStream, 3500);
          }
        });
      } else if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        const hls = new Hls({
          manifestLoadingTimeOut: 3000,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 2,
          lowLatencyMode: true,
          backBufferLength: 20
        });
        hlsRef.current = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(videoEl);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!isSubscribed) return;
          setVideoStatus('live');
          videoEl.muted = true;
          videoEl.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!isSubscribed) return;
          if (data.fatal) {
            setVideoStatus('offline');
            if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current = null;
            }
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(loadStream, 3500);
          }
        });
      }
    };

    loadStream();

    return () => {
      isSubscribed = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen]);

  // Auto-Sync per Ton ausführen
  const handleAutoSync = async () => {
    setIsAutoSyncing(true);
    setAutoSyncMsg(null);
    try {
      const res = await api.post('/admin/livestream/auto-sync');
      if (res.data?.success) {
        setSyncOffsetMs(res.data.offset_ms);
        setAutoSyncMsg(res.data.message || `Offset von ${res.data.offset_ms} ms erkannt.`);
        setTimeout(() => setAutoSyncMsg(null), 8000);
      }
    } catch (err: any) {
      console.error('Fehler bei Auto-Sync:', err);
      alert(err.response?.data?.detail || 'Auto-Sync fehlgeschlagen. Bitte prüfen, ob beide Kameras Audio senden.');
    } finally {
      setIsAutoSyncing(false);
    }
  };

  // Parameter speichern
  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/admin/livestream/stitch-config', {
        overlap_px: overlapPx,
        y_offset_px: yOffsetPx,
        feather_width_px: featherWidthPx,
        cam2_brightness: cam2Brightness,
        cam2_contrast: cam2Contrast,
        sync_offset_ms: syncOffsetMs
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Fehler beim Speichern der Nahtstellen-Parameter:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Go-Live Freigabe umschalten
  const handleTogglePublish = async () => {
    setIsTogglingPublish(true);
    try {
      const newStatus = !isPublished;
      await api.post('/admin/livestream/publish', { is_published: newStatus });
      setIsPublished(newStatus);
    } catch (err) {
      console.error('Fehler beim Ändern der Freigabe:', err);
    } finally {
      setIsTogglingPublish(false);
    }
  };

  // Aufnahme starten/stoppen
  const handleToggleRecording = async () => {
    setIsTogglingRec(true);
    try {
      if (isRecording) {
        const res = await api.post('/admin/livestream/recordings/stop', {
          discard: !savePermanently
        });
        setIsRecording(false);
        setRecDuration(0);
        if (res.data?.discarded) {
          alert('Aufnahme beendet & temporäre Datei gelöscht (Speicher geschont).');
        }
      } else {
        await api.post('/admin/livestream/recordings/start', { 
          stream_key: 'stitched',
          save_permanently: savePermanently
        });
        setIsRecording(true);
        setRecDuration(0);
      }
    } catch (err: any) {
      console.error('Fehler bei Aufnahme:', err);
      alert(err.response?.data?.detail || 'Aufnahme-Aktion fehlgeschlagen.');
    } finally {
      setIsTogglingRec(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Live-Stitching Regie & Nahtstellen-Editor
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Sparkles className="h-3 w-3" /> Echtzeit
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Prüfe das zusammengefügte Bild vor der Zuschauer-Freigabe und passe den Bildübergang an.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">

          {/* Top Quick Actions Bar (Go-Live & Aufnahme) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Go-Live Status & Button */}
            <div className={`p-4 rounded-xl border transition-all ${
              isPublished 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' 
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`relative flex h-3 w-3`}>
                    {isPublished && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      Zuschauer-Freigabe (Go-Live)
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-zinc-300">
                      {isPublished ? '🟢 Öffentlich sichtbar für alle Besucher' : '🟡 Vorschau-Modus (Warteraum für Zuschauer)'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTogglePublish}
                  disabled={isTogglingPublish}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 ${
                    isPublished
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                  }`}
                >
                  {isTogglingPublish ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : isPublished ? (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Pausieren
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Jetzt Freigeben
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Server-Aufnahme Card */}
            <div className={`p-4 rounded-xl border transition-all ${
              isRecording 
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50' 
                : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`relative flex h-3 w-3`}>
                    {isRecording && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isRecording ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Server-Aufnahme
                      </h4>
                      {isRecording && (
                        <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                          {formatDuration(recDuration)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-300">
                      {isRecording ? 'Speichert live auf Festplatte (-c copy)' : 'Stream verlustfrei als MP4 aufnehmen'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleRecording}
                    disabled={isTogglingRec}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 ${
                      isRecording
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white'
                    }`}
                  >
                    {isTogglingRec ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : isRecording ? (
                      <>
                        <Square className="h-3.5 w-3.5" /> Stoppen
                      </>
                    ) : (
                      <>
                        <Disc className="h-3.5 w-3.5 text-red-400" /> Starten
                      </>
                    )}
                  </button>

                  {onOpenRecordings && (
                    <button
                      onClick={onOpenRecordings}
                      title="Aufnahmen verwalten"
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 text-xs"
                    >
                      <Film className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Speicher-Option (Dauerhaft behalten vs. nach Stream löschen) */}
              <div className="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-zinc-700/60 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                <span className="text-gray-500 dark:text-zinc-400">Nach Aufnahme-Ende:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSavePermanently(true)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                      savePermanently 
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold' 
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300'
                    }`}
                  >
                    💾 Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => setSavePermanently(false)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                      !savePermanently 
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold' 
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300'
                    }`}
                    title="Datei wird nach dem Stream automatisch vom Server gelöscht"
                  >
                    🗑 Automatisch löschen
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Video Preview Container */}
          <div className="relative rounded-xl overflow-hidden bg-black border border-gray-200 dark:border-zinc-800 aspect-video shadow-inner flex items-center justify-center">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              muted
              autoPlay
            />

            {/* Video Overlay Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-black/60 backdrop-blur-md text-white border border-white/10">
                <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                Live Panorama Vorschau
              </span>

              {videoStatus === 'offline' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/80 backdrop-blur-md text-white">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Wartet auf beide Kameras...
                </span>
              )}
            </div>

            {/* Nahtstellen-Hilfslinie (Mittellinie dezent eingeblendet zur Orientierung) */}
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-emerald-400/30 border-l border-dashed border-emerald-400/60 pointer-events-none flex items-center justify-center">
              <span className="bg-emerald-600/80 text-[10px] text-white px-1.5 py-0.5 rounded shadow-sm -rotate-90">
                Nahtstelle
              </span>
            </div>
          </div>

          {/* Stitching Sliders & Controls */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Feinjustierung der Bild-Übergänge
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOverlapPx(320);
                    setYOffsetPx(0);
                    setFeatherWidthPx(80);
                    setCam2Brightness(0.0);
                    setCam2Contrast(1.0);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Optimale Werte für das 80° DJI Osmo Action 4 Stativ-Rig (1080p De-Warp)"
                >
                  <Sparkles className="h-3.5 w-3.5" /> 🎯 80° 3D-Rig Preset (1080p De-Warp)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

              {/* 1. Horizontaler Overlap */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <MoveHorizontal className="h-3.5 w-3.5 text-emerald-500" /> Schnitt & Überlappung
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {overlapPx} px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="600"
                  step="2"
                  value={overlapPx}
                  onChange={(e) => setOverlapPx(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                  Gleicht den Abstand der Kameras an der Mittellinie an.
                </p>
              </div>

              {/* 2. Vertikaler Offset (Y-Offset) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <MoveVertical className="h-3.5 w-3.5 text-emerald-500" /> Höhenversatz (Kamera 2)
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {yOffsetPx > 0 ? `+${yOffsetPx}` : yOffsetPx} px
                  </span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="1"
                  value={yOffsetPx}
                  onChange={(e) => setYOffsetPx(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                  Kompensiert unterschiedliche Stativ-Höhen.
                </p>
              </div>

              {/* 3. Weichzeichner / Feathering */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-emerald-500" /> Weiche Kante (Blend)
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {featherWidthPx} px
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="2"
                  value={featherWidthPx}
                  onChange={(e) => setFeatherWidthPx(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                  Macht die Schnittkante fließend und unsichtbar.
                </p>
              </div>

              {/* 4. Helligkeit Cam 2 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5 text-amber-500" /> Helligkeit Kamera 2
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {cam2Brightness > 0 ? `+${Math.round(cam2Brightness * 100)}%` : `${Math.round(cam2Brightness * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.25"
                  max="0.25"
                  step="0.02"
                  value={cam2Brightness}
                  onChange={(e) => setCam2Brightness(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                  Gleicht Sonne/Schatten zwischen beiden Hälften aus.
                </p>
              </div>

              {/* 5. Kontrast Cam 2 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-blue-500" /> Kontrast Kamera 2
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {Math.round(cam2Contrast * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.02"
                  value={cam2Contrast}
                  onChange={(e) => setCam2Contrast(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                  Feinabstimmung der Farbintensität.
                </p>
              </div>

              {/* 6. Audio/Video Latenz mit Auto-Sync */}
              <div className="space-y-2 p-3.5 rounded-xl border border-purple-500/25 bg-purple-500/5 col-span-1 md:col-span-2 lg:col-span-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 text-purple-500" /> Audio- & Video-Gleichlauf (Sync Offset)
                    </span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      {syncOffsetMs > 0 ? `+${syncOffsetMs}` : syncOffsetMs} ms
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoSync}
                    disabled={isAutoSyncing}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 ${
                      isAutoSyncing
                        ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-500 border border-purple-300 dark:border-purple-800'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20 active:scale-95'
                    }`}
                    title="Analysiert 6 Sekunden lang den Ton beider Kameras und berechnet den exakten Zeitversatz"
                  >
                    {isAutoSyncing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-500" />
                        Analysiere Audio (ca. 6 Sek)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-purple-200" />
                        ⚡ Auto-Sync per Ton
                      </>
                    )}
                  </button>
                </div>

                <input
                  type="range"
                  min="-2000"
                  max="2000"
                  step="20"
                  value={syncOffsetMs}
                  onChange={(e) => setSyncOffsetMs(parseInt(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />

                <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 dark:text-zinc-400 gap-1">
                  <span>
                    {syncOffsetMs > 0 
                      ? `Kamera 1 wird um ${syncOffsetMs} ms verzögert (Kamera 2 hing hinterher)` 
                      : syncOffsetMs < 0 
                      ? `Kamera 2 wird um ${Math.abs(syncOffsetMs)} ms verzögert (Kamera 1 hing hinterher)` 
                      : 'Perfekt synchron (0 ms Versatz)'}
                  </span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                    💡 Tipp: Vor dem Spiel kurz in die Hände klatschen für 100% präzisen Ton-Sync!
                  </span>
                </div>

                {autoSyncMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-in fade-in">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{autoSyncMsg}</span>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/70">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                <Check className="h-4 w-4" /> Parameter erfolgreich auf den Stream angewendet!
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
            >
              Schließen
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Anwenden...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> Naht-Parameter anwenden
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
