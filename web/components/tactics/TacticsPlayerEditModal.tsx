"use client";

import { useState, useEffect } from 'react';
import {
  X,
  User,
  Hash,
  Shield,
  Palette,
  Trash2,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import { PlayerToken } from './TacticsBoardCanvas';

interface TacticsPlayerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerToken | null;
  onUpdatePlayer: (updated: Partial<PlayerToken>) => void;
  onDeletePlayer: (id: string) => void;
  homeColor: string;
  awayColor: string;
}

const COMMON_ROLES = [
  'TW', 'LV', 'IV', 'LIV', 'RIV', 'RV',
  'DM', 'ZM', 'LM', 'RM', 'OM',
  'LA', 'RA', 'MS', 'ST', 'JOKER'
];

export default function TacticsPlayerEditModal({
  isOpen,
  onClose,
  player,
  onUpdatePlayer,
  onDeletePlayer,
  homeColor,
  awayColor
}: TacticsPlayerEditModalProps) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState(1);
  const [role, setRole] = useState('IV');
  const [team, setTeam] = useState<'home' | 'away' | 'neutral' | 'referee'>('home');
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);
  const [customColor, setCustomColor] = useState('');

  useEffect(() => {
    if (player) {
      setName(player.name || '');
      setNumber(player.number || 1);
      setRole(player.role || 'SP');
      setTeam(player.team || 'home');
      setIsGoalkeeper(Boolean(player.isGoalkeeper || player.role === 'TW'));
      setCustomColor(player.customColor || '');
    }
  }, [player]);

  if (!isOpen || !player) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePlayer({
      name: name.trim() || `S${number}`,
      number: Number(number) || 1,
      role: role.trim().toUpperCase() || 'SP',
      team,
      isGoalkeeper: isGoalkeeper || role === 'TW',
      customColor: customColor || undefined
    });
    onClose();
  };

  const handleQuickRoleSelect = (r: string) => {
    setRole(r);
    if (r === 'TW') {
      setIsGoalkeeper(true);
    }
    // If name was just the old role or empty, suggest new role as name
    if (!name || COMMON_ROLES.includes(name.toUpperCase())) {
      setName(r);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-md"
              style={{
                backgroundColor: customColor || (team === 'home' ? homeColor : awayColor),
                borderColor: '#ffffff',
                color: '#ffffff'
              }}
            >
              {number}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Spieler-Token bearbeiten
              </h2>
              <p className="text-[11px] text-zinc-400">
                Name, Position, Rückennummer & Trikotfarbe anpassen
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          
          {/* 1. Name & Number Inputs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Name / Beschriftung
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="z. B. Müller, IV, Kapitän"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl ps-9 pe-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Nummer
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={number}
                  onChange={(e) => setNumber(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl ps-9 pe-3.5 py-2.5 text-xs text-white focus:outline-hidden transition-colors text-center font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* 2. Position / Role Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-400">
              Position / Rolle (z. B. IV, DM, ST)
            </label>
            <input
              type="text"
              placeholder="z. B. IV, ZM, MS"
              value={role}
              onChange={(e) => setRole(e.target.value.toUpperCase())}
              className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white uppercase font-mono font-bold focus:outline-hidden mb-2"
            />
            {/* Quick Role Badges */}
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
              {COMMON_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleQuickRoleSelect(r)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                    role === r
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Team & Role Toggles */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-zinc-400">
              Team-Zugehörigkeit
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'home', label: 'Heim', color: homeColor },
                { id: 'away', label: 'Gast', color: awayColor },
                { id: 'neutral', label: 'Joker', color: '#a855f7' },
                { id: 'referee', label: 'Schiri', color: '#eab308' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTeam(t.id as any);
                    setCustomColor('');
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all ${
                    team === t.id && !customColor
                      ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-sm'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full mb-1 border border-white/40"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-[10px]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Goalkeeper Checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-all">
            <input
              type="checkbox"
              checked={isGoalkeeper}
              onChange={(e) => {
                setIsGoalkeeper(e.target.checked);
                if (e.target.checked && role !== 'TW') setRole('TW');
              }}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-white block">Torwart-Status</span>
              <span className="text-[10px] text-zinc-400">Nutzt die konfigurierte Torwart-Trikotfarbe</span>
            </div>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                onDeletePlayer(player.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Löschen</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Übernehmen</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
