"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Flame, Sliders, Trash2 } from 'lucide-react';

interface HeatmapOverlayProps {
  data: { x: number; y: number }[];
  visible: boolean;
  onDeleteHeatmap?: () => void;
  isAdmin?: boolean;
}

const HeatmapOverlay = ({ data, visible, onDeleteHeatmap, isAdmin }: HeatmapOverlayProps) => {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opacity, setOpacity] = useState(0.85);
  const [radius, setRadius] = useState(24);
  const [colorMode, setColorMode] = useState<'thermal' | 'fire' | 'electric'>('thermal');
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!data || data.length === 0) return;

    // Offscreen canvas for alpha accumulation
    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);

    // Draw radial alpha spots
    data.forEach((pos) => {
      const x = pos.x * offCanvas.width;
      const y = pos.y * offCanvas.height;

      const grad = offCtx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, 'rgba(0,0,0,0.3)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.15)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      offCtx.fillStyle = grad;
      offCtx.beginPath();
      offCtx.arc(x, y, radius, 0, Math.PI * 2);
      offCtx.fill();
    });

    // Extract alpha map & colorize
    const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha > 0) {
        const val = alpha / 255;
        let r = 0, g = 0, b = 0, a = Math.min(val * 1.5, 0.95);

        if (colorMode === 'thermal') {
          // Blue -> Cyan -> Yellow -> Orange -> Red -> White
          if (val < 0.2) {
            r = 0; g = Math.floor(val * 5 * 255); b = 255;
          } else if (val < 0.45) {
            r = 0; g = 255; b = Math.floor((1 - (val - 0.2) * 4) * 255);
          } else if (val < 0.7) {
            r = Math.floor((val - 0.45) * 4 * 255); g = 255; b = 0;
          } else if (val < 0.9) {
            r = 255; g = Math.floor((1 - (val - 0.7) * 5) * 255); b = 0;
          } else {
            r = 255; g = Math.floor((val - 0.9) * 10 * 255); b = Math.floor((val - 0.9) * 10 * 255);
          }
        } else if (colorMode === 'fire') {
          // Yellow -> Orange -> Deep Red -> White Hot
          r = 255;
          g = Math.floor(Math.max(0, 1 - val * 0.9) * 255);
          b = val > 0.85 ? Math.floor((val - 0.85) * 6 * 255) : 0;
          a = Math.min(val * 1.8, 0.98);
        } else {
          // Electric Neon: Cyan -> Emerald -> Purple Glow
          r = Math.floor(val * 200);
          g = Math.floor((1 - val * 0.5) * 255);
          b = 255;
          a = Math.min(val * 1.4, 0.9);
        }

        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = Math.floor(a * 255);
      }
    }

    ctx.putImageData(imgData, 0, 0);

  }, [data, visible, radius, colorMode]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover transition-opacity duration-300 drop-shadow-[0_0_12px_rgba(0,0,0,0.5)]"
        style={{ opacity }}
        width={1280}
        height={720}
      />

      {/* Floating Control Toggle Button */}
      <div className="absolute top-4 right-4 pointer-events-auto z-[60] flex items-center gap-2">
        <button
          onClick={() => setShowControls(!showControls)}
          className="flex items-center gap-1.5 bg-black/80 hover:bg-black border border-zinc-700/80 backdrop-blur-md px-3.5 py-2 rounded-full text-xs font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
          title="Heatmap-Einstellungen anpassen"
        >
          <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 animate-pulse" />
          <span>Heatmap Control</span>
          <Sliders className="w-3 h-3 text-zinc-400 ml-1" />
        </button>
      </div>

      {/* Control Popup Panel */}
      {showControls && (
        <div className="absolute top-16 right-4 pointer-events-auto z-[60] bg-zinc-950/95 border border-zinc-800 backdrop-blur-xl p-4 rounded-2xl shadow-2xl w-64 text-white text-xs space-y-4 animate-in fade-in zoom-in-95">

          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              Heatmap Parameter
            </span>
            <button onClick={() => setShowControls(false)} className="text-zinc-500 hover:text-white font-bold text-sm">
              ✕
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between">
              <span>Deckkraft</span>
              <span className="font-mono">{Math.round(opacity * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-orange-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between">
              <span>Radius</span>
              <span className="font-mono">{radius}px</span>
            </label>
            <input
              type="range"
              min="12"
              max="48"
              step="2"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              className="w-full accent-orange-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Farbschema
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'thermal', label: 'Thermal' },
                { id: 'fire', label: 'Fire' },
                { id: 'electric', label: 'Electric' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setColorMode(mode.id as any)}
                  className={`py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all ${
                    colorMode === mode.id
                      ? 'bg-orange-500 border-orange-400 text-black shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {isAdmin && onDeleteHeatmap && (
            <div className="pt-2 border-t border-zinc-800">
              <button
                onClick={onDeleteHeatmap}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Heatmap löschen</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(HeatmapOverlay, (prevProps, nextProps) => {
  return prevProps.visible === nextProps.visible && 
         prevProps.data === nextProps.data &&
         prevProps.isAdmin === nextProps.isAdmin;
});

