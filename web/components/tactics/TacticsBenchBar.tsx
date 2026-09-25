"use client";

import { useState } from 'react';
import {
  Users,
  ArrowLeftRight,
  Plus,
  Trash2,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Clock,
  Sparkles,
  Shield,
  ArrowUpRight
} from 'lucide-react';
import { PlayerToken, PlannedSubstitution } from './TacticsBoardCanvas';

interface TacticsBenchBarProps {
  benchPlayers: PlayerToken[];
  fieldPlayers: PlayerToken[];
  plannedSubstitutions: PlannedSubstitution[];
  homeColors: { primary: string; secondary: string; goalkeeper: string; text?: string };
  awayColors: { primary: string; secondary: string; goalkeeper: string; text?: string };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSquadDrawer: () => void;
  onOpenSubstitutionModal: (benchPlayerId?: string, fieldPlayerId?: string) => void;
  onAddBenchPlayer: (player: {
    id: string;
    name: string;
    number: number;
    role: string;
    team: 'home' | 'away';
  }) => void;
  onRemoveBenchPlayer: (id: string) => void;
  onMoveToPitch: (benchPlayer: PlayerToken) => void;
  onExecuteSubstitution: (sub: PlannedSubstitution, createNewPhase: boolean) => void;
  onDeleteSubstitution: (id: string) => void;
}

const COMMON_POSITIONS = ['TW', 'LV', 'IV', 'RV', 'DM', 'ZM', 'OM', 'LM', 'RM', 'LA', 'RA', 'ST', 'JOKER'];

export default function TacticsBenchBar({
  benchPlayers = [],
  fieldPlayers = [],
  plannedSubstitutions = [],
  homeColors,
  awayColors,
  isCollapsed,
  onToggleCollapse,
  onOpenSquadDrawer,
  onOpenSubstitutionModal,
  onAddBenchPlayer,
  onRemoveBenchPlayer,
  onMoveToPitch,
  onExecuteSubstitution,
  onDeleteSubstitution
}: TacticsBenchBarProps) {
  // Quick Add Bench Player State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickNumber, setQuickNumber] = useState('12');
  const [quickRole, setQuickRole] = useState('ZM');
  const [quickTeam, setQuickTeam] = useState<'home' | 'away'>('home');

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = quickName.trim() || `Spieler ${quickNumber}`;
    const num = parseInt(quickNumber) || 12;
    onAddBenchPlayer({
      id: `bench_${Date.now()}`,
      name,
      number: num,
      role: quickRole,
      team: quickTeam
    });
    setQuickName('');
    setQuickNumber(String(num + 1));
    setIsQuickAddOpen(false);
  };

  const getPlayerColor = (p: PlayerToken) => {
    if (p.customColor) return p.customColor;
    const isHome = p.team === 'home';
    const isGK = p.isGoalkeeper || p.role === 'TW';
    return isHome
      ? (isGK ? homeColors.goalkeeper : homeColors.primary)
      : (isGK ? awayColors.goalkeeper : awayColors.primary);
  };

  return (
    <div className="w-full rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-xl overflow-hidden backdrop-blur-md transition-all">
      
      {/* 1. Header Bar (always visible) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 bg-zinc-900/80 border-b border-zinc-800/80">
        
        {/* Left: Title & Badges */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-2 text-left group hover:opacity-90 transition-opacity"
            title={isCollapsed ? 'Reservebank aufklappen' : 'Reservebank einklappen'}
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-white tracking-tight">Reservebank</span>
          </button>

          {/* Player Count Badge */}
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-bold font-mono text-zinc-300">
            {benchPlayers.length} {benchPlayers.length === 1 ? 'Spieler' : 'Spieler'}
          </span>

          {/* Planned Subs Badge */}
          {plannedSubstitutions.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold font-mono text-emerald-300 flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {plannedSubstitutions.length} Wechsel geplant
            </span>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5">
          
          {/* Plan Substitution Button */}
          <button
            type="button"
            onClick={() => onOpenSubstitutionModal()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all active:scale-95"
            title="Wechsel vorbereiten (z. B. Theo für Albert)"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Wechsel planen</span>
          </button>

          {/* Quick Add Player Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isCollapsed) onToggleCollapse();
              setIsQuickAddOpen((prev) => !prev);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-bold transition-all active:scale-95"
            title="Spieler manuell zur Reservebank hinzufügen"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ Bank</span>
          </button>

          {/* Squad Drawer Button */}
          <button
            type="button"
            onClick={onOpenSquadDrawer}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-bold transition-all active:scale-95"
            title="Aus Vereins-Kader auswählen"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Kader</span>
          </button>

          {/* Collapse Toggle Chevron */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
            title={isCollapsed ? 'Aufklappen' : 'Einklappen'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

        </div>

      </div>

      {/* 2. Collapsible Body Area */}
      {!isCollapsed && (
        <div className="p-3 sm:p-4 space-y-3 bg-zinc-950/60">
          
          {/* Quick Add Form Dropdown */}
          {isQuickAddOpen && (
            <form
              onSubmit={handleQuickAddSubmit}
              className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-wrap items-center gap-2 animate-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Name:</span>
                <input
                  type="text"
                  placeholder="z. B. Theo"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-1 w-20">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Nr:</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={quickNumber}
                  onChange={(e) => setQuickNumber(e.target.value)}
                  className="w-12 bg-zinc-950 border border-zinc-800 rounded-lg px-1.5 py-1 text-xs font-mono text-center text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Pos:</span>
                <select
                  value={quickRole}
                  onChange={(e) => setQuickRole(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-bold text-zinc-300 focus:outline-none focus:border-emerald-500"
                >
                  {COMMON_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={quickTeam}
                  onChange={(e) => setQuickTeam(e.target.value as 'home' | 'away')}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-bold text-zinc-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="home">Heim</option>
                  <option value="away">Gast</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 ms-auto">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          )}

          {/* Section: Prepared Substitutions list */}
          {plannedSubstitutions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Vorbereitete Wechsel ({plannedSubstitutions.length})</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {plannedSubstitutions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-2.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 hover:border-emerald-500/60 transition-all flex flex-col gap-2"
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{sub.minute ? `${sub.minute}. Min` : 'Geplant'}</span>
                      </span>
                      {sub.notes && (
                        <span className="text-[10px] text-zinc-400 truncate max-w-[140px]" title={sub.notes}>
                          {sub.notes}
                        </span>
                      )}
                    </div>

                    {/* Swap comparison */}
                    <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      
                      {/* IN */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full border border-white flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                          style={{ backgroundColor: getPlayerColor(sub.playerIn) }}
                        >
                          {sub.playerIn.number}
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-bold text-white block truncate">
                            {sub.playerIn.name}
                          </span>
                          <span className="text-[9px] text-emerald-400 font-mono">
                            EIN ({sub.playerIn.role})
                          </span>
                        </div>
                      </div>

                      {/* Swap Arrow */}
                      <div className="w-6 h-6 rounded-full bg-zinc-800 text-emerald-400 flex items-center justify-center shrink-0">
                        <ArrowLeftRight className="w-3 h-3" />
                      </div>

                      {/* OUT */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 text-right justify-end">
                        <div className="truncate">
                          <span className="text-xs font-bold text-white block truncate">
                            {sub.playerOut.name}
                          </span>
                          <span className="text-[9px] text-rose-400 font-mono">
                            AUS ({sub.playerOut.role})
                          </span>
                        </div>
                        <div
                          className="w-6 h-6 rounded-full border border-white flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                          style={{ backgroundColor: getPlayerColor(sub.playerOut) }}
                        >
                          {sub.playerOut.number}
                        </div>
                      </div>

                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onDeleteSubstitution(sub.id)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-400 transition-all"
                        title="Vorbereitung löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onExecuteSubstitution(sub, true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-[11px] font-bold transition-all active:scale-95"
                        title="Erstellt eine neue Animations-Phase in der Timeline mit durchgeführtem Wechsel"
                      >
                        <Play className="w-3 h-3" />
                        <span>Neue Phase</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onExecuteSubstitution(sub, false)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95"
                        title="Wechsel sofort in dieser Phase vollziehen"
                      >
                        <Check className="w-3 h-3" />
                        <span>Jetzt ausführen</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Bench Players list */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">
                Ersatzspieler ({benchPlayers.length})
              </span>
              {benchPlayers.length === 0 && (
                <span className="text-[11px] text-zinc-500 italic">
                  Noch keine Ersatzspieler auf der Bank.
                </span>
              )}
            </div>

            {benchPlayers.length === 0 ? (
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center space-y-2">
                <p className="text-xs text-zinc-400">
                  Die Reservebank ist aktuell leer. Lege Auswechselspieler an, um Wechsel vorzubereiten (z. B. Theo für Albert).
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsQuickAddOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Spieler anlegen (z. B. Theo)</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSquadDrawer}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold transition-all"
                  >
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Aus Kader laden</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
                {benchPlayers.map((player) => {
                  const hasPlannedSub = plannedSubstitutions.some(
                    (s) => s.playerIn.id === player.id
                  );

                  return (
                    <div
                      key={player.id}
                      className={`shrink-0 p-2.5 rounded-2xl border transition-all flex items-center gap-2.5 ${
                        hasPlannedSub
                          ? 'bg-emerald-950/20 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
                          : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Jersey Token */}
                      <div
                        className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs text-white shadow-md shrink-0"
                        style={{ backgroundColor: getPlayerColor(player) }}
                      >
                        {player.number}
                      </div>

                      {/* Info */}
                      <div className="min-w-[60px] max-w-[110px]">
                        <span className="text-xs font-bold text-white block truncate">
                          {player.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                          <span>{player.role || 'SP'}</span>
                          <span>•</span>
                          <span>{player.team === 'home' ? 'H' : 'G'}</span>
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 border-s border-zinc-800 ps-1.5">
                        
                        {/* Plan Sub with this player */}
                        <button
                          type="button"
                          onClick={() => onOpenSubstitutionModal(player.id)}
                          className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95"
                          title={`Wechsel vorbereiten mit ${player.name}`}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Move to Pitch */}
                        <button
                          type="button"
                          onClick={() => onMoveToPitch(player)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all active:scale-95"
                          title={`${player.name} direkt aufs Spielfeld setzen`}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Remove from bench */}
                        <button
                          type="button"
                          onClick={() => onRemoveBenchPlayer(player.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-all active:scale-95"
                          title="Von der Bank entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
