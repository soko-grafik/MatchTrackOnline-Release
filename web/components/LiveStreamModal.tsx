"use client";

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { X, Radio, Copy, Check, Tv, AlertCircle } from 'lucide-react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [rtmpUrl, setRtmpUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      setRtmpUrl(`rtmp://${host}:1935/live/osmo4`);
    }
  }, []);

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

    const checkAndLoadStream = () => {
      if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = streamUrl;
        videoElement.play().then(() => setIsLive(true)).catch(() => setIsLive(false));
      } else if (Hls.isSupported()) {
        if (hlsRef.current) hlsRef.current.destroy();

        const hls = new Hls({
          manifestLoadingTimeOut: 5000,
          manifestLoadingMaxRetry: 2,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLive(true);
          videoElement.play().catch(console.error);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setIsLive(false);
          }
        });
      }
    };

    checkAndLoadStream();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, streamUrl]);

  const copyRtmpUrl = () => {
    navigator.clipboard.writeText(rtmpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                DJI Osmo Action 4 Livestream
                {isLive && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    LIVE
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">RTMP Stream & Echtzeit-Vorschau</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Player Container */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            controls
            playsInline
            autoPlay
            className={`w-full h-full object-contain ${isLive ? 'block' : 'hidden'}`}
          />

          {!isLive && (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500">
                <Tv className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Kein aktiver Stream gefunden</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Starte den RTMP-Livestream in deiner <strong>DJI Mimo App</strong> mit den untenstehenden Zugangsdaten.
              </p>
            </div>
          )}
        </div>

        {/* Footer: RTMP Info & Instructions */}
        <div className="border-t border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                RTMP Stream-URL für DJI Mimo App
              </span>
              <code className="text-xs font-mono text-blue-400 truncate block">
                {rtmpUrl || "rtmp://deine-domain.de:1935/live/osmo4"}
              </code>
            </div>
            <button
              onClick={copyRtmpUrl}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Kopiert!' : 'Kopieren'}
            </button>
          </div>

          <div className="flex items-start gap-2.5 text-[11px] text-zinc-400">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p>
              <strong>Anleitung:</strong> Kamera mit WLAN/Hotspot verbinden → DJI Mimo App öffnen → Livestream wählen → RTMP wählen → URL einfügen & Stream starten.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
