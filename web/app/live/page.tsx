"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Hls from 'hls.js';
import { Radio, Lock, Eye, EyeOff, Tv, AlertCircle, Share2, Check, Copy, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function PublicLivePage() {
  const { user } = useAuth();
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

  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const streamUrl = "/live/osmo4/index.m3u8";

  // 1. Initial Status abfragen
  useEffect(() => {
    fetchStreamStatus();
  }, []);

  const fetchStreamStatus = async () => {
    try {
      const res = await api.get('/public/livestream');
      if (res.data) {
        setIsProtected(!!res.data.is_protected);
        if (res.data.title) setStreamTitle(res.data.title);

        // Falls User eingeloggt ist, automatisch freigeschaltet
        if (user) {
          setIsUnlocked(true);
        } else if (!res.data.is_protected) {
          setIsUnlocked(true);
        } else {
          // Prüfen ob bereits in dieser Session entsperrt
          const savedAuth = sessionStorage.getItem('matchtrack_live_unlocked');
          if (savedAuth === 'true') {
            setIsUnlocked(true);
          }
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden des Livestream-Status:', err);
      // Fallback: Freischalten falls API nicht erreichbar
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

  // 3. HLS Player initialisieren sobald entsperrt
  useEffect(() => {
    if (!isUnlocked) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    let retryTimeout: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    const loadStream = () => {
      if (!isSubscribed) return;

      if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = streamUrl;
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

        hls.loadSource(streamUrl);
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
  }, [isUnlocked, streamUrl]);

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

  return (
    <div className="flex min-h-screen flex-col justify-between bg-gray-50 dark:bg-zinc-950 font-sans text-gray-900 dark:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo_light_wide.png"
            alt="MatchTrack Logo"
            width={130}
            height={32}
            className="h-7 w-auto object-contain dark:block hidden"
            priority
          />
          <Image
            src="/logo_light_wide.png"
            alt="MatchTrack Logo"
            width={130}
            height={32}
            className="h-7 w-auto object-contain dark:hidden block invert"
            priority
          />
          <span className="hidden sm:inline-block text-zinc-300 dark:text-zinc-700">|</span>
          <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 truncate max-w-[200px] sm:max-w-md">
            {streamTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 border border-red-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span>LIVE</span>
            </span>
          )}

          <button
            onClick={handleCopyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition-colors"
            title="Link kopieren"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? 'Kopiert' : 'Teilen'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        {!isUnlocked ? (
          /* Passwort-Abfrage für geschützte Streams */
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl dark:shadow-2xl animate-in fade-in duration-200 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Lock className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-bold mb-1">{streamTitle}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-6 leading-relaxed">
              Dieser Livestream ist passwortgeschützt. Bitte gib das von deinem Trainer oder Admin bereitgestellte Passwort ein.
            </p>

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div className="relative text-left">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-1">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Zugangspasswort eingeben..."
                    required
                    autoFocus
                    className="w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 px-4 py-3 pr-12 text-sm text-gray-900 dark:text-white focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !passwordInput.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-primary/20 transition-all disabled:opacity-50 active:scale-95"
              >
                <span>{isVerifying ? 'Überprüfe...' : 'Stream freischalten'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* Live Player */
          <div className="w-full max-w-5xl rounded-3xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl">
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                controls
                playsInline
                autoPlay
                muted
                className="w-full h-full object-contain"
              />

              {!isLive && (
                <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-10 animate-in fade-in">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500">
                    <Tv className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Stream ist aktuell offline</h3>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-md">
                    Die Live-Übertragung hat noch nicht begonnen oder pausiert gerade. Sobald die Übertragung startet, beginnt das Bild automatisch.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Stream Status Info */}
            <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                  <Radio className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">{streamTitle}</h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {isLive ? 'Live-Übertragung aktiv' : 'Wartet auf Live-Signal...'}
                  </p>
                </div>
              </div>

              {isProtected && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Zugang autorisiert</span>
                </span>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-zinc-900 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm py-4 px-6 text-center text-xs text-gray-500 dark:text-zinc-500">
        MatchTrack Online &bull; Live Video Stream Platform
      </footer>
    </div>
  );
}
