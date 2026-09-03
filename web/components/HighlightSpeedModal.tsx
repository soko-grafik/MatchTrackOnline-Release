"use client";

import { Sparkles, X, Zap, Gauge, Microscope } from 'lucide-react';

export type HighlightSpeed = 'fast' | 'normal' | 'slow';

interface HighlightSpeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (speed: HighlightSpeed) => void;
}

const SPEED_OPTIONS: { id: HighlightSpeed; label: string; description: string; badge: string; icon: React.ReactNode; accent: string }[] = [
  {
    id: 'fast',
    label: 'Fast',
    description: 'Grobe Abtastung (1 FPS), kleinstes Modell - schnellstes Ergebnis, weniger präzise.',
    badge: 'AM SCHNELLSTEN',
    icon: <Zap className="h-5 w-5" />,
    accent: 'border-blue-500/60 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15',
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'Ausgewogene Abtastung (2 FPS) - guter Kompromiss aus Geschwindigkeit und Genauigkeit.',
    badge: 'EMPFOHLEN',
    icon: <Gauge className="h-5 w-5" />,
    accent: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15',
  },
  {
    id: 'slow',
    label: 'Slow',
    description: 'Dichte Abtastung (5 FPS), größeres & präziseres Modell - bestes Ergebnis, dauert am längsten.',
    badge: 'BESTE QUALITÄT',
    icon: <Microscope className="h-5 w-5" />,
    accent: 'border-purple-500/60 bg-purple-500/10 text-purple-300 hover:bg-purple-500/15',
  },
];

export default function HighlightSpeedModal({ isOpen, onClose, onSelect }: HighlightSpeedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <Sparkles className="h-5 w-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-white">KI-Highlight-Erkennung</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2.5">
          <p className="text-xs text-zinc-500 px-0.5 pb-1">Geschwindigkeitsstufe wählen: Slow liefert die beste Erkennungsgenauigkeit, Fast das schnellste Ergebnis.</p>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${opt.accent}`}
            >
              <div className="mt-0.5">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">{opt.label}</span>
                  <span className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full bg-black/30">{opt.badge}</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
