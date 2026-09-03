"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Sliders, Target, Check, RefreshCcw, Loader2 } from 'lucide-react';
import { getMatchPreview, correctFisheye } from '@/services/api';
import FisheyeWebGLPreview from './FisheyeWebGLPreview';
import AlertDialog from './AlertDialog';


interface FisheyeCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
}

export default function FisheyeCorrectionModal({ isOpen, onClose, matchId }: FisheyeCorrectionModalProps) {
  const [method, setMethod] = useState<'slider' | 'corners'>('slider');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Slider Params
  const [k1, setK1] = useState(0);
  const [k2, setK2] = useState(0);
  
  // Corner Params
  const [points, setPoints] = useState<{ x: number, y: number }[]>([]);
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

  const renderCanvasOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageElement;
    if (!canvas || !img || method !== 'corners') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 450;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Draw points and lines
    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.lineWidth = 2;

    points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "bold 12px Inter";
        ctx.fillText((i + 1).toString(), p.x * canvas.width + 10, p.y * canvas.height - 10);
    });

    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
        }
        if (points.length === 4) {
            ctx.closePath();
        }
        ctx.stroke();
    }
  }, [method, points, imageElement]);

  useEffect(() => {
    if (method === 'corners') {
        renderCanvasOverlay();
    }
  }, [renderCanvasOverlay, method]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (method !== 'corners' || points.length >= 4) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setPoints([...points, { x, y }]);
  };

  const handleApply = async () => {
    setProcessing(true);
    try {
      const params = method === 'slider' 
        ? { method, k1, k2 } 
        : { method, points };
      
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
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 p-6">
          <div>
            <h2 className="text-xl font-bold text-white">Fisheye-Videokorrektur</h2>
            <p className="text-sm text-zinc-400">Passe das Video an, um Verzerrungen zu entfernen.</p>
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
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-zinc-500">Lade Vorschau...</p>
              </div>
            ) : (
              <div className="relative group cursor-crosshair">
                {method === 'slider' && imageElement ? (
                   <FisheyeWebGLPreview 
                     image={imageElement}
                     k1={k1}
                     k2={k2}
                     width={800}
                     height={450}
                   />
                ) : (
                  <canvas 
                    ref={canvasRef} 
                    onClick={handleCanvasClick}
                    className="h-auto max-w-full rounded-xl border border-zinc-800 shadow-lg"
                  />
                )}
                {method === 'corners' && points.length < 4 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-primary/90 px-4 py-2 text-xs font-bold text-white shadow-xl">
                      Klicke auf die 4 Ecken des Spielfelds ({points.length}/4)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rechte Seite: Controls */}
          <div className="w-full overflow-y-auto border-zinc-800 p-8 space-y-8 lg:w-80 lg:border-l">
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
                  method === 'corners' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Target className="h-4 w-4" />
                4-Ecken
              </button>
            </div>

            {method === 'slider' ? (
              <div className="space-y-6">
                <div className="space-y-3">
                    <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Krümmung k1 <span className="text-zinc-300">{k1.toFixed(2)}</span>
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
                        Krümmung k2 <span className="text-zinc-300">{k2.toFixed(2)}</span>
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
                    Bewege die Regler, um die Live-Vorschau der Korrektur zu sehen.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                    {points.map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm">
                            <span className="font-bold text-zinc-300">Punkt {i+1}</span>
                            <span className="text-zinc-500">x: {p.x.toFixed(3)}, y: {p.y.toFixed(3)}</span>
                        </div>
                    ))}
                    {points.length === 0 && (
                        <div className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm font-medium text-zinc-500">
                            Noch keine Punkte gesetzt
                        </div>
                    )}
                </div>
                <button 
                    onClick={() => setPoints([])}
                    disabled={points.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 px-5 py-3 text-sm font-bold text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCcw className="h-4 w-4" />
                    Punkte zurücksetzen
                </button>
              </div>
            )}
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
            disabled={processing || (method === 'corners' && points.length < 4)}
            className="flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verarbeite...
                </>
            ) : (
                <>
                    <Check className="h-4 w-4" />
                    Video korrigieren
                </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
