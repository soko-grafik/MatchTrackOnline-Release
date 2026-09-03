"use client";

import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Users,
  Check,
  BookmarkPlus,
  Layers,
  Sparkles,
  Shield
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { getTacticsFormations, createTacticsFormation, deleteTacticsFormation } from '@/services/api';

interface TacticsFormationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayers: any[];
  onApplyFormation: (positions: any[]) => void;
}

export default function TacticsFormationModal({
  isOpen,
  onClose,
  currentPlayers,
  onApplyFormation
}: TacticsFormationModalProps) {
  const { toast, confirm: confirmModal } = useToast();
  const [formations, setFormations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'11v11' | '9v9' | '7v7' | '6v6' | 'custom'>('11v11');

  // Save new formation state
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [newFormationName, setNewFormationName] = useState('');
  const [newFormationType, setNewFormationType] = useState('11v11');

  useEffect(() => {
    if (isOpen) {
      loadFormations();
    }
  }, [isOpen]);

  const loadFormations = async () => {
    setLoading(true);
    try {
      const data = await getTacticsFormations();
      if (Array.isArray(data)) {
        setFormations(data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Formationen:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (positions: any[]) => {
    onApplyFormation(positions);
    toast.success('Formation erfolgreich aufgestellt!');
    onClose();
  };

  const handleSaveCurrentAsFormation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormationName.trim()) {
      toast.error('Bitte gib einen Namen für die Formation ein.');
      return;
    }

    const homeTokens = currentPlayers.filter((p) => p.team === 'home');
    if (homeTokens.length === 0) {
      toast.error('Keine Heim-Spieler auf dem Feld vorhanden.');
      return;
    }

    try {
      const positionsData = homeTokens.map((p) => ({
        id: p.id,
        role: p.role || p.label || 'SP',
        number: p.number || 0,
        x: p.x,
        y: p.y,
        label: p.label || p.name || ''
      }));

      const newPreset = await createTacticsFormation({
        name: newFormationName.trim(),
        system_type: newFormationType,
        player_count: homeTokens.length,
        positions_data: positionsData
      });

      toast.success(`Lieblingsformation "${newFormationName}" gespeichert!`);
      setFormations((prev) => [...prev, newPreset]);
      setIsSavingCustom(false);
      setNewFormationName('');
      setActiveTab('custom');
    } catch (err) {
      console.error('Fehler beim Speichern der Formation:', err);
      toast.error('Fehler beim Speichern der Formation.');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    const confirmed = await confirmModal({
      title: 'Formation löschen',
      message: `Möchtest du die Formation "${name}" wirklich löschen?`,
      confirmText: 'Löschen',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await deleteTacticsFormation(id);
      toast.success(`Formation "${name}" gelöscht.`);
      setFormations((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      toast.error('Fehler beim Löschen der Formation.');
    }
  };

  if (!isOpen) return null;

  const filteredFormations = formations.filter((f) => {
    if (activeTab === 'custom') return !f.is_default;
    return f.system_type === activeTab;
  });

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Formationen & Aufstellungen
              </h2>
              <p className="text-xs text-zinc-400">
                Wähle eine Standard-Formation oder speichere eigene Taktik-Muster
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

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-2 bg-zinc-950 border-b border-zinc-800">
          {(['11v11', '9v9', '7v7', '6v6', 'custom'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {tab === '11v11' && '11er Feld'}
              {tab === '9v9' && '9er Feld'}
              {tab === '7v7' && '7er Feld'}
              {tab === '6v6' && '6er Feld'}
              {tab === 'custom' && 'Eigene'}
            </button>
          ))}
        </div>

        {/* Formations List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
          {isSavingCustom ? (
            <form onSubmit={handleSaveCurrentAsFormation} className="p-4 rounded-2xl bg-zinc-900/70 border border-indigo-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BookmarkPlus className="w-4 h-4 text-indigo-400" />
                  Aktuelle Aufstellung speichern
                </span>
                <button
                  type="button"
                  onClick={() => setIsSavingCustom(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Abbrechen
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Name der Formation
                </label>
                <input
                  type="text"
                  placeholder="z. B. 4-3-3 Asymmetrisch Pressing"
                  value={newFormationName}
                  onChange={(e) => setNewFormationName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Spielform
                </label>
                <select
                  value={newFormationType}
                  onChange={(e) => setNewFormationType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="11v11">11 gegen 11 (Großfeld)</option>
                  <option value="9v9">9 gegen 9 (D-Jugend)</option>
                  <option value="7v7">7 gegen 7 (E/F-Jugend)</option>
                  <option value="6v6">6 gegen 6 (F/E-Jugend / Halle)</option>
                  <option value="5v5">5 gegen 5 / Funino</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Formation in Favoriten speichern
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsSavingCustom(true)}
              className="w-full py-3 px-4 rounded-2xl border border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-900/30 hover:bg-indigo-500/5 text-zinc-400 hover:text-indigo-400 font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Aktuelle Aufstellung vom Spielfeld als Formation speichern
            </button>
          )}

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredFormations.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Keine Formationen in dieser Kategorie vorhanden.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {filteredFormations.map((form) => (
                <div
                  key={form.id}
                  onClick={() => handleApply(form.positions_data)}
                  className="group relative p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-900 cursor-pointer transition-all active:scale-95 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                      {form.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-mono font-semibold">
                      {form.player_count} Spieler
                    </span>
                  </div>

                  {/* Visual mini-preview of token distribution */}
                  <div className="relative w-full h-16 rounded-xl bg-emerald-950/40 border border-emerald-900/30 overflow-hidden">
                    <div className="absolute inset-y-0 start-1/2 w-px bg-white/10" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border border-white/10" />
                    </div>
                    {form.positions_data?.slice(0, 11).map((pos: any, idx: number) => (
                      <div
                        key={idx}
                        className="absolute w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow-xs"
                        style={{
                          left: `${(pos.x ?? 0.5) * 100}%`,
                          top: `${(pos.y ?? 0.5) * 100}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    ))}
                  </div>

                  {!form.is_default && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={(e) => handleDelete(e, form.id, form.name)}
                        className="text-[10px] text-red-500 hover:text-red-400 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" /> Löschen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-800 bg-zinc-900/60">
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
