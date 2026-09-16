"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  getSystemSettings,
  updateSystemSettings,
  testSmtpEmail,
  triggerFtpBackup,
  testFtpConnection,
  cleanupOrganizerMatches,
  getLegalTemplates,
  getSystemLogs,
  setLogIrrelevant,
  markLogPatternIrrelevant,
  getLogIrrelevantPatterns,
  deleteLogIrrelevantPattern,
  clearSystemLogs,
  createTestLogs,
  SystemLogItem
} from '@/services/api';
import {
  Settings2,
  Layers,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Activity,
  HardDrive,
  Monitor,
  ToggleLeft as Toggle,
  Cpu,
  Aperture,
  Send,
  Download,
  Database,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  Scale,
  FileText,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
  Building,
  Filter,
  Search,
  Server,
  ChevronDown,
  ChevronRight,
  Info,
  Ban,
  Check,
  Copy,
  SlidersHorizontal,
  Terminal,
  AlertTriangle,
  ListFilter,
  Clock
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'modules' | 'storage' | 'smtp' | 'ftp' | 'legal' | 'logs'>('modules');
  const [legalSubTab, setLegalSubTab] = useState<'imprint' | 'privacy' | 'terms' | 'club'>('imprint');

  const [settings, setSettings] = useState<any>({
    module_stitching_enabled: true,
    module_heatmap_enabled: true,
    module_video_color_enabled: true,
    module_hls_enabled: true,
    module_fisheye_enabled: true,
    module_ai_assistant_enabled: true,
    default_resolution: "1080p",
    default_video_quality: "High",
    default_storage_path: "backend/uploads",
    auto_hls_conversion: true,
    auto_stitching: false,
    show_push_test_button: false,
    show_match_cleanup_button: false,
    smtp_enabled: false,
    smtp_host: "smtp.example.com",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_sender_email: "noreply@matchtrack.de",
    smtp_sender_name: "MatchTrack",
    smtp_use_tls: true,
    ftp_enabled: false,
    ftp_host: "",
    ftp_port: 21,
    ftp_user: "",
    ftp_password: "",
    ftp_path: "/backups",
    ftp_auto_backup: false,
    ftp_backup_schedule: "DAILY",
    legal_imprint_content: "",
    legal_privacy_content: "",
    legal_terms_content: "",
    legal_club_name: "",
    legal_contact_email: "",
    legal_address: "",
    legal_representative: "",
    legal_register_info: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [triggeringFtp, setTriggeringFtp] = useState(false);
  const [testingFtp, setTestingFtp] = useState(false);
  const [showFtpPassword, setShowFtpPassword] = useState(false);
  const [ftpStatus, setFtpStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [cleaningMatches, setCleaningMatches] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isConfirmCleanupModalOpen, setIsConfirmCleanupModalOpen] = useState(false);
  const [cleanupFussballDeOnly, setCleanupFussballDeOnly] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // System Logs State
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logStats, setLogStats] = useState({
    total_all: 0,
    backend_count: 0,
    frontend_count: 0,
    error_count: 0,
    warning_count: 0,
    irrelevant_count: 0
  });
  const [logSourceFilter, setLogSourceFilter] = useState<'all' | 'backend' | 'frontend'>('all');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');
  const [logIrrelevantFilter, setLogIrrelevantFilter] = useState<'false' | 'true' | 'only'>('false');
  const [logSearch, setLogSearch] = useState('');
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>([]);
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [newPatternText, setNewPatternText] = useState('');
  const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);
  const [clearLogsOption, setClearLogsOption] = useState<'all' | '7days' | '30days' | 'only_irrelevant'>('all');
  const [clearingLogs, setClearingLogs] = useState(false);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLogsLoading(true);
    try {
      const res = await getSystemLogs({
        source: logSourceFilter,
        level: logLevelFilter,
        search: logSearch,
        show_irrelevant: logIrrelevantFilter,
        limit: 150,
        offset: 0
      });
      if (res && res.logs) {
        setLogs(res.logs);
        if (res.stats) setLogStats(res.stats);
      }
    } catch (err: any) {
      if (!silent) toast.error('Fehler beim Laden der System-Logs');
    } finally {
      if (!silent) setLogsLoading(false);
    }
  };

  const fetchIgnorePatterns = async () => {
    try {
      const res = await getLogIrrelevantPatterns();
      if (res && res.patterns) {
        setIgnorePatterns(res.patterns);
      }
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
      fetchIgnorePatterns();
    }
  }, [activeTab, logSourceFilter, logLevelFilter, logIrrelevantFilter]);

  // Debounced search
  useEffect(() => {
    if (activeTab !== 'logs') return;
    const timer = setTimeout(() => {
      fetchLogs(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [logSearch]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshLogs || activeTab !== 'logs') return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, activeTab, logSourceFilter, logLevelFilter, logIrrelevantFilter, logSearch]);

  const handleToggleIrrelevant = async (logId: string, currentStatus: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await setLogIrrelevant(logId, !currentStatus);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, is_irrelevant: !currentStatus } : l));
      setLogStats(prev => ({
        ...prev,
        irrelevant_count: !currentStatus ? prev.irrelevant_count + 1 : Math.max(0, prev.irrelevant_count - 1)
      }));
      toast.success(!currentStatus ? 'Meldung als irrelevant eingestuft' : 'Meldung wieder als relevant markiert');
    } catch (err) {
      toast.error('Fehler beim Ändern des Relevanz-Status');
    }
  };

  const handleMarkPattern = async (pattern: string) => {
    if (!pattern.trim()) return;
    try {
      const res = await markLogPatternIrrelevant(pattern.trim(), true);
      toast.success(`Muster "${pattern.trim()}" wird jetzt ignoriert (${res.affected_count} bestehende Logs markiert)`);
      setNewPatternText('');
      fetchLogs();
      fetchIgnorePatterns();
    } catch (err) {
      toast.error('Fehler beim Speichern des Ignorier-Musters');
    }
  };

  const handleDeletePattern = async (pattern: string) => {
    try {
      await deleteLogIrrelevantPattern(pattern);
      setIgnorePatterns(prev => prev.filter(p => p !== pattern));
      toast.info(`Muster "${pattern}" entfernt`);
    } catch (err) {
      toast.error('Fehler beim Entfernen des Musters');
    }
  };

  const handleCreateTestLogs = async () => {
    try {
      await createTestLogs();
      toast.success('Test-Logs für Backend & Frontend erzeugt');
      fetchLogs();
    } catch (err) {
      toast.error('Fehler beim Erzeugen der Test-Logs');
    }
  };

  const handleExecuteClearLogs = async () => {
    setClearingLogs(true);
    try {
      let days: number | undefined = undefined;
      let onlyIrrelevant = false;

      if (clearLogsOption === '7days') days = 7;
      else if (clearLogsOption === '30days') days = 30;
      else if (clearLogsOption === 'only_irrelevant') onlyIrrelevant = true;

      const res = await clearSystemLogs(days, onlyIrrelevant);
      toast.success(`${res.deleted_count} Log-Einträge gelöscht`);
      setIsClearLogsModalOpen(false);
      fetchLogs();
    } catch (err) {
      toast.error('Fehler beim Löschen der Logs');
    } finally {
      setClearingLogs(false);
    }
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!authLoading && (!user || user.role.toUpperCase() !== 'ADMIN')) {
      router.push('/');
    } else if (user && user.role.toUpperCase() === 'ADMIN') {
      fetchSettings();
    }
  }, [user, authLoading, router]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSystemSettings();
      if (data && typeof data === 'object' && !data.error) {
        setSettings((prev: any) => ({ ...prev, ...data }));
      }
    } catch (err: any) {
      console.error("Failed to fetch settings:", err);
      const detail = err.response?.data?.detail;
      setError(detail ? `Fehler beim Laden der Einstellungen: ${detail}` : "Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updateSystemSettings(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      setError(err.response?.data?.detail || "Fehler beim Speichern der Einstellungen.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingEmail(true);
    setTestEmailStatus(null);
    try {
      const res = await testSmtpEmail(settings);
      setTestEmailStatus({ type: 'success', message: res.detail || 'Test-E-Mail erfolgreich versendet.' });
    } catch (err: any) {
      setTestEmailStatus({ type: 'error', message: err.response?.data?.detail || 'Fehler beim Senden der Test-E-Mail.' });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestFtp = async () => {
    setTestingFtp(true);
    setFtpStatus(null);
    try {
      const res = await testFtpConnection({
        host: settings.ftp_host,
        port: settings.ftp_port,
        user: settings.ftp_user,
        password: settings.ftp_password,
        path: settings.ftp_path
      });
      setFtpStatus({ type: 'success', message: res.detail || 'FTP-Verbindung erfolgreich hergestellt.' });
    } catch (err: any) {
      setFtpStatus({ type: 'error', message: err.response?.data?.detail || 'Fehler bei der FTP-Verbindung.' });
    } finally {
      setTestingFtp(false);
    }
  };

  const handleTriggerFtpBackup = async () => {
    setTriggeringFtp(true);
    setFtpStatus(null);
    try {
      const res = await triggerFtpBackup();
      setFtpStatus({ type: 'success', message: res.detail || 'FTP-Backup erfolgreich gestartet.' });
    } catch (err: any) {
      setFtpStatus({ type: 'error', message: err.response?.data?.detail || 'Fehler beim Starten des Backups.' });
    } finally {
      setTriggeringFtp(false);
    }
  };

  const handleLoadDefaultLegalTemplate = async (type: 'imprint' | 'privacy' | 'terms') => {
    try {
      const templates = await getLegalTemplates();
      if (templates) {
        if (type === 'imprint' && templates.default_imprint) {
          handleChange('legal_imprint_content', templates.default_imprint);
        } else if (type === 'privacy' && templates.default_privacy) {
          handleChange('legal_privacy_content', templates.default_privacy);
        } else if (type === 'terms' && templates.default_terms) {
          handleChange('legal_terms_content', templates.default_terms);
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden der Standard-Vorlage:', err);
    }
  };

  const handleExecuteCleanupMatches = async () => {
    setCleaningMatches(true);
    setCleanupStatus(null);
    try {
      const res = await cleanupOrganizerMatches(null, cleanupFussballDeOnly);
      setCleanupStatus({
        type: 'success',
        message: res.message || `${res.deleted_count || 0} Spieltermin(e) erfolgreich gelöscht.`
      });
      setIsConfirmCleanupModalOpen(false);
    } catch (err: any) {
      setCleanupStatus({
        type: 'error',
        message: err.response?.data?.detail || 'Fehler beim Löschen der Spieltermine.'
      });
    } finally {
      setCleaningMatches(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="animate-pulse font-medium text-zinc-500">Initialisiere System-Konfiguration...</p>
      </div>
    );
  }

  if (user?.role.toUpperCase() !== 'ADMIN') return null;

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 font-sans text-white">
      <Navbar />

      <main className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSave} className="w-full">
          <PageHeader
            title="System Einstellungen"
            subtitle="Engine Modules & Core Pipeline Defaults"
            rightElement={
              <div className="flex items-center gap-4">
                 {success && (
                   <div className="flex animate-in fade-in zoom-in-95 items-center gap-2 text-xs font-bold text-emerald-500">
                     <CheckCircle2 className="h-4 w-4" />
                     EINSTELLUNGEN GESPEICHERT
                   </div>
                 )}
                 {activeTab === 'logs' ? (
                   <button
                     type="button"
                     onClick={() => fetchLogs()}
                     disabled={logsLoading}
                     className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xl transition-all hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
                   >
                     <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
                     <span>Logs Aktualisieren</span>
                   </button>
                 ) : (
                   <button
                     type="submit"
                     disabled={saving}
                     className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xl transition-all hover:bg-primary-hover active:scale-95 disabled:opacity-50"
                   >
                     {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                     <span>Einstellungen Speichern</span>
                   </button>
                 )}
              </div>
            }
          />

          {/* Feedback Messages */}
          {error && (
            <div className="p-4 rounded-xl mb-6 border flex items-center gap-3 text-sm font-medium bg-red-500/10 border-red-500/30 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto gap-2 border-b border-zinc-800 pb-3 mb-8 scrollbar-none">
            {[
              { id: 'modules', label: 'Modulverwaltung', icon: <Layers className="w-4 h-4 text-emerald-400" /> },
              { id: 'storage', label: 'Speicher & Defaults', icon: <HardDrive className="w-4 h-4 text-blue-400" /> },
              { id: 'smtp', label: 'E-Mail & SMTP', icon: <Send className="w-4 h-4 text-purple-400" /> },
              { id: 'ftp', label: 'FTP Backup & Sync', icon: <Database className="w-4 h-4 text-amber-400" /> },
              { id: 'legal', label: 'Rechtstexte & DSGVO', icon: <Scale className="w-4 h-4 text-rose-400" /> },
              { id: 'logs', label: 'System-Logs', icon: <FileText className="w-4 h-4 text-cyan-400" /> },
            ].map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-zinc-800 text-white font-bold'
                    : 'bg-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 1: Modulverwaltung */}
          {activeTab === 'modules' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  Modulverwaltung
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Aktivierung und Deaktivierung der System-Kernfunktionen für alle Benutzer.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'module_stitching_enabled', label: 'Video Stitching', desc: 'Panorama-Zusammenführung von Kameras', icon: Layers, color: 'text-emerald-500' },
                  { id: 'module_heatmap_enabled', label: 'Heatmap Engine', desc: 'Spieler-Tracking & Visualisierung', icon: Activity, color: 'text-orange-500' },
                  { id: 'module_video_color_enabled', label: 'Color Core', desc: 'Farbkorrektur & Filter', icon: Monitor, color: 'text-blue-500' },
                  { id: 'module_hls_enabled', label: 'HLS Streamer', desc: 'Adaptives Web-Streaming', icon: UploadCloud, color: 'text-purple-500' },
                  { id: 'module_fisheye_enabled', label: 'Lens Correction', desc: 'Fisheye-Entzerrung (AI)', icon: Aperture, color: 'text-pink-500' },
                  { id: 'module_ai_assistant_enabled', label: 'KI-Sprachassistent', desc: 'Schwebendes Voice Widget & AI Support', icon: Sparkles, color: 'text-amber-400' },
                  { id: 'show_push_test_button', label: 'Test-Push Button', desc: 'Zeigt 🧪 Test-Push im Organizer (nur Admins)', icon: Send, color: 'text-amber-500' },
                  { id: 'show_match_cleanup_button', label: 'Spieltermine-Löschfunktion', desc: 'Zeigt 🗑️ Spieltermine löschen im Organizer (nur Admins)', icon: Trash2, color: 'text-red-500' },
                ].map((mod) => (
                  <div
                    key={mod.id}
                    onClick={() => handleToggle(mod.id)}
                    className={`group flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                      settings[mod.id] ? 'border-zinc-700 bg-zinc-950/80' : 'border-zinc-900 bg-zinc-950/30 opacity-50 grayscale'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 ${settings[mod.id] ? mod.color : 'text-zinc-700'}`}>
                        <mod.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{mod.label}</p>
                        <p className="text-[11px] font-medium text-zinc-500">{mod.desc}</p>
                      </div>
                    </div>
                    <div className={`relative h-6 w-11 rounded-full transition-all duration-300 ${settings[mod.id] ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                      <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${settings[mod.id] ? 'left-6' : 'left-1'}`} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Wartung & Datenbereinigung Card */}
              <div className="border-t border-zinc-800/80 pt-6">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-red-400 flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        Organizer Spieltermine Bereinigung
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        Löscht alle erfassten oder über fussball.de importierten Spieltermine aus dem Kalender aller Teams.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfirmCleanupModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Spieltermine jetzt bereinigen</span>
                    </button>
                  </div>

                  {cleanupStatus && (
                    <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
                      cleanupStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                      {cleanupStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                      <span>{cleanupStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Speicher & Defaults */}
          {activeTab === 'storage' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-blue-400" />
                  Speicher & Pipeline Standardwerte
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Vorgaben für Video-Qualität, Auflösung, Speicherort und automatische Verarbeitungen.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-2">Standard Auflösung</label>
                  <select
                    value={settings.default_resolution}
                    onChange={(e) => handleChange('default_resolution', e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  >
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="4K">4K (Ultra HD)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-2">Standard Video-Qualität</label>
                  <select
                    value={settings.default_video_quality}
                    onChange={(e) => handleChange('default_video_quality', e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  >
                    <option value="Standard">Standard</option>
                    <option value="High">High</option>
                    <option value="Maximum">Maximum</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-zinc-400 block mb-2">Upload-Speicherpfad</label>
                  <input
                    type="text"
                    value={settings.default_storage_path}
                    onChange={(e) => handleChange('default_storage_path', e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Pfad zum Speichern hochgeladener Rohvideos und Renderdateien.</p>
                </div>
              </div>

              <div className="border-t border-zinc-800/80 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => handleToggle('auto_hls_conversion')}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                    settings.auto_hls_conversion ? 'border-zinc-700 bg-zinc-950/80' : 'border-zinc-900 bg-zinc-950/30 opacity-50'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-white">Auto HLS Konvertierung</p>
                    <p className="text-[11px] font-medium text-zinc-500">Automatisch Web-Stream erstellen</p>
                  </div>
                  <div className={`relative h-6 w-11 rounded-full transition-all duration-300 ${settings.auto_hls_conversion ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${settings.auto_hls_conversion ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                <div
                  onClick={() => handleToggle('auto_stitching')}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                    settings.auto_stitching ? 'border-zinc-700 bg-zinc-950/80' : 'border-zinc-900 bg-zinc-950/30 opacity-50'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-white">Auto Stitching</p>
                    <p className="text-[11px] font-medium text-zinc-500">Videos direkt zusammenfügen</p>
                  </div>
                  <div className={`relative h-6 w-11 rounded-full transition-all duration-300 ${settings.auto_stitching ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${settings.auto_stitching ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: E-Mail & SMTP */}
          {activeTab === 'smtp' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-purple-400" />
                    SMTP E-Mail Server
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Konfiguration des Mail-Servers für Passwort-Resets und Systembenachrichtigungen.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingEmail}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-bold text-white hover:bg-zinc-700 transition-all disabled:opacity-50"
                >
                  {testingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Test-E-Mail Senden</span>
                </button>
              </div>

              {testEmailStatus && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
                  testEmailStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {testEmailStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{testEmailStatus.message}</span>
                </div>
              )}

              <div
                onClick={() => handleToggle('smtp_enabled')}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                  settings.smtp_enabled ? 'border-purple-500/50 bg-purple-500/10' : 'border-zinc-800 bg-zinc-950/50 opacity-60'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-white">SMTP E-Mail Versand aktivieren</p>
                  <p className="text-[11px] font-medium text-zinc-500">Ermöglicht automatische E-Mails aus dem System</p>
                </div>
                <div className={`relative h-6 w-11 rounded-full transition-all duration-300 ${settings.smtp_enabled ? 'bg-purple-600' : 'bg-zinc-800'}`}>
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${settings.smtp_enabled ? 'left-6' : 'left-1'}`} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={settings.smtp_host || ''}
                    onChange={(e) => handleChange('smtp_host', e.target.value)}
                    placeholder="smtp.example.com"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">SMTP Port</label>
                  <input
                    type="number"
                    value={settings.smtp_port || 587}
                    onChange={(e) => handleChange('smtp_port', parseInt(e.target.value))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">SMTP Benutzer</label>
                  <input
                    type="text"
                    value={settings.smtp_user || ''}
                    onChange={(e) => handleChange('smtp_user', e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">SMTP Passwort</label>
                  <input
                    type="password"
                    value={settings.smtp_password || ''}
                    onChange={(e) => handleChange('smtp_password', e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Absender E-Mail</label>
                  <input
                    type="email"
                    value={settings.smtp_sender_email || ''}
                    onChange={(e) => handleChange('smtp_sender_email', e.target.value)}
                    placeholder="noreply@matchtrack.de"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Absender Name</label>
                  <input
                    type="text"
                    value={settings.smtp_sender_name || ''}
                    onChange={(e) => handleChange('smtp_sender_name', e.target.value)}
                    placeholder="MatchTrack"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <div
                    onClick={() => handleToggle('smtp_use_tls')}
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <div className={`relative h-6 w-11 rounded-full transition-all duration-300 ${settings.smtp_use_tls ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                      <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${settings.smtp_use_tls ? 'left-6' : 'left-1'}`} />
                    </div>
                    <span className="text-xs font-bold text-zinc-300">TLS-Verschlüsselung erzwingen</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: FTP Backup & Sync */}
          {activeTab === 'ftp' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-400" />
                    Remote FTP Backup & Sync
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Automatische Datensicherung und Sync auf ein externes FTP/SFTP-Laufwerk.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestFtp}
                    disabled={testingFtp}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-bold text-white hover:bg-zinc-700 transition-all disabled:opacity-50"
                  >
                    {testingFtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Verbindung Testen</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerFtpBackup}
                    disabled={triggeringFtp}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                  >
                    {triggeringFtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Backup Jetzt Ausführen</span>
                  </button>
                </div>
              </div>

              {ftpStatus && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
                  ftpStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {ftpStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{ftpStatus.message}</span>
                </div>
              )}

              <div
                onClick={() => handleToggle('ftp_enabled')}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                  settings.ftp_enabled ? 'border-amber-500/50 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/50 opacity-60'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-white">FTP-Sicherung aktivieren</p>
                  <p className="text-[11px] font-medium text-zinc-500">Automatische Übertragung auf Remote-Server</p>
                </div>
                <div className={`relative h-6 w-11 rounded-full transition-all duration-300 ${settings.ftp_enabled ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${settings.ftp_enabled ? 'left-6' : 'left-1'}`} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">FTP Host</label>
                  <input
                    type="text"
                    value={settings.ftp_host || ''}
                    onChange={(e) => handleChange('ftp_host', e.target.value)}
                    placeholder="ftp.deine-domain.de"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">FTP Port</label>
                  <input
                    type="number"
                    value={settings.ftp_port || 21}
                    onChange={(e) => handleChange('ftp_port', parseInt(e.target.value))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">FTP Benutzer</label>
                  <input
                    type="text"
                    value={settings.ftp_user || ''}
                    onChange={(e) => handleChange('ftp_user', e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">FTP Passwort</label>
                  <div className="relative">
                    <input
                      type={showFtpPassword ? 'text' : 'password'}
                      value={settings.ftp_password || ''}
                      onChange={(e) => handleChange('ftp_password', e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFtpPassword(!showFtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showFtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Ziel-Pfad auf Server</label>
                  <input
                    type="text"
                    value={settings.ftp_path || '/backups'}
                    onChange={(e) => handleChange('ftp_path', e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Backup Zeitplan</label>
                  <select
                    value={settings.ftp_backup_schedule || 'DAILY'}
                    onChange={(e) => handleChange('ftp_backup_schedule', e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  >
                    <option value="HOURLY">Stündlich</option>
                    <option value="DAILY">Täglich (Nachts 02:00 Uhr)</option>
                    <option value="WEEKLY">Wöchentlich (Sonntag)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Rechtstexte & DSGVO */}
          {activeTab === 'legal' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-rose-400" />
                    Rechtstexte, Impressum & DSGVO-Verwaltung
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Hier kannst du die Inhalte der rechtlichen Pflichtseiten für deinen Verein oder deine Instanz vollständig anpassen und verwalten.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/${legalSubTab === 'club' ? 'impressum' : legalSubTab === 'imprint' ? 'impressum' : legalSubTab === 'privacy' ? 'datenschutz' : 'terms'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Live-Seite öffnen</span>
                  </a>
                </div>
              </div>

              {/* Legal Sub-Navigation */}
              <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-950 rounded-2xl border border-zinc-800/80">
                {[
                  { id: 'imprint', label: '1. Impressum (§ 5 DDG)', icon: <Building className="w-3.5 h-3.5 text-blue-400" /> },
                  { id: 'privacy', label: '2. Datenschutzerklärung (DSGVO)', icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> },
                  { id: 'terms', label: '3. Nutzungsbedingungen (Terms)', icon: <FileText className="w-3.5 h-3.5 text-purple-400" /> },
                  { id: 'club', label: '4. Vereins- & Betreiberdaten', icon: <Scale className="w-3.5 h-3.5 text-amber-400" /> },
                ].map((st) => (
                  <button
                    type="button"
                    key={st.id}
                    onClick={() => setLegalSubTab(st.id as any)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      legalSubTab === st.id
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    {st.icon}
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>

              {/* Sub-Tab 1: Impressum */}
              {legalSubTab === 'imprint' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Individuelles Impressum</h4>
                      <p className="text-xs text-zinc-400">
                        Unterstützt Markdown-Formatierung. Wenn dieses Feld leer gelassen wird, wird automatisch das Standard-Template anhand der Vereinsdaten generiert.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLoadDefaultLegalTemplate('imprint')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-rose-300 hover:text-rose-200 transition-colors shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Standard-Vorlage einfügen</span>
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={16}
                      value={settings.legal_imprint_content || ''}
                      onChange={(e) => handleChange('legal_imprint_content', e.target.value)}
                      placeholder="Füge hier deinen individuellen Impressumstext ein oder klicke oben auf 'Standard-Vorlage einfügen'..."
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 focus:border-primary focus:outline-none leading-relaxed resize-y"
                    />
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Datenschutzerklärung */}
              {legalSubTab === 'privacy' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Individuelle Datenschutzerklärung (DSGVO / TDDDG)</h4>
                      <p className="text-xs text-zinc-400">
                        Enthält Abschnitte zu Videoanalyse, KI-Tracking, JWT-Sitzungen, LocalStorage und Betroffenenrechten.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLoadDefaultLegalTemplate('privacy')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-rose-300 hover:text-rose-200 transition-colors shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Standard-Vorlage einfügen</span>
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={18}
                      value={settings.legal_privacy_content || ''}
                      onChange={(e) => handleChange('legal_privacy_content', e.target.value)}
                      placeholder="Füge hier deine individuelle Datenschutzerklärung ein..."
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 focus:border-primary focus:outline-none leading-relaxed resize-y"
                    />
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Nutzungsbedingungen */}
              {legalSubTab === 'terms' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Nutzungsbedingungen / Terms of Service</h4>
                      <p className="text-xs text-zinc-400">
                        Regelt die Nutzung der Plattform, Rechte am Videomaterial und Haftungsausschlüsse.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLoadDefaultLegalTemplate('terms')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-rose-300 hover:text-rose-200 transition-colors shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Standard-Vorlage einfügen</span>
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={16}
                      value={settings.legal_terms_content || ''}
                      onChange={(e) => handleChange('legal_terms_content', e.target.value)}
                      placeholder="Füge hier deine Nutzungsbedingungen ein..."
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 focus:border-primary focus:outline-none leading-relaxed resize-y"
                    />
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Vereins- & Betreiberdaten */}
              {legalSubTab === 'club' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
                    <h4 className="text-sm font-bold text-white">Vereins- & Betreiber-Stammdaten</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Diese Angaben werden automatisch als Platzhalter in Standard-Vorlagen für Impressum und Datenschutzerklärung eingesetzt.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-bold text-zinc-400 block mb-1.5">Vereins- oder Firmenname</label>
                      <input
                        type="text"
                        value={settings.legal_club_name || ''}
                        onChange={(e) => handleChange('legal_club_name', e.target.value)}
                        placeholder="z. B. FC Musterstadt 1920 e.V."
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-400 block mb-1.5">Offizielle Kontakt- / Datenschutz-E-Mail</label>
                      <input
                        type="email"
                        value={settings.legal_contact_email || ''}
                        onChange={(e) => handleChange('legal_contact_email', e.target.value)}
                        placeholder="datenschutz@verein.de"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-400 block mb-1.5">Vertretungsberechtigte Personen / Vorstand</label>
                      <input
                        type="text"
                        value={settings.legal_representative || ''}
                        onChange={(e) => handleChange('legal_representative', e.target.value)}
                        placeholder="z. B. 1. Vorsitzender Max Mustermann"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-400 block mb-1.5">Registergericht & Registernummer</label>
                      <input
                        type="text"
                        value={settings.legal_register_info || ''}
                        onChange={(e) => handleChange('legal_register_info', e.target.value)}
                        placeholder="z. B. VR 12345 Amtsgericht Musterstadt"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-zinc-400 block mb-1.5">Vollständige Anschrift</label>
                      <textarea
                        rows={3}
                        value={settings.legal_address || ''}
                        onChange={(e) => handleChange('legal_address', e.target.value)}
                        placeholder="Musterstraße 1&#10;12345 Musterstadt&#10;Deutschland"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 6: System-Logs (Backend & Frontend) */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                    <span>Gesamt</span>
                    <Terminal className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="text-2xl font-black text-white mt-2">
                    {logStats.total_all}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1">Registrierte Einträge</div>
                </div>

                <div
                  onClick={() => setLogLevelFilter(logLevelFilter === 'ERROR' ? 'all' : 'ERROR')}
                  className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all ${
                    logLevelFilter === 'ERROR'
                      ? 'bg-red-500/10 border-red-500 ring-1 ring-red-500'
                      : 'bg-zinc-900 border-zinc-800/80 hover:border-red-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-red-400 text-xs font-semibold">
                    <span>Fehler</span>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="text-2xl font-black text-red-400 mt-2">
                    {logStats.error_count}
                  </div>
                  <div className="text-[10px] text-red-500/80 mt-1">Kritisch & Errors</div>
                </div>

                <div
                  onClick={() => setLogLevelFilter(logLevelFilter === 'WARNING' ? 'all' : 'WARNING')}
                  className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all ${
                    logLevelFilter === 'WARNING'
                      ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-zinc-900 border-zinc-800/80 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
                    <span>Warnungen</span>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-400 mt-2">
                    {logStats.warning_count}
                  </div>
                  <div className="text-[10px] text-amber-500/80 mt-1">Überprüfenswert</div>
                </div>

                <div
                  onClick={() => setLogSourceFilter(logSourceFilter === 'backend' ? 'all' : 'backend')}
                  className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all ${
                    logSourceFilter === 'backend'
                      ? 'bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500'
                      : 'bg-zinc-900 border-zinc-800/80 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-cyan-400 text-xs font-semibold">
                    <span>Backend</span>
                    <Server className="w-4 h-4 text-cyan-500" />
                  </div>
                  <div className="text-2xl font-black text-cyan-400 mt-2">
                    {logStats.backend_count}
                  </div>
                  <div className="text-[10px] text-cyan-500/80 mt-1">Server & APIs</div>
                </div>

                <div
                  onClick={() => setLogSourceFilter(logSourceFilter === 'frontend' ? 'all' : 'frontend')}
                  className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all ${
                    logSourceFilter === 'frontend'
                      ? 'bg-purple-500/10 border-purple-500 ring-1 ring-purple-500'
                      : 'bg-zinc-900 border-zinc-800/80 hover:border-purple-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-purple-400 text-xs font-semibold">
                    <span>Frontend</span>
                    <Monitor className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-2xl font-black text-purple-400 mt-2">
                    {logStats.frontend_count}
                  </div>
                  <div className="text-[10px] text-purple-500/80 mt-1">Browser & UI</div>
                </div>

                <div
                  onClick={() => setLogIrrelevantFilter(logIrrelevantFilter === 'only' ? 'false' : 'only')}
                  className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all ${
                    logIrrelevantFilter === 'only'
                      ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-500'
                      : 'bg-zinc-900 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                    <span>Irrelevant</span>
                    <Ban className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="text-2xl font-black text-zinc-300 mt-2">
                    {logStats.irrelevant_count}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1">Stummgeschaltet</div>
                </div>
              </div>

              {/* Main Log Management Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
                {/* Top Title & Quick Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-cyan-400" />
                      System- und Anwendungs-Logs
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Kombinierte Fehler- und Statusmeldungen aus Backend-Diensten und Frontend-Client.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        autoRefreshLogs
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{autoRefreshLogs ? 'Auto-Refresh (An)' : 'Auto-Refresh (Aus)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fetchLogs()}
                      disabled={logsLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                      <span>Neu laden</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateTestLogs}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/10 hover:bg-cyan-600/20 text-xs font-semibold text-cyan-400 border border-cyan-500/30 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Test-Logs</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPatternModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-xs font-semibold text-purple-400 border border-purple-500/30 transition-all"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Irrelevanz-Filter ({ignorePatterns.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsClearLogsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-xs font-semibold text-red-400 border border-red-500/30 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Leeren</span>
                    </button>
                  </div>
                </div>

                {/* Filter Control Bar */}
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Source Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Quelle:</span>
                      <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setLogSourceFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            logSourceFilter === 'all' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Alle
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogSourceFilter('backend')}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            logSourceFilter === 'backend' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Server className="w-3 h-3" />
                          Backend
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogSourceFilter('frontend')}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            logSourceFilter === 'frontend' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Monitor className="w-3 h-3" />
                          Frontend
                        </button>
                      </div>
                    </div>

                    {/* Level Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Level:</span>
                      <div className="flex flex-wrap items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                        {['all', 'ERROR', 'WARNING', 'INFO', 'DEBUG'].map((lvl) => (
                          <button
                            type="button"
                            key={lvl}
                            onClick={() => setLogLevelFilter(lvl)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              logLevelFilter === lvl
                                ? lvl === 'ERROR'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : lvl === 'WARNING'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : lvl === 'INFO'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-zinc-800 text-white'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {lvl === 'all' ? 'Alle' : lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Irrelevance Mode Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Ansicht:</span>
                      <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setLogIrrelevantFilter('false')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            logIrrelevantFilter === 'false' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Nur Relevante
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogIrrelevantFilter('true')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            logIrrelevantFilter === 'true' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Alle
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogIrrelevantFilter('only')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            logIrrelevantFilter === 'only' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Nur Irrelevante
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Suchbegriff in Meldung, Modul oder Stacktrace filtern..."
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-primary focus:outline-none font-sans"
                    />
                    {logSearch && (
                      <button
                        type="button"
                        onClick={() => setLogSearch('')}
                        className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Log Stream List */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-xs">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-bold uppercase text-[11px] tracking-wider">
                    <div className="col-span-3 sm:col-span-2">Zeitstempel</div>
                    <div className="col-span-2 sm:col-span-1">Quelle</div>
                    <div className="col-span-2 sm:col-span-1">Level</div>
                    <div className="col-span-5 sm:col-span-2 hidden md:block">Modul</div>
                    <div className="col-span-5 sm:col-span-6 md:col-span-4">Nachricht</div>
                    <div className="col-span-2 text-right">Aktionen</div>
                  </div>

                  {/* Logs Listing */}
                  {logsLoading && logs.length === 0 ? (
                    <div className="py-16 text-center text-zinc-500 flex flex-col items-center gap-3 font-sans">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span>Logs werden geladen...</span>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="py-16 text-center text-zinc-500 space-y-2 font-sans">
                      <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto" />
                      <div className="font-bold text-zinc-400">Keine Logs für diesen Filter gefunden</div>
                      <p className="text-[11px] text-zinc-600 max-w-sm mx-auto">
                        Es liegen aktuell keine Einträge vor, die den gewählten Kriterien entsprechen.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/60 max-h-[700px] overflow-y-auto">
                      {logs.map((item) => {
                        const isExpanded = !!expandedLogIds[item.id];
                        const dateStr = item.created_at
                          ? new Date(item.created_at).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })
                          : '-';

                        const isError = item.level === 'ERROR' || item.level === 'CRITICAL';
                        const isWarn = item.level === 'WARNING';
                        const isInfo = item.level === 'INFO';

                        return (
                          <div
                            key={item.id}
                            className={`transition-colors hover:bg-zinc-900/50 ${
                              item.is_irrelevant ? 'opacity-50 bg-zinc-950/40' : ''
                            }`}
                          >
                            <div
                              onClick={() => toggleExpandLog(item.id)}
                              className="grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer select-none"
                            >
                              {/* Timestamp */}
                              <div className="col-span-3 sm:col-span-2 text-zinc-400 text-[11px] truncate flex items-center gap-1.5">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                )}
                                <span>{dateStr}</span>
                              </div>

                              {/* Source */}
                              <div className="col-span-2 sm:col-span-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    item.source === 'frontend'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  }`}
                                >
                                  {item.source === 'frontend' ? 'Client' : 'Backend'}
                                </span>
                              </div>

                              {/* Level */}
                              <div className="col-span-2 sm:col-span-1">
                                <span
                                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                    isError
                                      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                      : isWarn
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                      : isInfo
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {item.level}
                                </span>
                              </div>

                              {/* Module */}
                              <div className="col-span-5 sm:col-span-2 hidden md:block text-zinc-400 text-[11px] truncate">
                                {item.module || '-'}
                              </div>

                              {/* Message */}
                              <div className="col-span-5 sm:col-span-6 md:col-span-4 flex items-center gap-2 truncate">
                                <span className={`truncate text-xs ${isError ? 'text-red-200' : isWarn ? 'text-amber-200' : 'text-zinc-200'}`}>
                                  {item.message}
                                </span>
                                {item.is_irrelevant && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] border border-zinc-700 shrink-0 font-sans">
                                    <Ban className="w-2.5 h-2.5" /> Irrelevant
                                  </span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="col-span-2 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  title={item.is_irrelevant ? 'Wieder als relevant einstufen' : 'Als irrelevant einstufen (ausblenden)'}
                                  onClick={(e) => handleToggleIrrelevant(item.id, item.is_irrelevant, e)}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    item.is_irrelevant
                                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                                  }`}
                                >
                                  {item.is_irrelevant ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                </button>

                                <button
                                  type="button"
                                  title="Muster künftig ignorieren"
                                  onClick={() => handleMarkPattern(item.message.slice(0, 60))}
                                  className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-purple-400 hover:border-purple-500/40 transition-all hidden sm:inline-flex"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Expanded Detail View */}
                            {isExpanded && (
                              <div className="px-6 py-4 bg-zinc-950/80 border-t border-zinc-900 text-xs space-y-3 font-sans">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                                  <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
                                    <span className="font-bold text-zinc-300">Log-ID:</span> {item.id}
                                    <span className="mx-2">•</span>
                                    <span className="font-bold text-zinc-300">Modul:</span> {item.module || 'N/A'}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(
                                          JSON.stringify({ message: item.message, details: item.details }, null, 2)
                                        );
                                        toast.success('Log-Details in Zwischenablage kopiert');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                                    >
                                      <Copy className="w-3 h-3" /> Kopieren
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleMarkPattern(item.message.slice(0, 80))}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-semibold"
                                    >
                                      <Ban className="w-3 h-3" /> Textmuster dauerhaft ignorieren
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <div className="text-zinc-400 text-xs font-bold mb-1">Vollständige Meldung:</div>
                                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-white break-words select-text">
                                    {item.message}
                                  </div>
                                </div>

                                {item.details && Object.keys(item.details).length > 0 && (
                                  <div>
                                    <div className="text-zinc-400 text-xs font-bold mb-1">Kontext & Technische Details:</div>
                                    <pre className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto select-text">
                                      {typeof item.details === 'object' ? JSON.stringify(item.details, null, 2) : String(item.details)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal: Irrelevanz-Muster verwalten */}
              {isPatternModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                  <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-purple-500/30 p-6 shadow-2xl space-y-5">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-3 text-purple-400">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <SlidersHorizontal className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">Irrelevanz-Filter verwalten</h3>
                          <p className="text-xs text-zinc-400">Meldungen mit diesen Textbestandteilen werden stummgeschaltet</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPatternModalOpen(false)}
                        className="text-zinc-400 hover:text-white text-sm"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-zinc-300 block">Neues Ignorier-Muster hinzufügen:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPatternText}
                          onChange={(e) => setNewPatternText(e.target.value)}
                          placeholder="z.B. ResizeObserver loop oder Timeout nach 5000ms"
                          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleMarkPattern(newPatternText)}
                          disabled={!newPatternText.trim()}
                          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white transition-all"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold text-zinc-400">Aktive Ignorier-Muster ({ignorePatterns.length}):</div>
                      {ignorePatterns.length === 0 ? (
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-500">
                          Noch keine automatischen Ignorier-Muster hinterlegt.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {ignorePatterns.map((pat, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                            >
                              <span className="font-mono text-[11px] truncate max-w-[320px]">{pat}</span>
                              <button
                                type="button"
                                onClick={() => handleDeletePattern(pat)}
                                className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                                title="Muster löschen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setIsPatternModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-all"
                      >
                        Schließen
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal: Logs leeren */}
              {isClearLogsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                  <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-red-500/30 p-6 shadow-2xl space-y-5">
                    <div className="flex items-center gap-3 text-red-400 border-b border-zinc-800 pb-3">
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">System-Logs bereinigen</h3>
                        <p className="text-xs text-zinc-400">Wähle den Bereinigungs-Umfang</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      {[
                        { id: 'all', title: 'Alle Logs vollständig leeren', desc: 'Löscht die gesamte Log-Tabelle unwiderruflich.' },
                        { id: '7days', title: 'Älter als 7 Tage löschen', desc: 'Behält nur die Logs der letzten Woche.' },
                        { id: '30days', title: 'Älter als 30 Tage löschen', desc: 'Behält die Logs des letzten Monats.' },
                        { id: 'only_irrelevant', title: 'Nur als irrelevant markierte Logs löschen', desc: 'Löscht alle stummgeschalteten Einträge.' },
                      ].map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                            clearLogsOption === opt.id
                              ? 'bg-red-500/10 border-red-500/50 text-white'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="clearOption"
                            checked={clearLogsOption === opt.id}
                            onChange={() => setClearLogsOption(opt.id as any)}
                            className="mt-0.5 text-primary bg-zinc-900 border-zinc-700 focus:ring-0"
                          />
                          <div>
                            <div className="font-bold text-white text-xs">{opt.title}</div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setIsClearLogsModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        disabled={clearingLogs}
                        onClick={handleExecuteClearLogs}
                        className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition-all flex items-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50"
                      >
                        {clearingLogs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        <span>Bereinigen ausführen</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Modal: Spieltermine löschen Bestätigung */}
        {isConfirmCleanupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-red-500/30 p-6 shadow-2xl space-y-5">
              <div className="flex items-center gap-3 text-red-400">
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Spieltermine bereinigen</h3>
                  <p className="text-xs text-zinc-400">Diese Aktion kann nicht rückgängig gemacht werden.</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Möchtest du wirklich alle erfassten Spieltermine aus dem Organizer-Kalender aller Teams löschen?
              </p>

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
                    ? 'Manuell erstellte Spieltermine bleiben erhalten.'
                    : 'Alle Spiele (manuelle und fussball.de-Termine) werden entfernt.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={cleaningMatches}
                  onClick={() => setIsConfirmCleanupModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50"
                >
                  Abbrechen
                </button>

                <button
                  type="button"
                  disabled={cleaningMatches}
                  onClick={handleExecuteCleanupMatches}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition-all flex items-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {cleaningMatches ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Unwiderruflich löschen</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
