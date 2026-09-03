"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUpload } from '@/contexts/UploadContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getAllUsers, deleteMatchStream, getMatchDetails } from '@/services/api';
import {
  Upload,
  Video,
  FileJson,
  FileText,
  Calendar,
  Users,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Clock,
  UploadCloud,
  Split,
  ArrowLeft,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';

export default function AdminUploadPage() {
  const { user, loading: authLoading } = useAuth();
  const { startUpload, activeUploads } = useUpload();
  const { settings } = useSettings();
  const router = useRouter();

  const searchParams = useSearchParams();
  const replaceMatchId = searchParams.get('replaceMatchId');
  const replaceMatchName = searchParams.get('replaceMatchName');

  const [name, setName] = useState(replaceMatchName || '');
  const [teamName, setTeamName] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [recordingDate, setRecordingDate] = useState('');
  const [category, setCategory] = useState('Punktspiel');

  // Video Format: '16:9' | 'panorama' | 'dual'
  const [uploadMode, setUploadMode] = useState<'16:9' | 'panorama' | 'dual'>('16:9');
  const [skipConversion, setSkipConversion] = useState(false);

  // Single mode file
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Dual mode files
  const [videoFile16x9, setVideoFile16x9] = useState<File | null>(null);
  const [videoFile32x9, setVideoFile32x9] = useState<File | null>(null);

  const [trackingFile, setTrackingFile] = useState<File | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Existing match information when in replace/extend mode
  const [existingStreamsInfo, setExistingStreamsInfo] = useState<{
    has16x9: boolean;
    has32x9: boolean;
    streams: any[];
    matchName: string;
  } | null>(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);
  const [deletingStreamId, setDeletingStreamId] = useState<string | null>(null);
  const [confirmDeleteStream, setConfirmDeleteStream] = useState<{ id: string; label: string } | null>(null);

  const handleDeleteStream = async (streamId: string) => {
    if (!replaceMatchId) return;
    setDeletingStreamId(streamId);
    try {
      await deleteMatchStream(replaceMatchId, streamId);
      setConfirmDeleteStream(null);
      // Reload match details
      const matchRes = await getMatchDetails(replaceMatchId);
      const m = matchRes?.match || matchRes;
      if (m) {
        const streams = m.available_streams || [];
        const has16 = streams.some((s: any) => s.id === '16x9');
        const has32 = streams.some((s: any) => s.id === '32x9');
        setExistingStreamsInfo({
          has16x9: has16,
          has32x9: has32,
          streams: streams,
          matchName: m.name || ''
        });
      }
    } catch (err: any) {
      console.error("Fehler beim Löschen des Streams:", err);
      setError(err.response?.data?.detail || err.message || 'Fehler beim Löschen des Videos.');
    } finally {
      setDeletingStreamId(null);
    }
  };

  const videoInputRef = useRef<HTMLInputElement>(null);
  const video16x9InputRef = useRef<HTMLInputElement>(null);
  const video32x9InputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  const [teamId, setTeamId] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);

  useEffect(() => {
    const roleUpper = user?.role?.toUpperCase();
    if (!authLoading && (!user || (roleUpper !== 'ADMIN' && roleUpper !== 'TEAM_ADMIN' && roleUpper !== 'TRAINER'))) {
      router.push('/');
    } else if (user) {
      const fetchData = async () => {
        try {
          const { getTeams, getMatchDetails } = await import('@/services/api');
          const [allTeams, allUsers] = await Promise.all([
            getTeams().catch(() => []),
            getAllUsers().catch(() => [])
          ]);

          if (Array.isArray(allTeams)) {
            setTeamsList(allTeams);
          }

          if (Array.isArray(allUsers)) {
            setUsers(allUsers.filter((u: any) => u.is_approved && u.id !== user.id));
          }

          if (replaceMatchId) {
            setIsLoadingMatch(true);
            try {
              const matchRes = await getMatchDetails(replaceMatchId);
              const m = matchRes?.match || matchRes;
              if (m) {
                setName(m.name || '');
                setCategory(m.category || 'Punktspiel');
                setAgeGroup(m.age_group || '');

                if (m.recording_date) {
                  const d = new Date(m.recording_date);
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  setRecordingDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                } else if (m.created_at) {
                  const d = new Date(m.created_at);
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  setRecordingDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                }

                let ids = m.team_id ? m.team_id.split(',').map((id: string) => id.trim()).filter(Boolean) : [];
                if (ids.length === 0 && m.team_name && Array.isArray(allTeams) && allTeams.length > 0) {
                  const parts = m.team_name.split(',').map((s: string) => s.trim().toLowerCase());
                  const matched = allTeams.filter((t: any) => parts.includes((t.name || '').toLowerCase())).map((t: any) => t.id);
                  if (matched.length > 0) ids = matched;
                }
                setSelectedTeamIds(ids);
                setTeamId(ids[0] || '');
                setTeamName(m.team_name || '');

                const streams = m.available_streams || [];
                const has16 = streams.some((s: any) => s.id === '16x9');
                const has32 = streams.some((s: any) => s.id === '32x9');
                setExistingStreamsInfo({
                  has16x9: has16,
                  has32x9: has32,
                  streams: streams,
                  matchName: m.name || ''
                });

                if (has16 && has32) {
                  setUploadMode('dual');
                } else if (has32 && !has16) {
                  setUploadMode('panorama');
                } else {
                  setUploadMode('16:9');
                }
              }
            } catch (err) {
              console.error("Failed to fetch match details for replace:", err);
            } finally {
              setIsLoadingMatch(false);
            }
          } else {
            if (Array.isArray(allTeams) && allTeams.length > 0) {
              setTeamId(allTeams[0].id);
              setSelectedTeamIds([allTeams[0].id]);
              setTeamName(allTeams[0].name);
            }
          }
        } catch (err) {
          console.error("Failed to fetch upload page data:", err);
        }
      };

      fetchData();
    }
  }, [user, authLoading, router, replaceMatchId]);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      if (!name) {
        setName(file.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handle16x9Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile16x9(file);
      if (!name) {
        setName(file.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handle32x9Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile32x9(file);
      if (!name) {
        setName(file.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handleTrackingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTrackingFile(e.target.files[0]);
    }
  };

  const hasVideoSelected = uploadMode === 'dual' ? (videoFile16x9 || videoFile32x9) : videoFile;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasVideoSelected) {
      return setError('Bitte wähle mindestens eine Videodatei aus.');
    }
    if (!name) return setError('Bitte gib einen Match-Namen an.');

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('name', name);
      if (teamName) formData.append('team_name', teamName);
      const joinedTeamIds = selectedTeamIds.join(',');
      if (joinedTeamIds) formData.append('team_id', joinedTeamIds);
      else if (teamId) formData.append('team_id', teamId);
      if (category) formData.append('category', category);
      if (recordingDate) formData.append('recording_date', recordingDate);
      if (ageGroup) formData.append('age_group', ageGroup);
      if (selectedUsers.length > 0) formData.append('notify_user_ids', selectedUsers.join(','));

      formData.append('aspect_ratio', uploadMode);
      formData.append('skip_conversion', skipConversion ? 'true' : 'false');

      if (uploadMode === 'dual') {
        if (videoFile16x9) formData.append('video_file_16x9', videoFile16x9);
        if (videoFile32x9) formData.append('video_file_32x9', videoFile32x9);
      } else {
        if (videoFile) formData.append('video_file', videoFile);
      }

      if (trackingFile) {
        formData.append('tracking_file', trackingFile);
      }

      await startUpload(formData, name, replaceMatchId || undefined);
      setSuccess(true);
      if (!replaceMatchId) {
        setName('');
        setTeamName('');
        setTeamId('');
        setSelectedTeamIds([]);
        setRecordingDate('');
        setSelectedUsers([]);
        setVideoFile(null);
        setVideoFile16x9(null);
        setVideoFile32x9(null);
        setTrackingFile(null);
      }
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Starten des Uploads.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || (user && user.role.toUpperCase() !== 'ADMIN' && user.role.toUpperCase() !== 'TRAINER')) return null;

  return (
    <div className="relative flex flex-col min-h-screen bg-zinc-950 text-white font-sans text-[13px]">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <form onSubmit={handleSubmit} className="mx-auto space-y-8">
          <PageHeader
            title={replaceMatchId ? `Video(s) & Match anpassen: ${name || replaceMatchName || 'Match'}` : "Match & Video Upload"}
            subtitle={replaceMatchId ? "PERSPEKTIVEN GEZIELT AUSTAUSCHEN, ERGÄNZEN ODER METADATEN AKTUALISIEREN" : "MATCHTRACK VIDEO PIPELINE (STANDARD, PANORAMA & DUAL-PERSPEKTIVE)"}
            rightElement={
              replaceMatchId ? (
                <button
                  type="button"
                  onClick={() => router.push(`/matches/${replaceMatchId}`)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4 text-zinc-400" />
                  Zurück zum Match
                </button>
              ) : null
            }
          />

          {replaceMatchId && (
            <div className="bg-gradient-to-r from-blue-950/40 via-zinc-900/60 to-purple-950/40 border border-blue-500/30 rounded-2xl p-5 shadow-xl animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Bearbeitungs- & Austausch-Modus
                    </span>
                    {isLoadingMatch && (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> Lade Match-Details...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300">
                    Wähle dein gewünschtes Format. Du kannst <strong>Standard- oder Panorama-Videos gezielt tauschen</strong> oder eine fehlende Perspektive <strong>nachträglich hochladen</strong>. Vorhandene Videos, die nicht neu hochgeladen werden, bleiben vollständig erhalten.
                  </p>
                </div>
                
                {/* Status of existing perspectives */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    existingStreamsInfo?.has16x9 
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${existingStreamsInfo?.has16x9 ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                    <span>📹 Standard: {existingStreamsInfo?.has16x9 ? 'Vorhanden' : 'Nicht hinterlegt'}</span>
                    {existingStreamsInfo?.has16x9 && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteStream({ id: '16x9', label: 'Standard-Video (16:9)' })}
                        disabled={deletingStreamId === '16x9'}
                        title="Standard-Video löschen"
                        className="p-1 rounded-md text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all ml-1 disabled:opacity-50"
                      >
                        {deletingStreamId === '16x9' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    existingStreamsInfo?.has32x9 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${existingStreamsInfo?.has32x9 ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span>🏟️ Panorama: {existingStreamsInfo?.has32x9 ? 'Vorhanden' : 'Nicht hinterlegt'}</span>
                    {existingStreamsInfo?.has32x9 && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteStream({ id: '32x9', label: 'Panorama-Video (Breitbild)' })}
                        disabled={deletingStreamId === '32x9'}
                        title="Panorama-Video löschen"
                        className="p-1 rounded-md text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all ml-1 disabled:opacity-50"
                      >
                        {deletingStreamId === '32x9' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Column 1: Metadata & Format Selection */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-8">
                <div className="flex items-center gap-3 border-b border-zinc-800/50 pb-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-200 uppercase tracking-tighter text-sm">Metadaten</h3>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase">Match Informationen</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Match Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="z. B. FC Bayern vs. Dortmund"
                      className="w-full h-11 bg-black/60 border border-zinc-800 rounded-xl px-5 text-white font-bold focus:outline-none focus:border-blue-500 transition-all text-sm placeholder:text-zinc-700 flex items-center"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Mannschaft(en) zuweisen</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-black/40 border border-zinc-800 rounded-xl">
                      {teamsList.map((t) => {
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

                              const selectedNames = teamsList
                                .filter(item => updated.includes(item.id))
                                .map(item => item.name);
                              setTeamName(selectedNames.join(', '));
                              setTeamId(updated[0] || '');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                              isSelected
                                ? 'bg-primary border-primary text-white shadow-md'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                            }`}
                          >
                            {t.name} {t.age_group ? `(${t.age_group})` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Kategorie</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-11 bg-black/40 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-blue-500 transition-all text-sm"
                    >
                      <option value="Punktspiel">Punktspiel</option>
                      <option value="Pokalspiel">Pokalspiel</option>
                      <option value="Testspiel">Testspiel</option>
                      <option value="Training">Training</option>
                      <option value="Trainingslager">Trainingslager</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Datum & Uhrzeit des Matches</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input
                        type="datetime-local"
                        value={recordingDate}
                        onChange={(e) => setRecordingDate(e.target.value)}
                        className="w-full h-11 bg-black/40 border border-zinc-800 rounded-xl pl-11 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all text-sm font-mono flex items-center text-scheme-dark"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Format Selection: 16:9 vs Panorama vs Dual */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-zinc-800/50 pb-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-200 uppercase tracking-tighter text-sm">Video-Format</h3>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase">Seitenverhältnis & Multi-Stream</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* Standard Option */}
                  <button
                    type="button"
                    onClick={() => setUploadMode('16:9')}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border-2 transition-all text-left ${
                      uploadMode === '16:9'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                        : 'bg-black/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      uploadMode === '16:9' ? 'bg-blue-500 text-white shadow-md' : 'bg-zinc-900 text-zinc-500'
                    }`}>
                      STD
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-xs uppercase tracking-wide text-zinc-100">Standard</p>
                        {uploadMode === '16:9' && (
                          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-black border border-blue-500/30">
                            AKTIV
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Klassische Kamera-Aufnahme (Einzelfeld)
                      </p>
                    </div>
                  </button>

                  {/* Panorama Option */}
                  <button
                    type="button"
                    onClick={() => setUploadMode('panorama')}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border-2 transition-all text-left ${
                      uploadMode === 'panorama'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                        : 'bg-black/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0 tracking-tighter ${
                      uploadMode === 'panorama' ? 'bg-emerald-500 text-white shadow-md' : 'bg-zinc-900 text-zinc-500'
                    }`}>
                      PANO
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-xs uppercase tracking-wide text-zinc-100">Panorama / Breitbild</p>
                        {uploadMode === 'panorama' && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black border border-emerald-500/30">
                            AKTIV
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Breitbild- & Panoramaformate (z. B. Veo, Pixellot, Multi-Cam)
                      </p>
                    </div>
                  </button>

                  {/* Dual (Standard & Panorama) Option */}
                  <button
                    type="button"
                    onClick={() => setUploadMode('dual')}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border-2 transition-all text-left ${
                      uploadMode === 'dual'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                        : 'bg-black/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      uploadMode === 'dual' ? 'bg-purple-600 text-white shadow-md' : 'bg-zinc-900 text-zinc-500'
                    }`}>
                      <Split className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-xs uppercase tracking-wide text-zinc-100">Dual (Standard & Panorama)</p>
                        {uploadMode === 'dual' && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-black border border-purple-500/30">
                            AKTIV
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Beide Perspektiven hochladen & im Player frei umschalten
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2: Media Assets & Dropzones */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 space-y-8 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 shadow-xl">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-zinc-100 uppercase tracking-tighter text-lg">Video & Daten</h3>
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
                        {uploadMode === 'dual' ? 'Standard & Panorama-Video' : uploadMode === 'panorama' ? 'Panorama- / Breitbild-Datei' : 'Standard-Videodatei'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-6">
                  {/* Single Mode Video Dropzone */}
                  {uploadMode !== 'dual' && (
                    <div
                      onClick={() => videoInputRef.current?.click()}
                      className={`flex-1 group relative overflow-hidden bg-black/60 border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[240px] ${
                        videoFile
                          ? 'border-emerald-500 bg-emerald-500/5'
                          : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/20'
                      }`}
                    >
                      <input
                        type="file"
                        ref={videoInputRef}
                        onChange={handleVideoChange}
                        accept="video/*"
                        className="hidden"
                      />
                      {videoFile ? (
                        <div className="text-center animate-in zoom-in-95 duration-500 w-full max-w-sm">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl ${
                            uploadMode === 'panorama' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            <Video className="w-8 h-8" />
                          </div>
                          <p className="text-base font-black text-zinc-100 truncate w-full px-4">{videoFile.name}</p>
                          <p className="text-xs text-zinc-400 font-bold mt-1.5 uppercase tracking-widest">
                            {(videoFile.size / (1024 * 1024)).toFixed(2)} MB &bull; {uploadMode === 'panorama' ? 'Panorama' : 'Standard'}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVideoFile(null);
                            }}
                            className="mt-4 px-5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-black text-red-400 uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all"
                          >
                            Entfernen
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-2xl bg-zinc-900 group-hover:bg-zinc-800 flex items-center justify-center text-zinc-700 group-hover:text-blue-400 mb-4 transition-all shadow-inner">
                            <Plus className="w-8 h-8" />
                          </div>
                          <p className="text-sm font-black text-zinc-300 uppercase tracking-[0.2em] text-center px-4">
                            {replaceMatchId ? (
                              uploadMode === 'panorama'
                                ? (existingStreamsInfo?.has32x9 ? 'Neues Panorama-Video hier ablegen (ersetzt altes)' : 'Panorama-Video hier ablegen (zusätzlich)')
                                : (existingStreamsInfo?.has16x9 ? 'Neues Standard-Video hier ablegen (ersetzt altes)' : 'Standard-Video hier ablegen (zusätzlich)')
                            ) : (
                              uploadMode === 'panorama' ? 'Panorama- / Breitbild-Video hier ablegen' : 'Standard-Video hier ablegen'
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase text-center px-4">
                            {replaceMatchId ? (
                              uploadMode === 'panorama'
                                ? (existingStreamsInfo?.has32x9 ? 'Ersetzt das bestehende Panorama-Video (Standard bleibt erhalten)' : 'Fügt dem Match ein Panorama-Video hinzu')
                                : (existingStreamsInfo?.has16x9 ? 'Ersetzt das bestehende Standard-Video (Panorama bleibt erhalten)' : 'Fügt dem Match ein Standard-Video hinzu')
                            ) : (
                              'MP4 / MOV / MKV / TS UNTERSTÜTZT'
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Dual Mode: Two Dropzones (Standard & Panorama) */}
                  {uploadMode === 'dual' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Standard Dropzone */}
                      <div
                        onClick={() => video16x9InputRef.current?.click()}
                        className={`group relative overflow-hidden bg-black/60 border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[190px] ${
                          videoFile16x9
                            ? 'border-blue-500 bg-blue-500/5'
                            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/20'
                        }`}
                      >
                        <input
                          type="file"
                          ref={video16x9InputRef}
                          onChange={handle16x9Change}
                          accept="video/*"
                          className="hidden"
                        />
                        {videoFile16x9 ? (
                          <div className="text-center animate-in zoom-in-95 duration-500 w-full">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-2">
                              <Video className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 block mb-1">📹 Standard-Video</span>
                            <p className="text-xs font-bold text-zinc-200 truncate w-full px-2">{videoFile16x9.name}</p>
                            <p className="text-[10px] text-zinc-500 mt-1">{(videoFile16x9.size / (1024 * 1024)).toFixed(1)} MB</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVideoFile16x9(null);
                              }}
                              className="mt-3 text-[10px] font-bold text-red-400 hover:underline"
                            >
                              Entfernen
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-blue-500 mb-2">
                              <Plus className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-zinc-200">
                              {replaceMatchId ? (existingStreamsInfo?.has16x9 ? 'Standard-Video ersetzen' : 'Standard-Video hinzufügen') : 'Standard-Video'}
                            </span>
                            <span className="text-[10px] text-zinc-500 mt-1 text-center px-2">
                              {replaceMatchId
                                ? (existingStreamsInfo?.has16x9 ? 'Bestehendes Video vorhanden (nur wählen falls neu)' : 'Hier ablegen (zusätzlich)')
                                : 'Hier ablegen (Standard)'}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Panorama Dropzone */}
                      <div
                        onClick={() => video32x9InputRef.current?.click()}
                        className={`group relative overflow-hidden bg-black/60 border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[190px] ${
                          videoFile32x9
                            ? 'border-emerald-500 bg-emerald-500/5'
                            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/20'
                        }`}
                      >
                        <input
                          type="file"
                          ref={video32x9InputRef}
                          onChange={handle32x9Change}
                          accept="video/*"
                          className="hidden"
                        />
                        {videoFile32x9 ? (
                          <div className="text-center animate-in zoom-in-95 duration-500 w-full">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                              <Video className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 block mb-1">🏟️ Panorama-Video</span>
                            <p className="text-xs font-bold text-zinc-200 truncate w-full px-2">{videoFile32x9.name}</p>
                            <p className="text-[10px] text-zinc-500 mt-1">{(videoFile32x9.size / (1024 * 1024)).toFixed(1)} MB</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVideoFile32x9(null);
                              }}
                              className="mt-3 text-[10px] font-bold text-red-400 hover:underline"
                            >
                              Entfernen
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-emerald-400 mb-2">
                              <Plus className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-zinc-200">
                              {replaceMatchId ? (existingStreamsInfo?.has32x9 ? 'Panorama-Video ersetzen' : 'Panorama-Video hinzufügen') : 'Panorama- / Breitbild-Video'}
                            </span>
                            <span className="text-[10px] text-zinc-500 mt-1 text-center px-2">
                              {replaceMatchId
                                ? (existingStreamsInfo?.has32x9 ? 'Bestehendes Video vorhanden (nur wählen falls neu)' : 'Hier ablegen (zusätzlich)')
                                : 'Hier ablegen (Panorama)'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tracking File Dropzone */}
                  <div
                    onClick={() => trackingInputRef.current?.click()}
                    className={`group relative overflow-hidden bg-black/40 border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer h-[100px] ${
                      trackingFile
                        ? 'border-amber-500 bg-amber-500/5'
                        : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/20'
                    }`}
                  >
                    <input
                      type="file"
                      ref={trackingInputRef}
                      onChange={handleTrackingChange}
                      accept=".json,.jsonl,.csv"
                      className="hidden"
                    />
                    {trackingFile ? (
                      <div className="text-center animate-in zoom-in-95 duration-500 w-full">
                        <FileJson className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                        <p className="text-xs font-black text-zinc-200 truncate w-full px-8">{trackingFile.name}</p>
                        <p className="text-[9px] text-amber-500/70 font-black uppercase tracking-[0.2em]">Tracking Daten verknüpft</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrackingFile(null);
                          }}
                          className="absolute top-3 right-3 text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FileJson className="w-6 h-6 text-zinc-700 group-hover:text-zinc-500 mb-1 transition-colors" />
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Optionale Tracking-Datei</p>
                        <p className="text-[8px] text-zinc-700 font-bold uppercase">JSON / CSV Datensatz</p>
                      </>
                    )}
                  </div>

                  {/* Fast HLS Option */}
                  <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-zinc-200 block">⚡ Schnelle HLS-Erstellung</span>
                      <span className="text-[10px] text-zinc-500 block leading-tight mt-0.5">
                        Erstellt sofortigen Vorab-Stream ohne zeitintensive ABR-Transkodierung
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={skipConversion}
                      onChange={(e) => setSkipConversion(e.target.checked)}
                      className="rounded border-zinc-700 text-blue-500 focus:ring-blue-500 bg-zinc-950 w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Deployment & Queue */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-6 flex flex-col h-full lg:h-auto">
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-inner">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-zinc-200 uppercase tracking-tighter text-sm">Empfänger</h3>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase">Benachrichtigungen</p>
                    </div>
                  </div>
                  {users.length > 0 && (
                    <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full">
                      {selectedUsers.length}/{users.length}
                    </span>
                  )}
                </div>

                {users.length > 0 && (
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-500 px-1">
                    <span>Benutzer auswählen</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedUsers.length === users.length) {
                          setSelectedUsers([]);
                        } else {
                          setSelectedUsers(users.map(u => u.id));
                        }
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {selectedUsers.length === users.length ? 'Keine' : 'Alle wählen'}
                    </button>
                  </div>
                )}

                {users.length === 0 ? (
                  <div className="bg-black/20 border border-zinc-800 border-dashed rounded-[1.5rem] p-8 text-center">
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest italic leading-relaxed">
                      Keine weiteren<br/>Benutzer gefunden
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {users.map((u) => (
                      <label
                        key={u.id}
                        className={`flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${
                          selectedUsers.includes(u.id)
                            ? 'bg-blue-600/10 border-blue-600/40'
                            : 'bg-black/40 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedUsers.includes(u.id)}
                          onChange={() =>
                            selectedUsers.includes(u.id)
                              ? setSelectedUsers(selectedUsers.filter(id => id !== u.id))
                              : setSelectedUsers([...selectedUsers, u.id])
                          }
                        />
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                          selectedUsers.includes(u.id)
                            ? 'bg-blue-500 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                            : 'border-zinc-700 bg-zinc-900'
                        }`}>
                          {selectedUsers.includes(u.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-xs font-black truncate tracking-tight uppercase ${
                            selectedUsers.includes(u.id) ? 'text-zinc-100' : 'text-zinc-400'
                          }`}>
                            {u.username}
                          </span>
                          {u.email && <span className="text-[9px] text-zinc-600 font-mono truncate">{u.email}</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="text-[9px] text-zinc-500 flex items-center gap-2 px-1 py-2 bg-zinc-950/30 border border-zinc-800/40 rounded-xl justify-center">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span className="font-black uppercase tracking-[0.1em]">Auto-Mail nach Upload</span>
                </div>
              </div>

              {/* Submit Section & Queue */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-6">
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/40 p-4 rounded-2xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-2 duration-500 shadow-xl shadow-red-950/20">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="text-[11px] font-bold uppercase tracking-tight">{error}</p>
                    </div>
                  )}
                  {success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 animate-in fade-in slide-in-from-top-2 duration-500 shadow-xl shadow-emerald-950/20">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <p className="text-[11px] font-bold uppercase tracking-tight">Upload gestartet!</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !hasVideoSelected || !name}
                    className={`w-full py-5 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 transition-all shadow-2xl active:scale-[0.98] uppercase tracking-[0.2em] border-2 ${
                      isSubmitting || !hasVideoSelected || !name
                        ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed border-zinc-800'
                        : 'bg-primary hover:bg-primary-hover border-transparent text-white shadow-primary/20'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Verarbeite...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-5 h-5" />
                        {replaceMatchId ? 'Video(s) & Match aktualisieren' : 'Match hochladen'}
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-6 border-t border-zinc-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Upload Queue
                    </h4>
                    <span className="text-[10px] font-black text-zinc-400 bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700/50 tabular-nums">
                      {activeUploads.length} TASKS
                    </span>
                  </div>

                  {activeUploads.length === 0 ? (
                    <div className="py-10 text-center opacity-20 flex flex-col items-center gap-3 border-2 border-dashed border-zinc-800 rounded-[1.5rem]">
                      <UploadCloud className="w-8 h-8 text-zinc-500" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Keine aktiven Uploads</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeUploads.map((upload) => (
                        <div
                          key={upload.id}
                          className="bg-black/60 border border-zinc-800 rounded-2xl p-4 space-y-3 shadow-2xl transition-all hover:border-zinc-700"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-black text-zinc-100 truncate uppercase tracking-tight">
                                {upload.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    upload.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'
                                  }`}
                                />
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-tighter">
                                  {upload.status}
                                </p>
                              </div>
                            </div>
                            {upload.status === 'completed' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : upload.status === 'error' ? (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : (
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            )}
                          </div>
                          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden shadow-inner">
                            <div
                              className={`h-full transition-all duration-500 ease-out ${
                                upload.status === 'error'
                                  ? 'bg-red-500'
                                  : 'bg-gradient-to-r from-blue-600 to-blue-400'
                              }`}
                              style={{ width: `${upload.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </form>
      </main>

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
    </div>
  );
}
