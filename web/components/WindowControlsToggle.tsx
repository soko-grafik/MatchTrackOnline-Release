"use client";

import { useState, useEffect } from 'react';
import { Maximize, Minimize, Monitor, X } from 'lucide-react';

export default function WindowControlsToggle() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    // Check if running in PWA standalone or display-mode window
    const isPwa = window.matchMedia('(display-mode: standalone)').matches ||
                  window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                  (window.navigator as any).standalone === true;
    setIsStandalone(isPwa);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreenMode = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fehler beim Umschalten des Fenstermodus:', err);
    }
  };

  return (
    <div className="hidden lg:block">
      <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700/80 p-1 rounded-xl shadow-lg backdrop-blur-md shrink-0">
        <button
          onClick={toggleFullscreenMode}
          title={isFullscreen ? "Fenstermodus wiederherstellen" : "Vollbild / Software-Modus (ohne Browserrahmen)"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 transition-all active:scale-95"
        >
          <Monitor className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>
            {isFullscreen ? "Fenstermodus" : "Fullscreen"}
          </span>
          {isFullscreen ? <Minimize className="w-3 h-3 text-zinc-400 shrink-0" /> : <Maximize className="w-3 h-3 text-zinc-400 shrink-0" />}
        </button>
      </div>
    </div>
  );
}
