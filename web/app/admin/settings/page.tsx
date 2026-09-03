"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSystemSettings, updateSystemSettings, testSmtpEmail, triggerFtpBackup, testFtpConnection, cleanupOrganizerMatches } from '@/services/api';
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
  Trash2
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'modules' | 'storage' | 'smtp' | 'ftp'>('modules');

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
    smtp_use_tls: true,
    ftp_enabled: false,
    ftp_host: "",
    ftp_port: 21,
    ftp_user: "",
    ftp_password: "",
    ftp_path: "/backups",
    ftp_auto_backup: false,
    ftp_backup_schedule: "DAILY"
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
    } catch (err) {
      console.error("Failed to fetch settings:", err);
      setError("Fehler beim Laden der Einstellungen.");
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
                 <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xl transition-all hover:bg-primary-hover active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Einstellungen Speichern</span>
                </button>
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
