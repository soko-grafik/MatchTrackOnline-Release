"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Sliders, Target, Check, RefreshCcw, Loader2, Eye, Edit3, 
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles 
} from 'lucide-react';
import { getMatchPreview, correctFisheye } from '@/services/api';
import FisheyeWebGLPreview from './FisheyeWebGLPreview';
import AlertDialog from './AlertDialog';

interface FisheyeCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
}

const POINT_LABELS = [
  "1: Oben-Links",
  "2: Oben-Rechts",
  "3: Unten-Rechts",
  "4: Unten-Links"
];

export default function FisheyeCorrectionModal({ isOpen, onClose, matchId }: FisheyeCorrectionModalProps) {
  const [method, setMethod] = useState<'slider' | 'corners'>('slider');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Slider Params
  const [k1, setK1] = useState(0);
  const [k2, setK2] = useState(0);
  
  // Crop & Edge Params
  const [autoCrop, setAutoCrop] = useState(true);
  const [cropPercent, setCropPercent] = useState(0);
  
  // Corner Params
  const [points, setPoints] = useState<{ x: number, y: number }[]>([]);
  const [cornersViewMode, setCornersViewMode] = useState<'edit' | 'preview'>('edit');
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type?: 'info' | 'success' | 'warning' | 'error'; title?: string }>({
    isOpen: false,
    message: '',
    type: 'info'
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen && matchId) {
      fetchPreview();
    }
  }, [isOpen, matchId]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const res = await getMatchPreview(matchId);
      if (res.image) {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${res.image}`;
        img.onload = () => {
          setImageElement(img);
        };
      }
    } catch (err) {
      console.error("Failed to fetch preview:", err);
    } finally {
      setLoading(false);
    }
  };

  // Standard-Spielfeld Trapez setzen
  const handleSetDefaultCorners = () => {
    setPoints([
      { x: 0.12, y: 0.18 }, // Oben-Links
      { x: 0.88, y: 0.18 }, // Oben-Rechts
      { x: 0.95, y: 0.88 }, // Unten-Rechts
      { x: 0.05, y: 0.88 }  // Unten-Links
    ]);
  };

  // Nudge point by delta
  const nudgePoint = (index: number, dx: number, dy: number) => {
    setPoints(prev => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      copy[index] = {
        x: Math.max(0, Math.min(1, copy[index].x + dx)),
        y: Math.max(0, Math.min(1, copy[index].y + dy))
      };
      return copy;
    });
  };

  // Canvas Overlay zeichnen (Punkte, Linien, Handles)
  const renderCanvasOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageElement;
    if (!canvas || !img || method !== 'corners' || cornersViewMode !== 'edit') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 450;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Polygon-Füllung und Verbindungs-Linien
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
      }
      if (points.length === 4) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
        ctx.fill();

        // Diagonale Hilfslinien (Zentrums-Ausrichtung)
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
        ctx.lineTo(points[2].x * canvas.width, points[2].y * canvas.height);
        ctx.moveTo(points[1].x * canvas.width, points[1].y * canvas.height);
        ctx.lineTo(points[3].x * canvas.width, points[3].y * canvas.height);
        ctx.stroke();
        ctx.restore();
      }

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Interaktive Eckpunkte zeichnen
    points.forEach((p, i) => {
      const px = p.x * canvas.width;
      const py = p.y * canvas.height;
      const isHovered = hoveredPointIndex === i;
      const isDragged = draggedPointIndex === i;

      // Äußerer Leucht-Ring
      ctx.beginPath();
      ctx.arc(px, py, isDragged ? 16 : isHovered ? 14 : 11, 0, Math.PI * 2);
      ctx.fillStyle = isDragged ? 'rgba(59, 130, 246, 0.5)' : isHovered ? 'rgba(96, 165, 250, 0.4)' : 'rgba(59, 130, 246, 0.25)';
      ctx.fill();
      ctx.strokeStyle = isDragged ? '#60a5fa' : '#3b82f6';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Innerer solider Punkt
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Label-Badge neben Punkt
      const label = POINT_LABELS[i] || `Punkt ${i + 1}`;
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      const textWidth = ctx.measureText(label).width;

      const badgeX = px + 12;
      const badgeY = py - 18;

      ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX - 4, badgeY - 12, textWidth + 8, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#60a5fa';
      ctx.fillText(label, badgeX, badgeY);
    });
  }, [method, points, imageElement, cornersViewMode, hoveredPointIndex, draggedPointIndex]);

  useEffect(() => {
    if (method === 'corners' && cornersViewMode === 'edit') {
      renderCanvasOverlay();
    }
  }, [renderCanvasOverlay, method, cornersViewMode]);

  // Maus- & Touch-Koordinaten extrahieren
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y, px: x * canvas.width, py: y * canvas.height };
  };

  const findHitPoint = (coords: { px: number, py: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const hitRadius = 24; // Pixel-Toleranz zum Greifen
    for (let i = 0; i < points.length; i++) {
      const px = points[i].x * canvas.width;
      const py = points[i].y * canvas.height;
      const dist = Math.hypot(coords.px - px, coords.py - py);
      if (dist <= hitRadius) {
        return i;
      }
    }
    return -1;
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    if (method !== 'corners' || cornersViewMode !== 'edit') return;
    const coords = getCanvasCoords(clientX, clientY);
    if (!coords) return;

    const hitIdx = findHitPoint(coords);
    if (hitIdx !== -1) {
      setDraggedPointIndex(hitIdx);
    } else if (points.length < 4) {
      // Neuer Punkt setzen
      setPoints(prev => [...prev, { x: coords.x, y: coords.y }]);
    }
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (method !== 'corners' || cornersViewMode !== 'edit') return;
    const coords = getCanvasCoords(clientX, clientY);
    if (!coords) return;

    if (draggedPointIndex !== null) {
      setPoints(prev => {
        const copy = [...prev];
        copy[draggedPointIndex] = { x: coords.x, y: coords.y };
        return copy;
      });
    } else {
      const hitIdx = findHitPoint(coords);
      setHoveredPointIndex(hitIdx !== -1 ? hitIdx : null);
    }
  };

  const handlePointerUp = () => {
    setDraggedPointIndex(null);
  };

  // Zoom-Faktor für Entzerrung berechnen
  const currentZoomFactor = React.useMemo(() => {
    if (cropPercent > 0) {
      return 1.0 + (cropPercent / 100.0);
    }
    if (autoCrop && k1 < 0) {
      const fEdge = 1.0 + k1 * 1.0 + k2 * 1.0;
      if (fEdge > 0.01) {
        return Math.max(1.0, 1.0 / fEdge);
      }
    }
    return 1.0;
  }, [cropPercent, autoCrop, k1, k2]);

  const handleApply = async () => {
    setProcessing(true);
    try {
      const params = method === 'slider' 
        ? { method, k1, k2, auto_crop: autoCrop, crop_percent: cropPercent } 
        : { method, points, auto_crop: autoCrop, crop_percent: cropPercent };
      
      const res = await correctFisheye(matchId, params);
      setAlertConfig({ isOpen: true, message: res.message || "Korrektur gestartet", type: 'success', title: 'Fisheye Korrektur' });
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Failed to apply correction:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Starten der Korrektur", type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <AlertDialog 
        isOpen={alertConfig.isOpen} 
        onClose={() => setAlertConfig(prev => ({...prev, isOpen: false}))}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 p-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              <span>Fisheye-Videokorrektur & Entzerrung</span>
            </h2>
            <p className="text-sm text-zinc-400">Passe das Video interaktiv an, um Krümmungen und Verzerrungen zu entfernen.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Linke Seite: Vorschau & Canvas */}
          <div className="flex flex-col flex-1 items-center justify-center bg-black/40 p-6">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-zinc-500">Lade Video-Vorschauframe...</p>
              </div>
            ) : (
              <div className="relative flex flex-col items-center w-full max-w-[800px]">
                {/* Method 1: Slider WebGL Preview */}
                {method === 'slider' && imageElement && (
                  <FisheyeWebGLPreview 
                    image={imageElement}
                    method="slider"
                    k1={k1}
                    k2={k2}
                    zoomFactor={currentZoomFactor}
                    width={800}
                    height={450}
                  />
                )}

                {/* Method 2: Corners Interactive Canvas oder WebGL Unwarped Preview */}
                {method === 'corners' && (
                  <>
                    {cornersViewMode === 'edit' || points.length < 4 ? (
                      <div className="relative w-full">
                        <canvas 
                          ref={canvasRef} 
                          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
                          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
                          onMouseUp={handlePointerUp}
                          onMouseLeave={handlePointerUp}
                          onTouchStart={(e) => {
                            if (e.touches[0]) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                          }}
                          onTouchMove={(e) => {
                            if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
                          }}
                          onTouchEnd={handlePointerUp}
                          className={`w-full h-auto rounded-xl border border-zinc-800 shadow-xl ${
                            draggedPointIndex !== null ? 'cursor-grabbing' : hoveredPointIndex !== null ? 'cursor-grab' : 'cursor-crosshair'
                          }`}
                        />
                        {points.length < 4 && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <span className="rounded-full bg-blue-600/90 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md animate-pulse">
                              Klicke auf die 4 Ecken des Spielfelds ({points.length}/4)
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      imageElement && (
                        <div className="relative w-full">
                          <FisheyeWebGLPreview 
                            image={imageElement}
                            method="corners"
                            points={points}
                            zoomFactor={currentZoomFactor}
                            width={800}
                            height={450}
                          />
                          <div className="absolute top-3 left-3 pointer-events-none">
                            <span className="px-2.5 py-1 bg-black/70 border border-blue-500/30 rounded-lg text-[11px] font-bold text-blue-300 backdrop-blur-md shadow-lg flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5 text-blue-400" />
                              <span>Entzerrte Live-Vorschau (WebGL Homographie)</span>
                            </span>
                          </div>
                        </div>
                      )
                    )}

                    {/* View Mode Toggle unter dem Bild */}
                    {points.length === 4 && (
                      <div className="flex items-center justify-center gap-2 mt-4 bg-zinc-900/80 p-1.5 rounded-xl border border-zinc-800 backdrop-blur-md">
                        <button
                          onClick={() => setCornersViewMode('edit')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            cornersViewMode === 'edit'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Eckpunkte anpassen</span>
                        </button>
                        <button
                          onClick={() => setCornersViewMode('preview')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            cornersViewMode === 'preview'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Entzerrte Live-Vorschau</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Rechte Seite: Controls & Parameter */}
          <div className="w-full overflow-y-auto border-zinc-800 p-6 space-y-6 lg:w-96 lg:border-l">
            {/* Methode umschalten */}
            <div className="flex rounded-xl bg-zinc-900 p-1">
              <button
                onClick={() => setMethod('slider')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
                  method === 'slider' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sliders className="h-4 w-4" />
                Schieberegler
              </button>
              <button
                onClick={() => setMethod('corners')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
                  method === 'corners' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Target className="h-4 w-4" />
                4-Ecken Homographie
              </button>
            </div>

            {method === 'slider' ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Krümmung k1 <span className="text-zinc-300 font-mono">{k1.toFixed(3)}</span>
                  </label>
                  <input 
                    type="range" 
                    min="-0.5" max="0.5" step="0.001" 
                    value={k1} 
                    onChange={(e) => setK1(parseFloat(e.target.value))}
                    className="h-1.5 w-full appearance-none rounded-full bg-zinc-800 accent-primary"
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Krümmung k2 <span className="text-zinc-300 font-mono">{k2.toFixed(3)}</span>
                  </label>
                  <input 
                    type="range" 
                    min="-0.2" max="0.2" step="0.001" 
                    value={k2} 
                    onChange={(e) => setK2(parseFloat(e.target.value))}
                    className="h-1.5 w-full appearance-none rounded-full bg-zinc-800 accent-primary"
                  />
                </div>
                <p className="text-xs font-medium italic text-zinc-500">
                  Bewege die Schieberegler für eine kontinuierliche Live-Vorschau der Tonnen-Korrektur.
                </p>

                {/* Auto-Crop & Kanten-Zuschnitt */}
                <div className="pt-4 border-t border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Auto-Crop (Ränder entfernen)</span>
                      <span className="text-[10px] text-zinc-400 block">Schneidet schwarze Kanten automatisch ab</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoCrop} 
                        onChange={(e) => setAutoCrop(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Manueller Zuschnitt / Zoom <span className="text-zinc-300">{cropPercent}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="35" 
                      step="1" 
                      value={cropPercent} 
                      onChange={(e) => setCropPercent(parseInt(e.target.value, 10))}
                      className="h-1.5 w-full appearance-none rounded-full bg-zinc-800 accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>0% (Original)</span>
                      <span>Zoom: {currentZoomFactor.toFixed(2)}x</span>
                      <span>35% (Max)</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Schnell-Aktionen für 4 Ecken */}
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handleSetDefaultCorners}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-500/20"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Trapez vorladen</span>
                  </button>
                  <button 
                    onClick={() => {
                      setPoints([]);
                      setCornersViewMode('edit');
                    }}
                    disabled={points.length === 0}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    <span>Zurücksetzen</span>
                  </button>
                </div>

                <div className="text-[11px] text-zinc-400">
                  <p>
                    Verschiebe die 4 Punkte per Drag & Drop direkt im Bild oder passe sie mit den Feintuning-Tasten millimetergenau an.
                  </p>
                </div>

                {/* Feintuning-Karten für jeden Punkt */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {points.map((p, i) => (
                    <div 
                      key={i} 
                      className={`rounded-lg border p-2.5 transition-all text-xs ${
                        hoveredPointIndex === i || draggedPointIndex === i
                          ? 'border-blue-500 bg-blue-950/20 shadow-sm'
                          : 'border-zinc-800 bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-zinc-200">{POINT_LABELS[i]}</span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          X: {p.x.toFixed(3)} | Y: {p.y.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-800/80">
                        <span className="text-[10px] text-zinc-500 font-medium">Feinjustierung:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => nudgePoint(i, -0.005, 0)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                            title="Nach links verschieben"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => nudgePoint(i, 0.005, 0)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                            title="Nach rechts verschieben"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => nudgePoint(i, 0, -0.005)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                            title="Nach oben verschieben"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => nudgePoint(i, 0, 0.005)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                            title="Nach unten verschieben"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {points.length === 0 && (
                    <div className="rounded-xl border border-dashed border-zinc-800 py-6 text-center text-xs font-medium text-zinc-500">
                      Klicke ins Bild oder wähle "Trapez vorladen"
                    </div>
                  )}
                </div>

                {/* Kanten-Zuschnitt für Ecken */}
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Kanten-Zuschnitt / Rand-Zoom <span className="text-zinc-300">{cropPercent}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="35" 
                    step="1" 
                    value={cropPercent} 
                    onChange={(e) => setCropPercent(parseInt(e.target.value, 10))}
                    className="h-1.5 w-full appearance-none rounded-full bg-zinc-800 accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>0% (Voll)</span>
                    <span>Zoom: {currentZoomFactor.toFixed(2)}x</span>
                    <span>35% (Randlos)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/50 px-8 py-5">
          <button 
            onClick={onClose}
            className="rounded-lg px-6 py-2.5 text-sm font-bold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Abbrechen
          </button>
          <button 
            onClick={handleApply}
            disabled={processing || (method === 'corners' && points.length < 4)}
            className="flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verarbeite...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {method === 'corners' ? 'Perspektive entzerren' : 'Video korrigieren'}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
