"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crosshair, Check, X, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye, Layout, AlertCircle } from 'lucide-react';
import { getMatchPreview, saveFieldCalibration } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import { Point2D, computeHomographyMatrix, projectPoint } from '@/lib/homography';

interface FieldCalibrationModalProps {
  matchId: string;
  isOpen: boolean;
  onClose: () => void;
  initialCalibration?: {
    src_points?: Point2D[];
    pitch_type?: string;
  } | null;
  onSaved?: (calibration: any) => void;
  samplePositions?: Point2D[];
}

const DEFAULT_POINTS: Point2D[] = [
  { x: 0.12, y: 0.22 }, // 1: Oben-Links
  { x: 0.88, y: 0.22 }, // 2: Oben-Rechts
  { x: 0.98, y: 0.90 }, // 3: Unten-Rechts
  { x: 0.02, y: 0.90 }, // 4: Unten-Links
];

const PRESETS: Record<string, { label: string; pitch_type: string; points: Point2D[] }> = {
  full: {
    label: 'Ganzes Spielfeld (Eckfahnen)',
    pitch_type: 'full',
    points: [
      { x: 0.10, y: 0.20 },
      { x: 0.90, y: 0.20 },
      { x: 0.98, y: 0.90 },
      { x: 0.02, y: 0.90 },
    ]
  },
  half_left: {
    label: 'Halbfeld Links (Tor bis Mittellinie)',
    pitch_type: 'half_left',
    points: [
      { x: 0.05, y: 0.25 },
      { x: 0.55, y: 0.22 },
      { x: 0.60, y: 0.90 },
      { x: 0.02, y: 0.90 },
    ]
  },
  half_right: {
    label: 'Halbfeld Rechts (Mittel- bis Torlinie)',
    pitch_type: 'half_right',
    points: [
      { x: 0.45, y: 0.22 },
      { x: 0.95, y: 0.25 },
      { x: 0.98, y: 0.90 },
      { x: 0.40, y: 0.90 },
    ]
  },
  center: {
    label: 'Zentrales Mittelfeld',
    pitch_type: 'full',
    points: [
      { x: 0.25, y: 0.30 },
      { x: 0.75, y: 0.30 },
      { x: 0.85, y: 0.85 },
      { x: 0.15, y: 0.85 },
    ]
  }
};

const CORNER_NAMES = [
  { id: 0, label: '1: Oben-Links', color: 'bg-emerald-500 border-emerald-400', desc: 'Eckfahne links oben / Torlinie' },
  { id: 1, label: '2: Oben-Rechts', color: 'bg-cyan-500 border-cyan-400', desc: 'Eckfahne rechts oben / Gegengerade' },
  { id: 2, label: '3: Unten-Rechts', color: 'bg-orange-500 border-orange-400', desc: 'Eckfahne rechts unten / Seitenlinie' },
  { id: 3, label: '4: Unten-Links', color: 'bg-pink-500 border-pink-400', desc: 'Eckfahne links unten / Trainerbank' },
];

export default function FieldCalibrationModal({
  matchId,
  isOpen,
  onClose,
  initialCalibration,
  onSaved,
  samplePositions = []
}: FieldCalibrationModalProps) {
  const { toast } = useToast();
  const [points, setPoints] = useState<Point2D[]>(DEFAULT_POINTS);
  const [pitchType, setPitchType] = useState<string>('full');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePointIdx, setActivePointIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'calibrate' | 'preview_split'>('calibrate');

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingIdxRef = useRef<number | null>(null);
  const miniPitchRef = useRef<HTMLCanvasElement>(null);

  // Initialize from props
  useEffect(() => {
    if (initialCalibration?.src_points && initialCalibration.src_points.length === 4) {
      setPoints(initialCalibration.src_points);
    } else {
      setPoints(DEFAULT_POINTS);
    }
    if (initialCalibration?.pitch_type) {
      setPitchType(initialCalibration.pitch_type);
    }
  }, [initialCalibration, isOpen]);

  // Load preview image
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getMatchPreview(matchId)
      .then((res) => {
        if (res?.preview_url) {
          setPreviewImage(res.preview_url);
        }
      })
      .catch((err) => console.error('Fehler beim Laden des Vorschaubilds:', err))
      .finally(() => setLoading(false));
  }, [isOpen, matchId]);

  // Mini 2D pitch preview renderer
  useEffect(() => {
    const canvas = miniPitchRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Turf
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, w, h);

    // Stripes
    ctx.fillStyle = '#166534';
    const sw = w / 6;
    for (let i = 0; i < 6; i += 2) {
      ctx.fillRect(i * sw, 0, sw, h);
    }

    // Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.beginPath();
    ctx.moveTo(w / 2, 6);
    ctx.lineTo(w / 2, h - 6);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.18, 0, Math.PI * 2);
    ctx.stroke();

    // Compute H and project sample positions onto mini pitch
    const H = computeHomographyMatrix(points, pitchType);
    if (H && samplePositions.length > 0) {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
      samplePositions.slice(0, 200).forEach((pos) => {
        const pt = projectPoint(H, pos.x, pos.y);
        if (pt && pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1) {
          const px = 6 + pt.x * (w - 12);
          const py = 6 + pt.y * (h - 12);
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }, [points, pitchType, samplePositions, viewMode]);

  // Pointer Drag Handlers
  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    draggingIdxRef.current = idx;
    setActivePointIdx(idx);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingIdxRef.current === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const idx = draggingIdxRef.current;
    setPoints((prev) => {
      const copy = [...prev];
      copy[idx] = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
      return copy;
    });
  }, []);

  const handlePointerUp = (e: React.PointerEvent) => {
    draggingIdxRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Fine Nudge Handlers
  const nudge = (dx: number, dy: number) => {
    setPoints((prev) => {
      const copy = [...prev];
      const cur = copy[activePointIdx];
      copy[activePointIdx] = {
        x: Math.max(0, Math.min(1, Math.round((cur.x + dx) * 1000) / 1000)),
        y: Math.max(0, Math.min(1, Math.round((cur.y + dy) * 1000) / 1000)),
      };
      return copy;
    });
  };

  // Save Calibration
  const handleSave = async () => {
    setSaving(true);
    try {
      const H = computeHomographyMatrix(points, pitchType);
      const res = await saveFieldCalibration(matchId, {
        src_points: points,
        pitch_type: pitchType,
        homography_matrix: H ? Array.from(H) : undefined
      });

      toast.success(res?.message || 'Spielfeld-Kalibrierung erfolgreich gespeichert!');
      if (onSaved) onSaved(res?.field_calibration || { src_points: points, pitch_type: pitchType });
      onClose();
    } catch (err: any) {
      console.error('Fehler beim Speichern der Kalibrierung:', err);
      toast.error('Fehler beim Speichern der Spielfeld-Kalibrierung');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shadow-inner">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Spielfeld-Kalibrierung</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  4-Ecken-Homographie
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Punkte im Video an die Spielfeldkanten anpassen, um die 2D-Vogelperspektive zu berechnen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setViewMode('calibrate')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'calibrate' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Eckpunkte
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview_split')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'preview_split' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Split-Vorschau</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col lg:flex-row gap-5 min-h-0">
          {/* Main Visual Calibration Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Interactive Image Canvas Container */}
            <div
              ref={containerRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 select-none touch-none shadow-2xl flex items-center justify-center cursor-crosshair group"
            >
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewImage}
                  alt="Video Standbild"
                  className="w-full h-full object-cover pointer-events-none select-none"
                  draggable={false}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-500 gap-2">
                  <div className="w-6 h-6 border-2 border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
                  <span className="text-xs">Lade Videobild...</span>
                </div>
              )}

              {/* Polygon Outline & Fill */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <polygon
                  points={points.map((p) => `${p.x * 100}%,${p.y * 100}%`).join(' ')}
                  fill="rgba(16, 185, 129, 0.15)"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                {/* Diagonal Guidelines */}
                <line
                  x1={`${points[0].x * 100}%`}
                  y1={`${points[0].y * 100}%`}
                  x2={`${points[2].x * 100}%`}
                  y2={`${points[2].y * 100}%`}
                  stroke="rgba(255,255,255,0.25)"
                  strokeDasharray="3 3"
                />
                <line
                  x1={`${points[1].x * 100}%`}
                  y1={`${points[1].y * 100}%`}
                  x2={`${points[3].x * 100}%`}
                  y2={`${points[3].y * 100}%`}
                  stroke="rgba(255,255,255,0.25)"
                  strokeDasharray="3 3"
                />
              </svg>

              {/* Draggable Corner Handles */}
              {points.map((pt, idx) => {
                const corner = CORNER_NAMES[idx];
                const isActive = activePointIdx === idx;
                return (
                  <div
                    key={idx}
                    onPointerDown={(e) => handlePointerDown(idx, e)}
                    style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing p-2 group/handle`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-black shadow-2xl transition-transform border-2 ${
                        corner.color
                      } ${isActive ? 'scale-125 ring-4 ring-white/30' : 'hover:scale-110'}`}
                    >
                      {idx + 1}
                    </div>

                    {/* Tooltip Label */}
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-950/95 border border-zinc-700/80 px-2 py-0.5 rounded text-[10px] font-mono text-white opacity-0 group-hover/handle:opacity-100 transition-opacity pointer-events-none shadow-lg">
                      {corner.label} ({Math.round(pt.x * 100)}%, {Math.round(pt.y * 100)}%)
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hint Under Visualizer */}
            <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
                Ziehe die 4 farbigen Punkte exakt auf die Spielfeldecken (oder Mittellinie).
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                Aktiv: <strong className="text-emerald-400">{CORNER_NAMES[activePointIdx].label}</strong>
              </span>
            </div>
          </div>

          {/* Sidebar Controls & Presets */}
          <div className="w-full lg:w-80 flex flex-col space-y-4 shrink-0">
            {/* Split Preview Mini-Pitch (When active) */}
            {viewMode === 'preview_split' && (
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    2D-Spielfeld Vorschau
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Live-Projektion</span>
                </div>
                <div className="relative aspect-[105/68] w-full rounded-lg overflow-hidden border border-zinc-800 shadow-inner">
                  <canvas ref={miniPitchRef} width={280} height={180} className="w-full h-full block" />
                </div>
              </div>
            )}

            {/* Presets Selector */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Perspektiven-Vorlagen
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPoints(preset.points);
                      setPitchType(preset.pitch_type);
                    }}
                    className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-left border border-zinc-700/60 hover:border-zinc-600 transition-all text-xs text-zinc-300"
                  >
                    <div className="font-bold truncate text-[11px]">{preset.label.split('(')[0]}</div>
                    <div className="text-[9px] text-zinc-500 truncate">{preset.label.split('(')[1]?.replace(')', '') || 'Vorlage'}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Point Fine-Tuning */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Feinjustierung
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  P{activePointIdx + 1}: X {Math.round(points[activePointIdx].x * 100)}% • Y {Math.round(points[activePointIdx].y * 100)}%
                </span>
              </div>

              {/* Point Selection Tabs */}
              <div className="grid grid-cols-4 gap-1">
                {CORNER_NAMES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActivePointIdx(c.id)}
                    className={`py-1.5 rounded-lg border text-xs font-black transition-all ${
                      activePointIdx === c.id
                        ? 'bg-zinc-800 text-white border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                        : 'bg-zinc-900/80 text-zinc-500 border-zinc-800 hover:text-white'
                    }`}
                  >
                    P{c.id + 1}
                  </button>
                ))}
              </div>

              {/* Micro-Adjustment D-Pad */}
              <div className="flex flex-col items-center justify-center gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => nudge(0, -0.005)}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 active:scale-95 transition-transform"
                  title="0.5% nach oben"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => nudge(-0.005, 0)}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 active:scale-95 transition-transform"
                    title="0.5% nach links"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-7 h-7 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-500">
                    ±.5
                  </div>
                  <button
                    type="button"
                    onClick={() => nudge(0.005, 0)}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 active:scale-95 transition-transform"
                    title="0.5% nach rechts"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => nudge(0, 0.005)}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 active:scale-95 transition-transform"
                  title="0.5% nach unten"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                setPoints(DEFAULT_POINTS);
                setPitchType('full');
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Standard-Trapez zurücksetzen</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Abbrechen
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Kalibrierung speichern</span>
          </button>
        </div>
      </div>
    </div>
  );
}
