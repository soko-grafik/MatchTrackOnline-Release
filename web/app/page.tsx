"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar as CalendarIcon,
  ArrowRight,
  Clock,
  MapPin,
  Video,
  Sparkles,
  Dumbbell,
  UploadCloud,
  LayoutGrid
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import MatchCard from '@/components/MatchCard';
import EditMatchModal from '@/components/EditMatchModal';
import EditCalendarEventModal from '@/components/EditCalendarEventModal';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/hooks/useMatches';
import { getCalendarEvents, getExercises, getMediaUrl } from '@/services/api';

export default function DashboardLandingPage() {
  const { user } = useAuth();
  const { matches, loading: matchesLoading, handleToggleSubscription, handleEdit } = useMatches();
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [recentExercises, setRecentExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<'EVENTS' | 'MATCHES' | 'EXERCISES'>('EVENTS');

  // Edit Calendar Event Modal State
  const [eventToEdit, setEventToEdit] = useState<any>(null);
  const [isEventEditModalOpen, setIsEventEditModalOpen] = useState(false);

  const onEventEditRequest = (ev: any) => {
    setEventToEdit(ev);
    setIsEventEditModalOpen(true);
  };

  // Edit Match Modal State
  const [matchToEdit, setMatchToEdit] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const onEditRequest = (e: React.MouseEvent, match: any) => {
    e.preventDefault();
    e.stopPropagation();
    setMatchToEdit(match);
    setIsEditModalOpen(true);
  };

  const confirmEdit = async (updatedData: any) => {
    if (!matchToEdit) return;
    try {
      await handleEdit(matchToEdit.id, updatedData);
    } catch (err) {
      console.error('Fehler beim Editieren:', err);
    } finally {
      setIsEditModalOpen(false);
      setMatchToEdit(null);
    }
  };

  const userRole = user?.role?.toUpperCase() || 'VIEWER';
  const isAdmin = userRole === 'ADMIN';
  const isTeamAdmin = userRole === 'TEAM_ADMIN';
  const canUpload = isAdmin || isTeamAdmin;

  const perms = (user as any)?.module_permissions || {};
  const isDefaultNo = userRole === 'VIEWER';

  const hasModule = (mod: string) => {
    if (isAdmin || isTeamAdmin) return true;
    if (perms[mod] !== undefined) return perms[mod];
    return isDefaultNo ? (mod === 'MATCHES') : true;
  };

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const [eventsData, exercisesData] = await Promise.all([
        getCalendarEvents(),
        getExercises()
      ]);

      if (Array.isArray(eventsData)) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const upcoming = eventsData
          .filter((ev) => new Date(ev.start_time) >= todayStart)
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 7);
        setUpcomingEvents(upcoming);
      }


      if (Array.isArray(exercisesData)) {
        setRecentExercises(exercisesData.slice(0, 7));
      }
    } catch (err) {
      console.error('Fehler beim Laden der Dashboard-Übersicht:', err);
    } finally {
      setLoading(false);
    }
  };

  const recentMatches = [...matches]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 7);

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 font-sans text-white">
      <Navbar />

      <main className="flex-1 w-full px-4 py-6 sm:px-6 lg:px-8 space-y-6 sm:space-y-10">
        {/* Compact Hero Banner */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-primary/10 p-5 sm:p-8 shadow-2xl">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="space-y-1 sm:space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> MatchTrack Online
              </div>
              <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                Hallo, {user?.first_name || user?.username || 'Trainer'}
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm hidden sm:block">
                Verwalte Spielanalysen, plane Trainingseinheiten und behalte alle Termine im Blick.
              </p>
            </div>

            {canUpload && (
              <Link
                href="/admin/upload"
                className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
              >
                <UploadCloud className="w-4 h-4" />
                <span className="hidden sm:inline">Video Upload</span>
              </Link>
            )}
          </div>
        </section>

        {/* Quick Action Navigation Grid (Desktop: 3 items side-by-side, hidden on mobile) */}
        <section className="hidden md:grid grid-cols-3 gap-4">
          {hasModule('ORGANIZER') && (
            <Link
              href="/organizer"
              className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900 text-center space-y-1.5 transition-all group backdrop-blur-md shadow-md"
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold block text-zinc-300 group-hover:text-white truncate">Organizer</span>
            </Link>
          )}

          {hasModule('MATCHES') && (
            <Link
              href="/matches"
              className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900 text-center space-y-1.5 transition-all group backdrop-blur-md shadow-md"
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Video className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold block text-zinc-300 group-hover:text-white truncate">Spiele</span>
            </Link>
          )}

          {hasModule('TRAINING') && (
            <Link
              href="/training"
              className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900 text-center space-y-1.5 transition-all group backdrop-blur-md shadow-md"
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Dumbbell className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold block text-zinc-300 group-hover:text-white truncate">Übungen</span>
            </Link>
          )}
        </section>

        {/* Mobile Tab Selector Switcher (Visible ONLY on Mobile < md) */}
        <div className="flex md:hidden items-center p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setActiveMobileTab('EVENTS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeMobileTab === 'EVENTS'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Termine ({upcomingEvents.length})</span>
          </button>

          <button
            onClick={() => setActiveMobileTab('MATCHES')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeMobileTab === 'MATCHES'
                ? 'bg-primary text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Spiele ({recentMatches.length})</span>
          </button>

          <button
            onClick={() => setActiveMobileTab('EXERCISES')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeMobileTab === 'EXERCISES'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Übungen</span>
          </button>
        </div>

        {/* Section 1: Upcoming Events from Organizer */}
        <section className={`space-y-4 ${activeMobileTab === 'EVENTS' ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white">Nächste Ereignisse</h2>
                <p className="text-xs text-zinc-400 hidden sm:block">Kommende Spiele & Trainingstermine deines Teams</p>
              </div>
            </div>

            <Link
              href="/organizer"
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Alle Termine <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 text-center text-zinc-500 text-xs">
              Keine anstehenden Termine im Kalender eingetragen.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-[1720px]:grid-cols-7 gap-3 sm:gap-4">
              {upcomingEvents.map((ev) => {
                const isMatch = ev.event_type === 'MATCH';
                const isTraining = ev.event_type === 'TRAINING';
                const badgeColor = isMatch
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : isTraining
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

                return (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEventEditRequest(ev)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEventEditRequest(ev);
                      }
                    }}
                    className="p-3.5 sm:p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900 transition-all space-y-2.5 block group shadow-lg cursor-pointer text-left focus:outline-none focus:border-primary select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${badgeColor}`}>
                        {ev.event_type}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono font-bold">
                        {new Date(ev.start_time).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                      {ev.title}
                    </h3>

                    {isTraining && (ev.training_session?.title || ev.training_session_id) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-xl font-medium">
                        <Dumbbell className="w-3 h-3 shrink-0 text-blue-400" />
                        <span className="truncate">Plan: <strong className="text-white">{ev.training_session?.title || 'Zugewiesen'}</strong></span>
                      </div>
                    )}

                    <div className="space-y-1 text-[11px] sm:text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span>{new Date(ev.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                      </div>
                      {ev.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Recent Matches & Video Analyses */}
        <section className={`space-y-4 ${activeMobileTab === 'MATCHES' ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white">Neueste Spiel-Analysen</h2>
                <p className="text-xs text-zinc-400 hidden sm:block">Zuletzt hochgeladene Match-Videos & KI-Analysen</p>
              </div>
            </div>

            <Link
              href="/matches"
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Alle Spiele <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentMatches.length === 0 ? (
            <div className="p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 text-center text-zinc-500 text-xs">
              Noch keine Videos hochgeladen.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-[1720px]:grid-cols-7 gap-3 sm:gap-4">
              {recentMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  user={user}
                  onToggleSubscription={(e, match) => handleToggleSubscription(match)}
                  onEditRequest={onEditRequest}
                  allowDelete={false}
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Recent Training Exercises & Plans */}
        <section className={`space-y-4 ${activeMobileTab === 'EXERCISES' ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white">Neueste Übungen</h2>
                <p className="text-xs text-zinc-400 hidden sm:block">Übungen aus der Wissensdatenbank mit Taktik-Skizzen</p>
              </div>
            </div>

            <Link
              href="/training"
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Zur Datenbank <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentExercises.length === 0 ? (
            <div className="p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 text-center text-zinc-500 text-xs">
              Noch keine Übungen in der Datenbank angelegt.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-[1720px]:grid-cols-7 gap-3 sm:gap-4">
              {recentExercises.map((ex) => (
                <Link
                  key={ex.id}
                  href="/training"
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-700 transition-all flex flex-col group shadow-lg"
                >
                  <div className="aspect-[3/2] bg-zinc-950 relative overflow-hidden flex items-center justify-center border-b border-zinc-800/80">
                    {ex.thumbnail_path ? (
                      <img
                        src={ex.thumbnail_path.startsWith('data:') || ex.thumbnail_path.startsWith('http') ? ex.thumbnail_path : getMediaUrl(ex.thumbnail_path)}
                        alt={ex.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Dumbbell className="w-8 h-8 text-zinc-700" />
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-zinc-900/90 text-primary text-[10px] font-bold border border-zinc-800">
                      {ex.focus_area}
                    </span>
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                    <h3 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-primary transition-colors">
                      {ex.title}
                    </h3>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2">
                      <span>{ex.age_group}</span>
                      <span>⏱️ {ex.duration_minutes} Min</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {matchToEdit && (
          <EditMatchModal
            isOpen={isEditModalOpen}
            onClose={() => { setIsEditModalOpen(false); setMatchToEdit(null); }}
            onSave={confirmEdit}
            match={matchToEdit}
          />
        )}

        {eventToEdit && (
          <EditCalendarEventModal
            isOpen={isEventEditModalOpen}
            onClose={() => {
              setIsEventEditModalOpen(false);
              setEventToEdit(null);
            }}
            event={eventToEdit}
            onSaved={loadOverviewData}
            onDeleted={loadOverviewData}
          />
        )}
      </main>
    </div>
  );
}

