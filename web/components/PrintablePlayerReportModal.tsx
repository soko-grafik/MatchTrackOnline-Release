"use client";

import React, { useRef } from 'react';
import { X, Printer, Download, Star, Calendar, Shield, Award } from 'lucide-react';

interface PrintablePlayerReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: any;
  evaluations: any[];
  attendances: any[];
}

export default function PrintablePlayerReportModal({
  isOpen,
  onClose,
  player,
  evaluations,
  attendances
}: PrintablePlayerReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !player) return null;

  const latestEval = evaluations.length > 0 ? evaluations[evaluations.length - 1] : null;

  // Attendance stats
  const totalAtt = attendances.length;
  const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
  const attRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 100;

  const krankheitCount = attendances.filter(a => a.absence_reason === 'KRANKHEIT').length;
  const privatesCount = attendances.filter(a => a.absence_reason === 'PRIVATES').length;
  const verletzungCount = attendances.filter(a => a.absence_reason === 'VERLETZUNG').length;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (typeof window !== 'undefined') {
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        const element = printRef.current;
        if (!element) return;

        const opt = {
          margin:       0,
          filename:     `Spielerbericht_${player.last_name}_${player.first_name}.pdf`,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, allowTaint: true, windowWidth: 1200, backgroundColor: '#ffffff' },
          jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const },
          pagebreak:    { mode: ['avoid-all'] }
        };

        await html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error("Failed to generate PDF:", err);
        window.print();
      }
    }
  };

  // Calculate average rating across ALL evaluations
  const totalEvalsCount = evaluations.length;

  const calculateCriterionAverage = (key: string): number => {
    if (totalEvalsCount === 0) return 0;
    const sum = evaluations.reduce((acc, ev) => acc + (ev[key] !== undefined ? Number(ev[key]) : 5.0), 0);
    return sum / totalEvalsCount;
  };

  const overallAverageScore = totalEvalsCount > 0
    ? evaluations.reduce((acc, ev) => acc + (ev.overall_rating || 5.0), 0) / totalEvalsCount
    : 0;

  const categories = [
    {
      title: "1. Technische Fähigkeiten",
      items: [
        { label: "Ballkontrolle", key: "tech_ball_control" },
        { label: "Dribbling", key: "tech_dribbling" },
        { label: "Passspiel", key: "tech_passing" },
        { label: "Torschuss", key: "tech_shooting" },
        { label: "Beidfüßigkeit", key: "tech_both_feet" },
      ]
    },
    {
      title: "2. Taktisches Verhalten",
      items: [
        { label: "Spielintelligenz", key: "tact_intelligence" },
        { label: "Freilaufverhalten", key: "tact_space_creation" },
        { label: "Umschaltspiel", key: "tact_transition" },
        { label: "1-gegen-1 Verhalten", key: "tact_one_on_one" },
      ]
    },
    {
      title: "3. Physis & Koordination",
      items: [
        { label: "Schnelligkeit", key: "phys_speed" },
        { label: "Gewandtheit", key: "phys_agility" },
        { label: "Beweglichkeit", key: "phys_mobility" },
      ]
    },
    {
      title: "4. Mental & Sozial",
      items: [
        { label: "Teamgeist", key: "ment_teamwork" },
        { label: "Einstellung", key: "ment_attitude" },
        { label: "Lernbereitschaft", key: "ment_learning" },
        { label: "Fairplay", key: "ment_fairplay" },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }
      `}</style>

      {/* Action Header bar for modal view */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all"
        >
          <Printer className="w-4 h-4 text-blue-400" />
          <span>Drucken</span>
        </button>

        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all"
        >
          <Download className="w-4 h-4" />
          <span>PDF Herunterladen (Querformat)</span>
        </button>

        <button
          onClick={onClose}
          className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Printable A4 Landscape Container (297mm x 210mm) */}
      <div
        ref={printRef}
        className="w-[297mm] max-w-[297mm] min-h-[210mm] bg-white text-zinc-900 p-[8mm] shadow-2xl mx-auto rounded-none print:shadow-none print:w-full print:p-0 font-sans text-xs leading-tight box-border"
        style={{ colorScheme: 'light' }}
      >
        {/* Document Header */}
        <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2 mb-3">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700">
              MatchTrack Online — Entwicklungs & Fortschrittsbericht (Querformat)
            </div>
            <h1 className="text-xl font-black tracking-tight text-zinc-900">
              {player.first_name} {player.last_name}
            </h1>
            <div className="flex items-center gap-2.5 text-zinc-600 text-[11px] font-semibold mt-0.5">
              <span>Mannschaft: <strong>{player.team_name || 'Keine Zuweisung'}</strong></span>
              {player.jersey_number && <span>| Rückennummer: <strong>#{player.jersey_number}</strong></span>}
              {player.position && <span>| Position: <strong>{player.position}</strong></span>}
              {player.date_of_birth && <span>| Geb.: <strong>{player.date_of_birth}</strong></span>}
              {player.dfb_id && <span>| DFB-Pass: <strong className="font-mono">{player.dfb_id}</strong></span>}
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              {totalEvalsCount > 0 ? `${overallAverageScore.toFixed(1)} / 10` : '—'}
            </div>
            <div className="text-[9px] uppercase font-bold text-zinc-500">Gesamtschnitt ({totalEvalsCount} Bewertungen)</div>
            <div className="text-[9px] text-zinc-400">Erstellt am {new Date().toLocaleDateString('de-DE')}</div>
          </div>
        </div>

        {/* 2-Column Landscape Grid (Left: Data & Average Ratings | Right: Chart) */}
        <div className="grid grid-cols-12 gap-4 items-start">
          
          {/* LEFT COLUMN: Meta, Attendance & Average Ratings */}
          <div className="col-span-6 space-y-2">
            
            {/* Meta & Attendance Bar (Zentrierte Werte) */}
            <div className="grid grid-cols-3 gap-2 bg-zinc-100/90 p-2 rounded-lg border border-zinc-200 text-[10px]">
              <div className="text-center flex flex-col items-center justify-center">
                <span className="text-[8px] uppercase font-bold text-zinc-500 block">Anwesenheitsquote</span>
                <span className="font-bold text-emerald-700 text-center">{attRate}% ({presentCount} / {totalAtt})</span>
              </div>
              <div className="text-center flex flex-col items-center justify-center border-x border-zinc-200/80 px-1">
                <span className="text-[8px] uppercase font-bold text-zinc-500 block">Absagen</span>
                <span className="font-bold text-zinc-800 text-center">K: {krankheitCount} | P: {privatesCount} | V: {verletzungCount}</span>
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <span className="text-[8px] uppercase font-bold text-zinc-500 block">Anzahl Bewertungen</span>
                <span className="font-bold text-zinc-800 text-center">{totalEvalsCount} Quartale</span>
              </div>
            </div>

            {/* Average Ratings Matrix (Durchschnitt aus ALLEN Einzelbewertungen) */}
            <div className="border border-zinc-300 rounded-lg overflow-hidden">
              <div className="bg-zinc-900 text-white font-bold text-[11px] px-3 py-1.5 flex justify-between items-center">
                <span>Durchschnitt aus allen {totalEvalsCount} Einzelbewertungen</span>
                <span className="text-[10px] text-emerald-400 font-mono">Skala 1 bis 10</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-white text-[10px]">
                {categories.map((cat, cIdx) => {
                  const catAvg = cat.items.reduce((sum, item) => sum + calculateCriterionAverage(item.key), 0) / cat.items.length;
                  return (
                    <div key={cIdx} className="border border-zinc-200 rounded-lg p-2 bg-zinc-50/50">
                      <div className="flex justify-between items-center font-bold text-zinc-900 border-b border-zinc-200 pb-1 mb-1.5">
                        <span className="text-[10px] font-extrabold">{cat.title}</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono inline-flex items-center justify-center text-center font-bold">
                          Ø {catAvg.toFixed(1)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {cat.items.map((item, iIdx) => {
                          const avgVal = calculateCriterionAverage(item.key);
                          return (
                            <div key={iIdx} className="flex justify-between items-center text-[10px] py-0.5">
                              <span className="text-zinc-700 font-medium leading-normal pr-2">{item.label}</span>
                              <span className="font-bold font-mono text-zinc-900 bg-white border border-zinc-300 px-2 py-0.5 rounded min-w-[30px] text-center inline-flex items-center justify-center shadow-xs shrink-0">
                                {avgVal.toFixed(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Printed Fortschritts-Analyse Graph */}
          <div className="col-span-6 space-y-2">
            <div className="border border-zinc-300 rounded-lg p-2.5 bg-zinc-50/50">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <h3 className="text-xs font-black text-zinc-900 uppercase">Fortschritts-Analyse (Verlaufsgraph)</h3>
                  <span className="text-[9px] text-zinc-500">Entwicklungsverlauf über alle {totalEvalsCount} Quartale</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600"></span> Gesamtschnitt</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span> Ballkontrolle</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600"></span> Passspiel</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-600"></span> Schnelligkeit</span>
                </div>
              </div>

              {evaluations.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs italic">
                  Keine Daten für den Verlaufsgraph vorhanden.
                </div>
              ) : (
                <div className="w-full">
                  <div className="h-44 w-full relative">
                    <svg className="w-full h-full" viewBox="0 0 650 160" preserveAspectRatio="none">
                      {/* Grid Lines */}
                      {[2, 4, 6, 8, 10].map(val => {
                        const y = 140 - (val / 10) * 120;
                        return (
                          <g key={val}>
                            <line x1="30" y1={y} x2="630" y2={y} stroke="#e4e4e7" strokeDasharray="3 3" strokeWidth="1" />
                            <text x="22" y={y + 3} fill="#71717a" fontSize="9" fontWeight="700" textAnchor="end">{val}</text>
                          </g>
                        );
                      })}

                      {/* Plot Criteria Lines */}
                      {[
                        { key: 'overall_rating', color: '#059669' },
                        { key: 'tech_ball_control', color: '#2563eb' },
                        { key: 'tech_passing', color: '#4f46e5' },
                        { key: 'phys_speed', color: '#d97706' },
                      ].map(opt => {
                        const points = evaluations.map((ev, idx) => {
                          const x = 45 + (idx / Math.max(1, evaluations.length - 1)) * 570;
                          const val = ev[opt.key] !== undefined ? Number(ev[opt.key]) : 5;
                          const y = 140 - (val / 10) * 120;
                          return { x, y, val };
                        });

                        let pathStr = `M ${points[0].x} ${points[0].y}`;
                        if (points.length === 2) {
                          pathStr = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
                        } else if (points.length > 2) {
                          for (let i = 0; i < points.length - 1; i++) {
                            const curr = points[i];
                            const next = points[i + 1];
                            const mx = (curr.x + next.x) / 2;
                            pathStr += ` C ${mx} ${curr.y}, ${mx} ${next.y}, ${next.x} ${next.y}`;
                          }
                        }

                        return (
                          <g key={opt.key}>
                            <path d={pathStr} fill="none" stroke={opt.color} strokeWidth="2.5" strokeLinecap="round" />
                            {points.map((p, pIdx) => (
                              <circle key={pIdx} cx={p.x} cy={p.y} r="3" fill={opt.color} />
                            ))}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* X-Axis Date Labels */}
                  <div className="flex justify-between pl-8 pr-2 mt-1 text-[9px] font-bold text-zinc-600 border-t border-zinc-200 pt-1">
                    {evaluations.map((ev, idx) => {
                      const dateFormatted = ev.evaluation_date ? new Date(ev.evaluation_date).toLocaleDateString('de-DE') : `${ev.eval_quarter || ''} ${ev.eval_year || ''}`;
                      return (
                        <div key={ev.id || idx} className="text-center">
                          <div>{dateFormatted}</div>
                          <div className="text-[8px] text-emerald-700 font-mono font-bold">{Number(ev.overall_rating || 0).toFixed(1)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FULL WIDTH: Gesamteinschätzung & Trainerfazit (Erstreckt sich bis nach unten) */}
        <div className="w-full border border-zinc-300 rounded-lg p-3 bg-zinc-50/50 mt-3 min-h-[48mm] flex flex-col justify-between">
          <div>
            <div className="font-bold uppercase text-zinc-900 text-[10px] tracking-wider mb-1 flex justify-between items-center border-b border-zinc-200 pb-1">
              <span>Gesamteinschätzung & Trainerfazit</span>
              <span className="text-[8px] font-normal text-zinc-500 italic">Entwicklungsstand & Empfehlungen</span>
            </div>
            <p className="text-zinc-700 italic text-[10px] leading-relaxed whitespace-pre-line">
              {latestEval?.overall_notes || 'Noch kein Gesamtfazit für das aktuelle Quartal hinterlegt.'}
            </p>
          </div>

          {/* Footer & Signature at bottom of full page */}
          <div className="pt-2 border-t border-zinc-300 flex justify-between items-center text-[9px] text-zinc-500 mt-4">
            <div>MatchTrack Online — Professionelles Jugend- & Seniorentraining</div>
            <div>Datum & Unterschrift Trainer / Jugendleiter: _______________________</div>
          </div>
        </div>
      </div>
    </div>
  );
}
