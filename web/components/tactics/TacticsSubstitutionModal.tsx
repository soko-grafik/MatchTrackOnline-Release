"use client";

import { useState, useEffect } from 'react';
import {
  X,
  ArrowLeftRight,
  UserPlus,
  Check,
  Clock,
  FileText,
  AlertCircle,
  Sparkles,
  Play
} from 'lucide-react';
import { PlayerToken, PlannedSubstitution } from './TacticsBoardCanvas';

interface TacticsSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  benchPlayers: PlayerToken[];
  fieldPlayers: PlayerToken[];
  preselectedBenchPlayerId?: string | null;
  preselectedFieldPlayerId?: string | null;
  homeColors: { primary: string; secondary: string; goalkeeper: string; text?: string };
  awayColors: { primary: string; secondary: string; goalkeeper: string; text?: string };
  onSaveSubstitution: (sub: {
    playerIn: PlayerToken;
    playerOut: PlayerToken;
    minute?: string;
    notes?: string;
  }) => void;
  onExecuteImmediate: (
    playerIn: PlayerToken,
    playerOut: PlayerToken,
    createNewPhase: boolean
  ) => void;
}

export default function TacticsSubstitutionModal({
  isOpen,
  onClose,
  benchPlayers,
  fieldPlayers,
  preselectedBenchPlayerId,
  preselectedFieldPlayerId,
  homeColors,
  awayColors,
  onSaveSubstitution,
  onExecuteImmediate
}: TacticsSubstitutionModalProps) {
  const [selectedInId, setSelectedInId] = useState<string>('');
  const [selectedOutId, setSelectedOutId] = useState<string>('');
  const [minute, setMinute] = useState<string>('60');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (preselectedBenchPlayerId) {
        setSelectedInId(preselectedBenchPlayerId);
      } else if (benchPlayers.length > 0) {
        setSelectedInId(benchPlayers[0].id);
      } else {
        setSelectedInId('');
      }

      if (preselectedFieldPlayerId) {
        setSelectedOutId(preselectedFieldPlayerId);
      } else if (fieldPlayers.length > 0) {
        setSelectedOutId(fieldPlayers[0].id);
      } else {
        setSelectedOutId('');
      }
    }
  }, [isOpen, preselectedBenchPlayerId, preselectedFieldPlayerId, benchPlayers, fieldPlayers]);

  if (!isOpen) return null;

  const playerIn = benchPlayers.find((p) => p.id === selectedInId);
  const playerOut = fieldPlayers.find((p) => p.id === selectedOutId);

  const getPlayerColor = (p: PlayerToken) => {
    if (p.customColor) return p.customColor;
    const isHome = p.team === 'home';
    const isGK = p.isGoalkeeper || p.role === 'TW';
    return isHome
      ? (isGK ? homeColors.goalkeeper : homeColors.primary)
      : (isGK ? awayColors.goalkeeper : awayColors.primary);
  };

  const handlePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerIn || !playerOut) return;
    onSaveSubstitution({
      playerIn,
      playerOut,
      minute: minute.trim() || undefined,
      notes: notes.trim() || `${playerIn.name} für ${playerOut.name}`
    });
    onClose();
  };

  const handleExecuteNow = (newPhase: boolean) => {
    if (!playerIn || !playerOut) return;
    onExecuteImmediate(playerIn, playerOut, newPhase);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Wechsel vorbereiten</h3>
              <p className="text-[11px] text-zinc-400">Einwechslung von der Reservebank planen</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <form onSubmit={handlePlan} className="p-6 space-y-5">

          {/* Warning if no bench players available */}
          {benchPlayers.length === 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300 space-y-1">
                <span className="font-bold block">Keine Spieler auf der Reservebank!</span>
                <span>Füge zuerst Spieler zur Reservebank hinzu (z. B. Theo über den Button &quot;+ Spieler auf Bank&quot; oder über den Kader).</span>
              </div>
            </div>
          )}

          {/* Visual Swap Preview */}
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3">
            
            {/* IN: Bench Player */}
            <div className="flex-1 flex flex-col items-center text-center p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <span>🟢 Kommt rein</span>
              </span>
              {playerIn ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center font-bold text-sm text-white shadow-lg"
                    style={{ backgroundColor: getPlayerColor(playerIn) }}
                  >
                    {playerIn.number || '–'}
                  </div>
                  <span className="text-xs font-bold text-white max-w-[120px] truncate">
                    {playerIn.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {playerIn.role}
                  </span>
                </div>
              ) : (
                <div className="py-3 text-xs text-zinc-500 italic">Spieler wählen...</div>
              )}
            </div>

            {/* Swap Arrows Icon */}
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 shadow-md shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>

            {/* OUT: Pitch Player */}
            <div className="flex-1 flex flex-col items-center text-center p-3 rounded-xl bg-rose-950/20 border border-rose-500/30">
              <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <span>🔴 Geht raus</span>
              </span>
              {playerOut ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center font-bold text-sm text-white shadow-lg"
                    style={{ backgroundColor: getPlayerColor(playerOut) }}
                  >
                    {playerOut.number || '–'}
                  </div>
                  <span className="text-xs font-bold text-white max-w-[120px] truncate">
                    {playerOut.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {playerOut.role}
                  </span>
                </div>
              ) : (
                <div className="py-3 text-xs text-zinc-500 italic">Spieler wählen...</div>
              )}
            </div>

          </div>

          {/* Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Select Bench Player (IN) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">
                Einwechselspieler (Bank)
              </label>
              <select
                value={selectedInId}
                onChange={(e) => setSelectedInId(e.target.value)}
                disabled={benchPlayers.length === 0}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                {benchPlayers.length === 0 ? (
                  <option value="">(Keine Ersatzspieler auf Bank)</option>
                ) : (
                  benchPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.number} {p.name} ({p.role}) - {p.team === 'home' ? 'Heim' : 'Gast'}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Select Pitch Player (OUT) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">
                Auswechselspieler (Feld)
              </label>
              <select
                value={selectedOutId}
                onChange={(e) => setSelectedOutId(e.target.value)}
                disabled={fieldPlayers.length === 0}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none disabled:opacity-50"
              >
                {fieldPlayers.length === 0 ? (
                  <option value="">(Keine Feldspieler vorhanden)</option>
                ) : (
                  fieldPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.number} {p.name} ({p.role}) - {p.team === 'home' ? 'Heim' : 'Gast'}
                    </option>
                  ))
                )}
              </select>
            </div>

          </div>

          {/* Minute & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Geplante Minute</span>
              </label>
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
                <input
                  type="text"
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  placeholder="z. B. 60"
                  className="w-full bg-transparent text-xs text-white focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 font-bold">. Min</span>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                <span>Taktische Anweisung / Notiz</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="z. B. Theo für Albert (offensiver Flügel)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
            
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all"
            >
              Abbrechen
            </button>

            <div className="flex items-center gap-2">
              
              {/* Execute Immediately in current frame */}
              <button
                type="button"
                onClick={() => handleExecuteNow(false)}
                disabled={!playerIn || !playerOut}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                title="Tauscht die Spieler sofort im aktuellen Spielzug aus"
              >
                Jetzt ausführen
              </button>

              {/* Execute as new Phase */}
              <button
                type="button"
                onClick={() => handleExecuteNow(true)}
                disabled={!playerIn || !playerOut}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 hover:text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                title="Erstellt eine neue Animations-Phase in der Timeline mit dem Wechsel"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Als neue Phase</span>
              </button>

              {/* Primary: Save as Planned Sub */}
              <button
                type="submit"
                disabled={!playerIn || !playerOut}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-40"
                title="Wechsel auf der Bank und am Spieler vormerken"
              >
                <Check className="w-4 h-4" />
                <span>Wechsel vormerken</span>
              </button>

            </div>

          </div>

        </form>

      </div>
    </div>
  );
}
