"use client";

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { X, Radio, Copy, Check, Tv, AlertCircle, Video, Settings2, Share2, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LiveStreamShareModal from '@/components/LiveStreamShareModal';

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamUrl?: string;
}

export default function LiveStreamModal({
  isOpen,
  onClose,
  streamUrl = "/live/osmo4/index.m3u8",
}: LiveStreamModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'TRAINER';

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const [streamClientTab, setStreamClientTab] = useState<'dji' | 'obs'>('dji');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.hostname);
    }
  }, []);

  const fullRtmpUrl = `rtmp://${host || 'matchtrack.de'}:1935/live/osmo4`;
  const obsServerUrl = `rtmp://${host || 'matchtrack.de'}:1935/live`;
  const obsStreamKey = `osmo4`;

  useEffect(() => {
    if (!isOpen) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const videoElement = videoRef.current;
    if (!videoElement) return;

    let retryTimeout: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    const checkAndLoadStream = () => {
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
            retryTimeout = setTimeout(checkAndLoadStream, 3000);
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
              if (isSubscribed && isOpen) {
                checkAndLoadStream();
              }
            }, 3000);
          }
        });
      }
    };

    checkAndLoadStream();

    return () => {
      isSubscribed = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, streamUrl]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  MatchTrack Livestream
                  {isLive && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                      LIVE
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {isAdmin ? "RTMP Stream & Echtzeit-Vorschau (Admin-Modus)" : "Echtzeit-Videoübertragung"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition-colors"
                title="Stream-Link teilen"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Teilen</span>
              </button>

              <button
                onClick={onClose}
                className="rounded-lg p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Player Container */}
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
                <h3 className="text-lg font-bold text-white">Kein aktiver Stream empfangen</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-md">
                  {isAdmin ? (
                    <>Starte den RTMP-Stream über deine <strong>DJI Mimo App</strong> oder <strong>OBS Studio</strong> mit den untenstehenden Zugangsdaten.</>
                  ) : (
                    <>Die Live-Übertragung hat noch nicht begonnen oder wurde kurzzeitig unterbrochen. Das Bild aktualisiert sich automatisch, sobald gesendet wird.</>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Footer: Stream Settings (NUR FÜR ADMINS & TRAINER) */}
          {isAdmin ? (
            <div className="border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStreamClientTab('dji')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      streamClientTab === 'dji'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>DJI Mimo App</span>
                  </button>
                  <button
                    onClick={() => setStreamClientTab('obs')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      streamClientTab === 'obs'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>OBS Studio</span>
                  </button>
                </div>

                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Shield className="w-3 h-3" /> Nur Admins sichtbar
                </span>
              </div>

              {streamClientTab === 'dji' ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 block mb-1">
                        Komplette RTMP-URL für DJI Mimo
                      </span>
                      <code className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate block select-all">
                        {fullRtmpUrl}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(fullRtmpUrl, 'dji-full')}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {copiedKey === 'dji-full' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      {copiedKey === 'dji-full' ? 'Kopiert!' : 'Kopieren'}
                    </button>
                  </div>

                  <div className="flex items-start gap-2.5 text-[11px] text-gray-600 dark:text-zinc-400">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p>
                      <strong>DJI Anleitung:</strong> Osmo Action 4 einschalten → DJI Mimo App öffnen → Livestreaming → RTMP wählen → WLAN/Hotspot verbinden → Obige RTMP-URL einfügen & Stream starten.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 block">
                          OBS Server
                        </span>
                        <code className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate block select-all">
                          {obsServerUrl}
                        </code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(obsServerUrl, 'obs-server')}
                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                        title="Server kopieren"
                      >
                        {copiedKey === 'obs-server' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 block">
                          OBS Stream-Schlüssel
                        </span>
                        <code className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold block select-all">
                          {obsStreamKey}
                        </code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(obsStreamKey, 'obs-key')}
                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                        title="Key kopieren"
                      >
                        {copiedKey === 'obs-key' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-[11px] text-gray-600 dark:text-zinc-400">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p>
                      <strong>OBS Studio Anleitung:</strong> Einstellungen → Stream → Dienst: <em>Benutzerdefiniert...</em> → Server: <code>{obsServerUrl}</code> → Stream-Schlüssel: <code>{obsStreamKey}</code> → Streaming starten.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Für reguläre Nutzer / Spieler */
            <div className="border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 px-6 py-4 flex items-center justify-between text-xs text-gray-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live-Übertragung von MatchTrack Online</span>
              </div>
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Link mit Freunden teilen</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Share & Password Protection Modal */}
      <LiveStreamShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        isAdmin={isAdmin}
      />
    </>
  );
}
