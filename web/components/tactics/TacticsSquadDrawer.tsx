"use client";

import { useState, useEffect } from 'react';
import {
  X,
  Users,
  Search,
  Plus,
  Shield,
  UserCheck,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { getTeams, getPlayers, getMediaUrl } from '@/services/api';

interface TacticsSquadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayerToken: (playerData: {
    id: string;
    name: string;
    number: number;
    role: string;
    team: 'home' | 'away';
    avatar_url?: string;
  }) => void;
}

export default function TacticsSquadDrawer({
  isOpen,
  onClose,
  onAddPlayerToken
}: TacticsSquadDrawerProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [players, setPlayers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetTeam, setTargetTeam] = useState<'home' | 'away'>('home');

  useEffect(() => {
    if (isOpen) {
      loadTeamsAndPlayers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedTeamId) {
      loadPlayers(selectedTeamId);
    }
  }, [selectedTeamId]);

  const loadTeamsAndPlayers = async () => {
    setLoading(true);
    try {
      const teamsData = await getTeams();
      if (Array.isArray(teamsData) && teamsData.length > 0) {
        setTeams(teamsData);
        setSelectedTeamId(teamsData[0].id);
      } else {
        loadPlayers();
      }
    } catch (err) {
      console.error('Fehler beim Laden der Teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (teamId?: string) => {
    setLoading(true);
    try {
      const data = await getPlayers({ team_id: teamId || undefined });
      if (Array.isArray(data)) {
        setPlayers(data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Spieler:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter((p) => {
    const full = `${p.first_name || ''} ${p.last_name || ''} ${p.jersey_number || ''} ${p.primary_position || ''}`.toLowerCase();
    return full.includes(searchQuery.toLowerCase());
  });

  const handleSelectPlayer = (player: any) => {
    onAddPlayerToken({
      id: `p_${player.id}_${Date.now()}`,
      name: player.last_name || player.first_name || 'Spieler',
      number: player.jersey_number || 0,
      role: player.primary_position || 'SP',
      team: targetTeam,
      avatar_url: player.avatar_path ? getMediaUrl(player.avatar_path) : undefined
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Right Drawer */}
      <aside className="fixed top-0 bottom-0 end-0 z-[99999] w-80 sm:w-96 bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Kader & Spielerbank</h3>
              <p className="text-[10px] text-zinc-400">Spieler auf das Feld ziehen / aufstellen</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls: Target Team & Team Selector */}
        <div className="p-4 border-b border-zinc-800 space-y-3 bg-zinc-900/30">
          {/* Target Team Switcher */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
            <button
              onClick={() => setTargetTeam('home')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                targetTeam === 'home'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white border border-blue-400" />
              Heim-Team
            </button>

            <button
              onClick={() => setTargetTeam('away')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                targetTeam === 'away'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white border border-red-400" />
              Gast-Team
            </button>
          </div>

          {/* Team Dropdown */}
          {teams.length > 0 && (
            <div>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.age_group || 'Kader'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Spieler nach Name oder Nummer suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl ps-9 pe-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>
        </div>

        {/* Players List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
              <p>Keine Spieler im gewählten Kader gefunden.</p>
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <div
                key={player.id}
                onClick={() => handleSelectPlayer(player)}
                className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-amber-500/40 hover:bg-zinc-900 flex items-center justify-between cursor-pointer transition-all active:scale-95 group"
              >
                <div className="flex items-center gap-3">
                  {/* Number Badge */}
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 group-hover:bg-amber-500/20 text-white group-hover:text-amber-400 border border-zinc-700/50 flex items-center justify-center font-mono font-extrabold text-xs transition-colors">
                    {player.jersey_number ?? '–'}
                  </div>

                  <div>
                    <span className="text-xs font-bold text-white block group-hover:text-amber-300 transition-colors">
                      {player.first_name} {player.last_name}
                    </span>
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded-sm bg-zinc-800 text-zinc-300 font-semibold text-[9px]">
                        {player.primary_position || 'Feld'}
                      </span>
                      {player.dominant_foot && (
                        <span>• {player.dominant_foot === 'LEFT' ? 'Links' : 'Rechts'}</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-lg bg-zinc-800 group-hover:bg-amber-500 text-zinc-400 group-hover:text-zinc-950 flex items-center justify-center transition-all">
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 text-center">
          <span className="text-[11px] text-zinc-400 block">
            Klicke auf einen Spieler, um ihn auf die Taktiktafel zu setzen.
          </span>
        </div>

      </aside>
    </>
  );
}
