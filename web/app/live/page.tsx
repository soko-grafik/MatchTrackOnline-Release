"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Hls from 'hls.js';
import { 
  Radio, Lock, Eye, EyeOff, Tv, AlertCircle, Share2, Check, 
  Copy, ArrowRight, ShieldCheck, Video, Sliders, Film, Play, 
  Pause, RefreshCw, Sparkles, Layers 
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import LiveStreamShareModal from '@/components/LiveStreamShareModal';
import LiveStitchPreviewModal from '@/components/LiveStitchPreviewModal';
import LiveRecordingsModal from '@/components/LiveRecordingsModal';

interface StreamDetail {
  is_live: boolean;
  name: string;
  url: string;
}

export default function PublicLivePage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isProtected, setIsProtected] = useState(false);
  const [streamTitle, setStreamTitle] = useState('MatchTrack Livestream');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Livestream Multi-Cam & Stitched States
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [streamMode, setStreamMode] = useState<'multi_cam' | 'stitched'>('multi_cam');
  const [streams, setStreams] = useState<Record<string, StreamDetail>>({
    cam1: { is_live: false, name: "Kamera 1 (Links)", url: "/live/cam1/index.m3u8" },
    cam2: { is_live: false, name: "Kamera 2 (Rechts)", url: "/live/cam2/index.m3u8" },
    stitched: { is_live: false, name: "Panorama (Gestitcht)", url: "/live/stitched/index.m3u8" }
  });
  const [selectedCam, setSelectedCam] = useState<'cam1' | 'cam2'>('cam1');

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isStitchModalOpen, setIsStitchModalOpen] = useState(false);
  const [isRecordingsModalOpen, setIsRecordingsModalOpen] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);

  // 1. Initial Status abfragen & periodisches Polling
  useEffect(() => {
    fetchStreamStatus();
    const interval = setInterval(fetchStreamStatus, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchStreamStatus = async () => {
    try {
      const res = await api.get('/public/livestream');
      if (res.data) {
        setIsProtected(!!res.data.is_protected);
        if (res.data.title) setStreamTitle(res.data.title);
        setIsPublished(!!res.data.is_published);
        if (res.data.mode) setStreamMode(res.data.mode);

        if (res.data.streams) {
          setStreams(res.data.streams);
          
          // Falls aktuell gewählte Cam offline ist, aber die andere online ist: umschalten
          if (res.data.mode === 'multi_cam') {
            if (!res.data.streams.cam1?.is_live && res.data.streams.cam2?.is_live) {
              setSelectedCam('cam2');
            } else if (res.data.streams.cam1?.is_live && !res.data.streams.cam2?.is_live) {
              setSelectedCam('cam1');
            }
          }
        }

        // Freischaltung prüfen
        if (user || !res.data.is_protected) {
          setIsUnlocked(true);
        } else {
          const savedAuth = sessionStorage.getItem('matchtrack_live_unlocked');
          if (savedAuth === 'true') {
            setIsUnlocked(true);
          }
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden des Livestream-Status:', err);
      setIsUnlocked(true);
    } finally {
      setLoadingStatus(false);
    }
  };

  // 2. Passwort verifizieren
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setIsVerifying(true);
    setAuthError(null);

    try {
      const res = await api.post('/public/livestream/verify', {
        password: passwordInput.trim()
      });
      if (res.data && res.data.success) {
        setIsUnlocked(true);
        sessionStorage.setItem('matchtrack_live_unlocked', 'true');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.detail || 'Ungültiges Passwort. Bitte versuche es erneut.');
    } finally {
      setIsVerifying(false);
    }
  };

  // 3. Aktive Video-URL ermitteln
  const activeStreamUrl = streamMode === 'stitched' 
    ? (streams.stitched?.url || "/live/stitched/index.m3u8")
    : (streams[selectedCam]?.url || `/live/${selectedCam}/index.m3u8`);

  // 4. HLS Player initialisieren sobald entsperrt und (freigegeben ODER Admin)
  const canPlay = isUnlocked && (isPublished || isAdmin);

  useEffect(() => {
    if (!canPlay) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    let retryTimeout: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    const loadStream = () => {
      if (!isSubscribed) return;

      if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = activeStreamUrl;
        videoElement.muted = true;
        videoElement.play().then(() => {
          if (isSubscribed) setIsLive(true);
        }).catch(() => {
          if (isSubscribed) {
            setIsLive(false);
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(loadStream, 3000);
          }
        });
      } else if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        const hls = new Hls({
          manifestLoadingTimeOut: 4000,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 2,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;

        hls.loadSource(activeStreamUrl);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!isSubscribed) return;
          setIsLive(true);
          videoElement.muted = true;
          videoElement.play().catch((err) => {
            console.warn("Autoplay notice:", err);
          });
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!isSubscribed) return;
          if (data.fatal) {
            setIsLive(false);
            if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current = null;
            }
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(() => {
              if (isSubscribed) {
                loadStream();
              }
            }, 3000);
          }
        });
      }
    };

    loadStream();

    return () => {
      isSubscribed = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [canPlay, activeStreamUrl]);

  // Go-Live Umschalten (Admin Schnellaktion)
  const handleTogglePublish = async () => {
    setIsTogglingPublish(true);
    try {
      const nextState = !isPublished;
      await api.post('/admin/livestream/publish', { is_published: nextState });
      setIsPublished(nextState);
    } catch (err) {
      console.error('Fehler beim Ändern der Freigabe:', err);
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const handleCopyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Fall A: Geschützter Stream & Noch nicht freigeschaltet
  if (isProtected && !isUnlocked && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-white">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-2xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Lock className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-xl font-bold">{streamTitle}</h1>
            <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
              Dieser Livestream ist geschützt. Bitte gib das Passwort ein, das du vom Veranstalter erhalten hast.
            </p>
          </div>

          {authError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              {authError}
            </div>
          )}

          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Passwort eingeben..."
                required
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-4 py-3 pr-12 text-sm text-gray-900 dark:text-white focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              {isVerifying ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Freischalten</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Fall B: Warteraum für reguläre Zuschauer (wenn noch nicht freigegeben)
  if (!isPublished && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-white">
        <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-2xl text-center space-y-6">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Radio className="h-10 w-10 animate-pulse text-emerald-500" />
            <span className="animate-ping absolute inline-flex h-full w-full rounded-3xl bg-emerald-400 opacity-20"></span>
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Sparkles className="h-3 w-3" /> Übertragung in Vorbereitung
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{streamTitle}</h1>
            <p className="text-sm text-gray-600 dark:text-zinc-400 max-w-md mx-auto">
              Die Kameras werden aktuell am Spielfeldrand eingerichtet. Die Live-Übertragung startet in wenigen Minuten automatisch!
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 dark:border-zinc-800/80 bg-gray-50/70 dark:bg-zinc-950/50 flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-zinc-400">
            <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
            <span>Diese Seite aktualisiert sich automatisch, sobald der Stream freigegeben wird.</span>
          </div>

          <button
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
            {copiedLink ? 'Link kopiert!' : 'Link teilen'}
          </button>
        </div>
      </div>
    );
  }

  // Fall C: Regulärer Player (oder Admin-Preview)
  const bothCamsActive = streams.cam1?.is_live && streams.cam2?.is_live;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-white flex flex-col">
      
      {/* Admin Regie-Bar (falls Admin / Trainer) */}
      {isAdmin && (
        <div className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 text-white px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${
                isPublished 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isPublished ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isPublished ? 'ÖFFENTLICH LIVE' : 'REGIE-VORSCHAU (Warteraum für Zuschauer)'}
              </span>
              <span className="hidden sm:inline text-zinc-400 capitalize">
                Modus: <strong>{streamMode === 'stitched' ? 'Panorama (Stitched)' : 'Multi-Kamera'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePublish}
                disabled={isTogglingPublish}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shadow-sm ${
                  isPublished
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                }`}
              >
                {isTogglingPublish ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : isPublished ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Freigabe pausieren
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Für alle freigeben
                  </>
                )}
              </button>

              <button
                onClick={() => setIsStitchModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center gap-1.5"
                title="Nahtstellen-Editor & Justierung"
              >
                <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden md:inline">Naht-Editor</span>
              </button>

              <button
                onClick={() => setIsRecordingsModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center gap-1.5"
                title="Gespeicherte Aufnahmen"
              >
                <Film className="h-3.5 w-3.5 text-blue-400" />
                <span className="hidden md:inline">Aufnahmen</span>
              </button>

              <button
                onClick={() => setIsShareModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Teilen & Schutz</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

        {/* Video Player Card */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-gray-200 dark:border-zinc-800 shadow-2xl flex items-center justify-center group">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            controls
            playsInline
            muted
          />

          {/* Status Badges Overlay */}
          <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 pointer-events-none">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white shadow-lg shadow-red-600/30">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                {streamMode === 'stitched' ? 'LIVE PANORAMA' : 'LIVE'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-black/60 backdrop-blur-md text-zinc-300 border border-white/10">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                Wartet auf Signal...
              </span>
            )}

            {streamMode === 'stitched' && isLive && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-black/60 backdrop-blur-md text-emerald-400 border border-emerald-500/20">
                <Layers className="h-3 w-3" /> 2-Kamera-Panorama
              </span>
            )}
          </div>

          {/* Multi-Cam Switcher (Nur im Multi-Cam Modus sichtbar!) */}
          {streamMode === 'multi_cam' && bothCamsActive && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 shadow-lg">
              <button
                onClick={() => setSelectedCam('cam1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedCam === 'cam1'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                <span>{streams.cam1?.name || 'Kamera 1'}</span>
              </button>

              <button
                onClick={() => setSelectedCam('cam2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedCam === 'cam2'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                <span>{streams.cam2?.name || 'Kamera 2'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Video Info Header & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{streamTitle}</h1>
              {streamMode === 'stitched' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Panorama-Modus
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Multi-Kamera
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              MatchTrack Online Livestreaming • Direkt vom Spielfeldrand
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopyShareLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 hover:bg-gray-100 dark:hover:bg-zinc-800 text-xs font-medium text-gray-700 dark:text-zinc-200 transition-colors shadow-sm"
            >
              {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
              <span>{copiedLink ? 'Link kopiert!' : 'Teilen'}</span>
            </button>
          </div>
        </div>

      </main>

      {/* Modals */}
      <LiveStreamShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        isAdmin={isAdmin}
      />

      <LiveStitchPreviewModal
        isOpen={isStitchModalOpen}
        onClose={() => setIsStitchModalOpen(false)}
        onOpenRecordings={() => {
          setIsStitchModalOpen(false);
          setIsRecordingsModalOpen(true);
        }}
      />

      <LiveRecordingsModal
        isOpen={isRecordingsModalOpen}
        onClose={() => setIsRecordingsModalOpen(false)}
      />

    </div>
  );
}
