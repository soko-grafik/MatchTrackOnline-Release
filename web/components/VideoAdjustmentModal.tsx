"use client";

import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, RefreshCw } from 'lucide-react';
import { updateVideoAdjustments } from '@/services/api';
import AlertDialog from '@/components/AlertDialog';


interface VideoAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  initialAdjustments: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
  };
  videoUrl: string;
  onSave: (adjustments: any) => void;
}

export default function VideoAdjustmentModal({
  isOpen,
  onClose,
  matchId,
  initialAdjustments,
  videoUrl,
  onSave
}: VideoAdjustmentModalProps) {
  const [brightness, setBrightness] = useState(initialAdjustments?.brightness ?? 100);
  const [contrast, setContrast] = useState(initialAdjustments?.contrast ?? 100);
  const [saturation, setSaturation] = useState(initialAdjustments?.saturation ?? 100);
  const [hue, setHue] = useState(initialAdjustments?.hue ?? 0);
  const [processing, setProcessing] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type?: 'info' | 'success' | 'warning' | 'error'; title?: string }>({
    isOpen: false,
    message: '',
    type: 'error'
  });

  useEffect(() => {
    setBrightness(initialAdjustments?.brightness ?? 100);
    setContrast(initialAdjustments?.contrast ?? 100);
    setSaturation(initialAdjustments?.saturation ?? 100);
    setHue(initialAdjustments?.hue ?? 0);
  }, [initialAdjustments]);

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHue(0);
  };

  const handleApply = async () => {
    setProcessing(true);
    try {
      const adjustments = { brightness, contrast, saturation, hue };
      await updateVideoAdjustments(matchId, adjustments);
      onSave(adjustments);
      onClose();
    } catch (err) {
      console.error("Failed to save adjustments:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Speichern der Anpassungen.", type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;


  const filterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <AlertDialog
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 p-6">
          <div>
            <h2 className="text-xl font-bold text-white">Video-Farbanpassungen</h2>
            <p className="text-sm text-zinc-400">Passe Helligkeit, Kontrast und Farben für dieses Video an.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Linke Seite: Vorschau */}
          <div className="flex min-h-[300px] flex-1 items-center justify-center bg-black/40 p-8">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-2xl">
              <video 
                src={videoUrl} 
                className="h-full w-full object-contain" 
                style={filterStyle}
                autoPlay 
                muted 
                loop 
                playsInline
              />
              <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70 backdrop-blur-md">
                Live Vorschau
              </div>
            </div>
          </div>

          {/* Rechte Seite: Controls */}
          <div className="w-full overflow-y-auto border-zinc-800 p-8 space-y-8 lg:w-80 lg:border-l">
            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Helligkeit <span className="text-zinc-300">{brightness}%</span>
                    </label>
                    <input 
                        type="range" 
                        min="0" max="200" step="1" 
                        value={brightness} 
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="h-1.5 w-full appearance-none rounded-full bg-zinc-800 accent-primary"
                    />
                </div>
                <div className="space-y-3">
                    <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Kontrast <span className="text-zinc-300">{contrast}%</span>
                    </label>
                    <input 
                        type="range" 
                        min="0" max="200" step="1" 
                        value={contrast} 
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="h-1.5 w-full appearance-none rounded-full bg-zinc-800 accent-primary"
                    />
                </div>
                <div className="space-y-3">
                    <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Sättigung <span className="text-zinc-300">{saturation}%</span>
                    </label>
                    <input 
                        type="range" 
                        min="0" max="200" step="1" 
                        value={saturation} 
                        onChange={(e) => setSaturation(parseInt(e.target.value))}
                        className="h-1.5 w-full appearance-none rounded-full bg-zinc-800 accent-primary"
                    />
                </div>
                <div className="space-y-3">
                    <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Farbton <span className="text-zinc-300">{hue}°</span>
                    </label>
                    <input 
                        type="range" 
                        min="0" max="360" step="1" 
                        value={hue} 
                        onChange={(e) => setHue(parseInt(e.target.value))}
                        className="h-1.5 w-full appearance-none rounded-full bg-zinc-800 accent-primary"
                    />
                </div>
                
                <button 
                    onClick={handleReset}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 px-5 py-3 text-sm font-bold text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
                >
                    <RefreshCw className="h-4 w-4" />
                    Zurücksetzen
                </button>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/50 px-8 py-6">
          <button 
            onClick={onClose}
            className="rounded-lg px-6 py-2.5 text-sm font-bold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Abbrechen
          </button>
          <button 
            onClick={handleApply}
            disabled={processing}
            className="flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Speichere...
                </>
            ) : (
                <>
                    <Check className="h-4 w-4" />
                    Speichern
                </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
