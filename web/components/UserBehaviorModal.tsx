"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, Activity, Eye, Clock, MessageSquare, PenTool, LayoutGrid, 
  Calendar, Award, Flame, User as UserIcon, Shield, Layers, 
  ChevronRight, RefreshCw, Filter, PlayCircle 
} from 'lucide-react';
import { getSingleUserStatistics, getUserActivityLogs, getMediaUrl } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

interface UserBehaviorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function UserBehaviorModal({ isOpen, onClose, userId }: UserBehaviorModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'feed'>('overview');
  const [selectedActivityType, setSelectedActivityType] = useState<string>('ALL');

  const loadStats = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getSingleUserStatistics(userId);
      setStatsData(data);
    } catch (err: any) {
      toast.error(err.message || 'Nutzerstatistiken konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (type: string = selectedActivityType) => {
    if (!userId) return;
    setLogsLoading(true);
    try {
      const res = await getUserActivityLogs(userId, 1, 50, type);
      setActivityLogs(res.logs || []);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadStats();
      loadLogs('ALL');
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const user = statsData?.user;
  const metrics = statsData?.metrics || {};
  const heatmap = statsData?.heatmap_30d || [];
  const moduleBreakdown = statsData?.module_breakdown || {};
  const recentMatches = statsData?.recent_matches || [];

  const totalModuleActions = (moduleBreakdown.video || 0) + (moduleBreakdown.tactics || 0) + (moduleBreakdown.training || 0) + (moduleBreakdown.players || 0) || 1;
  const videoPerc = Math.round(((moduleBreakdown.video || 0) / totalModuleActions) * 100);
  const tacticsPerc = Math.round(((moduleBreakdown.tactics || 0) / totalModuleActions) * 100);
  const trainingPerc = Math.round(((moduleBreakdown.training || 0) / totalModuleActions) * 100);
  const playersPerc = Math.max(0, 100 - videoPerc - tacticsPerc - trainingPerc);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'LOGIN': return <Shield className="w-3.5 h-3.5 text-blue-400" />;
      case 'VIEW_MATCH': return <Eye className="w-3.5 h-3.5 text-emerald-400" />;
      case 'WATCH_TIME': return <Clock className="w-3.5 h-3.5 text-teal-400" />;
      case 'ADD_COMMENT': return <MessageSquare className="w-3.5 h-3.5 text-amber-400" />;
      case 'CREATE_DRAWING': return <PenTool className="w-3.5 h-3.5 text-purple-400" />;
      case 'CREATE_TACTICS':
      case 'EDIT_TACTICS': return <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />;
      case 'CREATE_TRAINING': return <Calendar className="w-3.5 h-3.5 text-cyan-400" />;
      case 'EVALUATE_PLAYER': return <Award className="w-3.5 h-3.5 text-rose-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const formatActivityText = (log: any) => {
    const details = log.details || {};
    switch (log.activity_type) {
      case 'LOGIN': return `Erfolgreich angemeldet`;
      case 'VIEW_MATCH': return `Match angesehen: ${details.match_name || 'Match'}`;
      case 'WATCH_TIME': return `Aktive Videoanalyse (+${details.duration_seconds || 30}s)`;
      case 'ADD_COMMENT': return `Kommentar gesetzt (bei ${Math.round((details.video_time_ms || 0)/1000)}s)`;
      case 'CREATE_DRAWING': return `Taktische Zeichnung auf Video erstellt`;
      case 'CREATE_TACTICS': return `Taktiktafel erstellt: "${details.title || 'Spielzug'}"`;
      case 'EDIT_TACTICS': return `Taktiktafel bearbeitet: "${details.title || 'Spielzug'}"`;
      case 'CREATE_TRAINING': return `Trainingsplan erstellt: "${details.title || 'Einheit'}"`;
      case 'EVALUATE_PLAYER': return `Spielerbewertung abgegeben für ${details.player_name || 'Spieler'}`;
      default: return `${log.activity_type}`;
    }
  };

  const formatTimestamp = (isoStr: string) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        
        {/* Header with User Profile */}
        <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/40 flex items-start justify-between relative">
          {loading ? (
            <div className="flex items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 animate-pulse" />
              <div className="space-y-2">
                <div className="w-40 h-5 bg-zinc-800 rounded animate-pulse" />
                <div className="w-24 h-4 bg-zinc-800/60 rounded animate-pulse" />
              </div>
            </div>
          ) : user ? (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 border border-white/10 flex items-center justify-center text-white text-xl font-black shadow-lg overflow-hidden relative">
                {user.avatar_path ? (
                  <img src={getMediaUrl(user.avatar_path)} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <span>{(user.first_name?.[0] || user.username?.[0] || 'U').toUpperCase()}</span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-white tracking-tight">
                    {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {user.role}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 flex-wrap font-mono">
                  <span>@{user.username}</span>
                  <span>•</span>
                  <span>{user.email}</span>
                  {user.teams && user.teams.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-300 font-sans">
                        Teams: {user.teams.map((t: any) => t.name).join(', ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-zinc-400 text-sm">Benutzerdaten nicht verfügbar</div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 py-2 border-b border-zinc-800/80 bg-zinc-900/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Verhaltens-Übersicht & KPIs</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('feed');
                loadLogs(selectedActivityType);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'feed'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Aktivitäts-Timeline (Audit Log)</span>
            </button>
          </div>

          {activeTab === 'feed' && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={selectedActivityType}
                onChange={(e) => {
                  setSelectedActivityType(e.target.value);
                  loadLogs(e.target.value);
                }}
                className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Alle Aktivitäten</option>
                <option value="LOGIN">Logins</option>
                <option value="VIEW_MATCH">Match-Aufrufe</option>
                <option value="WATCH_TIME">Watch-Time</option>
                <option value="ADD_COMMENT">Kommentare</option>
                <option value="CREATE_DRAWING">Zeichnungen</option>
                <option value="CREATE_TACTICS">Taktik-Erstellungen</option>
                <option value="CREATE_TRAINING">Trainingspläne</option>
                <option value="EVALUATE_PLAYER">Spielerbewertungen</option>
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'overview' ? (
            <>
              {/* Metric KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-zinc-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Watch-Time</span>
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {metrics.watch_time_mins || 0} <span className="text-xs font-normal text-zinc-400">Min.</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {metrics.views_count || 0} Spiele aufgerufen
                  </p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-zinc-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Video-Aktionen</span>
                    <PenTool className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {(metrics.comments_count || 0) + (metrics.drawings_count || 0)}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {metrics.comments_count || 0} Notizen, {metrics.drawings_count || 0} Zeichnungen
                  </p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-zinc-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Taktik & Plan</span>
                    <LayoutGrid className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {(metrics.tactics_count || 0) + (metrics.trainings_count || 0)}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {metrics.tactics_count || 0} Tafeln, {metrics.trainings_count || 0} Einheiten
                  </p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-zinc-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Logins & Aktiv</span>
                    <Flame className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {metrics.logins_count || 0}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Zuletzt: {formatTimestamp(metrics.last_active) || 'Kürzlich'}
                  </p>
                </div>
              </div>

              {/* 30-Day Activity Heatmap */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Aktivitäts-Kalender (Letzte 30 Tage)
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                    <span>Weniger</span>
                    <div className="w-2.5 h-2.5 rounded-sm bg-zinc-800" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-950 border border-emerald-800" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-700" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-300" />
                    <span>Mehr</span>
                  </div>
                </div>

                <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-30 gap-1.5">
                  {heatmap.map((day: any, idx: number) => {
                    const levelColors = [
                      'bg-zinc-800/60 border-zinc-800 text-zinc-600',
                      'bg-emerald-950/80 border-emerald-800/60 text-emerald-300',
                      'bg-emerald-800 border-emerald-600 text-white',
                      'bg-emerald-600 border-emerald-400 text-white font-bold',
                      'bg-emerald-400 border-emerald-200 text-zinc-950 font-bold shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                    ];

                    return (
                      <div
                        key={idx}
                        className={`h-9 rounded-lg border flex flex-col items-center justify-center p-0.5 text-[9px] font-mono transition-all hover:scale-110 cursor-pointer ${
                          levelColors[day.level] || levelColors[0]
                        }`}
                        title={`${day.date}: ${day.count} Aktionen`}
                      >
                        <span className="opacity-70 text-[8px]">{day.day_name}</span>
                        <span>{day.count > 0 ? day.count : '-'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Module Breakdown & Top Matches */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Module Usage Breakdown */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      Modul-Nutzungsverteilung
                    </h3>

                    {/* Progress Bar */}
                    <div className="w-full h-3 rounded-full overflow-hidden flex bg-zinc-800 mb-4 shadow-inner">
                      <div style={{ width: `${videoPerc}%` }} className="bg-emerald-500 h-full transition-all" title={`Video: ${videoPerc}%`} />
                      <div style={{ width: `${tacticsPerc}%` }} className="bg-indigo-500 h-full transition-all" title={`Taktik: ${tacticsPerc}%`} />
                      <div style={{ width: `${trainingPerc}%` }} className="bg-cyan-500 h-full transition-all" title={`Training: ${trainingPerc}%`} />
                      <div style={{ width: `${playersPerc}%` }} className="bg-rose-500 h-full transition-all" title={`Spieler: ${playersPerc}%`} />
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span>Video- & Spielanalyse</span>
                        </div>
                        <span className="font-mono font-bold text-white">{videoPerc}%</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                          <span>Taktikboard & Spielzüge</span>
                        </div>
                        <span className="font-mono font-bold text-white">{tacticsPerc}%</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                          <span>Trainingsplanung & Übungen</span>
                        </div>
                        <span className="font-mono font-bold text-white">{trainingPerc}%</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                          <span>Spieler- & Leistungsanalyse</span>
                        </div>
                        <span className="font-mono font-bold text-white">{playersPerc}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Interacted Matches */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-emerald-400" />
                    Zuletzt analysierte Matches
                  </h3>

                  {recentMatches.length === 0 ? (
                    <div className="text-xs text-zinc-500 italic py-6 text-center">
                      Noch keine Match-Interaktionen erfasst.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {recentMatches.map((m: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-zinc-900/80 hover:bg-zinc-800/80 rounded-xl border border-zinc-800 transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-7 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0 relative">
                              {m.thumbnail_path ? (
                                <img src={getMediaUrl(m.thumbnail_path)} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-zinc-500">
                                  VS
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-bold text-zinc-200 truncate">{m.name}</span>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              {m.interactions_count} Aktionen
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </>
          ) : (
            /* Activity Feed (Audit Log) */
            <div className="space-y-3">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Lade Aktivitätsprotokoll...</span>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">
                  Keine Aktivitäten für diesen Filter gefunden.
                </div>
              ) : (
                <div className="relative border-l border-zinc-800 ml-4 pl-6 space-y-4">
                  {activityLogs.map((log: any, idx: number) => (
                    <div key={idx} className="relative group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center group-hover:border-blue-500 transition-colors">
                        {getActivityIcon(log.activity_type)}
                      </div>

                      <div className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl p-3 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-zinc-200">
                            {formatActivityText(log)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">
                            {formatTimestamp(log.created_at)}
                          </span>
                        </div>

                        {log.ip_address && (
                          <div className="text-[10px] font-mono text-zinc-500 mt-1 flex items-center gap-3">
                            <span>IP: {log.ip_address}</span>
                            {log.user_agent && (
                              <span className="truncate max-w-xs" title={log.user_agent}>
                                {log.user_agent.slice(0, 40)}...
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-500">
          <span>MatchTrack User Analytics Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl transition-colors"
          >
            Schließen
          </button>
        </div>

      </div>
    </div>
  );
}
