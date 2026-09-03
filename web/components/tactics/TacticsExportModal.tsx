"use client";

import { useState } from 'react';
import {
  X,
  Download,
  Image as ImageIcon,
  FileText,
  Share2,
  Check,
  Printer,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface TacticsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardTitle: string;
  boardData: any;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export default function TacticsExportModal({
  isOpen,
  onClose,
  boardTitle,
  boardData,
  canvasRef
}: TacticsExportModalProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExportPNG = () => {
    if (!canvasRef.current) {
      toast.error('Kein Spielfeld zum Exportieren gefunden.');
      return;
    }
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const safeTitle = (boardTitle || 'taktiktafel').toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.download = `matchtrack_${safeTitle}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('HD-Bild der Taktiktafel heruntergeladen!');
    } catch (err) {
      console.error('Export-Fehler:', err);
      toast.error('Fehler beim Exportieren des Bildes.');
    }
  };

  const handlePrintPDF = () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Popup-Blocker verhindert den Druckdialog.');
        return;
      }
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${boardTitle || 'MatchTrack Taktiktafel'}</title>
            <style>
              @page { size: landscape; margin: 10mm; }
              body { font-family: system-ui, sans-serif; background: white; color: black; margin: 0; padding: 20px; text-align: center; }
              h1 { margin: 0 0 10px 0; font-size: 24px; }
              p { margin: 0 0 20px 0; color: #666; font-size: 14px; }
              img { max-width: 100%; height: auto; border: 2px solid #333; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
              .footer { margin-top: 20px; font-size: 11px; color: #888; }
            </style>
          </head>
          <body>
            <h1>${boardTitle || 'MatchTrack Taktiktafel'}</h1>
            <p>MatchTrack Online — Taktische Spieltagsvorbereitung</p>
            <img src="${dataUrl}" />
            <div class="footer">Erstellt mit MatchTrack Online • Datum: ${new Date().toLocaleDateString('de-DE')}</div>
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error('Druck-Fehler:', err);
      toast.error('Fehler beim Drucken.');
    }
  };

  const handleExportJSON = () => {
    try {
      const jsonStr = JSON.stringify(boardData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeTitle = (boardTitle || 'taktiktafel').toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.download = `matchtrack_taktik_${safeTitle}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Taktik-Daten als JSON exportiert!');
    } catch (err) {
      console.error('JSON Export Fehler:', err);
      toast.error('Fehler beim JSON-Export.');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Taktik exportieren</h2>
              <p className="text-xs text-zinc-400">Wähle dein gewünschtes Exportformat</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Export Options */}
        <div className="p-6 space-y-3 text-sm">
          {/* PNG Export */}
          <div
            onClick={handleExportPNG}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-900 cursor-pointer flex items-center justify-between transition-all group active:scale-95"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block group-hover:text-indigo-400 transition-colors">
                  HD-Bild (PNG)
                </span>
                <span className="text-[11px] text-zinc-400">
                  Ideal für WhatsApp, Bildschirme und Handouts
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
          </div>

          {/* PDF Print */}
          <div
            onClick={handlePrintPDF}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-900 cursor-pointer flex items-center justify-between transition-all group active:scale-95"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block group-hover:text-indigo-400 transition-colors">
                  Drucklayout / PDF
                </span>
                <span className="text-[11px] text-zinc-400">
                  Querformat-Layout für die Kabinentür / Taktikmappe
                </span>
              </div>
            </div>
            <Printer className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
          </div>

          {/* JSON Backup */}
          <div
            onClick={handleExportJSON}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-900 cursor-pointer flex items-center justify-between transition-all group active:scale-95"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block group-hover:text-indigo-400 transition-colors">
                  Taktik-Daten (JSON)
                </span>
                <span className="text-[11px] text-zinc-400">
                  Rohdaten zum Teilen und Importieren
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-zinc-800 bg-zinc-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all active:scale-95"
          >
            Schließen
          </button>
        </div>

      </div>
    </div>
  );
}
