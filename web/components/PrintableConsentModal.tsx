"use client";

import { useEffect, useRef, useState } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  ShieldCheck, 
  FileText, 
  Building2, 
  Lock, 
  AlertCircle,
  Loader2 
} from 'lucide-react';
import { getPublicLegalPages } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

interface PrintableConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledTeamName?: string;
  prefilledPlayerName?: string;
}

export default function PrintableConsentModal({
  isOpen,
  onClose,
  prefilledTeamName = '',
  prefilledPlayerName = ''
}: PrintableConsentModalProps) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [legalData, setLegalData] = useState<any>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getPublicLegalPages()
        .then((data) => setLegalData(data))
        .catch((err) => console.error("Fehler beim Laden der Vereinsdaten für die Einwilligung:", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const clubName = legalData?.club_name || '';
  const contactEmail = legalData?.contact_email || '';
  const address = legalData?.address || '';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const cleanClubName = (clubName || 'Verein').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Einwilligung_Videoaufnahmen_${cleanClubName}.pdf`;

      const opt = {
        margin: [6, 6, 6, 6] as [number, number, number, number],
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css'] }
      };

      await html2pdf().from(printRef.current).set(opt).save();
      toast.success('Einwilligungserklärung als PDF heruntergeladen!');
    } catch (err) {
      console.error('Fehler beim PDF Export:', err);
      toast.error('PDF-Download fehlgeschlagen. Bitte nutze "Drucken / Als PDF speichern".');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/85 p-3 sm:p-6 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Print Styles */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          html, body {
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-consent-sheet-area, #printable-consent-sheet-area * {
            visibility: visible !important;
          }
          #printable-consent-sheet-area {
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

      {/* Top Action Bar (hidden when printing) */}
      <div className="w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-4 shrink-0 shadow-2xl print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Muster-Einwilligungserklärung (KUG / DSGVO)
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              1x DIN A4 Seite
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Druckfertige Vorlage für Erziehungsberechtigte bei Videoaufnahmen im Jugendfußball
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
            title="Drucken oder als PDF speichern"
          >
            <Printer className="w-4 h-4" />
            <span>Drucken / Als PDF speichern</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Generiere PDF...</span>
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

      {/* Sheet Container */}
      <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto pb-8 print:p-0 print:m-0 print:overflow-visible">
        <div
          id="printable-consent-sheet-area"
          ref={printRef}
          className="bg-white text-slate-900 p-8 rounded-xl shadow-2xl border border-slate-300 text-left font-sans space-y-3.5 w-full max-w-[210mm] mx-auto box-border border-t-8 border-t-emerald-600 print:border-none print:shadow-none print:p-0 print:rounded-none"
        >
          {/* Document Header */}
          <div className="border-b-2 border-slate-300 pb-3 flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded inline-block mb-1">
                Rechtssicherheit im Verein • Datenschutz & Bildrechte
              </span>
              <h1 className="text-xl font-black text-slate-950 m-0 uppercase tracking-tight">
                Einwilligungserklärung
              </h1>
              <p className="text-xs font-bold text-slate-700 mt-0.5 leading-snug">
                zur Erstellung und teaminternen Nutzung von Video- und Bildaufnahmen zu Spielanalyse- und Ausbildungszwecken
              </p>
            </div>

            <div className="text-right shrink-0 text-[10px] font-medium text-slate-500 border-l border-slate-200 pl-3">
              <div className="font-bold text-slate-900 text-xs">{clubName || 'Sportverein / Fußballabteilung'}</div>
              {address && <div>{address}</div>}
              {contactEmail && <div>E-Mail: {contactEmail}</div>}
              <div className="text-slate-400 mt-0.5">Gemäß DSGVO &amp; §§ 22, 23 KUG</div>
            </div>
          </div>

          {/* Formular-Felder für Spieler/Eltern */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-[11px] text-slate-800 print-avoid-break">
            <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>Stammdaten des Spielers / der Spielerin &amp; Erziehungsberechtigten</span>
              <span className="text-[10px] text-slate-500 font-normal">Bitte in Druckbuchstaben ausfüllen</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1">
              <div>
                <span className="text-[10px] font-bold text-slate-600 block">Name, Vorname des Spielers/der Spielerin:</span>
                <div className="border-b border-slate-400 font-bold text-slate-900 pt-0.5 min-h-[20px]">
                  {prefilledPlayerName || ''}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-600 block">Geburtsdatum:</span>
                <div className="border-b border-slate-400 font-bold text-slate-900 pt-0.5 min-h-[20px]">
                  &nbsp;
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-600 block">Mannschaft / Altersklasse:</span>
                <div className="border-b border-slate-400 font-bold text-slate-900 pt-0.5 min-h-[20px]">
                  {prefilledTeamName || ''}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-600 block">Name(n) der/des Personensorgeberechtigten (Eltern):</span>
                <div className="border-b border-slate-400 font-bold text-slate-900 pt-0.5 min-h-[20px]">
                  &nbsp;
                </div>
              </div>
            </div>
          </div>

          {/* Sachverhalt & Aufklärung in 5 klaren Punkten */}
          <div className="space-y-2.5 text-[10.5px] leading-relaxed text-slate-800">
            {/* Punkt 1 */}
            <div className="space-y-0.5">
              <h2 className="font-bold text-slate-950 text-[11px] flex items-center gap-1.5 m-0">
                <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">1</span>
                <span>Zweck der Aufnahmen &amp; teaminterne Nutzung</span>
              </h2>
              <p className="m-0 pl-5 text-slate-700">
                Im Rahmen des modernen Trainings- und Ausbildungsbetriebs werden Meisterschafts-, Freundschafts- und Trainingsspiele
                des oben genannten Vereins mittels Video aufgezeichnet. Die Aufnahmen dienen ausschließlich der
                <strong> sportlichen und taktischen Analyse</strong>, der individuellen <strong>Leistungsförderung</strong>, Fehlerkorrektur 
                sowie der <strong>Kader- und Anwesenheitsverwaltung</strong> der Mannschaft.
              </p>
            </div>

            {/* Punkt 2 */}
            <div className="space-y-0.5">
              <h2 className="font-bold text-slate-950 text-[11px] flex items-center gap-1.5 m-0">
                <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">2</span>
                <span>Geschützter Zugriff über MatchTrack Online (Kein Social Media)</span>
              </h2>
              <p className="m-0 pl-5 text-slate-700">
                Die Aufnahmen werden im vereinsinternen, passwortgeschützten Portal <em>MatchTrack Online</em> hinterlegt.
                Zugriffsberechtigt sind ausschließlich die zuständigen <strong>Trainer, Betreuer und aktiven Spieler der jeweiligen Mannschaft</strong>. 
                Eine Weitergabe an unberechtigte Dritte oder eine Veröffentlichung auf öffentlichen Plattformen (z.&nbsp;B. YouTube, Instagram, TikTok)
                ist <strong>ausdrücklich nicht gestattet</strong> und bedarf einer gesonderten schriftlichen Genehmigung.
              </p>
            </div>

            {/* Punkt 3 */}
            <div className="space-y-0.5">
              <h2 className="font-bold text-slate-950 text-[11px] flex items-center gap-1.5 m-0">
                <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">3</span>
                <span>Rechtsgrundlage &amp; Freiwilligkeit</span>
              </h2>
              <p className="m-0 pl-5 text-slate-700">
                Die Einwilligung erfolgt freiwillig gemäß <strong>Art. 6 Abs. 1 lit. a DSGVO</strong> sowie <strong>§§ 22, 23 KunstUrhG (KUG)</strong>.
                Aus einer Nichterteilung entstehen dem Spieler / der Spielerin <strong>keinerlei sportliche oder persönliche Nachteile</strong> 
                bei der Aufstellung oder im regulären Spiel- und Trainingsbetrieb des Vereins.
              </p>
            </div>

            {/* Punkt 4 */}
            <div className="space-y-0.5">
              <h2 className="font-bold text-slate-950 text-[11px] flex items-center gap-1.5 m-0">
                <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">4</span>
                <span>Jederzeitiges Widerrufsrecht (Art. 7 Abs. 3 DSGVO)</span>
              </h2>
              <p className="m-0 pl-5 text-slate-700">
                Diese Erklärung kann <strong>jederzeit ohne Angabe von Gründen mit Wirkung für die Zukunft</strong> ganz oder teilweise widerrufen werden.
                Der Widerruf kann formlos per E-Mail an <span className="font-semibold text-slate-900">{contactEmail || 'die sportliche Leitung des Vereins'}</span> oder
                schriftlich an die Vereinsanschrift gerichtet werden. Nach Eingang des Widerrufs werden künftige Aufnahmen der betroffenen Person unterlassen
                und bestehende Videos bei Bedarf unkenntlich gemacht bzw. archiviert.
              </p>
            </div>

            {/* Punkt 5 */}
            <div className="space-y-0.5">
              <h2 className="font-bold text-slate-950 text-[11px] flex items-center gap-1.5 m-0">
                <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">5</span>
                <span>Speicherdauer &amp; Löschung</span>
              </h2>
              <p className="m-0 pl-5 text-slate-700">
                Die Aufnahmen werden für die Dauer der aktuellen Spielzeit bzw. der Mannschaftszugehörigkeit gespeichert. Nach Ausscheiden aus der Mannschaft
                oder Ablauf der Saison werden nicht mehr für den Archiv- und Ausbildungsbetrieb benötigte Rohdateien sicher gelöscht.
              </p>
            </div>
          </div>

          {/* Einwilligungserklärung & Checkboxen */}
          <div className="border border-emerald-300 bg-emerald-50/70 rounded-lg p-3 space-y-1.5 text-[10.5px] print-avoid-break">
            <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Einwilligungserklärung der/des Personensorgeberechtigten</span>
            </div>
            <p className="text-slate-800 m-0">
              Ich habe/wir haben die oben genannten Informationen zur Kenntnis genommen und willige(n) hiermit ein,
              dass Foto- und Videoaufnahmen meines/unseres Kindes zu vereins- und teaminternen Spiel- und Trainingsanalysezwecken 
              wie beschrieben angefertigt, digital analysiert und im passwortgeschützten Tool <em>MatchTrack Online</em> den Trainern
              und Mannschaftskollegen zugänglich gemacht werden dürfen.
            </p>
          </div>

          {/* Unterschriftsbereich */}
          <div className="pt-2 space-y-5 print-avoid-break text-[11px]">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <span className="text-[10px] font-bold text-slate-600 block mb-3">Ort, Datum:</span>
                <div className="border-b border-slate-500 pb-0.5">
                  ___________________________________________
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-600 block mb-3">
                  Unterschrift(en) der/des Personensorgeberechtigten:
                </span>
                <div className="border-b border-slate-500 pb-0.5">
                  ___________________________________________
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-1">
              <div>
                <span className="text-[10px] font-bold text-slate-600 block mb-3">
                  Bei Jugendlichen ab 14 Jahren (Unterschrift des Spielers/der Spielerin):
                </span>
                <div className="border-b border-slate-500 pb-0.5">
                  ___________________________________________
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-600 block mb-3">
                  Vom Trainer / Jugendleiter entgegengenommen am:
                </span>
                <div className="border-b border-slate-500 pb-0.5">
                  ___________________________________________
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-2 text-center text-[9px] text-slate-400 flex items-center justify-between">
            <span>MatchTrack Online • DSGVO-Mustervorlage für Jugend- &amp; Amateursport</span>
            <span>Stand: {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
