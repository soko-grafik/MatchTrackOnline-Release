"use client";

import React from 'react';
import { 
  Type, 
  Square, 
  Circle, 
  ArrowRight, 
  MousePointer2, 
  Eraser, 
  Check, 
  X, 
  Trash2,
  Undo2,
  Pencil,
  Clock
} from 'lucide-react';

export type Tool = 'select' | 'pen' | 'line' | 'arrow' | 'rect' | 'circle' | 'text';

export const colors = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ffffff', // White
  '#000000', // Black
];

interface DrawingToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  shapeDuration: number;
  setShapeDuration: (duration: number) => void;
  onClear: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export default function DrawingToolbar({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  shapeDuration,
  setShapeDuration,
  onClear,
  onCancel,
  onSave
}: DrawingToolbarProps) {
  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Auswählen' },
    { id: 'pen', icon: Pencil, label: 'Stift' },
    { id: 'arrow', icon: ArrowRight, label: 'Pfeil' },
    { id: 'rect', icon: Square, label: 'Rechteck' },
    { id: 'circle', icon: Circle, label: 'Kreis' },
    { id: 'text', icon: Type, label: 'Text' },
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-[#18181b]/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl flex items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center group relative ${activeTool === tool.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            title={tool.label}
          >
            <tool.icon className="w-5 h-5" />
            <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-zinc-800">
              {tool.label}
            </span>
          </button>
        ))}
        
        <div className="w-px h-6 bg-white/10 mx-1"></div>
        
        <button
          onClick={onClear}
          className="p-2.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all group relative"
          title="Alles löschen"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-[#18181b]/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-4">
        <div className="flex items-center gap-1.5 px-1">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => setActiveColor(color)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${activeColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-white/10"></div>
        
        <div className="flex items-center gap-2 text-zinc-300">
          <Clock className="w-4 h-4" />
          <input
            type="number"
            value={shapeDuration / 1000}
            onChange={(e) => setShapeDuration(Number(e.target.value) * 1000)}
            className="bg-transparent w-12 text-center font-bold text-sm outline-none"
            step="0.5"
            min="0.5"
          />
          <span className="text-xs font-bold">sek</span>
        </div>

        <div className="w-px h-6 bg-white/10"></div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
            Abbrechen
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
          >
            <Check className="w-4 h-4" />
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
