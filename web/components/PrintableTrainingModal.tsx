"use client";

import { useRef, useState } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Clock, 
  Users, 
  Shield, 
  CheckCircle2, 
  Layers, 
  Loader2,
  Bookmark,
  Sparkles,
  Dumbbell
} from 'lucide-react';
import { getMediaUrl } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

interface PrintableTrainingModalProps {
  session?: any;
  exercise?: any;
  exercisesList?: any[];
  onClose: () => void;
}

export default function PrintableTrainingModal({
  session,
  exercise,
  exercisesList = [],
  onClose
}: PrintableTrainingModalProps) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Determine if single exercise mode or full session mode
  const isSingleExercise = !!exercise && !session;
  const currentItem = session || exercise;

  if (!currentItem) return null;

  // Group exercises by section (for session mode)
  const grouped: { [key: string]: any[] } = {};
  if (session) {
    (session.exercises || []).forEach((exItem: any) => {
      const sec = exItem.section_name || 'Hauptteil';
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(exItem);
    });
  }

  // Calculate total duration (for session mode)
  const totalDuration = session
    ? (session.exercises || []).reduce((acc: number, item: any) => {
        const exDetail = exercisesList.find(x => x.id === item.exercise_id) || item.exercise;
        return acc + (item.duration_override || exDetail?.duration_minutes || 15);
      }, 0)
    : (exercise?.duration_minutes || 15);

  // Collect aggregated materials from all exercises
  const aggregatedMaterials: string[] = [];
  if (session) {
    (session.exercises || []).forEach((exItem: any) => {
      const exDetail = exercisesList.find(x => x.id === exItem.exercise_id) || exItem.exercise;
      if (exDetail?.materials && Array.isArray(exDetail.materials)) {
        exDetail.materials.forEach((m: string) => {
          if (m && !aggregatedMaterials.includes(m.trim())) {
            aggregatedMaterials.push(m.trim());
          }
        });
      }
    });
  } else if (exercise?.materials && Array.isArray(exercise.materials)) {
    exercise.materials.forEach((m: string) => {
      if (m && !aggregatedMaterials.includes(m.trim())) {
        aggregatedMaterials.push(m.trim());
      }
    });
  }

  const handleNativePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const titleStr = isSingleExercise ? (exercise.title || 'Uebung') : (session.title || 'Trainingsplan');
      const safeFilename = `${titleStr.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      const opt = {
        margin: [6, 6, 6, 6] as [number, number, number, number],
        filename: safeFilename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          allowTaint: true, 
          backgroundColor: '#ffffff',
          logging: false
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().from(printRef.current).set(opt).save();
      toast.success('PDF erfolgreich erstellt & heruntergeladen');
    } catch (err) {
      console.error('PDF Export Error:', err);
      toast.error('Fehler beim automatischen PDF-Download. Bitte nutze "Drucken / Als PDF speichern".');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/85 p-3 sm:p-6 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Print Stylesheet */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          html, body {
            height: auto !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
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
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Action Bar (hidden in Print) */}
      <div className="w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-4 shrink-0 shadow-2xl print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white">
              {isSingleExercise ? 'Übungs-Karte Druckvorschau' : 'Trainingsplan DIN A4 Export'}
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              A4 Hochformat
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Optimiert für den Ausdruck auf dem Platz oder als digitales PDF
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleNativePrint}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
            title="Öffnet das Druckmenü des Browsers (Speichern als PDF oder Direktdruck)"
          >
            <Printer className="w-4 h-4" />
            <span>Drucken / Als PDF speichern</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50"
            title="Erstellt die PDF-Datei direkt im Browser"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Erstelle PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>PDF Download</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet View Container */}
      <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto pb-8 print:p-0 print:m-0 print:overflow-visible">
        <div
          id="printable-training-plan-area"
          ref={printRef}
          className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-2xl border border-slate-300 text-left font-sans space-y-4 w-full max-w-[210mm] mx-auto box-border border-t-8 border-t-emerald-600 print:border-none print:shadow-none print:p-0 print:rounded-none"
        >
          {/* ============================================================ */}
          {/* MODE A: FULL TRAINING PLAN SESSION */}
          {/* ============================================================ */}
          {!isSingleExercise && session && (
            <>
              {/* Header Banner */}
              <div className="border-b-2 border-slate-300 pb-3.5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black tracking-widest text-emerald-700 uppercase bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded">
                      MatchTrack Online • Trainingsplan
                    </span>
                    {session.date && (
                      <span className="text-[11px] font-semibold text-slate-500">
                        Datum: {new Date(session.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-black text-slate-950 m-0 leading-tight">
                    {session.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-0.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold">
                      {session.age_group || 'Alle Altersklassen'}
                    </span>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                      Modell: {session.methodology || 'Trainingsphilosophie Deutschland'}
                    </span>
                    {session.team?.name && (
                      <>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold">
                          {session.team.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-flex flex-col items-end">
                    <span className="text-sm font-black border-2 border-emerald-600 bg-emerald-50 text-emerald-900 px-3 py-1 rounded-lg shadow-sm">
                      ⏱️ {totalDuration} Minuten
                    </span>
                    {session.target_duration_minutes && session.target_duration_minutes !== totalDuration && (
                      <span className="text-[10px] text-slate-500 mt-1 font-medium">
                        Zielzeit: {session.target_duration_minutes} Min.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary / Notes & Material Checklist Card */}
              {(session.notes || aggregatedMaterials.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 print-avoid-break">
                  {session.notes && (
                    <div className={aggregatedMaterials.length > 0 ? "sm:col-span-7 space-y-1" : "sm:col-span-12 space-y-1"}>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                        <Bookmark className="w-3 h-3 text-emerald-600" /> Trainingsschwerpunkt & Bemerkungen
                      </span>
                      <p className="text-[11px] text-slate-700 leading-snug whitespace-pre-line m-0">
                        {session.notes}
                      </p>
                    </div>
                  )}

                  {aggregatedMaterials.length > 0 && (
                    <div className={session.notes ? "sm:col-span-5 space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3" : "sm:col-span-12 space-y-1"}>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                        <Dumbbell className="w-3 h-3 text-emerald-600" /> Benötigtes Material (Packliste)
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {aggregatedMaterials.map((mat, i) => (
                          <span key={i} className="text-[10px] font-bold bg-white border border-slate-300 text-slate-800 px-1.5 py-0.5 rounded shadow-2xs">
                            ✓ {mat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Training Sections & Exercises */}
              <div className="space-y-4 pt-1">
                {Object.entries(grouped).map(([secName, exList]) => {
                  const secDuration = exList.reduce((acc, item) => {
                    const exDetail = exercisesList.find(x => x.id === item.exercise_id) || item.exercise;
                    return acc + (item.duration_override || exDetail?.duration_minutes || 15);
                  }, 0);

                  return (
                    <div key={secName} className="space-y-2.5">
                      {/* Section Title Banner */}
                      <div className="bg-emerald-800 text-white px-3 py-1.5 rounded-lg flex items-center justify-between shadow-xs print-avoid-break">
                        <h2 className="text-xs font-black uppercase tracking-wider m-0 flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-emerald-300" />
                          <span>{secName}</span>
                        </h2>
                        <span className="text-xs font-bold text-emerald-200">
                          {secDuration} Minuten
                        </span>
                      </div>

                      {/* Exercise Cards */}
                      <div className="space-y-3">
                        {exList.map((exItem: any, idx: number) => {
                          const exDetail = exercisesList.find(x => x.id === exItem.exercise_id) || exItem.exercise || {};
                          const title = exDetail.title || exItem.title || 'Übung';
                          const focus = exDetail.focus_area || exItem.focus_area || '';
                          const duration = exItem.duration_override || exDetail.duration_minutes || exItem.duration_minutes || 15;
                          const minPlayers = exDetail.min_players || 4;
                          const maxPlayers = exDetail.max_players || 12;
                          const coaching = exDetail.coaching_points || '';
                          const description = exDetail.description || '';
                          const thumbnail = exDetail.thumbnail_path || exItem.thumbnail_path || '';
                          const materials = exDetail.materials || [];

                          const imageSrc = thumbnail
                            ? (thumbnail.startsWith('data:') || thumbnail.startsWith('http') ? thumbnail : getMediaUrl(thumbnail))
                            : null;

                          return (
                            <div 
                              key={exItem.id || idx} 
                              className="border border-slate-300 rounded-xl p-3 bg-white shadow-xs space-y-2 print-avoid-break hover:border-slate-400 transition-colors"
                            >
                              {/* Exercise Header */}
                              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <h3 className="text-xs font-bold text-slate-900 m-0">
                                    {title}
                                  </h3>
                                </div>

                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                                  {focus && (
                                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black">
                                      {focus}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1 text-slate-700">
                                    <Clock className="w-3 h-3 text-slate-500" /> {duration} Min.
                                  </span>
                                  <span className="flex items-center gap-1 text-slate-700">
                                    <Users className="w-3 h-3 text-slate-500" /> {minPlayers}-{maxPlayers} Spieler
                                  </span>
                                </div>
                              </div>

                              {/* Content: Left Text details / Right Diagram */}
                              <div className="flex flex-col sm:flex-row items-start gap-3.5">
                                <div className="flex-1 text-[11px] text-slate-800 leading-normal space-y-2">
                                  {description && (
                                    <div>
                                      <strong className="text-slate-900 block font-bold mb-0.5">Ablauf & Organisation:</strong>
                                      <p className="text-slate-700 m-0 whitespace-pre-line leading-relaxed">
                                        {description}
                                      </p>
                                    </div>
                                  )}

                                  {coaching && (
                                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-2 text-slate-900">
                                      <strong className="text-emerald-900 font-bold block mb-0.5 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Coaching-Punkte:
                                      </strong>
                                      <p className="text-slate-800 m-0 whitespace-pre-line text-[10.5px]">
                                        {coaching}
                                      </p>
                                    </div>
                                  )}

                                  {materials && Array.isArray(materials) && materials.length > 0 && (
                                    <div className="text-[10px] text-slate-500">
                                      <strong className="text-slate-700">Material: </strong>
                                      <span>{materials.join(', ')}</span>
                                    </div>
                                  )}
                                </div>

                                {imageSrc && (
                                  <div className="w-full sm:w-56 shrink-0 border border-slate-300 rounded-lg overflow-hidden bg-white p-1 shadow-2xs text-center">
                                    <img
                                      src={imageSrc}
                                      alt={title}
                                      crossOrigin="anonymous"
                                      className="w-full h-auto max-h-40 object-contain mx-auto block"
                                    />
                                    <span className="text-[9px] font-bold text-slate-400 block mt-1 tracking-wider uppercase">
                                      FT-Graphics Taktik-Skizze
                                    </span>
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

              {/* Hand-written Trainer Notes on Pitch Box */}
              <div className="border border-dashed border-slate-300 rounded-xl p-3.5 space-y-2 print-avoid-break bg-slate-50/60 mt-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  ✍️ Notizen & Beobachtungen auf dem Platz (Für Nachbesprechung & nächste Einheit)
                </span>
                <div className="space-y-2.5 pt-1">
                  <div className="border-b border-slate-300 h-4"></div>
                  <div className="border-b border-slate-300 h-4"></div>
                  <div className="border-b border-slate-300 h-4"></div>
                </div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* MODE B: SINGLE EXERCISE PRINT */}
          {/* ============================================================ */}
          {isSingleExercise && exercise && (
            <div className="space-y-4">
              {/* Header */}
              <div className="border-b-2 border-slate-300 pb-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest text-emerald-700 uppercase bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded">
                    MatchTrack Online • Wissensdatenbank
                  </span>
                  <h1 className="text-2xl font-black text-slate-950 m-0">
                    {exercise.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-0.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold">
                      {exercise.age_group || 'Alle Altersklassen'}
                    </span>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold">
                      {exercise.focus_area || 'Allgemein'}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <div className="text-xs font-black border-2 border-emerald-600 bg-emerald-50 text-emerald-900 px-3 py-1 rounded-lg">
                    ⏱️ {exercise.duration_minutes || 15} Minuten
                  </div>
                  <div className="text-[11px] font-bold text-slate-600">
                    👥 {exercise.min_players || 4} bis {exercise.max_players || 12} Spieler
                  </div>
                </div>
              </div>

              {/* Large Central Sketch */}
              {exercise.thumbnail_path && (
                <div className="border border-slate-300 rounded-xl overflow-hidden bg-white p-2 shadow-xs text-center print-avoid-break">
                  <img
                    src={exercise.thumbnail_path.startsWith('data:') || exercise.thumbnail_path.startsWith('http') ? exercise.thumbnail_path : getMediaUrl(exercise.thumbnail_path)}
                    alt={exercise.title}
                    crossOrigin="anonymous"
                    className="w-full h-auto max-h-72 object-contain mx-auto block"
                  />
                  <span className="text-[10px] font-bold text-slate-400 block mt-1 tracking-wider uppercase">
                    FT-Graphics Taktik-Skizze
                  </span>
                </div>
              )}

              {/* Materials */}
              {exercise.materials && Array.isArray(exercise.materials) && exercise.materials.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 print-avoid-break">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1">
                    <Dumbbell className="w-3 h-3 text-emerald-600" /> Benötigtes Material
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {exercise.materials.map((m: string, idx: number) => (
                      <span key={idx} className="text-xs font-bold bg-white border border-slate-300 text-slate-800 px-2 py-0.5 rounded shadow-2xs">
                        ✓ {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content sections */}
              <div className="space-y-3">
                {exercise.description && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-white print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-1.5">
                      Ablauf & Spielregeln
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line m-0">
                      {exercise.description}
                    </p>
                  </div>
                )}

                {exercise.coaching_points && (
                  <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-4 print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950 mb-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Coaching-Punkte & Schwerpunkte
                    </h3>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line m-0">
                      {exercise.coaching_points}
                    </p>
                  </div>
                )}
              </div>

              {/* Handwritten space */}
              <div className="border border-dashed border-slate-300 rounded-xl p-3.5 space-y-2 print-avoid-break bg-slate-50/60 mt-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  ✍️ Eigene Trainingsnotizen / Variationen
                </span>
                <div className="space-y-2.5 pt-1">
                  <div className="border-b border-slate-300 h-4"></div>
                  <div className="border-b border-slate-300 h-4"></div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-200 pt-3 text-center text-[10px] font-medium text-slate-400 flex items-center justify-between">
            <span>MatchTrack Online • Digitale Trainingsplattform</span>
            <span>Erstellt am: {new Date().toLocaleDateString('de-DE')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
