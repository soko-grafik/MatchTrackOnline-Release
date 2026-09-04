"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Trash2,
  Save,
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Dumbbell,
  ExternalLink,
  Lock,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  UserCheck,
  Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  updateCalendarEvent,
  deleteCalendarEvent,
  getMyTeams,
  getTeams,
  getTrainingSessions,
  getEventAttendance,
  saveEventAttendance
} from '@/services/api';

interface EditCalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  initialTab?: 'DETAILS' | 'ATTENDANCE';
  onSaved?: () => void;
  onDeleted?: () => void;
}

export default function EditCalendarEventModal({
  isOpen,
  onClose,
  event,
  initialTab = 'DETAILS',
  onSaved,
  onDeleted
}: EditCalendarEventModalProps) {
  const { user } = useAuth();
  const { toast, confirm: confirmModal } = useToast();

  const [activeTab, setActiveTab] = useState<'DETAILS' | 'ATTENDANCE'>('DETAILS');

  const [teams, setTeams] = useState<any[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Attendance State
  const [attendanceData, setAttendanceData] = useState<any | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; absence_reason?: string | null; notes?: string | null }>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');

  const roundToQuarterHour = (date: Date): string => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const d = new Date(date);
    d.setMinutes(roundedMinutes);
    d.setSeconds(0);
    d.setMilliseconds(0);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  const toLocalIso = (dtStr: string) => {
    if (!dtStr) return '';
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  const getEventTeamIds = (ev: any): string[] => {
    if (Array.isArray(ev?.team_ids) && ev.team_ids.length > 0) {
      return ev.team_ids.map(String);
    }
    return ev?.team_id ? [String(ev.team_id)] : [];
  };

  const [eventForm, setEventForm] = useState({
    title: '',
    event_type: 'TRAINING',
    start_time: '',
    end_time: '',
    location: 'Sportplatz',
    is_home: true,
    opponent: '',
    team_id: '',
    team_ids: [] as string[],
    training_session_id: undefined as number | null | undefined,
    reminder_minutes: 30,
    notes: '',
    repeat_weekly: false,
    repeat_until: ''
  });

  const userRole = user?.role?.toUpperCase() || 'VIEWER';
  const isAdmin = userRole === 'ADMIN';

  const isAttendanceApplicable = Boolean(
    event?.id && (eventForm.event_type === 'TRAINING' || eventForm.event_type === 'MATCH')
  );

  // Set initial tab on open
  useEffect(() => {
    if (isOpen) {
      if (initialTab === 'ATTENDANCE' && isAttendanceApplicable) {
        setActiveTab('ATTENDANCE');
      } else {
        setActiveTab('DETAILS');
      }
    }
  }, [isOpen, initialTab, isAttendanceApplicable]);

  // Load teams and training sessions when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingData(true);

    Promise.all([
      getMyTeams().catch(() => getTeams()),
      getTrainingSessions().catch(() => [])
    ])
      .then(([teamsRes, sessionsRes]) => {
        if (!isMounted) return;
        if (Array.isArray(teamsRes)) setTeams(teamsRes);
        if (Array.isArray(sessionsRes)) setTrainingSessions(sessionsRes);
      })
      .finally(() => {
        if (isMounted) setLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Load attendance data when event ID is available and attendance is applicable
  useEffect(() => {
    if (!isOpen || !event?.id || !isAttendanceApplicable) return;

    loadEventAttendance();
  }, [isOpen, event?.id, isAttendanceApplicable]);

  const loadEventAttendance = async () => {
    if (!event?.id) return;
    setLoadingAttendance(true);
    try {
      const data = await getEventAttendance(event.id);
      setAttendanceData(data);

      const map: Record<string, { status: string; absence_reason?: string | null; notes?: string | null }> = {};
      if (Array.isArray(data?.players)) {
        data.players.forEach((p: any) => {
          map[p.player_id] = {
            status: p.status || 'PRESENT',
            absence_reason: p.absence_reason || null,
            notes: p.notes || null
          };
        });
      }
      setAttendanceMap(map);
    } catch (err) {
      console.error('Fehler beim Laden der Anwesenheit:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Populate eventForm when event changes
  useEffect(() => {
    if (!event) return;

    const startIso = toLocalIso(event.start_time);
    const endIso = toLocalIso(event.end_time);
    const initialTeamIds = getEventTeamIds(event);

    setEventForm({
      title: event.title || '',
      event_type: event.event_type || 'TRAINING',
      start_time: startIso,
      end_time: endIso,
      location: event.location || 'Sportplatz',
      is_home: event.is_home ?? true,
      opponent: event.opponent || '',
      team_id: initialTeamIds[0] || (event.team_id ? String(event.team_id) : ''),
      team_ids: initialTeamIds,
      training_session_id: event.training_session_id || event.training_session?.id || undefined,
      reminder_minutes: event.reminder_minutes ?? 30,
      notes: event.notes || '',
      repeat_weekly: Boolean(event.repeat_weekly),
      repeat_until: event.repeat_until ? toLocalIso(event.repeat_until).slice(0, 10) : ''
    });
  }, [event]);

  // Permission checks
  const isTeamEditable = (teamId?: string | null) => {
    if (isAdmin) return true;
    if (!teamId) return true;
    const ut = user?.teams?.find((item: any) => String(item.id) === String(teamId));
    if (ut) return ut.can_edit !== false;
    const t = teams.find((item: any) => String(item.id) === String(teamId));
    return t ? t.can_edit !== false : false;
  };

  const canEditEvent = (() => {
    if (isAdmin) return true;
    if (!event) return false;
    const ids = getEventTeamIds(event);
    if (ids.length === 0) return isTeamEditable(null);
    return ids.every((id) => isTeamEditable(id));
  })();

  const handleStartTimeChange = (newStartTimeStr: string) => {
    let newEndTimeStr = eventForm.end_time;
    if (newStartTimeStr) {
      const startDate = new Date(newStartTimeStr);
      const endDate = eventForm.end_time ? new Date(eventForm.end_time) : null;

      if (!endDate || isNaN(endDate.getTime()) || endDate <= startDate) {
        const autoEnd = new Date(startDate.getTime() + 90 * 60000);
        newEndTimeStr = roundToQuarterHour(autoEnd);
      }
    }

    setEventForm((prev) => ({
      ...prev,
      start_time: newStartTimeStr,
      end_time: newEndTimeStr
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event?.id) return;

    try {
      if (eventForm.start_time && eventForm.end_time) {
        const startDate = new Date(eventForm.start_time);
        const endDate = new Date(eventForm.end_time);
        if (endDate <= startDate) {
          toast.warning('Das Ende des Termins muss nach der Startzeit liegen!');
          return;
        }
      }

      const formatIso = (dtStr: string) => {
        if (!dtStr) return undefined;
        if (dtStr.length === 10) return `${dtStr}T23:59:59`;
        if (dtStr.length === 16) return `${dtStr}:00`;
        return dtStr;
      };

      const payload = {
        ...eventForm,
        start_time: formatIso(eventForm.start_time),
        end_time: formatIso(eventForm.end_time),
        team_ids: eventForm.team_ids,
        team_id: eventForm.team_ids[0] || undefined,
        training_session_id: eventForm.training_session_id ? Number(eventForm.training_session_id) : null,
        reminder_minutes: Number(eventForm.reminder_minutes ?? 30),
        repeat_weekly: Boolean(eventForm.repeat_weekly),
        repeat_until: eventForm.repeat_weekly && eventForm.repeat_until ? formatIso(eventForm.repeat_until) : undefined
      };

      setSaving(true);
      await updateCalendarEvent(event.id, payload);
      toast.success('Termin erfolgreich aktualisiert');
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('Fehler beim Speichern des Termins:', err?.response?.data || err);
      toast.error(err?.response?.data?.detail || 'Fehler beim Bearbeiten des Termins');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;

    const hasRecurring = Boolean(event.repeat_weekly || event.recurring_event_id);
    let deleteFollowing = false;

    if (hasRecurring) {
      const confirmResult = await confirmModal({
        title: 'Termin löschen',
        message: 'Möchtest du nur diesen einzelnen Termin oder diesen und alle Folgetermine löschen?',
        confirmText: 'Alle Folgetermine löschen',
        cancelText: 'Nur diesen Termin',
        type: 'danger'
      });
      deleteFollowing = confirmResult;
    } else {
      const confirmed = await confirmModal({
        title: 'Termin löschen',
        message: `Möchtest du den Termin "${eventForm.title || event.title}" wirklich löschen?`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        type: 'danger'
      });
      if (!confirmed) return;
    }

    try {
      setDeleting(true);
      await deleteCalendarEvent(event.id, deleteFollowing);
      toast.success('Termin gelöscht');
      onDeleted ? onDeleted() : onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('Fehler beim Löschen des Termins:', err);
      toast.error(err?.response?.data?.detail || 'Fehler beim Löschen des Termins');
    } finally {
      setDeleting(false);
    }
  };

  // Set all players to present
  const handleMarkAllPresent = () => {
    if (!attendanceData?.players) return;
    const updated: Record<string, { status: string; absence_reason?: string | null; notes?: string | null }> = { ...attendanceMap };
    attendanceData.players.forEach((p: any) => {
      updated[p.player_id] = {
        status: 'PRESENT',
        absence_reason: null,
        notes: updated[p.player_id]?.notes || null
      };
    });
    setAttendanceMap(updated);
    toast.info('Alle Spieler als anwesend markiert');
  };

  // Toggle single player status
  const handleSetPlayerStatus = (playerId: string, status: string, reason?: string | null) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [playerId]: {
        status,
        absence_reason: status === 'EXCUSED' ? (reason || prev[playerId]?.absence_reason || 'KRANKHEIT') : null,
        notes: prev[playerId]?.notes || null
      }
    }));
  };

  // Save Attendance to Backend
  const handleSaveAttendance = async () => {
    if (!event?.id) return;
    setSavingAttendance(true);

    try {
      const items = Object.entries(attendanceMap).map(([player_id, item]) => ({
        player_id,
        status: item.status,
        absence_reason: item.absence_reason,
        notes: item.notes
      }));

      await saveEventAttendance(event.id, items);
      toast.success(`Anwesenheit für ${items.length} Spieler erfolgreich gespeichert!`);
      await loadEventAttendance();
      onSaved?.();
    } catch (err: any) {
      console.error('Fehler beim Speichern der Anwesenheit:', err);
      toast.error(err?.response?.data?.detail || 'Fehler beim Speichern der Anwesenheit');
    } finally {
      setSavingAttendance(false);
    }
  };

  if (!isOpen || !event) return null;

  const now = new Date();
  const currentRoundedStart = roundToQuarterHour(now).slice(11, 16);
  const currentRoundedEnd = roundToQuarterHour(new Date(now.getTime() + 90 * 60000)).slice(11, 16);

  const selectedStartTime = eventForm.start_time ? eventForm.start_time.slice(11, 16) : currentRoundedStart;
  const selectedEndTime = eventForm.end_time ? eventForm.end_time.slice(11, 16) : currentRoundedEnd;
  const selectedDate = eventForm.start_time ? eventForm.start_time.slice(0, 10) : roundToQuarterHour(now).slice(0, 10);

  // Compute live attendance statistics
  const playerList: any[] = attendanceData?.players || [];
  const totalCount = playerList.length;
  let livePresentCount = 0;
  let liveAbsentCount = 0;
  let liveExcusedCount = 0;

  playerList.forEach((p) => {
    const st = attendanceMap[p.player_id]?.status || 'PRESENT';
    if (st === 'PRESENT') livePresentCount++;
    else if (st === 'ABSENT') liveAbsentCount++;
    else if (st === 'EXCUSED') liveExcusedCount++;
  });

  const liveRate = totalCount > 0 ? Math.round((livePresentCount / totalCount) * 100) : 100;

  const filteredPlayers = playerList.filter((p) => {
    if (!attendanceSearch.trim()) return true;
    const q = attendanceSearch.toLowerCase();
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const num = p.jersey_number ? String(p.jersey_number) : '';
    return fullName.includes(q) || num.includes(q) || (p.position && p.position.toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                eventForm.event_type === 'MATCH'
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : eventForm.event_type === 'TRAINING'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {canEditEvent ? 'Termin bearbeiten' : 'Termin-Details'}
                {!canEditEvent && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Nur Leseansicht
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {eventForm.event_type === 'TRAINING' ? 'Training' : eventForm.event_type === 'MATCH' ? 'Spiel' : 'Termin'} verwalten
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/organizer"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs flex items-center gap-1"
              title="Im Kalender / Organizer ansehen"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Organizer</span>
            </Link>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selector (only for existing TRAINING or MATCH events) */}
        {isAttendanceApplicable && (
          <div className="flex border-b border-zinc-800 bg-zinc-900/40 px-6 pt-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('DETAILS')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'DETAILS'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Termindetails</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ATTENDANCE')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'ATTENDANCE'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Anwesenheit</span>
              {totalCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {livePresentCount}/{totalCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* TAB 1: DETAILS */}
        {activeTab === 'DETAILS' && (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Titel des Termins</label>
              <input
                type="text"
                required
                disabled={!canEditEvent}
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="z. B. Dienstagstraining oder Punktspiel vs. FC Muster"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Event Type & Teams */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Termin-Typ</label>
                <select
                  disabled={!canEditEvent}
                  value={eventForm.event_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setEventForm({
                      ...eventForm,
                      event_type: newType,
                      reminder_minutes: newType === 'MATCH' ? 1440 : (eventForm.reminder_minutes === 1440 ? 30 : eventForm.reminder_minutes)
                    });
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="TRAINING">🟢 Training</option>
                  <option value="MATCH">🔴 Spiel</option>
                  <option value="MEETING">🔵 Besprechung / Event</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">
                  Mannschaft(en)
                  {eventForm.team_ids.length > 1 && (
                    <span className="ml-1.5 font-semibold text-zinc-500">({eventForm.team_ids.length} ausgewählt)</span>
                  )}
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-zinc-800 bg-zinc-900 max-h-24 overflow-y-auto">
                  {teams
                    .filter((t) => isAdmin || t.can_edit !== false)
                    .map((t) => {
                      const isSelected = eventForm.team_ids.includes(String(t.id));
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={!canEditEvent}
                          onClick={() => {
                            const idStr = String(t.id);
                            const updated = isSelected
                              ? eventForm.team_ids.filter((id) => id !== idStr)
                              : [...eventForm.team_ids, idStr];
                            setEventForm({ ...eventForm, team_ids: updated, team_id: updated[0] || '' });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border disabled:opacity-60 ${
                            isSelected
                              ? 'bg-primary border-primary text-white shadow-sm'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                          }`}
                        >
                          {t.name}{t.age_group ? ` (${t.age_group})` : ''}
                        </button>
                      );
                    })}
                </div>
                {eventForm.team_ids.length === 0 && (
                  <p className="text-[10px] text-amber-400/80 mt-1">
                    Ohne Auswahl ist der Termin für alle sichtbar.
                  </p>
                )}
              </div>
            </div>

            {/* Date & Times */}
            <div className="space-y-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Datum</label>
                <input
                  type="date"
                  required
                  disabled={!canEditEvent}
                  value={selectedDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    if (newDate) {
                      handleStartTimeChange(`${newDate}T${selectedStartTime}`);
                      setEventForm((prev) => ({
                        ...prev,
                        start_time: `${newDate}T${selectedStartTime}`,
                        end_time: `${newDate}T${selectedEndTime}`
                      }));
                    }
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Beginn (Uhrzeit)</label>
                  <select
                    disabled={!canEditEvent}
                    value={selectedStartTime}
                    onChange={(e) => {
                      const newStartIso = `${selectedDate}T${e.target.value}`;
                      handleStartTimeChange(newStartIso);
                    }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none disabled:opacity-60"
                  >
                    {Array.from({ length: 96 }).map((_, i) => {
                      const h = Math.floor(i / 4).toString().padStart(2, '0');
                      const m = ((i % 4) * 15).toString().padStart(2, '0');
                      const timeVal = `${h}:${m}`;
                      return (
                        <option key={timeVal} value={timeVal}>
                          {timeVal} Uhr
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Ende (Uhrzeit)</label>
                  <select
                    disabled={!canEditEvent}
                    value={selectedEndTime}
                    onChange={(e) => {
                      setEventForm((prev) => ({ ...prev, end_time: `${selectedDate}T${e.target.value}` }));
                    }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none disabled:opacity-60"
                  >
                    {Array.from({ length: 96 }).map((_, i) => {
                      const h = Math.floor(i / 4).toString().padStart(2, '0');
                      const m = ((i % 4) * 15).toString().padStart(2, '0');
                      const timeVal = `${h}:${m}`;
                      return (
                        <option key={timeVal} value={timeVal}>
                          {timeVal} Uhr
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Training Plan Link */}
            {eventForm.event_type === 'TRAINING' && (
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Trainingsplan zuweisen (optional)</label>
                <select
                  disabled={!canEditEvent}
                  value={eventForm.training_session_id || ''}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      training_session_id: e.target.value ? parseInt(e.target.value) : null
                    })
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none disabled:opacity-60"
                >
                  <option value="">Kein Trainingsplan verknüpft</option>
                  {trainingSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.age_group || s.methodology || 'Plan'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Match Opponent */}
            {eventForm.event_type === 'MATCH' && (
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Gegner (Mannschaft)</label>
                <input
                  type="text"
                  disabled={!canEditEvent}
                  value={eventForm.opponent || ''}
                  onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })}
                  placeholder="z. B. JFC Unstrut Eagles II"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>
            )}

            {/* Location */}
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Spielort / Treffpunkt</label>
              <input
                type="text"
                disabled={!canEditEvent}
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="z. B. Sportplatz Großengottern"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </div>

            {/* Push Reminder */}
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">🔔 Push-Erinnerungszeit</label>
              <select
                disabled={!canEditEvent}
                value={eventForm.reminder_minutes ?? 30}
                onChange={(e) => setEventForm({ ...eventForm, reminder_minutes: parseInt(e.target.value) })}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none disabled:opacity-60"
              >
                <option value={0}>❌ Keine Erinnerung</option>
                <option value={15}>⏱️ 15 Minuten vorher</option>
                <option value={30}>⏱️ 30 Minuten vorher</option>
                <option value={60}>⏰ 1 Stunde vorher</option>
                <option value={240}>⏰ 4 Stunden vorher</option>
                <option value={1440}>📅 1 Tag vorher</option>
              </select>
            </div>

            {/* Weekly Recurrence */}
            {canEditEvent && (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white">
                  <input
                    type="checkbox"
                    checked={eventForm.repeat_weekly}
                    onChange={(e) => setEventForm({ ...eventForm, repeat_weekly: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-primary"
                  />
                  <span>🔄 Termin wöchentlich wiederholen</span>
                </label>

                {eventForm.repeat_weekly && (
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                      Wiederholen bis einschließlich Datum:
                    </label>
                    <input
                      type="date"
                      required={eventForm.repeat_weekly}
                      value={eventForm.repeat_until}
                      onChange={(e) => setEventForm({ ...eventForm, repeat_until: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-4 mt-2">
              {canEditEvent ? (
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={handleDelete}
                  className="px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Löschen</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving || deleting}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-all"
                >
                  {canEditEvent ? 'Abbrechen' : 'Schließen'}
                </button>

                {canEditEvent && (
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Speichern</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: ATTENDANCE */}
        {activeTab === 'ATTENDANCE' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Attendance Top Controls & Stats */}
            <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{livePresentCount} Da</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{liveAbsentCount} Fehlt</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{liveExcusedCount} Entschuldigt</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 ml-1">
                    Quote: <strong className="text-white">{liveRate}%</strong>
                  </span>
                </div>

                {canEditEvent && totalCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Alle anwesend</span>
                  </button>
                )}
              </div>

              {/* Player Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  placeholder="Spieler nach Name oder Nummer suchen..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 pl-9 pr-3.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Attendance Player List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingAttendance ? (
                <div className="flex flex-col items-center justify-center p-12 text-zinc-500 text-xs space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span>Lade Spieler & Anwesenheitsdaten...</span>
                </div>
              ) : totalCount === 0 ? (
                <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 text-center text-zinc-500 text-xs space-y-2">
                  <Users className="w-8 h-8 mx-auto text-zinc-600 opacity-50" />
                  <p>Keine Spieler für die zugewiesene Mannschaft gefunden.</p>
                  <p className="text-[11px] text-zinc-600">
                    Stelle sicher, dass dem Termin eine Mannschaft zugewiesen ist, die Spieler enthält.
                  </p>
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs">
                  Keine Spieler gefunden für „{attendanceSearch}“.
                </div>
              ) : (
                filteredPlayers.map((player) => {
                  const currentItem = attendanceMap[player.player_id] || { status: 'PRESENT' };
                  const isPresent = currentItem.status === 'PRESENT';
                  const isAbsent = currentItem.status === 'ABSENT';
                  const isExcused = currentItem.status === 'EXCUSED';

                  return (
                    <div
                      key={player.player_id}
                      className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Player Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {player.jersey_number ? (
                            <span className="font-mono text-[11px] text-amber-400">#{player.jersey_number}</span>
                          ) : (
                            <span>{player.first_name?.[0] || '?'}{player.last_name?.[0] || ''}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">
                            {player.first_name} {player.last_name}
                          </span>
                          <span className="text-[10px] text-zinc-400 block truncate">
                            {player.position || 'Feldspieler'}
                          </span>
                        </div>
                      </div>

                      {/* Status Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {/* Da / Anwesend */}
                        <button
                          type="button"
                          disabled={!canEditEvent}
                          onClick={() => handleSetPlayerStatus(player.player_id, 'PRESENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 disabled:opacity-60 ${
                            isPresent
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                              : 'bg-zinc-950/80 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>Da</span>
                        </button>

                        {/* Fehlt / Abwesend */}
                        <button
                          type="button"
                          disabled={!canEditEvent}
                          onClick={() => handleSetPlayerStatus(player.player_id, 'ABSENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 disabled:opacity-60 ${
                            isAbsent
                              ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                              : 'bg-zinc-950/80 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                          }`}
                        >
                          <X className="w-3 h-3" />
                          <span>Fehlt</span>
                        </button>

                        {/* Entschuldigt */}
                        <div className="relative flex items-center">
                          <button
                            type="button"
                            disabled={!canEditEvent}
                            onClick={() => handleSetPlayerStatus(player.player_id, 'EXCUSED')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 disabled:opacity-60 ${
                              isExcused
                                ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                                : 'bg-zinc-950/80 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                            }`}
                            title="Entschuldigt"
                          >
                            <span>Entschuldigt</span>
                          </button>

                          {isExcused && (
                            <select
                              disabled={!canEditEvent}
                              value={currentItem.absence_reason || 'KRANKHEIT'}
                              onChange={(e) => handleSetPlayerStatus(player.player_id, 'EXCUSED', e.target.value)}
                              className="ml-1.5 py-1 px-2 rounded-lg border border-amber-500/40 bg-zinc-900 text-[11px] text-amber-300 focus:outline-none"
                            >
                              <option value="KRANKHEIT">Krank</option>
                              <option value="VERLETZUNG">Verletzt</option>
                              <option value="PRIVATES">Privat</option>
                              <option value="SONSTIGES">Sonstiges</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Attendance Bottom Bar */}
            <div className="flex items-center justify-between border-t border-zinc-800 p-4 bg-zinc-950">
              <span className="text-xs text-zinc-400">
                Wird direkt ins Spielerprofil übernommen
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-all"
                >
                  Schließen
                </button>

                {canEditEvent && (
                  <button
                    type="button"
                    disabled={savingAttendance || totalCount === 0}
                    onClick={handleSaveAttendance}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingAttendance ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Anwesenheit speichern</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
