"use client";

import { useState, useEffect } from 'react';
import { X, Save, Loader2, RefreshCw, Upload, Video, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { replaceMatchVideo, getTeams, getMatchDetails, deleteMatchStream } from '../services/api';
import AlertDialog from '@/components/AlertDialog';

interface EditMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: any) => void;
  match: any;
}

export default function EditMatchModal({ isOpen, onClose, onSave, match }: EditMatchModalProps) {
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [videoQuality, setVideoQuality] = useState('');
  const [category, setCategory] = useState('Punktspiel');
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [streams, setStreams] = useState<any[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [deletingStreamId, setDeletingStreamId] = useState<string | null>(null);
  const [confirmDeleteStream, setConfirmDeleteStream] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      getTeams().then((data) => {
        if (Array.isArray(data)) {
          setTeams(data);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  const { user, logout, token } = useAuth();
  const [recordingDate, setRecordingDate] = useState('');
  const roleUpper = user?.role?.toUpperCase();
  const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'TRAINER';

  const loadMatchStreams = async (matchId: string) => {
    setStreamsLoading(true);
    try {
      const matchRes = await getMatchDetails(matchId);
      const m = matchRes?.match || matchRes;
      if (m && Array.isArray(m.available_streams)) {
        setStreams(m.available_streams);
      } else if (match?.available_streams) {
        setStreams(match.available_streams);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Streams:", err);
      if (match?.available_streams) {
        setStreams(match.available_streams);
      }
    } finally {
      setStreamsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && match) {
      setName(match.name || '');
      setTeamName(match.team_name || '');
      setCategory(match.category || 'Punktspiel');
      setVideoQuality(match.video_quality || '');

      if (match.id) {
        loadMatchStreams(match.id);
      }

      // Support comma-separated team IDs for multi-team assignment
      let ids = match.team_id ? match.team_id.split(',').map((id: string) => id.trim()).filter(Boolean) : [];

      // Fallback: If team_id is missing, try to resolve team IDs by matching team_name against teams list
      if (ids.length === 0 && match.team_name && teams.length > 0) {
        const teamNameParts = match.team_name.split(',').map((s: string) => s.trim().toLowerCase());
        const matchedIds = teams
          .filter((t: any) => teamNameParts.includes((t.name || '').toLowerCase()))
          .map((t: any) => t.id);
        if (matchedIds.length > 0) {
          ids = matchedIds;
        }
      }

      setTeamId(ids[0] || '');
      setSelectedTeamIds(ids);

      // Parse and format recording_date for datetime-local input (YYYY-MM-DDTHH:mm)
      if (match.recording_date) {
        const d = new Date(match.recording_date);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setRecordingDate(formatted);
      } else if (match.created_at) {
        const d = new Date(match.created_at);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setRecordingDate(formatted);
      } else {
        setRecordingDate('');
      }
    }
  }, [isOpen, match, teams]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    // Join all selected team IDs as comma-separated string
    const joinedTeamIds = selectedTeamIds.join(',');
    const updatedData = {
      name,
      team_id: joinedTeamIds || teamId,
      team_name: teamName,
      category,
      video_quality: videoQuality,
      recording_date: recordingDate ? new Date(recordingDate).toISOString() : null,
    };
    await onSave(updatedData);
    setLoading(false);
  };

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type?: 'info' | 'success' | 'warning' | 'error'; title?: string }>({
    isOpen: false,
    message: '',
    type: 'error'
  });

  const handleDeleteStream = async (streamId: string) => {
    if (!match?.id) return;
    setDeletingStreamId(streamId);
    try {
      const res = await deleteMatchStream(match.id, streamId);
      setConfirmDeleteStream(null);
      setAlertConfig({
        isOpen: true,
        title: 'Video gelöscht',
        message: res.message || 'Das Video wurde erfolgreich gelöscht.',
        type: 'success'
      });
      await loadMatchStreams(match.id);
    } catch (err: any) {
      console.error("Fehler beim Löschen des Streams:", err);
      setAlertConfig({
        isOpen: true,
        title: 'Fehler',
        message: err.response?.data?.detail || err.message || 'Fehler beim Löschen des Videos.',
        type: 'error'
      });
    } finally {
      setDeletingStreamId(null);
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!match?.id) {
      setAlertConfig({ isOpen: true, message: 'Fehler: Match-ID nicht gefunden.', type: 'error' });
      return;
    }

    if (!token || token.split('.').length !== 3) {
        setAlertConfig({ isOpen: true, message: 'Authentifizierungstoken ist ungültig oder fehlt. Bitte loggen Sie sich erneut ein.', type: 'error' });
        logout();
        return;
    }

    setThumbLoading(true);
    try {
      const response = await fetch(`/api/admin/matches/${match.id}/regenerate-thumbnail`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Fehler beim Starten der Thumbnail-Generierung.');
      }
      
      setAlertConfig({
        isOpen: true,
        message: 'Thumbnail-Generierung wurde im Hintergrund gestartet. Es kann einen Moment dauern, bis das neue Bild sichtbar ist.',
        type: 'success',
        title: 'Thumbnail gestartet'
      });

    } catch (error: any) {
      console.error('Fehler:', error);
      setAlertConfig({ isOpen: true, message: `Ein Fehler ist aufgetreten: ${error.message}`, type: 'error' });
    } finally {
      setThumbLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-lg font-bold text-white">Match bearbeiten</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          <div>
            <label htmlFor="edit-name" className="mb-2 block text-sm font-medium text-zinc-300">Match-Name</label>
            <input
              type="text"
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Zugewiesene Mannschaft(en)</label>
            <div className="flex flex-wrap gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
              {teams.map((t: any) => {
                const isSelected = selectedTeamIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      let updated: string[];
                      if (isSelected) {
                        updated = selectedTeamIds.filter(id => id !== t.id);
                      } else {
                        updated = [...selectedTeamIds, t.id];
                      }
                      setSelectedTeamIds(updated);

                      const selectedNames = teams
                        .filter((item: any) => updated.includes(item.id))
                        .map((item: any) => item.name);
                      setTeamName(selectedNames.join(', '));
                      setTeamId(updated[0] || '');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-primary border-primary text-white shadow-md'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    {t.name} {t.age_group ? `(${t.age_group})` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="edit-teamName" className="mb-2 block text-sm font-medium text-zinc-300">Angezeigter Team-Name / Kombination</label>
            <input
              type="text"
              id="edit-teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="z.B. E1, E2"
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="edit-category" className="mb-2 block text-sm font-medium text-zinc-300">Kategorie</label>
            <select
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
            >
              <option value="Punktspiel">Punktspiel</option>
              <option value="Pokalspiel">Pokalspiel</option>
              <option value="Testspiel">Testspiel</option>
              <option value="Training">Training</option>
              <option value="Trainingslager">Trainingslager</option>
            </select>
          </div>

          <div>
            <label htmlFor="edit-recordingDate" className="mb-2 block text-sm font-medium text-zinc-300">Datum & Uhrzeit des Matches</label>
            <input
              type="datetime-local"
              id="edit-recordingDate"
              value={recordingDate}
              onChange={(e) => setRecordingDate(e.target.value)}
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary text-scheme-dark"
            />
          </div>

          <div>
            <label htmlFor="edit-quality" className="mb-2 block text-sm font-medium text-zinc-300">Video-Qualität</label>
            <input
              type="text"
              id="edit-quality"
              value={videoQuality}
              onChange={(e) => setVideoQuality(e.target.value)}
              placeholder="z.B. 1080p, 720p"
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          
          {isAdmin && (
            <div className="mt-6 space-y-4 border-t border-zinc-800 pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Video className="h-4 w-4 text-blue-400" />
                Video-Perspektiven verwalten
              </h3>

              {/* Vorhandene Streams mit Löschen-Funktion */}
              <div className="space-y-2">
                {streamsLoading ? (
                  <div className="flex items-center gap-2 p-3 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> Lade Video-Perspektiven...
                  </div>
                ) : streams.length === 0 ? (
                  <div className="p-3 text-xs text-zinc-500 bg-zinc-900/50 border border-zinc-800/80 rounded-xl text-center">
                    Keine Videodateien hinterlegt
                  </div>
                ) : (
                  streams.map((s: any) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{s.id === '32x9' ? '🏟️' : '📹'}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{s.label || (s.id === '32x9' ? 'Panorama' : 'Standard')}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-800 text-zinc-400">
                              {s.id === '32x9' ? 'Breitbild' : '16:9'}
                            </span>
                          </div>
                          {s.video_path && (
                            <div className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px] sm:max-w-xs">
                              {s.video_path}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteStream({ id: s.id, label: s.label || (s.id === '32x9' ? 'Panorama-Video' : 'Standard-Video') })}
                        disabled={deletingStreamId === s.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all shrink-0 disabled:opacity-50"
                        title={`${s.label || s.id} löschen`}
                      >
                        {deletingStreamId === s.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Löschen</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex gap-3 rounded-lg border border-blue-900/30 bg-blue-950/20 p-3 text-xs text-blue-300">
                <Video className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                <p>
                  Im Upload-Bereich kannst du <strong>Standard- oder Panorama-Videos gezielt austauschen</strong> oder eine fehlende Perspektive <strong>nachträglich ergänzen</strong>. Kommentare und Zeitstempel bleiben erhalten.
                </p>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/admin/upload?replaceMatchId=${match?.id}&replaceMatchName=${encodeURIComponent(match?.name || '')}`;
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 hover:border-zinc-500"
              >
                <Upload className="h-4 w-4" />
                Zum Upload-Bereich (Video austauschen / hinzufügen)
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-zinc-800 bg-zinc-900/50 p-4">
          {isAdmin && (
            <button
              onClick={handleRegenerateThumbnail}
              disabled={thumbLoading}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-yellow-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-yellow-700 disabled:opacity-50"
            >
              {thumbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Thumbnail neu
            </button>
          )}
          
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Abbrechen
          </button>
          
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Speichern
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Deleting Single Stream */}
      {confirmDeleteStream && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-950 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Videospur löschen</h3>
                <p className="text-xs text-zinc-400">{confirmDeleteStream.label}</p>
              </div>
            </div>
            
            <p className="text-xs text-zinc-300">
              Möchtest du das <strong>{confirmDeleteStream.label}</strong> wirklich von diesem Match entfernen? Die Videodatei und Stream-Segmente werden gelöscht. Das Match, Kommentare und Events bleiben erhalten.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteStream(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStream(confirmDeleteStream.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20"
              >
                <Trash2 className="w-4 h-4" />
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

