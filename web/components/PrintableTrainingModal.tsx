"use client";

import { useRef } from 'react';
import { Printer, Download, X } from 'lucide-react';
import { getMediaUrl } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

interface PrintableTrainingModalProps {
  session: any;
  exercisesList?: any[];
  onClose: () => void;
}

export default function PrintableTrainingModal({
  session,
  exercisesList = [],
  onClose
}: PrintableTrainingModalProps) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  if (!session) return null;

  // Group exercises by section
  const grouped: { [key: string]: any[] } = {};
  (session.exercises || []).forEach((exItem: any) => {
    const sec = exItem.section_name || 'Hauptteil';
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push(exItem);
  });

  // Calculate total duration
  const totalDuration = (session.exercises || []).reduce((acc: number, item: any) => {
    const exDetail = exercisesList.find(x => x.id === item.exercise_id) || item.exercise;
    return acc + (exDetail?.duration_minutes || 15);
  }, 0);

  const handleNativePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0,
        filename: `${(session.title || 'Trainingsplan').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, windowWidth: 1000, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      await html2pdf().from(printRef.current).set(opt).save();
    } catch (err) {
      console.error('PDF Export Error:', err);
      toast.error('Fehler beim PDF Export. Bitte nutze den "Drucken / PDF speichern" Button.');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/90 p-4 sm:p-6 backdrop-blur-md overflow-y-auto">
      {/* Print styles */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 5mm;
        }
        @media print {
          html, body {
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-training-plan-area, #printable-training-plan-area * {
            visibility: visible !important;
          }
          #printable-training-plan-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: 285mm !important;
            margin: 0 !important;
            padding: 12px 16px !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Top Action Bar (hidden on print) */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-4 shrink-0 shadow-2xl print:hidden">
        <div>
          <h3 className="text-base font-bold text-white">Druckvorschau & PDF Export (1x A4 Seite)</h3>
          <p className="text-xs text-zinc-400">Kompakt skaliertes Layout für exakt 1 DIN A4 Blatt</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleNativePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
          >
            <Printer className="w-4 h-4" /> Drucken / PDF speichern
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all"
          >
            <Download className="w-4 h-4" /> PDF Herunterladen
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all text-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet View */}
      <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto pb-6">
        <div
          id="printable-training-plan-area"
          ref={printRef}
          className="bg-white text-slate-900 p-6 rounded-xl shadow-2xl border border-slate-200 text-left font-sans space-y-4 w-[210mm] max-w-[210mm] min-h-[297mm] mx-auto box-border border-t-4 border-t-emerald-500"
        >
          {/* Header */}
          <div className="border-b-2 border-slate-200 pb-3 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 m-0 leading-tight">{session.title}</h1>
              <div className="text-[11px] font-bold text-slate-600 mt-1 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {session.age_group || 'Alle'}
                </span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  Struktur: {session.methodology || 'Standard'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold border-2 border-emerald-500 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg inline-block shadow-sm">
                Gesamtdauer: {totalDuration} Min.
              </span>
            </div>
          </div>

          {/* Body Sections */}
          <div className="space-y-4">
            {Object.entries(grouped).map(([secName, exList]) => {
              const secDuration = exList.reduce((acc, item) => {
                const exDetail = exercisesList.find(x => x.id === item.exercise_id) || item.exercise;
                return acc + (exDetail?.duration_minutes || 15);
              }, 0);

              return (
                <div key={secName} className="space-y-2 break-inside-avoid">
                  {/* Section Title */}
                  <div className="bg-emerald-50/90 border border-emerald-200 border-l-4 border-l-emerald-600 px-3 py-1 flex items-center justify-between rounded-r-md">
                    <h2 className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider m-0">
                      {secName}
                    </h2>
                    <span className="text-[11px] font-bold text-emerald-800">{secDuration} Min.</span>
                  </div>

                  {/* Exercises in section */}
                  <div className="space-y-2">
                    {exList.map((exItem: any, idx: number) => {
                      const exDetail = exercisesList.find(x => x.id === exItem.exercise_id) || exItem.exercise || {};
                      const title = exDetail.title || exItem.title || 'Übung';
                      const focus = exDetail.focus_area || exItem.focus_area || '';
                      const duration = exDetail.duration_minutes || exItem.duration_minutes || 15;
                      const minPlayers = exDetail.min_players || 4;
                      const maxPlayers = exDetail.max_players || 12;
                      const coaching = exDetail.coaching_points || '';
                      const description = exDetail.description || '';
                      const thumbnail = exDetail.thumbnail_path || exItem.thumbnail_path || '';

                      const imageSrc = thumbnail
                        ? (thumbnail.startsWith('data:') || thumbnail.startsWith('http') ? thumbnail : getMediaUrl(thumbnail))
                        : null;

                      return (
                        <div key={exItem.id || idx} className="border border-slate-200 rounded-lg p-2.5 bg-white shadow-sm space-y-1.5 break-inside-avoid">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                            <h3 className="text-xs font-bold text-slate-900 m-0">
                              {idx + 1}. {title}
                            </h3>
                            <div className="text-[10px] font-bold text-slate-600 space-x-2">
                              {focus && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  {focus}
                                </span>
                              )}
                              <span className="text-slate-700">• {duration} Min.</span>
                              <span className="text-slate-700">• {minPlayers}-{maxPlayers} Spieler</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="flex-1 text-[10px] text-slate-800 leading-snug space-y-1">
                              {description && (
                                <div>
                                  <strong className="text-slate-900">Ablauf: </strong>
                                  <span>{description}</span>
                                </div>
                              )}
                              {coaching && (
                                <div>
                                  <strong className="text-emerald-700">Coaching-Punkte: </strong>
                                  <span className="text-slate-800">{coaching}</span>
                                </div>
                              )}
                            </div>

                            {imageSrc && (
                              <div className="w-36 shrink-0 text-center border border-slate-300 rounded-md overflow-hidden bg-white p-0.5 shadow-sm">
                                <img
                                  src={imageSrc}
                                  alt={title}
                                  crossOrigin="anonymous"
                                  className="w-full h-auto max-h-24 object-contain mx-auto block"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-2 text-center text-[9px] font-medium text-slate-400">
            MatchTrack Online • Trainingsplan Export • {new Date().toLocaleDateString('de-DE')}
          </div>
        </div>
      </div>
    </div>
  );
}
