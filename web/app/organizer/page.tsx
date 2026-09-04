"use client";

import { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Download,
  Bell,
  BellOff,
  Clock,
  MapPin,
  Trophy,
  Users,
  Layers,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Radio,
  FileText,
  Printer,
  MoreVertical,
  List,
  Star,
  Loader2
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import PrintableTrainingModal from '@/components/PrintableTrainingModal';
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  linkCalendarEventTrainingSession,
  importFussballDeMatches,
  getTeams,
  getMyTeams,
  getTrainingSessions,
  subscribePushNotifications,
  unsubscribePushNotifications,
  sendTestPushNotification,
  cleanupOrganizerMatches
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';

export default function OrganizerPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { toast, confirm: confirmModal } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  // Month Navigation
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCleanupMatchesModalOpen, setIsCleanupMatchesModalOpen] = useState(false);
  const [cleaningMatches, setCleaningMatches] = useState(false);
  const [cleanupTeamSelection, setCleanupTeamSelection] = useState<string>('ALL');
  const [cleanupFussballDeOnly, setCleanupFussballDeOnly] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<any | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [linkingSessionId, setLinkingSessionId] = useState<number | undefined>(undefined);
  const [printingSession, setPrintingSession] = useState<any | null>(null);
  const [isEventMenuOpen, setIsEventMenuOpen] = useState(false);
  const [isMoreActionsMenuOpen, setIsMoreActionsMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [pushStatus, setPushStatus] = useState<'checking' | 'enabled' | 'disabled' | 'unsupported'>('checking');
  const [pushBusy, setPushBusy] = useState(false);

  // Set default viewMode to LIST on mobile devices (< 768px)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('LIST');
    }
  }, []);

  // Close the dropdowns when clicking anywhere outside them (not just on the toggle).
  const moreActionsMenuRef = useRef<HTMLDivElement>(null);
  const eventMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreActionsMenuOpen && !isEventMenuOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      const target = e.target as Node;
      if (isMoreActionsMenuOpen && moreActionsMenuRef.current && !moreActionsMenuRef.current.contains(target)) {
        setIsMoreActionsMenuOpen(false);
      }
      if (isEventMenuOpen && eventMenuRef.current && !eventMenuRef.current.contains(target)) {
        setIsEventMenuOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreActionsMenuOpen(false);
        setIsEventMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside, true);
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true);
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMoreActionsMenuOpen, isEventMenuOpen]);

  // Event Form
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

  const roundToQuarterHour = (date: Date): string => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const d = new Date(date);
    d.setMinutes(roundedMinutes);
    d.setSeconds(0);
    d.setMilliseconds(0);

    // Format to local ISO string (YYYY-MM-DDTHH:mm) without UTC conversion shift
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };


  const handleStartTimeChange = (newStartTimeStr: string, isEditing: boolean = false) => {
    let newEndTimeStr = eventForm.end_time;
    if (newStartTimeStr) {
      const startDate = new Date(newStartTimeStr);
      const endDate = eventForm.end_time ? new Date(eventForm.end_time) : null;

      // Only auto-adjust end_time if not editing OR if end_time <= start_time
      if (!isEditing || !endDate || isNaN(endDate.getTime()) || endDate <= startDate) {
        const autoEnd = new Date(startDate.getTime() + 90 * 60000);
        newEndTimeStr = roundToQuarterHour(autoEnd);
      }
    }

    setEventForm(prev => ({
      ...prev,
      start_time: newStartTimeStr,
      end_time: newEndTimeStr
    }));
  };


  // Events from older records may only carry team_id, so fall back to it.
  const getEventTeamIds = (ev: any): string[] => {
    if (Array.isArray(ev?.team_ids) && ev.team_ids.length > 0) return ev.team_ids;
    return ev?.team_id ? [ev.team_id] : [];
  };

  const getEventTeamNames = (ev: any): string => {
    const ids = getEventTeamIds(ev);
    if (ids.length > 0) {
      return ids.map((id) => teams.find((t) => String(t.id) === String(id))?.name || id).join(', ');
    }
    if (ev?.team?.name) return ev.team.name;
    if (ev?.team_name) return ev.team_name;
    return '';
  };

  const getReminderLabel = (mins?: number) => {

    if (mins === 0) return 'Keine';
    if (mins === 15) return '15 Min. vorher';
    if (mins === 60) return '1 Std. vorher';
    if (mins === 240) return '4 Std. vorher';
    if (mins === 1440) return '1 Tag vorher';
    return '30 Min. vorher';
  };

  // Import Form
  const [importForm, setImportForm] = useState({
    url_or_team_id: '',
    team_id: ''
  });
  const [importing, setImporting] = useState(false);

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  // Helper to check if user has write permissions for a specific team
  const isTeamEditable = (teamId?: string | null) => {
    if (isAdmin) return true;
    if (!teamId) return true;
    const ut = user?.teams?.find((item: any) => item.id === teamId);
    if (ut) return ut.can_edit !== false;
    const t = teams.find((item: any) => item.id === teamId);
    return t ? t.can_edit !== false : false;
  };

  // Check if current user has edit rights for at least one team or is admin
  const canEdit = (() => {
    if (isAdmin) return true;
    if (user?.teams && user.teams.length > 0) {
      return user.teams.some((t: any) => t.can_edit !== false);
    }
    if (teams && teams.length > 0) {
      return teams.some((t: any) => t.can_edit !== false);
    }
    return false;
  })();

  // Helper to check if an event is editable by the current user
  const canEditEvent = (ev: any) => {
    if (isAdmin) return true;
    if (!ev) return false;
    const ids = getEventTeamIds(ev);
    if (ids.length === 0) return isTeamEditable(null);
    // Mirrors the backend: editing requires rights on every assigned team.
    return ids.every((id) => isTeamEditable(id));
  };

  const showTestPushAction = isAdmin && !!settings?.show_push_test_button;
  const showMatchCleanupAction = (isAdmin || canEdit) && !!settings?.show_match_cleanup_button;

  useEffect(() => {
    loadData();
  }, [selectedTeamFilter, selectedTypeFilter]);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        const todayEl = document.getElementById('today-calendar-day');
        if (todayEl) {
          todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
    }
  }, [currentDate, loading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [evData, teamsData, sesData] = await Promise.all([
        getCalendarEvents({
          team_id: selectedTeamFilter !== 'ALL' ? selectedTeamFilter : undefined,
          event_type: selectedTypeFilter !== 'ALL' ? selectedTypeFilter : undefined
        }),
        getMyTeams(),
        getTrainingSessions()
      ]);

      if (Array.isArray(evData)) setEvents(evData);
      if (Array.isArray(teamsData)) {
        setTeams(teamsData);
        const editableTeams = teamsData.filter((t: any) => {
          if (isAdmin) return true;
          return t.can_edit !== false;
        });
        if (editableTeams.length > 0 && !importForm.team_id) {
          setImportForm((prev) => ({ ...prev, team_id: editableTeams[0].id }));
        }
      }
      if (Array.isArray(sesData)) setTrainingSessions(sesData);
    } catch (err) {
      console.error('Fehler beim Laden der Kalenderdaten:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
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
        if (dtStr.length === 10) return `${dtStr}T23:59:59`; // date only (YYYY-MM-DD)
        if (dtStr.length === 16) return `${dtStr}:00`; // datetime-local (YYYY-MM-DDTHH:mm)
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

      if (editingEventId) {
        await updateCalendarEvent(editingEventId, payload);
      } else {
        await createCalendarEvent(payload);
      }
      setIsEventModalOpen(false);
      setEditingEventId(null);
      setSelectedEventDetails(null);
      loadData();
      toast.success(editingEventId ? 'Termin erfolgreich aktualisiert' : 'Termin erfolgreich erstellt');
    } catch (err: any) {
      console.error('Fehler beim Speichern des Termins:', err?.response?.data || err);
      toast.error(editingEventId ? 'Fehler beim Bearbeiten des Termins' : 'Fehler beim Erstellen des Termins');
    }
  };

  const handleLinkSessionToEvent = async (eventId: number, sessionId: number | null | undefined) => {
    try {
      const targetSessionId = sessionId ? Number(sessionId) : null;
      const updated = await linkCalendarEventTrainingSession(eventId, targetSessionId);
      setSelectedEventDetails(updated);
      setLinkingSessionId(undefined);
      loadData();
      if (targetSessionId) {
        toast.success('Trainingsplan erfolgreich verknüpft');
      } else {
        toast.success('Verknüpfung zum Trainingsplan aufgehoben');
      }
    } catch (err: any) {
      console.error("Fehler beim Aktualisieren des Trainingsplans:", err);
      toast.error('Fehler beim Aktualisieren des Trainingsplans');
    }
  };

  const handleEditEventRequest = (ev: any) => {
    setEditingEventId(ev.id);
    const toLocalIso = (dtStr: string) => {
      if (!dtStr) return '';
      const d = new Date(dtStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${mins}`;
    };

    const startIso = toLocalIso(ev.start_time);
    const endIso = toLocalIso(ev.end_time);

    setEventForm({

      title: ev.title || '',
      event_type: ev.event_type || 'TRAINING',
      start_time: startIso,
      end_time: endIso,
      location: ev.location || 'Sportplatz',
      is_home: ev.is_home ?? true,
      opponent: ev.opponent || '',
      team_id: ev.team_id || '',
      team_ids: getEventTeamIds(ev),
      training_session_id: ev.training_session_id || undefined,
      reminder_minutes: ev.reminder_minutes ?? 30,
      notes: ev.notes || '',
      repeat_weekly: false,
      repeat_until: ''
    });
    setSelectedEventDetails(null);
    setIsEventModalOpen(true);
  };

  const handleDeleteEvent = async (id: number, deleteFollowing: boolean = false) => {
    const isConfirmed = await confirmModal({
      title: 'Termin löschen',
      message: deleteFollowing
        ? 'Möchtest du diesen Termin und ALLE FOLGETERMINE wirklich löschen?'
        : 'Möchtest du nur diesen einzelnen Termin löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await deleteCalendarEvent(id, deleteFollowing);
      setSelectedEventDetails(null);
      setIsEventModalOpen(false);
      loadData();
      toast.success('Termin gelöscht');
    } catch (err) {
      toast.error('Fehler beim Löschen des Termins');
    }
  };

  const handleImportFussballDe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.url_or_team_id || !importForm.team_id) return;
    setImporting(true);
    try {
      const res = await importFussballDeMatches(importForm.url_or_team_id, importForm.team_id);
      toast.success(res.message || 'Import abgeschlossen');
      setIsImportModalOpen(false);
      loadData();
    } catch (err) {
      toast.error('Fehler beim Import von fussball.de');
    } finally {
      setImporting(false);
    }
  };

  const handleCleanupMatches = async () => {
    setCleaningMatches(true);
    try {
      const targetTeam = cleanupTeamSelection === 'ALL' ? undefined : cleanupTeamSelection;
      const res = await cleanupOrganizerMatches(targetTeam, cleanupFussballDeOnly);
      toast.success(res.message || `${res.deleted_count || 0} Spieltermin(e) gelöscht.`);
      setIsCleanupMatchesModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Fehler beim Löschen der Spieltermine.');
    } finally {
      setCleaningMatches(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const isPushSupported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window;

  // Reflects whether THIS device/browser currently has an active push subscription.
  // The browser and the backend can disagree (e.g. the DB row was removed while the
  // browser kept its subscription), so a still-valid subscription is re-synced here.
  const refreshPushStatus = async () => {
    if (!isPushSupported()) {
      setPushStatus('unsupported');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;

      if (sub && Notification.permission === 'granted') {
        setPushStatus('enabled');
        try {
          const j = sub.toJSON();
          await subscribePushNotifications({
            endpoint: j.endpoint || '',
            p256dh: j.keys?.p256dh || '',
            auth: j.keys?.auth || ''
          });
        } catch (syncErr) {
          console.warn('Push re-sync with backend failed:', syncErr);
        }
      } else {
        setPushStatus('disabled');
      }
    } catch (e) {
      setPushStatus('disabled');
    }
  };

  useEffect(() => {
    refreshPushStatus();
  }, []);

  const handleTogglePush = async () => {
    if (pushBusy) return;
    if (pushStatus === 'enabled') {
      await handleDisablePush();
    } else {
      await handleEnablePush();
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;

      if (sub) {
        // Drop the DB row first; if the browser unsubscribe succeeded but this failed,
        // the server would keep pushing to a dead endpoint.
        try {
          await unsubscribePushNotifications(sub.endpoint);
        } catch (apiErr) {
          console.warn('Backend unsubscribe failed:', apiErr);
        }
        await sub.unsubscribe();
      }

      setPushStatus('disabled');
      toast.success('🔕 Push-Benachrichtigungen für dieses Gerät deaktiviert.');
    } catch (err: any) {
      console.error('Push deactivation error:', err);
      toast.error(`Deaktivierung fehlgeschlagen: ${err?.message || err}`);
      await refreshPushStatus();
    } finally {
      setPushBusy(false);
    }
  };

  const handleEnablePush = async () => {
    if (!isPushSupported()) {
      toast.warning('Dein Browser oder Gerät unterstützt leider keine Web Push-Benachrichtigungen.');
      setPushStatus('unsupported');
      return;
    }

    setPushBusy(true);
    try {
      toast.info('Bitte erlaube Benachrichtigungen im Browser-Pop-up...');

      let permission = Notification.permission;
      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        toast.warning('Benachrichtigungs-Berechtigung wurde abgelehnt. Bitte aktiviere Benachrichtigungen in deinen Smartphone/Browser-Einstellungen.');
        setPushStatus('disabled');
        return;
      }

      // Ensure active Service Worker registration
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
      }
      if (!reg.active) {
        reg = await navigator.serviceWorker.ready;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BAq3GldEwstlCSYVCqJPBAs55IkeqDamlfRm16QKBnRJ49XoK5cgfD-CkV96PR-1d-caI4ryLfjvM3C20N8gmmE';

      let convertedKey: Uint8Array | string = vapidKey;
      try {
        convertedKey = urlBase64ToUint8Array(vapidKey);
      } catch (e) {
        console.warn('VAPID Key conversion fallback:', e);
      }

      // Check existing subscription first
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as any
        });
      }

      const subJson = sub.toJSON();
      await subscribePushNotifications({
        endpoint: subJson.endpoint || '',
        p256dh: subJson.keys?.p256dh || '',
        auth: subJson.keys?.auth || ''
      });
      setPushStatus('enabled');
      toast.success('🔔 Push-Benachrichtigungen für dieses Gerät wurden erfolgreich aktiviert!');
    } catch (err: any) {
      console.error('Push activation error:', err);
      setPushStatus('disabled');
      toast.error(`Push-Aktivierung fehlgeschlagen: ${err?.message || err}`);
    } finally {
      setPushBusy(false);
    }
  };


  const handleTestPush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        toast.warning('Dein Browser unterstützt keine Push-Benachrichtigungen.');
        return;
      }
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          toast.warning('Benachrichtigungs-Berechtigung wurde nicht erteilt.');
          return;
        }
      }

      // Ensure push subscription exists before triggering server test push
      try {
        await handleEnablePush();
      } catch (e) {
        console.warn('Auto subscribe before test push warning:', e);
      }

      // Purely local notification: only proves this device can DISPLAY notifications.
      // It is labelled as such so it cannot be mistaken for the real server push below.
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification('⚽ MatchTrack Test (Lokal)', {
            body: 'Lokale Anzeige funktioniert. Der echte Server-Push folgt separat.',
            icon: '/app_icon.png',
            badge: '/icon.png',
            vibrate: [100, 50, 100]
          } as any);
        }
      } catch (e) {
        console.warn('Local Android notification fallback error:', e);
      }

      // Trigger backend WebPush - report what the server ACTUALLY delivered.
      const res = await sendTestPushNotification();
      const sentCount = res?.sent_count ?? 0;
      if (sentCount > 0) {
        toast.success(`🧪 Server-Push an ${sentCount} Gerät(e) gesendet.`);
      } else {
        toast.error('🧪 Server konnte keine Push-Nachricht zustellen (0 Geräte). Die lokale Test-Anzeige sagt nichts über den Server-Versand aus - bitte Backend-Log prüfen.');
      }
    } catch (err: any) {
      console.error('Test push error:', err);
      toast.error(`Test-Push ausgelöst: ${err?.response?.data?.detail || err?.message || err}`);
    }
  };

  // Calendar Days calculation
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday = 0
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const startDayOffset = getFirstDayOfMonth(year, month);

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 font-sans text-white">
      <Navbar />

      <main className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Organizer"
          subtitle="SPIELPLAN, TRAININGS-KALENDER, FUSSBALL.DE IMPORT & BENACHRICHTIGUNGEN"
        />

        {/* Top Filter & Actions Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Team Filter */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs font-bold text-zinc-400 uppercase tracking-wider">Team:</span>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="max-w-[120px] sm:max-w-none truncate rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-bold text-white focus:border-primary focus:outline-none"
              >
                <option value="ALL">Alle Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs font-bold text-zinc-400 uppercase tracking-wider">Typ:</span>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="max-w-[120px] sm:max-w-none truncate rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-bold text-white focus:border-primary focus:outline-none"
              >
                <option value="ALL">Alle Termine</option>
                <option value="MATCH">🔴 Spiele</option>
                <option value="TRAINING">🟢 Training</option>
                <option value="MEETING">🔵 Besprechung / Event</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Push-Benachrichtigungen: grüne Glocke = aktiv, graue durchgestrichene Glocke = inaktiv */}
            <button
              onClick={handleTogglePush}
              disabled={pushStatus === 'unsupported' || pushBusy}
              aria-pressed={pushStatus === 'enabled'}
              aria-label={pushStatus === 'enabled' ? 'Push-Benachrichtigungen deaktivieren' : 'Push-Benachrichtigungen aktivieren'}
              title={
                pushStatus === 'unsupported'
                  ? 'Dein Browser oder Gerät unterstützt keine Push-Benachrichtigungen'
                  : pushStatus === 'enabled'
                  ? 'Push-Benachrichtigungen sind aktiv - klicken zum Deaktivieren'
                  : 'Push-Benachrichtigungen für dieses Gerät aktivieren'
              }
              className={`p-2 rounded-xl border transition-all flex items-center justify-center disabled:cursor-not-allowed ${
                pushStatus === 'enabled'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              } ${pushBusy ? 'opacity-50' : ''}`}
            >
              {pushStatus === 'enabled' ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>

            {canEdit && (
              <button
                onClick={() => {
                  setEditingEventId(null);
                  const nowIso = new Date().toISOString().slice(0, 16);
                  const firstEditable = teams.find((t) => {
                    if (isAdmin) return true;
                    return t.can_edit !== false;
                  });
                  const now = new Date();
                  const startRounded = roundToQuarterHour(now);
                  const endRounded = roundToQuarterHour(new Date(now.getTime() + 90 * 60000));

                  const defaultTeamName = firstEditable?.name || teams[0]?.name || '';
                  setEventForm({
                    title: '',
                    event_type: 'TRAINING',
                    start_time: startRounded,
                    end_time: endRounded,
                    location: 'Sportplatz',
                    is_home: true,
                    opponent: '',
                    team_id: firstEditable?.id || teams[0]?.id || '',
                    team_ids: firstEditable?.id ? [firstEditable.id] : (teams[0]?.id ? [teams[0].id] : []),
                    training_session_id: undefined,
                    reminder_minutes: 30,
                    notes: '',
                    repeat_weekly: false,
                    repeat_until: ''
                  });
                  setIsEventModalOpen(true);

                }}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
                title="Termin anlegen"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Termin anlegen</span>
              </button>
            )}

            {/* 3-Dots Dropdown für weitere Aktionen (fussball.de Import, Test-Push, Spieltermine löschen).
                Nur anzeigen, wenn mindestens eine Aktion verfügbar ist. */}
            {(canEdit || showTestPushAction || showMatchCleanupAction) && (
            <div className="relative" ref={moreActionsMenuRef}>
              <button
                onClick={() => setIsMoreActionsMenuOpen(!isMoreActionsMenuOpen)}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center"
                title="Weitere Optionen"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMoreActionsMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 z-[110] space-y-1 text-xs font-semibold">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setIsMoreActionsMenuOpen(false);
                        setIsImportModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all text-left"
                    >
                      <Download className="w-4 h-4 text-blue-400" /> fussball.de Import
                    </button>
                  )}

                  {showTestPushAction && (
                    <button
                      onClick={() => {
                        setIsMoreActionsMenuOpen(false);
                        handleTestPush();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all text-left"
                      title="Klicken um eine sofortige Test-Push-Benachrichtigung auf deinem Gerät zu empfangen"
                    >
                      🧪 Test-Push
                    </button>
                  )}

                  {showMatchCleanupAction && (
                    <button
                      onClick={() => {
                        setIsMoreActionsMenuOpen(false);
                        setCleanupTeamSelection(selectedTeamFilter !== 'ALL' ? selectedTeamFilter : 'ALL');
                        setIsCleanupMatchesModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all text-left border-t border-zinc-800/80 pt-2 mt-1"
                      title="Alle Spieltermine für ein bestimmtes Team oder alle Teams löschen"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" /> Spieltermine löschen
                    </button>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Calendar Header Navigation & View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h2 className="text-base sm:text-xl font-bold text-white uppercase tracking-wider">
              {monthNames[month]} {year}
            </h2>

            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* View Toggle (Grid / List) */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setViewMode('GRID')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'GRID'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Raster</span>
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'LIST'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Agenda</span>
            </button>
          </div>
        </div>

        {/* Grid or List Agenda Calendar View */}
        {viewMode === 'GRID' ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-2xl">
            {/* Weekday Labels (Desktop only) */}
            <div className="hidden md:grid grid-cols-7 border-b border-zinc-800 bg-zinc-950 text-center text-xs font-bold uppercase tracking-wider text-zinc-500 py-3">
              <div>Mo</div>
              <div>Di</div>
              <div>Mi</div>
              <div>Do</div>
              <div>Fr</div>
              <div>Sa</div>
              <div>So</div>
            </div>

            {/* Month Days Grid */}
            <div className="grid grid-cols-1 md:grid-cols-7 auto-rows-fr">
              {/* Empty Leading Days (Desktop only) */}
              {Array.from({ length: startDayOffset }).map((_, idx) => (
                <div key={`empty_${idx}`} className="hidden md:block min-h-[110px] border-b border-r border-zinc-800/40 bg-zinc-950/40 p-2" />
              ))}

              {/* Actual Days */}
              {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
                const dayNumber = dayIdx + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;

                const todayStr = new Date().toISOString().slice(0, 10);
                const isToday = dateStr === todayStr;

                const dayDateObj = new Date(year, month, dayNumber);
                const weekdayName = dayDateObj.toLocaleDateString('de-DE', { weekday: 'short' });

                const dayEvents = events.filter((ev) => {
                  const evDate = new Date(ev.start_time).toISOString().slice(0, 10);
                  return evDate === dateStr;
                });

                return (
                  <div
                    key={`day_${dayNumber}`}
                    id={isToday ? 'today-calendar-day' : `day_${dayNumber}`}
                    className={`min-h-[90px] md:min-h-[110px] border-b border-r border-zinc-800/60 p-2.5 transition-all flex flex-col justify-between group ${
                      isToday
                        ? 'bg-primary/10 border-primary/60 ring-2 ring-primary/40 shadow-lg shadow-primary/10'
                        : 'bg-zinc-900/30 hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold ${
                        isToday
                          ? 'bg-primary text-white px-2 py-0.5 rounded-full shadow-md text-[11px]'
                          : 'text-zinc-400 group-hover:text-white'
                      }`}>
                        <span className="md:hidden">{weekdayName}, </span>{dayNumber}. {isToday && <span className="text-[9px] font-normal uppercase ml-1">Heute</span>}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {dayEvents.map((ev) => {
                        const isMatch = ev.event_type === 'MATCH';
                        const isTraining = ev.event_type === 'TRAINING';
                        const isPast = new Date(ev.start_time) < new Date(new Date().setHours(0, 0, 0, 0));

                        let colorClass = isMatch
                          ? 'bg-red-500/20 border-red-500/40 text-red-300'
                          : isTraining
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-blue-500/20 border-blue-500/40 text-blue-300';

                        if (isPast) {
                          colorClass = 'bg-zinc-900/40 border-zinc-800 text-zinc-500 opacity-60 hover:opacity-100 hover:text-zinc-300';
                        }

                        const teamName = getEventTeamNames(ev);
                        const isEditable = canEditEvent(ev);

                        return (
                          <div key={ev.id} className="relative group/event">
                            <button
                              onClick={() => setSelectedEventDetails(ev)}
                              className={`w-full text-left p-1.5 rounded-lg border text-[10px] font-bold transition-all ${colorClass}`}
                            >
                              {/* Zeile 1: Uhrzeit + Mannschafts-Tag (z. B. E3-Junioren) + Status */}
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="opacity-90 font-mono shrink-0">
                                  {new Date(ev.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className="flex items-center gap-1 shrink-0 overflow-hidden">
                                  {teamName && (
                                    <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] truncate max-w-[110px] ${
                                      isPast ? 'bg-black/20 text-zinc-600' : 'bg-black/50 text-zinc-200 border border-white/10'
                                    }`}>
                                      {teamName}
                                    </span>
                                  )}
                                  {isEditable && (
                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                                  )}
                                </div>
                              </div>

                              {/* Zeile 2: Titel / Spielbegegnung + Trainingsplan Badge */}
                              <div className="flex items-center gap-1 leading-tight">
                                <span className="truncate flex-1">
                                  {ev.title}
                                </span>
                                {ev.training_session_id && (
                                  <span className="text-[8px] px-1 py-0.2 rounded font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shrink-0">
                                    📋 Plan
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Hover Tooltip Card */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/event:block z-[90] w-64 p-3 rounded-xl bg-zinc-950 border border-zinc-700 shadow-2xl text-xs space-y-1.5 pointer-events-none">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  isMatch ? 'bg-red-500/20 text-red-400 border border-red-500/30' : isTraining ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}>
                                  {isMatch ? '🔴 Spiel' : isTraining ? '🟢 Training' : ev.event_type}
                                </span>
                                {teamName && (
                                  <span className="text-[10px] font-bold text-primary truncate max-w-[120px]">
                                    {teamName}
                                  </span>
                                )}
                              </div>

                              <h4 className="font-bold text-white text-xs">{ev.title}</h4>

                              <div className="text-[11px] text-zinc-300 space-y-1">
                                {isMatch ? (
                                  <div>⏱️ <strong className="text-white">Anstoß:</strong> <span className="text-red-400 font-bold">{new Date(ev.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span></div>
                                ) : (
                                  <div>🕒 {new Date(ev.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>
                                )}
                                {ev.opponent && (
                                  <div>⚽ <strong className="text-white">Gegner:</strong> <span className="text-red-400 font-semibold">{ev.opponent}</span></div>
                                )}
                                {ev.location && (
                                  <div>📍 <strong className="text-white">Spielort:</strong> <span>{ev.location}</span></div>
                                )}
                                {(ev.training_session || ev.training_session_id) && (
                                  <div className="text-[10px] text-emerald-400 font-bold mt-1">
                                    📋 Trainingsplan: {ev.training_session?.title || 'Verknüpft'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Agenda / List View (Optimized for Mobile & Quick Scrolling) */
          <div className="space-y-4">
            {(() => {
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);

              const currentMonthEvents = events.filter((ev) => {
                const dt = new Date(ev.start_time);
                const isCurrentMonth = dt.getFullYear() === year && dt.getMonth() === month;
                const isFutureOrToday = dt >= todayStart;
                return isCurrentMonth && isFutureOrToday;
              }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

              if (currentMonthEvents.length === 0) {
                return (
                  <div className="p-12 text-center text-zinc-500 text-xs bg-zinc-900/40 border border-zinc-800 rounded-2xl">
                    Keine anstehenden Termine im {monthNames[month]} {year} gefunden.
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {currentMonthEvents.map((ev) => {
                    const isMatch = ev.event_type === 'MATCH';
                    const isTraining = ev.event_type === 'TRAINING';
                    const evDate = new Date(ev.start_time);
                    const isPast = evDate < new Date(new Date().setHours(0, 0, 0, 0));
                    const teamName = getEventTeamNames(ev);
                    const isEditable = canEditEvent(ev);

                    const badgeColor = isMatch
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : isTraining
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

                    return (
                      <button
                        key={`list_${ev.id}`}
                        onClick={() => setSelectedEventDetails(ev)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all space-y-2.5 block group ${
                          isPast
                            ? 'bg-zinc-950/60 border-zinc-800/80 opacity-70 hover:opacity-100'
                            : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700 shadow-lg backdrop-blur-md'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border ${badgeColor}`}>
                              {ev.event_type}
                            </span>
                            {teamName && (
                              <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <span>{teamName}</span>
                                {isEditable && (
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0 inline-block" />
                                )}
                              </span>
                            )}
                            {!teamName && isEditable && (
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0 inline-block" />
                            )}
                          </div>

                          <span className="text-xs font-bold font-mono text-zinc-300">
                            {evDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-white text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                            <span>{ev.title}</span>
                            {isEditable && (
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0 inline-block" />
                            )}
                          </h3>
                          <span className={`text-xs font-bold shrink-0 flex items-center gap-1 ${
                            isMatch ? 'text-red-400 font-mono' : 'text-zinc-400'
                          }`}>
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            {isMatch
                              ? `Anstoß: ${evDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
                              : `${evDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`}
                          </span>
                        </div>

                        {isMatch && ev.opponent && (
                          <div className="flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
                            <span>⚽ Gegner: <strong className="text-white">{ev.opponent}</strong></span>
                          </div>
                        )}

                        {(ev.training_session || ev.training_session_id) && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl font-medium">
                            <span>📋 Verknüpfter Trainingsplan: <strong className="text-white">{ev.training_session?.title || 'Verknüpft'}</strong></span>
                          </div>
                        )}

                        {ev.location && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate"><strong className="text-zinc-300">Spielort:</strong> {ev.location}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Modal: Event Details */}
        {selectedEventDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    selectedEventDetails.event_type === 'MATCH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {selectedEventDetails.event_type}
                  </span>
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    <span>{getEventTeamNames(selectedEventDetails) || selectedEventDetails.title}</span>
                    {canEditEvent(selectedEventDetails) && (
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0 inline-block" />
                    )}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    if (!canEditEvent(selectedEventDetails)) return null;

                    return (
                      <div className="relative" ref={eventMenuRef}>
                        <button
                          onClick={() => setIsEventMenuOpen(!isEventMenuOpen)}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs flex items-center justify-center"
                          title="Optionen"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                      {isEventMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 z-[110] space-y-1 text-xs font-semibold">
                          <button
                            onClick={() => {
                              setIsEventMenuOpen(false);
                              handleEditEventRequest(selectedEventDetails);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all text-left"
                          >
                            ✏️ Termin Bearbeiten
                          </button>
                          <button
                            onClick={() => {
                              setIsEventMenuOpen(false);
                              handleDeleteEvent(selectedEventDetails.id, false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-zinc-400" /> Nur diesen löschen
                          </button>
                          <button
                            onClick={() => {
                              setIsEventMenuOpen(false);
                              handleDeleteEvent(selectedEventDetails.id, true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" /> + Folgetermine löschen
                          </button>
                        </div>
                      )}
                    </div>
                    );
                  })()}
                  <button onClick={() => { setIsEventMenuOpen(false); setSelectedEventDetails(null); }} className="text-zinc-500 hover:text-white p-1 text-lg leading-none">✕</button>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-300">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Clock className={`w-4 h-4 ${selectedEventDetails.event_type === 'MATCH' ? 'text-red-400' : 'text-primary'}`} />
                  <span>
                    {selectedEventDetails.event_type === 'MATCH' ? (
                      <>
                        <strong className="text-white">Anstoß:</strong>{' '}
                        <span className="text-red-400 font-bold font-mono">
                          {new Date(selectedEventDetails.start_time).toLocaleString('de-DE', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} Uhr
                        </span>
                      </>
                    ) : (
                      `${new Date(selectedEventDetails.start_time).toLocaleString('de-DE')} Uhr`
                    )}
                  </span>
                </div>

                {selectedEventDetails.event_type === 'MATCH' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1.5 text-xs text-zinc-300">
                    {selectedEventDetails.opponent && (
                      <div>
                        ⚽ <strong className="text-white">Gegner:</strong>{' '}
                        <span className="text-red-300 font-bold">{selectedEventDetails.opponent}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedEventDetails.location && (
                  <div className="flex items-center gap-2 text-zinc-300">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span><strong className="text-white">Spielort:</strong> {selectedEventDetails.location}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-zinc-400">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Push-Erinnerung: {getReminderLabel(selectedEventDetails.reminder_minutes)}</span>
                </div>

                {/* Linked Training Session Section */}
                {(() => {
                  const linkedSession = selectedEventDetails.training_session || trainingSessions.find(s => s.id === selectedEventDetails.training_session_id);

                  if (linkedSession) {
                    const grouped: { [key: string]: any[] } = {};
                    (linkedSession.exercises || []).forEach((exItem: any) => {
                      const sec = exItem.section_name || 'Hauptteil';
                      if (!grouped[sec]) grouped[sec] = [];
                      grouped[sec].push(exItem);
                    });

                    return (
                      <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <div>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Verknüpfter Trainingsplan</span>
                            <h4 className="font-bold text-white text-sm mt-0.5">{linkedSession.title}</h4>
                            <span className="text-[10px] text-zinc-400">{linkedSession.methodology} • {linkedSession.age_group}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPrintingSession(linkedSession)}
                              className="text-xs font-bold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg border border-zinc-700 flex items-center gap-1.5 transition-all"
                            >
                              <Printer className="w-3.5 h-3.5 text-primary" /> Drucken / PDF
                            </button>
                            <a
                              href="/training"
                              className="text-xs font-bold text-primary hover:underline bg-primary/10 px-2.5 py-1.5 rounded-lg border border-primary/20 flex items-center gap-1"
                            >
                              ✏️ Editor
                            </a>
                          </div>
                        </div>

                        {/* Grouped Exercises preview */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {Object.entries(grouped).map(([secName, exList]) => (
                            <div key={secName} className="space-y-1">
                              <span className="text-[9px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded border border-primary/20 inline-block">
                                {secName}
                              </span>
                              <div className="space-y-1">
                                {exList.map((exItem: any, idx: number) => {
                                  const exTitle = exItem.exercise?.title || exItem.title || 'Übung';
                                  const exDuration = exItem.exercise?.duration_minutes || exItem.duration_minutes || 15;
                                  return (
                                    <div key={exItem.id || idx} className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between text-xs">
                                      <span className="font-bold text-zinc-200">{idx + 1}. {exTitle}</span>
                                      <span className="text-[10px] text-zinc-500">{exDuration} Min.</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {canEdit && (
                          <div className="pt-2.5 border-t border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <select
                                value={linkingSessionId || ''}
                                onChange={(e) => setLinkingSessionId(e.target.value ? parseInt(e.target.value) : undefined)}
                                className="flex-1 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                              >
                                <option value="">Anderen Plan auswählen...</option>
                                {trainingSessions.filter((s: any) => s.id !== linkedSession.id).map((s: any) => (
                                  <option key={s.id} value={s.id}>{s.title} ({s.age_group || s.methodology || 'Plan'})</option>
                                ))}
                              </select>
                              <button
                                disabled={!linkingSessionId}
                                onClick={() => handleLinkSessionToEvent(selectedEventDetails.id, linkingSessionId)}
                                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs disabled:opacity-40 shrink-0 shadow-sm transition-all"
                              >
                                Wechseln
                              </button>
                            </div>

                            <button
                              onClick={() => handleLinkSessionToEvent(selectedEventDetails.id, null)}
                              className="text-xs text-red-400 hover:text-red-300 hover:underline font-semibold shrink-0 text-right py-1"
                            >
                              🔗 Verknüpfung aufheben
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  } else if (canEdit && (selectedEventDetails.event_type === 'TRAINING' || selectedEventDetails.event_type === 'ALL')) {
                    return (
                      <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                        <span className="text-[11px] font-bold text-zinc-300 block">📋 Noch kein Trainingsplan verknüpft</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={linkingSessionId || ''}
                            onChange={(e) => setLinkingSessionId(e.target.value ? parseInt(e.target.value) : undefined)}
                            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                          >
                            <option value="">Trainingsplan auswählen...</option>
                            {trainingSessions.map((s) => (
                              <option key={s.id} value={s.id}>{s.title} ({s.age_group || s.methodology || 'Plan'})</option>
                            ))}
                          </select>
                          <button
                            disabled={!linkingSessionId}
                            onClick={() => handleLinkSessionToEvent(selectedEventDetails.id, linkingSessionId)}
                            className="px-3 py-1.5 rounded-xl bg-primary text-white font-bold text-xs disabled:opacity-40"
                          >
                            Verknüpfen
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {selectedEventDetails.notes && (
                  <p className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 text-zinc-400">
                    {selectedEventDetails.notes}
                  </p>
                )}
              </div>

              <div className="flex justify-end border-t border-zinc-800 pt-4">
                <button
                  onClick={() => { setIsEventMenuOpen(false); setSelectedEventDetails(null); }}
                  className="px-5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-bold transition-all"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Manuell Termin anlegen / bearbeiten */}
        {isEventModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-white">
                  {editingEventId ? 'Termin einzeln bearbeiten' : 'Neuen Termin anlegen'}
                </h3>
                <button onClick={() => setIsEventModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Titel des Termins</label>
                  <input
                    type="text"
                    required
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    placeholder="z. B. Dienstagstraining oder Punktspiel vs. FC Muster"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">Termin-Typ</label>
                    <select
                      value={eventForm.event_type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setEventForm({
                          ...eventForm,
                          event_type: newType,
                          reminder_minutes: newType === 'MATCH' ? 1440 : (eventForm.reminder_minutes === 1440 ? 30 : eventForm.reminder_minutes)
                        });
                      }}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none"
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
                    <div className="flex flex-wrap gap-2 p-2.5 rounded-xl border border-zinc-800 bg-zinc-900">
                      {teams
                        .filter((t) => isAdmin || t.can_edit !== false)
                        .map((t) => {
                          const isSelected = eventForm.team_ids.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                const updated = isSelected
                                  ? eventForm.team_ids.filter((id) => id !== t.id)
                                  : [...eventForm.team_ids, t.id];
                                setEventForm({ ...eventForm, team_ids: updated, team_id: updated[0] || '' });
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                isSelected
                                  ? 'bg-primary border-primary text-white shadow-md'
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                              }`}
                            >
                              {t.name}{t.age_group ? ` (${t.age_group})` : ''}
                            </button>
                          );
                        })}
                    </div>
                    {eventForm.team_ids.length === 0 && (
                      <p className="text-[10px] text-amber-400/80 mt-1.5">
                        Ohne Auswahl ist der Termin für alle sichtbar und löst keine Team-Erinnerung aus.
                      </p>
                    )}
                  </div>
                </div>

                {/* Datum, Startzeit und Endzeit mit 15-Minuten Dropdowns */}
                {(() => {
                  const now = new Date();
                  const currentRoundedStart = roundToQuarterHour(now).slice(11, 16);
                  const currentRoundedEnd = roundToQuarterHour(new Date(now.getTime() + 90 * 60000)).slice(11, 16);

                  const selectedStartTime = eventForm.start_time ? eventForm.start_time.slice(11, 16) : currentRoundedStart;
                  const selectedEndTime = eventForm.end_time ? eventForm.end_time.slice(11, 16) : currentRoundedEnd;
                  const selectedDate = eventForm.start_time ? eventForm.start_time.slice(0, 10) : roundToQuarterHour(now).slice(0, 10);

                  return (
                    <div className="space-y-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60">
                      <div>
                        <label className="text-xs font-bold text-zinc-400 block mb-1">Datum</label>
                        <input
                          type="date"
                          required
                          value={selectedDate}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            if (newDate) {
                              handleStartTimeChange(`${newDate}T${selectedStartTime}`, !!editingEventId);
                              setEventForm(prev => ({
                                ...prev,
                                start_time: `${newDate}T${selectedStartTime}`,
                                end_time: `${newDate}T${selectedEndTime}`
                              }));
                            }
                          }}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-zinc-400 block mb-1">Beginn (Uhrzeit)</label>
                          <select
                            value={selectedStartTime}
                            onChange={(e) => {
                              const newStartIso = `${selectedDate}T${e.target.value}`;
                              handleStartTimeChange(newStartIso, !!editingEventId);
                            }}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none"
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
                            value={selectedEndTime}
                            onChange={(e) => {
                              setEventForm(prev => ({ ...prev, end_time: `${selectedDate}T${e.target.value}` }));
                            }}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none"
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
                  );
                })()}




                {/* Optional Training Session attachment */}
                {eventForm.event_type === 'TRAINING' && (
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">Trainingsplan zuweisen (optional)</label>
                    <select
                      value={eventForm.training_session_id || ''}
                      onChange={(e) => setEventForm({ ...eventForm, training_session_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="">Kein Trainingsplan verknüpft</option>
                      {trainingSessions.map((s) => (
                        <option key={s.id} value={s.id}>{s.title} ({s.age_group || s.methodology || 'Plan'})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">🔔 Push-Erinnerungszeit</label>
                  <select
                    value={eventForm.reminder_minutes ?? 30}
                    onChange={(e) => setEventForm({ ...eventForm, reminder_minutes: parseInt(e.target.value) })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none"
                  >
                    <option value={0}>❌ Keine Erinnerung</option>
                    <option value={15}>⏱️ 15 Minuten vorher</option>
                    <option value={30}>⏱️ 30 Minuten vorher</option>
                    <option value={60}>⏰ 1 Stunde vorher</option>
                    <option value={240}>⏰ 4 Stunden vorher</option>
                    <option value={1440}>📅 1 Tag vorher</option>
                  </select>
                </div>

                {/* Weekly Recurrence Option */}
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

                {/* Match specific options */}
                {eventForm.event_type === 'MATCH' && (
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">Gegner (Mannschaft)</label>
                    <input
                      type="text"
                      value={eventForm.opponent || ''}
                      onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })}
                      placeholder="z. B. JFC Unstrut Eagles II"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Spielort / Treffpunkt</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    placeholder="z. B. Sportplatz Großengottern"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                  {editingEventId ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(editingEventId, false)}
                      className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Termin löschen
                    </button>
                  ) : <div />}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEventModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white text-xs font-bold transition-all"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
                    >
                      Termin Speichern
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: fussball.de Import */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-white">fussball.de Spielplan Import</h3>
                <button onClick={() => setIsImportModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleImportFussballDe} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">fussball.de Team-ID oder URL</label>
                  <input
                    type="text"
                    required
                    value={importForm.url_or_team_id}
                    onChange={(e) => setImportForm({ ...importForm, url_or_team_id: e.target.value })}
                    placeholder="z. B. 02LTUROG70000000VS5489B1VVVHS1D7 oder https://www.fussball.de/..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />

                  {/* Help Hint: Wo befindet sich die Team-ID */}
                  <div className="mt-2.5 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                      <span>💡 Wo finde ich die Team-ID?</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Öffne deine Mannschaftsseite auf <strong className="text-zinc-200">fussball.de</strong>. Die <strong className="text-amber-300 font-mono">Team-ID</strong> steht in der Adresszeile deines Browsers direkt nach <code className="text-zinc-300 font-mono">/team-id/</code>:
                    </p>
                    <div className="rounded-lg border border-zinc-800 bg-black/60 p-1.5 overflow-hidden">
                      <img
                        src="/fussball_de_id_help.png"
                        alt="fussball.de Team-ID in Browser Adresszeile"
                        className="w-full rounded border border-zinc-700/60 object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Ziel-Mannschaft</label>
                  <select
                    value={importForm.team_id}
                    onChange={(e) => setImportForm({ ...importForm, team_id: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  >
                    {teams
                      .filter((t) => {
                        if (isAdmin) return true;
                        return t.can_edit !== false;
                      })
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-bold hover:text-white transition-all"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={importing}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50 transition-all"
                  >
                    {importing ? 'Importiere...' : 'Spiele Importieren'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Spieltermine löschen */}
        {isCleanupMatchesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-red-500/30 p-6 shadow-2xl space-y-5">
              <div className="flex items-center gap-3 text-red-400">
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Spieltermine löschen</h3>
                  <p className="text-xs text-zinc-400">Bereinigt Spieltermine aus dem Kalender.</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Möchtest du die Spieltermine wirklich unwiderruflich aus dem Organizer entfernen?
              </p>

              {isAdmin && (
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Betroffene Mannschaft</label>
                  <select
                    value={cleanupTeamSelection}
                    onChange={(e) => setCleanupTeamSelection(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  >
                    <option value="ALL">⚠️ Alle Mannschaften (Kompletter Kalender)</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-zinc-300">
                  <input
                    type="checkbox"
                    checked={cleanupFussballDeOnly}
                    onChange={(e) => setCleanupFussballDeOnly(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-0 w-4 h-4"
                  />
                  <span>Nur über fussball.de importierte Spiele löschen</span>
                </label>
                <p className="text-[11px] text-zinc-500 pl-7">
                  {cleanupFussballDeOnly
                    ? 'Manuell erstellte Spieltermine bleiben im Kalender erhalten.'
                    : 'Alle Spieltermine werden restlos gelöscht.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={cleaningMatches}
                  onClick={() => setIsCleanupMatchesModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50"
                >
                  Abbrechen
                </button>

                <button
                  type="button"
                  disabled={cleaningMatches}
                  onClick={handleCleanupMatches}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition-all flex items-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {cleaningMatches ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Unwiderruflich löschen</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Printable Training Modal */}
        {printingSession && (
          <PrintableTrainingModal
            session={printingSession}
            exercisesList={[]}
            onClose={() => setPrintingSession(null)}
          />
        )}
      </main>
    </div>
  );
}
