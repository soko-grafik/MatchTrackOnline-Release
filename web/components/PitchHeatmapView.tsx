"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Flame, Sliders, Download, Crosshair, X, Users, User, GitCompare, BarChart2 } from 'lucide-react';
import { calculateZoneStats, Point2D, ZoneStats, TrackedPlayer, TeamSummary } from '@/lib/homography';

interface PitchHeatmapViewProps {
  pitchPositions: Point2D[];
  zoneStats?: ZoneStats | null;
  teamZoneStats?: {
    home?: ZoneStats | null;
    away?: ZoneStats | null;
  } | null;
  teams?: {
    home?: TeamSummary;
    away?: TeamSummary;
  } | null;
  players?: TrackedPlayer[];
  onOpenCalibration?: () => void;
  onClose?: () => void;
  canCalibrate?: boolean;
}

export default function PitchHeatmapView({
  pitchPositions = [],
  zoneStats: initialZoneStats,
  teamZoneStats,
  teams,
  players = [],
  onOpenCalibration,
  onClose,
  canCalibrate = true
}: PitchHeatmapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Settings & Modes
  const [opacity, setOpacity] = useState(0.85);
  const [radius, setRadius] = useState(24);
  const [colorMode, setColorMode] = useState<'thermal' | 'fire' | 'electric'>('thermal');
  const [pitchStyle, setPitchStyle] = useState<'grass_striped' | 'dark_tactical' | 'chalkboard'>('grass_striped');
  const [showControls, setShowControls] = useState(false);
  const [showZoneStats, setShowZoneStats] = useState(true);

  // Team & Player Filter State
  const [teamFilter, setTeamFilter] = useState<'all' | 'home' | 'away' | 'dual'>('all');
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | 'all'>('all');

  // Filtered positions based on team & player selection
  const activePositions = useMemo(() => {
    if (!pitchPositions) return [];
    if (selectedTrackerId !== 'all') {
      return pitchPositions.filter((p) => p.tracker_id === selectedTrackerId);
    }
    if (teamFilter === 'home') {
      return pitchPositions.filter((p) => p.team === 'home');
    }
    if (teamFilter === 'away') {
      return pitchPositions.filter((p) => p.team === 'away');
    }
    return pitchPositions;
  }, [pitchPositions, teamFilter, selectedTrackerId]);

  // Compute or select zone stats
  const activeZoneStats = useMemo(() => {
    if (selectedTrackerId !== 'all') {
      return calculateZoneStats(activePositions);
    }
    if (teamFilter === 'home' && teamZoneStats?.home) {
      return teamZoneStats.home;
    }
    if (teamFilter === 'away' && teamZoneStats?.away) {
      return teamZoneStats.away;
    }
    if (initialZoneStats && initialZoneStats.total_points > 0) {
      return initialZoneStats;
    }
    return calculateZoneStats(activePositions);
  }, [activePositions, teamFilter, selectedTrackerId, teamZoneStats, initialZoneStats]);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 1050;
    const height = 680;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    // 1. Draw Turf Background
    if (pitchStyle === 'dark_tactical') {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);
    } else if (pitchStyle === 'chalkboard') {
      ctx.fillStyle = '#182420';
      ctx.fillRect(0, 0, width, height);
    } else {
      // Grass Striped (10 vertical stripes)
      const stripes = 10;
      const stripeW = width / stripes;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#166534';
        ctx.fillRect(i * stripeW, 0, stripeW, height);
      }
    }

    // Border and margin setup
    const marginX = width * 0.045;
    const marginY = height * 0.055;
    const bw = width - 2 * marginX;
    const bh = height - 2 * marginY;
    const bx = marginX;
    const by = marginY;
    const midX = bx + bw / 2;
    const midY = by + bh / 2;

    // Helper: Draw a single colored density heatmap on offscreen canvas
    const renderDensityLayer = (pts: Point2D[], mode: 'thermal' | 'fire' | 'electric' | 'home_red' | 'away_blue') => {
      if (!pts || pts.length === 0) return null;

      const offCanvas = document.createElement('canvas');
      offCanvas.width = width;
      offCanvas.height = height;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return null;

      // Accumulate radial gradient alpha
      pts.forEach((pos) => {
        const px = bx + pos.x * bw;
        const py = by + pos.y * bh;

        const grad = offCtx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, 'rgba(0,0,0,0.32)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.15)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        offCtx.fillStyle = grad;
        offCtx.beginPath();
        offCtx.arc(px, py, radius, 0, Math.PI * 2);
        offCtx.fill();
      });

      const imgData = offCtx.getImageData(0, 0, width, height);
      const pixels = imgData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha > 0) {
          const val = alpha / 255;
          let r = 0, g = 0, b = 0, a = Math.min(val * 1.6, 0.95);

          if (mode === 'home_red') {
            // Warm Red-Orange (Heimteam)
            r = 245;
            g = Math.floor(Math.max(0, 1 - val * 0.8) * 160);
            b = 30;
            a = Math.min(val * 1.7, 0.95);
          } else if (mode === 'away_blue') {
            // Cool Cyan-Blue (Gastteam)
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
            // Electric Neon
            r = Math.floor(val * 200);
            g = Math.floor((1 - val * 0.5) * 255);
            b = 255;
            a = Math.min(val * 1.4, 0.9);
          }

          pixels[i] = r;
          pixels[i + 1] = g;
          pixels[i + 2] = b;
          pixels[i + 3] = Math.floor(a * opacity * 255);
        }
      }

      offCtx.putImageData(imgData, 0, 0);
      return offCanvas;
    };

    // 2. Heatmap Render Pipeline
    if (teamFilter === 'dual' && selectedTrackerId === 'all') {
      // Dual Team Contrast Overlay
      const homePts = pitchPositions.filter((p) => p.team === 'home');
      const awayPts = pitchPositions.filter((p) => p.team === 'away');

      const homeCanvas = renderDensityLayer(homePts, 'home_red');
      const awayCanvas = renderDensityLayer(awayPts, 'away_blue');

      if (homeCanvas) ctx.drawImage(homeCanvas, 0, 0);
      if (awayCanvas) ctx.drawImage(awayCanvas, 0, 0);
    } else {
      // Single Selection Layer
      const layer = renderDensityLayer(activePositions, colorMode);
      if (layer) ctx.drawImage(layer, 0, 0);
    }

    // 3. Draw Football Field Lines (Crisp Overlay on Top)
    const lineColor = pitchStyle === 'dark_tactical' 
      ? 'rgba(255, 255, 255, 0.55)' 
      : 'rgba(255, 255, 255, 0.90)';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer Boundary Line
    ctx.strokeRect(bx, by, bw, bh);

    // Halfway Line
    ctx.beginPath();
    ctx.moveTo(midX, by);
    ctx.lineTo(midX, by + bh);
    ctx.stroke();

    // Center Circle & Spot
    const centerR = bh * 0.18;
    ctx.beginPath();
    ctx.arc(midX, midY, centerR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    // Left Penalty Box (16m)
    const boxW = bw * 0.16;
    const boxH = bh * 0.55;
    const boxY = midY - boxH / 2;
    ctx.strokeRect(bx, boxY, boxW, boxH);

    // Left 5m Box (Goal Area)
    const goalBoxW = bw * 0.06;
    const goalBoxH = bh * 0.28;
    const goalBoxY = midY - goalBoxH / 2;
    ctx.strokeRect(bx, goalBoxY, goalBoxW, goalBoxH);

    // Left Penalty Spot & Arc
    const leftPenX = bx + bw * 0.11;
    ctx.beginPath(); ctx.arc(leftPenX, midY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(leftPenX, midY, centerR, -0.65, 0.65); ctx.stroke();

    // Right Penalty Box (16m)
    ctx.strokeRect(bx + bw - boxW, boxY, boxW, boxH);

    // Right 5m Box (Goal Area)
    ctx.strokeRect(bx + bw - goalBoxW, goalBoxY, goalBoxW, goalBoxH);

    // Right Penalty Spot & Arc
    const rightPenX = bx + bw - bw * 0.11;
    ctx.beginPath(); ctx.arc(rightPenX, midY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rightPenX, midY, centerR, Math.PI - 0.65, Math.PI + 0.65); ctx.stroke();

    // Corner Arcs
    const cornerR = 12;
    ctx.beginPath(); ctx.arc(bx, by, cornerR, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by + bh, cornerR, -Math.PI / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + bw, by, cornerR, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + bw, by + bh, cornerR, Math.PI, -Math.PI / 2); ctx.stroke();

    // Goal Nets
    const goalH = bh * 0.24;
    const goalY = midY - goalH / 2;
    const goalDepth = 12;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.strokeRect(bx - goalDepth, goalY, goalDepth, goalH);
    ctx.strokeRect(bx + bw, goalY, goalDepth, goalH);

  }, [activePositions, opacity, radius, colorMode, pitchStyle, teamFilter, selectedTrackerId, pitchPositions]);

  // Export PNG Function
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `match-heatmap-2d-${teamFilter}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-zinc-950/95 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Top Bar / Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-orange-500/20 rounded-lg text-orange-400 border border-orange-500/30">
            <Flame className="w-4 h-4 fill-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                2D-Spielfeld Heatmap
              </h3>
              <span className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-[9px] font-bold border border-orange-500/30">
                105×68m
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">
              Team- & spielerspezifische Aktionszonen und Laufwege
            </p>
          </div>
        </div>

        {/* Center: Team Filter Tabs */}
        <div className="flex items-center bg-black/60 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setTeamFilter('all');
              setSelectedTrackerId('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              teamFilter === 'all' && selectedTrackerId === 'all'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Alle</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTeamFilter('home');
              setSelectedTrackerId('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              teamFilter === 'home' && selectedTrackerId === 'all'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-red-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>{teams?.home?.name || 'Heim'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTeamFilter('away');
              setSelectedTrackerId('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              teamFilter === 'away' && selectedTrackerId === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-blue-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{teams?.away?.name || 'Gast'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTeamFilter('dual');
              setSelectedTrackerId('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              teamFilter === 'dual' && selectedTrackerId === 'all'
                ? 'bg-gradient-to-r from-red-600 to-blue-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Heim (Rot) und Gast (Blau) gleichzeitig vergleichen"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Dual-Vergleich</span>
          </button>
        </div>

        {/* Right: Player Select & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Player Select Dropdown */}
          {players && players.length > 0 && (
            <div className="relative">
              <select
                value={selectedTrackerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTrackerId(val === 'all' ? 'all' : parseInt(val, 10));
                }}
                className="bg-zinc-900 border border-zinc-700/80 text-zinc-300 text-[11px] font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-orange-500 cursor-pointer max-w-[150px] truncate"
              >
                <option value="all">👤 Alle Spieler</option>
                {players.slice(0, 25).map((pl) => (
                  <option key={pl.tracker_id} value={pl.tracker_id}>
                    {pl.team === 'home' ? '🔴' : '🔵'} Spieler #{pl.tracker_id} ({pl.count} Pkt.)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle Zone Stats */}
          <button
            onClick={() => setShowZoneStats(!showZoneStats)}
            className={`p-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
              showZoneStats 
                ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white border-zinc-700/60'
            }`}
            title="Taktische Zonen-Statistik ein-/ausblenden"
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>

          {/* Controls Toggle */}
          <button
            onClick={() => setShowControls(!showControls)}
            className={`p-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
              showControls 
                ? 'bg-orange-500 text-black border-orange-400 shadow-md' 
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white border-zinc-700/60'
            }`}
            title="Darstellung & Heatmap-Parameter"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Calibrate Pitch */}
          {canCalibrate && onOpenCalibration && (
            <button
              onClick={onOpenCalibration}
              className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
              title="4-Ecken-Spielfeldkalibrierung anpassen"
            >
              <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          )}

          {/* Download PNG */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
            title="Heatmap-Grafik als PNG herunterladen"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              title="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Pitch Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-black/40 min-h-0"
      >
        <div className="relative max-w-full max-h-full aspect-[105/68] rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain block drop-shadow-2xl"
          />

          {/* Active Filter Overlay Badge */}
          <div className="absolute top-2.5 left-3 pointer-events-none z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-bold text-white shadow-lg">
            {teamFilter === 'dual' ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400">{teams?.home?.name || 'Heim'}</span>
                <span className="text-zinc-500">vs</span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-blue-400">{teams?.away?.name || 'Gast'}</span>
              </span>
            ) : selectedTrackerId !== 'all' ? (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-amber-400" />
                <span>Spieler #{selectedTrackerId}</span>
              </span>
            ) : teamFilter === 'home' ? (
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>{teams?.home?.name || 'Heimteam'}</span>
              </span>
            ) : teamFilter === 'away' ? (
              <span className="flex items-center gap-1 text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{teams?.away?.name || 'Gastteam'}</span>
              </span>
            ) : (
              <span className="text-zinc-300">Gesamtes Spiel (Alle Spieler)</span>
            )}
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400 font-mono">{activePositions.length} Punkte</span>
          </div>

          {/* Empty State Overlay */}
          {(!pitchPositions || pitchPositions.length === 0) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-center p-6">
              <Flame className="w-8 h-8 text-zinc-500 mb-2" />
              <p className="text-sm font-bold text-zinc-300 mb-1">Keine 2D-Heatmap-Daten vorhanden</p>
              <p className="text-xs text-zinc-500 max-w-sm">
                Starte die KI-Heatmap-Generierung oder kalibriere das Spielfeld mit der 4-Ecken-Auswahl.
              </p>
            </div>
          )}
        </div>

        {/* Floating Parameter Popup */}
        {showControls && (
          <div className="absolute top-4 right-4 z-30 bg-zinc-950/95 border border-zinc-800 backdrop-blur-xl p-4 rounded-2xl shadow-2xl w-64 text-white text-xs space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-orange-500" />
                Heatmap Parameter
              </span>
              <button onClick={() => setShowControls(false)} className="text-zinc-500 hover:text-white font-bold text-sm">
                ✕
              </button>
            </div>

            {/* Pitch Style */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Rasen-Design
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'grass_striped', label: 'Rasen' },
                  { id: 'dark_tactical', label: 'Dark' },
                  { id: 'chalkboard', label: 'Board' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPitchStyle(s.id as any)}
                    className={`py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                      pitchStyle === s.id
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deckkraft */}
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

            {/* Radius */}
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

            {/* Farbschema (Nur aktiv wenn nicht Dual-Modus) */}
            {teamFilter !== 'dual' && (
              <div className="space-y-1.5">
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
          </div>
        )}
      </div>

      {/* Bottom Taktische Zonenleiste */}
      {showZoneStats && (
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/80 shrink-0 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Dual Team Direkter Vergleich */}
          {teamFilter === 'dual' && teamZoneStats?.home && teamZoneStats?.away ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Angriffsdrittel Vergleich */}
              <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                  <span>Präsenz Angriffsdrittel</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Heim vs. Gast</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-zinc-800 shadow-inner">
                  <div 
                    style={{ width: `${(teamZoneStats.home.thirds.attacking / Math.max(1, teamZoneStats.home.thirds.attacking + teamZoneStats.away.thirds.attacking)) * 100}%` }} 
                    className="bg-red-500 h-full transition-all" 
                  />
                  <div 
                    style={{ width: `${(teamZoneStats.away.thirds.attacking / Math.max(1, teamZoneStats.home.thirds.attacking + teamZoneStats.away.thirds.attacking)) * 100}%` }} 
                    className="bg-blue-500 h-full transition-all" 
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-red-400 font-bold">{teams?.home?.name || 'Heim'}: {teamZoneStats.home.thirds.attacking}%</span>
                  <span className="text-blue-400 font-bold">{teams?.away?.name || 'Gast'}: {teamZoneStats.away.thirds.attacking}%</span>
                </div>
              </div>

              {/* Mittelfeld-Kontrolle */}
              <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                  <span>Mittelfeld-Kontrolle</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Zentrale Dominanz</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-zinc-800 shadow-inner">
                  <div 
                    style={{ width: `${(teamZoneStats.home.thirds.midfield / Math.max(1, teamZoneStats.home.thirds.midfield + teamZoneStats.away.thirds.midfield)) * 100}%` }} 
                    className="bg-red-500 h-full transition-all" 
                  />
                  <div 
                    style={{ width: `${(teamZoneStats.away.thirds.midfield / Math.max(1, teamZoneStats.home.thirds.midfield + teamZoneStats.away.thirds.midfield)) * 100}%` }} 
                    className="bg-blue-500 h-full transition-all" 
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-red-400 font-bold">{teamZoneStats.home.thirds.midfield}%</span>
                  <span className="text-blue-400 font-bold">{teamZoneStats.away.thirds.midfield}%</span>
                </div>
              </div>

              {/* Gegnerische Hälfte Ballbesitz/Präsenz */}
              <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                  <span>Druck in gegn. Hälfte</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Territoriale Überlegenheit</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-zinc-800 shadow-inner">
                  <div 
                    style={{ width: `${teamZoneStats.home.halves.opponent_half}%` }} 
                    className="bg-red-500 h-full transition-all" 
                  />
                  <div 
                    style={{ width: `${teamZoneStats.away.halves.opponent_half}%` }} 
                    className="bg-blue-500 h-full transition-all" 
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-red-400 font-bold">🚩 {teamZoneStats.home.halves.opponent_half}%</span>
                  <span className="text-blue-400 font-bold">🚩 {teamZoneStats.away.halves.opponent_half}%</span>
                </div>
              </div>
            </div>
          ) : (
            /* Single Team / Player Zonenleiste */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Drittel-Verteilung */}
              <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                  <span>Spielfeld-Drittel</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Def / Mid / Att</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-zinc-800 shadow-inner">
                  <div 
                    style={{ width: `${activeZoneStats.thirds.defensive}%` }} 
                    className="bg-blue-500 h-full transition-all" 
                    title={`Defensivdrittel: ${activeZoneStats.thirds.defensive}%`}
                  />
                  <div 
                    style={{ width: `${activeZoneStats.thirds.midfield}%` }} 
                    className="bg-amber-500 h-full transition-all" 
                    title={`Mittelfelddrittel: ${activeZoneStats.thirds.midfield}%`}
                  />
                  <div 
                    style={{ width: `${activeZoneStats.thirds.attacking}%` }} 
                    className="bg-red-500 h-full transition-all" 
                    title={`Angriffsdrittel: ${activeZoneStats.thirds.attacking}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span className="text-blue-400 font-bold">{activeZoneStats.thirds.defensive}%</span>
                  <span className="text-amber-400 font-bold">{activeZoneStats.thirds.midfield}%</span>
                  <span className="text-red-400 font-bold">{activeZoneStats.thirds.attacking}%</span>
                </div>
              </div>

              {/* Flügel-Verteilung */}
              <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                  <span>Flügel & Zentrum</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Links / Zent / Rechts</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-zinc-800 shadow-inner">
                  <div 
                    style={{ width: `${activeZoneStats.channels.left_flank}%` }} 
                    className="bg-purple-500 h-full transition-all" 
                    title={`Linke Außenbahn: ${activeZoneStats.channels.left_flank}%`}
                  />
                  <div 
                    style={{ width: `${activeZoneStats.channels.center}%` }} 
                    className="bg-emerald-500 h-full transition-all" 
                    title={`Zentrum: ${activeZoneStats.channels.center}%`}
                  />
                  <div 
                    style={{ width: `${activeZoneStats.channels.right_flank}%` }} 
                    className="bg-cyan-500 h-full transition-all" 
                    title={`Rechte Außenbahn: ${activeZoneStats.channels.right_flank}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span className="text-purple-400 font-bold">{activeZoneStats.channels.left_flank}%</span>
                  <span className="text-emerald-400 font-bold">{activeZoneStats.channels.center}%</span>
                  <span className="text-cyan-400 font-bold">{activeZoneStats.channels.right_flank}%</span>
                </div>
              </div>

              {/* Hälften-Verteilung */}
              <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                  <span>Spielhälften</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Eigene / Gegner</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-zinc-800 shadow-inner">
                  <div 
                    style={{ width: `${activeZoneStats.halves.own_half}%` }} 
                    className="bg-sky-500 h-full transition-all" 
                    title={`Eigene Hälfte: ${activeZoneStats.halves.own_half}%`}
                  />
                  <div 
                    style={{ width: `${activeZoneStats.halves.opponent_half}%` }} 
                    className="bg-orange-500 h-full transition-all" 
                    title={`Gegnerische Hälfte: ${activeZoneStats.halves.opponent_half}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span className="text-sky-400 font-bold">🏠 {activeZoneStats.halves.own_half}%</span>
                  <span className="text-orange-400 font-bold">🚩 {activeZoneStats.halves.opponent_half}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
