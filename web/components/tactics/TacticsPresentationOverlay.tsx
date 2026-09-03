"use client";

import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Zap,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sliders
} from 'lucide-react';

interface TacticsPresentationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activeFrameIndex: number;
  totalFrames: number;
  isPlaying: boolean;
  currentTool: string;
  onTogglePlay: () => void;
  onNextFrame: () => void;
  onPrevFrame: () => void;
  onSelectTool: (tool: string) => void;
  currentFrameTitle?: string;
}

export default function TacticsPresentationOverlay({
  isOpen,
  onClose,
  activeFrameIndex,
  totalFrames,
  isPlaying,
  currentTool,
  onTogglePlay,
  onNextFrame,
  onPrevFrame,
  onSelectTool,
  currentFrameTitle
}: TacticsPresentationOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed top-4 inset-x-4 z-[99999] pointer-events-none flex items-center justify-between">
      
      {/* Left Badge: Phase Info */}
      <div className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 backdrop-blur-md shadow-2xl">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
          Phase {activeFrameIndex + 1} / {totalFrames}
        </span>
        {currentFrameTitle && (
          <span className="text-xs text-zinc-400 border-s border-zinc-800 ps-2 ms-1">
            {currentFrameTitle}
          </span>
        )}
      </div>

      {/* Center: Floating Presentation Toolbar */}
      <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 backdrop-blur-md shadow-2xl">
        {/* Laserpointer Toggle */}
        <button
          type="button"
          onClick={() => onSelectTool(currentTool === 'laser' ? 'select' : 'laser')}
          className={`h-11 px-4 rounded-xl flex items-center gap-2 text-xs font-bold transition-all active:scale-95 ${
            currentTool === 'laser'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-rose-300 fill-current" />
          <span>Laserpointer</span>
        </button>

        <div className="w-px h-6 bg-zinc-800" />

        {/* Step Prev */}
        <button
          type="button"
          disabled={activeFrameIndex <= 0 || isPlaying}
          onClick={onPrevFrame}
          className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
          title="Vorherige Phase"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Play/Pause */}
        <button
          type="button"
          onClick={onTogglePlay}
          className={`h-11 px-4 rounded-xl flex items-center gap-2 text-xs font-bold transition-all active:scale-95 ${
            isPlaying
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-indigo-600 text-white'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ms-0.5" />
          )}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* Step Next */}
        <button
          type="button"
          disabled={activeFrameIndex >= totalFrames - 1 || isPlaying}
          onClick={onNextFrame}
          className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
          title="Nächste Phase"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Exit Presentation Mode */}
      <div className="pointer-events-auto">
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:bg-zinc-900 backdrop-blur-md text-zinc-300 hover:text-white flex items-center gap-2 text-xs font-bold shadow-2xl transition-all active:scale-95"
        >
          <Minimize2 className="w-4 h-4" />
          <span>Beenden</span>
        </button>
      </div>

    </div>
  );
}
