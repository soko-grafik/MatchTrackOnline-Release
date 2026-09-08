"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Flame, Sliders, Trash2, Crosshair, Layout, Eye, Users, User, GitCompare } from 'lucide-react';
import PitchHeatmapView from './PitchHeatmapView';
import { Point2D, ZoneStats, TrackedPlayer, TeamSummary } from '@/lib/homography';

interface HeatmapOverlayProps {
  data: Point2D[];
  pitchData?: Point2D[];
  zoneStats?: ZoneStats | null;
  teamZoneStats?: { home?: ZoneStats | null; away?: ZoneStats | null } | null;
  teams?: { home?: TeamSummary; away?: TeamSummary } | null;
  players?: TrackedPlayer[];
  visible: boolean;
  onDeleteHeatmap?: () => void;
  isAdmin?: boolean;
  onOpenCalibration?: () => void;
  canCalibrate?: boolean;
}

const HeatmapOverlay = ({
  data = [],
  pitchData = [],
  zoneStats,
  teamZoneStats,
  teams,
  players = [],
  visible,
  onDeleteHeatmap,
  isAdmin,
  onOpenCalibration,
  canCalibrate = true
}: HeatmapOverlayProps) => {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opacity, setOpacity] = useState(0.85);
  const [radius, setRadius] = useState(24);
  const [colorMode, setColorMode] = useState<'thermal' | 'fire' | 'electric'>('thermal');
  const [showControls, setShowControls] = useState(false);
  const [viewMode, setViewMode] = useState<'video' | 'pitch_2d'>('video');

  // Filter State
  const [teamFilter, setTeamFilter] = useState<'all' | 'home' | 'away' | 'dual'>('all');
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | 'all'>('all');

  // Filter positions for Video overlay
  const activeVideoPositions = useMemo(() => {
    if (!data) return [];
    if (selectedTrackerId !== 'all') {
      return data.filter((p) => p.tracker_id === selectedTrackerId);
    }
    if (teamFilter === 'home') {
      return data.filter((p) => p.team === 'home');
    }
    if (teamFilter === 'away') {
      return data.filter((p) => p.team === 'away');
    }
    return data;
  }, [data, teamFilter, selectedTrackerId]);

  // Video-Perspective Canvas Rendering
  useEffect(() => {
    if (!visible || viewMode !== 'video' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!data || data.length === 0) return;

    const renderPointsToContext = (pts: Point2D[], mode: 'thermal' | 'fire' | 'electric' | 'home_red' | 'away_blue') => {
      if (!pts || pts.length === 0) return;

      const offCanvas = document.createElement('canvas');
      offCanvas.width = canvas.width;
      offCanvas.height = canvas.height;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);

      pts.forEach((pos) => {
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

      const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
      const pixels = imgData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha > 0) {
          const val = alpha / 255;
          let r = 0, g = 0, b = 0, a = Math.min(val * 1.5, 0.95);

          if (mode === 'home_red') {
            r = 245;
            g = Math.floor(Math.max(0, 1 - val * 0.8) * 160);
            b = 30;
            a = Math.min(val * 1.7, 0.95);
          } else if (mode === 'away_blue') {
            r = 20;
            g = Math.floor((val * 0.7 + 0.3) * 220);
            b = 255;
            a = Math.min(val * 1.7, 0.95);
          } else if (mode === 'thermal') {
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
          } else if (mode === 'fire') {
            r = 255;
            g = Math.floor(Math.max(0, 1 - val * 0.9) * 255);
            b = val > 0.85 ? Math.floor((val - 0.85) * 6 * 255) : 0;
            a = Math.min(val * 1.8, 0.98);
          } else {
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

      offCtx.putImageData(imgData, 0, 0);
      ctx.drawImage(offCanvas, 0, 0);
    };

    if (teamFilter === 'dual' && selectedTrackerId === 'all') {
      const homeDets = data.filter((p) => p.team === 'home');
      const awayDets = data.filter((p) => p.team === 'away');
      renderPointsToContext(homeDets, 'home_red');
      renderPointsToContext(awayDets, 'away_blue');
    } else {
      renderPointsToContext(activeVideoPositions, colorMode);
    }

  }, [data, visible, radius, colorMode, viewMode, teamFilter, selectedTrackerId, activeVideoPositions]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Mode A: Video Overlay Canvas */}
      {viewMode === 'video' && (
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover transition-opacity duration-300 drop-shadow-[0_0_12px_rgba(0,0,0,0.5)]"
          style={{ opacity }}
          width={1280}
          height={720}
        />
      )}

      {/* Mode B: 2D Pitch Modal/Card Overlay */}
      {viewMode === 'pitch_2d' && (
        <div className="absolute inset-4 sm:inset-8 z-50 pointer-events-auto flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full h-full max-w-5xl max-h-[85vh] shadow-2xl">
            <PitchHeatmapView
              pitchPositions={pitchData}
              zoneStats={zoneStats}
              teamZoneStats={teamZoneStats}
              teams={teams}
              players={players}
              onOpenCalibration={onOpenCalibration}
              onClose={() => setViewMode('video')}
              canCalibrate={canCalibrate}
            />
          </div>
        </div>
      )}

      {/* Floating Control Toggle Button */}
      <div className="absolute top-4 right-4 pointer-events-auto z-[60] flex items-center gap-2">
        {/* Quick 2D Mode Switcher Button */}
        <button
          onClick={() => setViewMode(viewMode === 'video' ? 'pitch_2d' : 'video')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold shadow-2xl transition-all hover:scale-105 active:scale-95 border backdrop-blur-md ${
            viewMode === 'pitch_2d'
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-950/50'
              : 'bg-black/80 hover:bg-black border-zinc-700/80 text-zinc-300 hover:text-white'
          }`}
          title={viewMode === 'video' ? 'Zu genormtem 2D-Spielfeld wechseln' : 'Zurück zum Video-Overlay'}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>{viewMode === 'video' ? '2D-Spielfeld' : 'Video-Overlay'}</span>
        </button>

        {/* Heatmap Settings Button */}
        <button
          onClick={() => setShowControls(!showControls)}
          className="flex items-center gap-1.5 bg-black/80 hover:bg-black border border-zinc-700/80 backdrop-blur-md px-3.5 py-2 rounded-full text-xs font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
          title="Heatmap-Einstellungen & Team-Filter"
        >
          <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 animate-pulse" />
          <span>Heatmap</span>
          <Sliders className="w-3 h-3 text-zinc-400 ml-0.5" />
        </button>
      </div>

      {/* Control Popup Panel */}
      {showControls && (
        <div className="absolute top-16 right-4 pointer-events-auto z-[60] bg-zinc-950/95 border border-zinc-800 backdrop-blur-xl p-4 rounded-2xl shadow-2xl w-72 text-white text-xs space-y-3.5 animate-in fade-in zoom-in-95">

          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              Heatmap Filter & Parameter
            </span>
            <button onClick={() => setShowControls(false)} className="text-zinc-500 hover:text-white font-bold text-sm">
              ✕
            </button>
          </div>

          {/* Ansichtsmodus */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Ansichtsmodus
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setViewMode('video')}
                className={`py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                  viewMode === 'video'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Video</span>
              </button>
              <button
                onClick={() => setViewMode('pitch_2d')}
                className={`py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                  viewMode === 'pitch_2d'
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Layout className="w-3 h-3" />
                <span>2D-Feld</span>
              </button>
            </div>
          </div>

          {/* Team-Filter Tabs */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Mannschafts-Filter
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'all', label: 'Alle' },
                { id: 'home', label: teams?.home?.name ? teams.home.name.substring(0, 5) : 'Heim' },
                { id: 'away', label: teams?.away?.name ? teams.away.name.substring(0, 5) : 'Gast' },
                { id: 'dual', label: 'Dual' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTeamFilter(t.id as any);
                    setSelectedTrackerId('all');
                  }}
                  className={`py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                    teamFilter === t.id && selectedTrackerId === 'all'
                      ? t.id === 'home'
                        ? 'bg-red-600 border-red-500 text-white'
                        : t.id === 'away'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : t.id === 'dual'
                        ? 'bg-gradient-to-r from-red-600 to-blue-600 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spieler-Auswahl */}
          {players && players.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Einzelner Spieler
              </label>
              <select
                value={selectedTrackerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTrackerId(val === 'all' ? 'all' : parseInt(val, 10));
                }}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] rounded-lg p-1.5 focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="all">👤 Alle Spieler anzeigen</option>
                {players.slice(0, 25).map((pl) => (
                  <option key={pl.tracker_id} value={pl.tracker_id}>
                    {pl.team === 'home' ? '🔴' : '🔵'} Spieler #{pl.tracker_id} ({pl.count} Aktionen)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Calibrate Pitch Button */}
          {canCalibrate && onOpenCalibration && (
            <button
              onClick={() => {
                setShowControls(false);
                onOpenCalibration();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all shadow-sm"
            >
              <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
              <span>Spielfeld kalibrieren (4-Ecken)</span>
            </button>
          )}

          {/* Deckkraft */}
          <div className="space-y-1">
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

          {/* Radius */}
          <div className="space-y-1">
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

          {/* Farbschema (Wenn nicht Dual) */}
          {teamFilter !== 'dual' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Farbschema
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'thermal', label: 'Thermal' },
                  { id: 'fire', label: 'Fire' },
                  { id: 'electric', label: 'Neon' },
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
          )}

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

export default React.memo(HeatmapOverlay);
