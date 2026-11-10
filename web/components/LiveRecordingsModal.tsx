"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, Film, HardDrive, Clock, Calendar, Check, AlertCircle, 
  Trash2, ArrowRight, RefreshCw, Trophy, Users, ShieldAlert, Sparkles 
} from 'lucide-react';
import { api } from '@/services/api';

interface RecordingItem {
  id: string;
  title: string;
  file_path: string;
  file_size_bytes: number;
  duration_seconds: number;
  mode: string;
  status: string;
  converted_match_id?: string | null;
  created_at: string;
}

interface TeamItem {
  id: string;
  name: string;
  age_group?: string;
}

interface LiveRecordingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchCreated?: (matchId: string) => void;
}

export default function LiveRecordingsModal({
  isOpen,
  onClose,
  onMatchCreated
}: LiveRecordingsModalProps) {
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRecording, setActiveRecording] = useState<any>(null);

  // Convert Dialog State
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<RecordingItem | null>(null);
  const [matchName, setMatchName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [category, setCategory] = useState('Punktspiel');
  const [recordingDate, setRecordingDate] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Delete State
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recRes, teamRes] = await Promise.all([
        api.get('/admin/livestream/recordings'),
        api.get('/admin/teams').catch(() => ({ data: [] }))
      ]);

      if (recRes.data) {
        setRecordings(recRes.data.recordings || []);
        setActiveRecording(recRes.data.active_recording || null);
      }
      if (teamRes.data) {
        setTeams(teamRes.data || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Aufnahmen:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} min`;
  };

  const openConvertDialog = (rec: RecordingItem) => {
    setSelectedRec(rec);
    setMatchName(rec.title || 'Neues Match');
    setSelectedTeamId(teams.length > 0 ? teams[0].id : '');
    setCategory('Punktspiel');
    setRecordingDate(rec.created_at ? rec.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
    setConvertSuccess(null);
    setConvertError(null);
    setConvertModalOpen(true);
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRec) return;

    setIsConverting(true);
    setConvertError(null);
    try {
      const res = await api.post(`/admin/livestream/recordings/${selectedRec.id}/convert-to-match`, {
        name: matchName.trim(),
        team_id: selectedTeamId || null,
        category: category,
        recording_date: recordingDate || null
      });

      if (res.data && res.data.success) {
        setConvertSuccess(`Match "${matchName}" erfolgreich angelegt!`);
        loadData();
        if (onMatchCreated && res.data.match_id) {
          onMatchCreated(res.data.match_id);
        }
        setTimeout(() => {
          setConvertModalOpen(false);
          setConvertSuccess(null);
        }, 2000);
      }
    } catch (err: any) {
      setConvertError(err.response?.data?.detail || 'Fehler beim Konvertieren der Aufnahme.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDelete = async (recId: string) => {
    if (!window.confirm('Möchtest du diese Aufnahme wirklich dauerhaft vom Server löschen?')) {
      return;
    }

    setIsDeletingId(recId);
    try {
      await api.delete(`/admin/livestream/recordings/${recId}`);
      setRecordings((prev) => prev.filter((r) => r.id !== recId));
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert('Aufnahme konnte nicht gelöscht werden.');
    } finally {
      setIsDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Gespeicherte Livestream-Aufnahmen
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Verwalte aufgezeichnete Spiele auf dem Server und konvertiere sie in MatchTrack-Analysen.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {activeRecording?.is_recording && (
            <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-xs font-semibold text-red-900 dark:text-red-300">
                  Aktuell läuft eine Aufnahme... ({formatDuration(activeRecording.duration_seconds)})
                </span>
              </div>
              <span className="text-xs text-red-700 dark:text-red-400 font-mono">
                {formatFileSize(activeRecording.file_size_bytes)}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
              <RefreshCw className="h-7 w-7 animate-spin mb-2 text-emerald-500" />
              <p className="text-xs">Lade Aufnahmen...</p>
            </div>
          ) : recordings.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400">
              <Film className="h-10 w-10 text-gray-300 dark:text-zinc-700 mb-2" />
              <h4 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Keine Aufnahmen vorhanden</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-500 max-w-sm mt-1">
                Sobald du während eines Livestreams auf "Aufnahme starten" klickst, wird das Spiel hier gespeichert.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((rec) => {
                const isConverted = rec.status === 'CONVERTED' || !!rec.converted_match_id;

                return (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {rec.title}
                        </h4>
                        {isConverted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ✓ Als Match angelegt
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            MP4 Aufnahme
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {rec.created_at ? new Date(rec.created_at).toLocaleDateString('de-DE') : '-'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(rec.duration_seconds)}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3.5 w-3.5" />
                          {formatFileSize(rec.file_size_bytes)}
                        </span>
                        <span className="capitalize text-zinc-400">
                          Modus: {rec.mode}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {!isConverted ? (
                        <button
                          onClick={() => openConvertDialog(rec)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
                        >
                          <Trophy className="h-3.5 w-3.5" /> In Match umwandeln
                        </button>
                      ) : (
                        <a
                          href={`/matches/${rec.converted_match_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center gap-1.5 transition-all"
                        >
                          Zum Match <ArrowRight className="h-3 w-3" />
                        </a>
                      )}

                      <button
                        onClick={() => handleDelete(rec.id)}
                        disabled={isDeletingId === rec.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Aufnahme löschen"
                      >
                        {isDeletingId === rec.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Schließen
          </button>
        </div>

      </div>

      {/* Sub-Dialog: Convert To Match */}
      {convertModalOpen && selectedRec && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4">
            
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-emerald-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Aufnahme in Match umwandeln
                </h3>
              </div>
              <button
                onClick={() => setConvertModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {convertSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                {convertSuccess}
              </div>
            )}

            {convertError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                {convertError}
              </div>
            )}

            <form onSubmit={handleConvertSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Spielbezeichnung / Gegner
                </label>
                <input
                  type="text"
                  required
                  value={matchName}
                  onChange={(e) => setMatchName(e.target.value)}
                  placeholder="z. B. 1. FC Köln vs. Bayer Leverkusen"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Mannschaft zuweisen
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Keine bestimmte Mannschaft</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.age_group ? `(${t.age_group})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">
                    Kategorie
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Punktspiel">Punktspiel</option>
                    <option value="Pokalspiel">Pokalspiel</option>
                    <option value="Testspiel">Testspiel</option>
                    <option value="Training">Training</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">
                    Spieldatum
                  </label>
                  <input
                    type="date"
                    value={recordingDate}
                    onChange={(e) => setRecordingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConvertModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isConverting}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
                >
                  {isConverting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Erstelle Match...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Spiel anlegen
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
