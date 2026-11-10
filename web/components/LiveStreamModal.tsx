"use client";

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  X, Radio, Copy, Check, Tv, AlertCircle, Video, Settings2, 
  Share2, Shield, Sliders, Film, Layers, Play 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import LiveStreamShareModal from '@/components/LiveStreamShareModal';
import LiveStitchPreviewModal from '@/components/LiveStitchPreviewModal';
import LiveRecordingsModal from '@/components/LiveRecordingsModal';

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamUrl?: string;
}

export default function LiveStreamModal({
  isOpen,
  onClose,
  streamUrl
}: LiveStreamModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [host, setHost] = useState('');
  
  // Settings & Modes
  const [streamMode, setStreamMode] = useState<'multi_cam' | 'stitched'>('multi_cam');
  const [selectedCam, setSelectedCam] = useState<'cam1' | 'cam2'>('cam1');
  const [streams, setStreams] = useState<any>({});
  const [activeCamIngestTab, setActiveCamIngestTab] = useState<'cam1' | 'cam2'>('cam1');
  const [streamClientTab, setStreamClientTab] = useState<'dji' | 'obs'>('dji');

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isStitchModalOpen, setIsStitchModalOpen] = useState(false);
  const [isRecordingsModalOpen, setIsRecordingsModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.hostname);
    }
  }, []);

  // Status & Mode laden
  useEffect(() => {
    if (isOpen) {
      api.get('/public/livestream').then((res) => {
        if (res.data) {
          if (res.data.mode) setStreamMode(res.data.mode);
          if (res.data.streams) setStreams(res.data.streams);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  const domain = host || 'matchtrack.de';
  const effectiveStreamUrl = streamUrl || (
    streamMode === 'stitched' 
      ? "/live/stitched/index.m3u8" 
      : `/live/${selectedCam}/index.m3u8`
  );

  const fullRtmpUrlCam1 = `rtmp://${domain}:1935/live/cam1`;
  const fullRtmpUrlCam2 = `rtmp://${domain}:1935/live/cam2`;
  const obsServerUrl = `rtmp://${domain}:1935/live`;

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
        videoElement.src = effectiveStreamUrl;
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

        hls.loadSource(effectiveStreamUrl);
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
  }, [isOpen, effectiveStreamUrl]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  const bothCamsActive = streams.cam1?.is_live && streams.cam2?.is_live;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  MatchTrack Live-Stream
                  {streamMode === 'stitched' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Panorama
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Multi-Cam
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Echtzeit-Übertragung direkt vom Platz
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    onClick={() => setIsStitchModalOpen(true)}
                    className="p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-emerald-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Live-Stitching Nahtstellen-Editor"
                  >
                    <Sliders className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIsRecordingsModalOpen(true)}
                    className="p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Aufnahmen verwalten"
                  >
                    <Film className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Stream-Einstellungen & Zugangsdaten"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Video Player */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              className="h-full w-full object-contain"
              controls
              playsInline
              muted
            />

            {/* Live Indicator Overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              {isLive ? (
                <div className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-zinc-300 backdrop-blur-md border border-white/10">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                  Wartet auf Live-Signal...
                </div>
              )}
            </div>

            {/* Multi-Cam Umschalter im Modal */}
            {streamMode === 'multi_cam' && bothCamsActive && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/10">
                <button
                  onClick={() => setSelectedCam('cam1')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedCam === 'cam1' ? 'bg-emerald-600 text-white' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  Cam 1
                </button>
                <button
                  onClick={() => setSelectedCam('cam2')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedCam === 'cam2' ? 'bg-emerald-600 text-white' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  Cam 2
                </button>
              </div>
            )}
          </div>

          {/* Admin Zugangsdaten */}
          {isAdmin ? (
            <div className="border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <Radio className="h-3.5 w-3.5 text-primary" />
                    Stream Ingest-Einstellungen
                  </span>
                  <div className="flex rounded-lg bg-gray-200 dark:bg-zinc-800 p-0.5 text-xs">
                    <button
                      onClick={() => setActiveCamIngestTab('cam1')}
                      className={`px-2 py-0.5 rounded font-medium ${activeCamIngestTab === 'cam1' ? 'bg-white dark:bg-zinc-900 text-primary shadow-xs' : 'text-gray-500'}`}
                    >
                      Kamera 1
                    </button>
                    <button
                      onClick={() => setActiveCamIngestTab('cam2')}
                      className={`px-2 py-0.5 rounded font-medium ${activeCamIngestTab === 'cam2' ? 'bg-white dark:bg-zinc-900 text-primary shadow-xs' : 'text-gray-500'}`}
                    >
                      Kamera 2
                    </button>
                  </div>
                </div>

                <div className="flex rounded-lg bg-gray-200 dark:bg-zinc-800 p-0.5 text-xs">
                  <button
                    onClick={() => setStreamClientTab('dji')}
                    className={`px-2.5 py-1 rounded font-semibold transition-all ${
                      streamClientTab === 'dji' ? 'bg-white dark:bg-zinc-900 text-primary shadow-xs' : 'text-gray-600 dark:text-zinc-400'
                    }`}
                  >
                    DJI Mimo
                  </button>
                  <button
                    onClick={() => setStreamClientTab('obs')}
                    className={`px-2.5 py-1 rounded font-semibold transition-all ${
                      streamClientTab === 'obs' ? 'bg-white dark:bg-zinc-900 text-primary shadow-xs' : 'text-gray-600 dark:text-zinc-400'
                    }`}
                  >
                    OBS Studio
                  </button>
                </div>
              </div>

              {streamClientTab === 'dji' ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 block mb-0.5">
                      RTMP-URL für {activeCamIngestTab === 'cam1' ? 'Kamera 1' : 'Kamera 2'}
                    </span>
                    <code className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate block select-all">
                      {activeCamIngestTab === 'cam1' ? fullRtmpUrlCam1 : fullRtmpUrlCam2}
                    </code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(activeCamIngestTab === 'cam1' ? fullRtmpUrlCam1 : fullRtmpUrlCam2, 'dji')}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {copiedKey === 'dji' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === 'dji' ? 'Kopiert' : 'Kopieren'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-500 block">OBS Server</span>
                      <code className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate block select-all">
                        {obsServerUrl}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(obsServerUrl, 'obs-server')}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white"
                    >
                      {copiedKey === 'obs-server' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-500 block">Stream-Schlüssel</span>
                      <code className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold block select-all">
                        {activeCamIngestTab === 'cam1' ? 'cam1' : 'cam2'}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(activeCamIngestTab === 'cam1' ? 'cam1' : 'cam2', 'obs-key')}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white"
                    >
                      {copiedKey === 'obs-key' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
    </>
  );
}
