"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Dumbbell,
  AlertCircle
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('printable-training-modal-open');
    return () => {
      document.body.classList.remove('printable-training-modal-open');
    };
  }, []);

  // Determine if single exercise mode or full session mode
  const isSingleExercise = !!exercise && !session;
  const currentItem = session || exercise;

  if (!currentItem || !mounted) return null;

  // Group exercises by section (for session mode)
  // Group exercises by section (for session mode)
  const grouped: { [key: string]: any[] } = {};
  if (session) {
    (session.exercises || []).forEach((exItem: any) => {
      const sec = exItem.section_name || 'Hauptteil';
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(exItem);
    });
  }

  // Priority ranking for pedagogical order:
  // 1. Aktivierung -> 2. Spielblock 1 -> 3. Zwischenblock (Übung) -> 4. Spielblock 2
  const getSectionRank = (name: string): number => {
    const lower = (name || '').toLowerCase().trim();
    if (lower.includes('aktivierung') || lower.includes('aufwärm')) return 1;
    if (lower.includes('spielblock 1') || lower.includes('spielblock1')) return 2;
    if (lower.includes('zwischenblock') || lower.includes('übung')) return 3;
    if (lower.includes('spielblock 2') || lower.includes('spielblock2')) return 4;
    if (lower.includes('hauptteil')) return 5;
    if (lower.includes('schlussteil') || lower.includes('abschluss')) return 6;
    if (lower.includes('auslauf')) return 7;
    return 10;
  };

  const formatSectionTitle = (name: string): string => {
    const lower = (name || '').toLowerCase().trim();
    if (lower.includes('aktivierung')) return '1. Aktivierung';
    if (lower.includes('spielblock 1') || lower.includes('spielblock1')) return '2. Spielblock 1';
    if (lower.includes('zwischenblock') || lower.includes('übung')) return '3. Zwischenblock (Übung)';
    if (lower.includes('spielblock 2') || lower.includes('spielblock2')) return '4. Spielblock 2';
    return name;
  };

  // Sorted list of sections from top to bottom
  const sortedSections = Object.entries(grouped).sort(([secA], [secB]) => {
    const rankA = getSectionRank(secA);
    const rankB = getSectionRank(secB);
    if (rankA !== rankB) return rankA - rankB;
    return secA.localeCompare(secB, 'de');
  });

  // Flatten exercises with their section information for unified 1-page grid rendering
  const allSessionExercises: {
    secName: string;
    exItem: any;
    exDetail: any;
    idx: number;
  }[] = [];

  if (session) {
    sortedSections.forEach(([secName, exList]) => {
      exList.forEach((exItem) => {
        const exDetail = exercisesList.find(x => x.id === exItem.exercise_id) || exItem.exercise || {};
        allSessionExercises.push({
          secName,
          exItem,
          exDetail,
          idx: allSessionExercises.length + 1
        });
      });
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
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const titleStr = isSingleExercise ? (exercise.title || 'Uebung') : (session.title || 'Trainingsplan');
      const safeFilename = `${titleStr.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      // Enforce desktop A4 layout during html2canvas capture
      printRef.current.classList.add('force-a4-render');

      const opt = {
        margin: [5, 5, 5, 5] as [number, number, number, number],
        filename: safeFilename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          allowTaint: true, 
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 1024
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
      if (printRef.current) {
        printRef.current.classList.remove('force-a4-render');
      }
      setIsGeneratingPdf(false);
    }
  };

  const modalContent = (
    <div 
      id="printable-training-modal-portal"
      className="fixed inset-0 z-[200] flex flex-col bg-black/85 p-3 sm:p-6 backdrop-blur-md overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:overflow-visible print:backdrop-blur-none"
    >
      {/* Print Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 5mm;
        }
        @media print {
          html, body {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: 287mm !important;
            max-height: 287mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            overflow: hidden !important;
            color-scheme: light !important;
            -webkit-text-size-adjust: 100% !important;
          }

          /* Hide all other direct children of body so only this portal is printed */
          body:has(#printable-training-modal-portal) > *:not(#printable-training-modal-portal),
          body.printable-training-modal-open > *:not(#printable-training-modal-portal) {
            display: none !important;
          }

          #printable-training-modal-portal {
            display: block !important;
            position: static !important;
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: 287mm !important;
            max-height: 287mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            overflow: hidden !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .print-hide-actions {
            display: none !important;
          }

          .print-scroll-wrapper {
            display: block !important;
            position: static !important;
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: 287mm !important;
            max-height: 287mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          #printable-training-plan-area {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            position: static !important;
            width: 200mm !important;
            min-width: 200mm !important;
            max-width: 200mm !important;
            height: 285mm !important;
            max-height: 285mm !important;
            margin: 0 auto !important;
            padding: 2mm 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-scheme: light !important;
          }

          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      ` }} />

      {/* Top Action Bar (hidden in Print) */}
      <div className="print-hide-actions w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-4 shrink-0 shadow-2xl print:hidden">
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
      <div className="print-scroll-wrapper flex-1 w-full max-w-4xl mx-auto overflow-y-auto pb-8 print:p-0 print:m-0 print:overflow-visible print:max-w-none print:w-full">
        <div
          id="printable-training-plan-area"
          ref={printRef}
          className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-2xl border border-slate-300 text-left font-sans space-y-4 print:space-y-1.5 w-full max-w-[210mm] mx-auto box-border border-t-8 border-t-emerald-600 print:border-none print:shadow-none print:p-0 print:rounded-none print:max-w-none print:w-full print:m-0"
        >
          {/* ============================================================ */}
          {/* MODE A: FULL TRAINING PLAN SESSION (STRICT SINGLE A4 PAGE) */}
          {/* ============================================================ */}
          {!isSingleExercise && session && (
            <>
              {/* Header Banner */}
              <div className="border-b-2 border-slate-300 pb-2 flex items-start justify-between gap-3 shrink-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black tracking-widest text-emerald-700 uppercase bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded">
                      MatchTrack Online • Trainingsplan
                    </span>
                    {session.date && (
                      <span className="text-[10px] font-semibold text-slate-500">
                        Datum: {new Date(session.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg sm:text-xl print:text-base font-black text-slate-950 m-0 leading-tight">
                    {session.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] print:text-[9px] text-slate-600">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">
                      {session.age_group || 'Alle Altersklassen'}
                    </span>
                    <span>•</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                      Modell: {session.methodology || 'Trainingsphilosophie Deutschland'}
                    </span>
                    {session.team?.name && (
                      <>
                        <span>•</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-bold">
                          {session.team.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-flex flex-col items-end">
                    <span className="text-xs sm:text-sm print:text-xs font-black border-2 border-emerald-600 bg-emerald-50 text-emerald-900 px-2.5 py-0.5 rounded-lg shadow-xs">
                      ⏱️ {totalDuration} Minuten
                    </span>
                    {session.target_duration_minutes && session.target_duration_minutes !== totalDuration && (
                      <span className="text-[9px] text-slate-500 mt-0.5 font-medium">
                        Ziel: {session.target_duration_minutes} Min.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary / Notes & Material Checklist Card */}
              {(session.notes || aggregatedMaterials.length > 0) && (
                <div className="grid grid-cols-12 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 print:p-1.5 shrink-0 print-avoid-break">
                  {session.notes && (
                    <div className={aggregatedMaterials.length > 0 ? "col-span-7 space-y-0.5" : "col-span-12 space-y-0.5"}>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                        <Bookmark className="w-2.5 h-2.5 text-emerald-600" /> Trainingsschwerpunkt:
                      </span>
                      <p className="text-[10px] print:text-[8.5px] text-slate-700 leading-snug line-clamp-2 m-0">
                        {session.notes}
                      </p>
                    </div>
                  )}

                  {aggregatedMaterials.length > 0 && (
                    <div className={session.notes ? "col-span-5 space-y-0.5 border-l border-slate-200 pl-2" : "col-span-12 space-y-0.5"}>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                        <Dumbbell className="w-2.5 h-2.5 text-emerald-600" /> Benötigtes Material:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {aggregatedMaterials.slice(0, 8).map((mat, i) => (
                          <span key={i} className="text-[8.5px] print:text-[7.5px] font-bold bg-white border border-slate-300 text-slate-800 px-1 py-0.2 rounded shadow-2xs">
                            ✓ {mat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Training Exercises: 2-Column Grid for DIN A4 1-Page Layout */}
              <div className={`grid gap-2.5 print:gap-1.5 flex-1 my-1 print:my-0.5 ${
                allSessionExercises.length <= 1 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 md:grid-cols-2 print:grid-cols-2'
              }`}>
                {allSessionExercises.map(({ secName, exItem, exDetail, idx }) => {
                  const title = exDetail.title || exItem.title || 'Übung';
                  const focus = exDetail.focus_area || exItem.focus_area || '';
                  const duration = exItem.duration_override || exDetail.duration_minutes || exItem.duration_minutes || 15;
                  const minPlayers = exDetail.min_players || 4;
                  const maxPlayers = exDetail.max_players || 12;
                  const coaching = exDetail.coaching_points || '';
                  const description = exDetail.description || '';
                  const provocation = exDetail.provocation_rules || '';
                  const thumbnail = exDetail.thumbnail_path || exItem.thumbnail_path || '';
                  const materials = exDetail.materials || [];

                  const imageSrc = thumbnail
                    ? (thumbnail.startsWith('data:') || thumbnail.startsWith('http') ? thumbnail : getMediaUrl(thumbnail))
                    : null;

                  return (
                    <div 
                      key={exItem.id || idx} 
                      className="border border-slate-300 rounded-lg p-2.5 print:p-2 bg-white shadow-xs space-y-1.5 print:space-y-1 print-avoid-break hover:border-slate-400 transition-colors flex flex-col justify-between"
                    >
                      {/* Exercise Header */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1 shrink-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-800 text-white text-[9px] print:text-[8px] font-black uppercase tracking-wider shrink-0">
                            {formatSectionTitle(secName)}
                          </span>
                          <h3 className="text-xs print:text-[10px] font-black text-slate-900 truncate m-0">
                            {title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1 text-[9px] print:text-[8px] font-bold text-slate-600 shrink-0">
                          {focus && (
                            <span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-900 font-black">
                              {focus}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5 text-slate-700">
                            <Clock className="w-2.5 h-2.5 text-slate-500" /> {duration}m
                          </span>
                          <span className="text-slate-500">
                            👥 {minPlayers}-{maxPlayers}
                          </span>
                        </div>
                      </div>

                      {/* Text details: Ablauf, Provokation, Coaching, Material */}
                      <div className="text-[10px] print:text-[8.5px] text-slate-800 leading-snug space-y-1 shrink-0">
                        {description && (
                          <div>
                            <strong className="text-slate-900 font-bold text-[9.5px] print:text-[8px]">Ablauf: </strong>
                            <div className="text-slate-700 space-y-0.5 mt-0.5">
                              {description.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => {
                                const clean = line.replace(/^[•\-\*]\s*/, '').trim();
                                return (
                                  <div key={i} className="flex items-start gap-1">
                                    <span className="text-emerald-600 font-bold text-[8px] shrink-0 mt-0.5">•</span>
                                    <span>{clean}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {provocation && (
                          <div className="bg-amber-50/90 border border-amber-200 rounded p-1 text-amber-950">
                            <strong className="text-amber-900 font-bold block mb-0.5 text-[9px] print:text-[7.5px] flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5 text-amber-600 inline" /> Provokation:
                            </strong>
                            <div className="space-y-0.5 text-[9px] print:text-[8px] leading-tight text-amber-950">
                              {provocation.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => {
                                const clean = line.replace(/^[•\-\*]\s*/, '').trim();
                                return (
                                  <div key={i} className="flex items-start gap-1">
                                    <span className="text-amber-600 font-bold text-[8px] shrink-0 mt-0.5">•</span>
                                    <span>{clean}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {coaching && (
                          <div className="bg-emerald-50/90 border border-emerald-200 rounded p-1 text-slate-900">
                            <strong className="text-emerald-900 font-bold block mb-0.5 text-[9px] print:text-[7.5px] flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 inline" /> Coaching:
                            </strong>
                            <p className="text-slate-800 m-0 whitespace-pre-line text-[9px] print:text-[8px] leading-tight">
                              {coaching}
                            </p>
                          </div>
                        )}

                        {materials && Array.isArray(materials) && materials.length > 0 && (
                          <div className="text-[8.5px] print:text-[7.5px] text-slate-500 truncate">
                            <strong className="text-slate-700">Material: </strong>
                            <span>{materials.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      {/* Large Central Taktik-Skizze at bottom of card */}
                      {imageSrc && (
                        <div className="w-full border border-slate-300 rounded-md overflow-hidden bg-white p-1 shadow-2xs text-center mt-auto">
                          <img
                            src={imageSrc}
                            alt={title}
                            crossOrigin="anonymous"
                            className="w-full h-auto max-h-36 sm:max-h-40 print:max-h-36 object-contain mx-auto block"
                          />
                          <span className="text-[7.5px] print:text-[7px] font-bold text-slate-400 block mt-0.5 tracking-wider uppercase">
                            TAKTIK-SKIZZE
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Hand-written Trainer Notes on Pitch Box */}
              <div className="border border-dashed border-slate-300 rounded-lg p-2 print:p-1.5 space-y-1 print-avoid-break bg-slate-50/60 shrink-0 w-full">
                <span className="text-[9px] print:text-[8px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  ✍️ Notizen & Beobachtungen auf dem Platz (Für Nachbesprechung & nächste Einheit)
                </span>
                <div className="space-y-1.5 pt-0.5">
                  <div className="border-b border-slate-300 h-3"></div>
                  <div className="border-b border-slate-300 h-3"></div>
                </div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* MODE B: SINGLE EXERCISE PRINT */}
          {/* ============================================================ */}
          {isSingleExercise && exercise && (
            <div className="flex-1 flex flex-col justify-between space-y-3 print:space-y-2 w-full">
              {/* Header */}
              <div className="border-b-2 border-slate-300 pb-2.5 flex items-start justify-between gap-4">
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

              {/* Large Central Sketch - Expanded to fill available width and height */}
              {exercise.thumbnail_path && (
                <div className="w-full border border-slate-300 rounded-xl overflow-hidden bg-white p-2 shadow-xs text-center print-avoid-break">
                  <img
                    src={exercise.thumbnail_path.startsWith('data:') || exercise.thumbnail_path.startsWith('http') ? exercise.thumbnail_path : getMediaUrl(exercise.thumbnail_path)}
                    alt={exercise.title}
                    crossOrigin="anonymous"
                    className="w-full h-auto max-h-[420px] print:max-h-[105mm] object-contain mx-auto block"
                  />
                  <span className="text-[9.5px] print:text-[8.5px] font-bold text-slate-400 block mt-1 tracking-wider uppercase">
                    FT-Graphics Taktik-Skizze
                  </span>
                </div>
              )}

              {/* Materials */}
              {exercise.materials && Array.isArray(exercise.materials) && exercise.materials.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 print:p-2 print-avoid-break">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1">
                    <Dumbbell className="w-3 h-3 text-emerald-600" /> Benötigtes Material
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {exercise.materials.map((m: string, idx: number) => (
                      <span key={idx} className="text-xs font-bold bg-white border border-slate-300 text-slate-800 px-2.5 py-0.5 rounded shadow-2xs">
                        ✓ {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content sections */}
              <div className="space-y-2.5 print:space-y-1.5">
                {exercise.description && (
                  <div className="border border-slate-200 rounded-xl p-3.5 print:p-2 bg-white print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-1.5">
                      Ablauf & Spielregeln
                    </h3>
                    <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
                      {exercise.description.split('\n').filter((l: string) => l.trim()).map((line: string, idx: number) => {
                        const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();
                        return (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
                            <span className="whitespace-pre-line">{cleanLine}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {exercise.provocation_rules && (
                  <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 print:p-2 print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-950 mb-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-700" />
                      Provokationsregeln
                    </h3>
                    <div className="space-y-1 text-xs text-amber-950 leading-relaxed">
                      {exercise.provocation_rules.split('\n').filter((l: string) => l.trim()).map((line: string, idx: number) => {
                        const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();
                        return (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-amber-700 font-bold shrink-0 mt-0.5">•</span>
                            <span className="whitespace-pre-line">{cleanLine}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {exercise.coaching_points && (
                  <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3.5 print:p-2 print-avoid-break">
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
              <div className="border border-dashed border-slate-300 rounded-xl p-3 print:p-2 space-y-1.5 print-avoid-break bg-slate-50/60 mt-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  ✍️ Eigene Trainingsnotizen / Variationen
                </span>
                <div className="space-y-2 pt-0.5">
                  <div className="border-b border-slate-300 h-3.5"></div>
                  <div className="border-b border-slate-300 h-3.5"></div>
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

  return createPortal(modalContent, document.body);
}
