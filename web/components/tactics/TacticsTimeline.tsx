"use client";

import { useState } from 'react';
import {
  Play,
  Pause,
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Edit3,
  Check
} from 'lucide-react';

interface TacticsTimelineProps {
  frames: any[];
  activeFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  isLooping: boolean;
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: (index: number) => void;
  onDeleteFrame: (index: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onChangeSpeed: (speed: number) => void;
  onUpdateFrameTitle?: (index: number, title: string) => void;
}

export default function TacticsTimeline({
  frames,
  activeFrameIndex,
  isPlaying,
  playbackSpeed,
  isLooping,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onTogglePlay,
  onToggleLoop,
  onChangeSpeed,
  onUpdateFrameTitle
}: TacticsTimelineProps) {
  const [editingTitleIndex, setEditingTitleIndex] = useState<number | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  const speeds = [0.5, 1.0, 1.5, 2.0];

  const handleStartEditTitle = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleIndex(index);
    setTempTitle(frames[index]?.title || `Phase ${index + 1}`);
  };

  const handleSaveTitle = (index: number) => {
    if (onUpdateFrameTitle && tempTitle.trim()) {
      onUpdateFrameTitle(index, tempTitle.trim());
    }
    setEditingTitleIndex(null);
  };

  return (
    <div className="w-full bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl">
      
      {/* Left: Playback Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Play/Pause Button (large touch target) */}
        <button
          type="button"
          onClick={onTogglePlay}
          className={`h-11 sm:h-12 px-4 sm:px-5 rounded-2xl flex items-center gap-2 font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-lg ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
          }`}
          title={isPlaying ? 'Animation pausieren' : 'Spielzug abspielen'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ms-0.5" />
              <span>Abspielen</span>
            </>
          )}
        </button>

        {/* Step Prev & Next */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
          <button
            type="button"
            disabled={activeFrameIndex <= 0 || isPlaying}
            onClick={() => onSelectFrame(activeFrameIndex - 1)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all active:scale-95"
            title="Vorherige Phase"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            type="button"
            disabled={activeFrameIndex >= frames.length - 1 || isPlaying}
            onClick={() => onSelectFrame(activeFrameIndex + 1)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all active:scale-95"
            title="Nächste Phase"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
          {speeds.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeSpeed(s)}
              className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition-all ${
                playbackSpeed === s
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Loop Toggle */}
        <button
          type="button"
          onClick={onToggleLoop}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${
            isLooping
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
          title={isLooping ? 'Endlosschleife aktiv' : 'Endlosschleife inaktiv'}
        >
          <Repeat className="w-4 h-4" />
        </button>
      </div>

      {/* Center/Right: Phases Sequence Bar */}
      <div className="flex-1 w-full sm:w-auto flex items-center gap-2 overflow-x-auto py-1 custom-scrollbar">
        {frames.map((frame, index) => {
          const isActive = index === activeFrameIndex;
          const isEditing = editingTitleIndex === index;

          return (
            <div
              key={index}
              onClick={() => !isPlaying && onSelectFrame(index)}
              className={`group relative shrink-0 h-11 sm:h-12 px-3 sm:px-4 rounded-2xl border flex items-center gap-2.5 cursor-pointer transition-all active:scale-95 ${
                isActive
                  ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/10'
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {/* Phase Number Badge */}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${
                  isActive ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {index + 1}
              </div>

              {/* Title / Name */}
              {isEditing ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={() => handleSaveTitle(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(index);
                      if (e.key === 'Escape') setEditingTitleIndex(null);
                    }}
                    className="bg-zinc-950 border border-indigo-500 rounded-lg px-2 py-0.5 text-xs text-white font-bold focus:outline-none w-28 sm:w-36"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveTitle(index)}
                    className="p-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    title="Speichern"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span
                    onClick={(e) => handleStartEditTitle(index, e)}
                    className="text-xs font-semibold whitespace-nowrap hover:text-indigo-300 transition-colors"
                    title="Klicken zum Umbenennen"
                  >
                    {frame.title || `Phase ${index + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleStartEditTitle(index, e)}
                    className={`p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-indigo-300 transition-colors ${
                      isActive ? 'inline-flex' : 'hidden group-hover:inline-flex'
                    }`}
                    title="Phase umbenennen"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Duplicate & Delete buttons on hover */}
              <div className="hidden group-hover:flex items-center gap-1 ps-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateFrame(index);
                  }}
                  className="w-5 h-5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-indigo-300 flex items-center justify-center transition-colors"
                  title="Phase duplizieren"
                >
                  <Copy className="w-3 h-3" />
                </button>

                {frames.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFrame(index);
                    }}
                    className="w-5 h-5 rounded-md hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors"
                    title="Phase löschen"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Phase Button */}
        <button
          type="button"
          onClick={onAddFrame}
          disabled={isPlaying}
          className="shrink-0 h-11 sm:h-12 px-3 sm:px-4 rounded-2xl border border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-900/30 hover:bg-indigo-500/10 text-zinc-400 hover:text-indigo-300 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
          title="Neue Phase hinzufügen"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Phase +</span>
        </button>
      </div>

    </div>
  );
}
