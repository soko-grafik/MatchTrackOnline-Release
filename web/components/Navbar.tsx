"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LogOut,
  User as UserIcon,
  Shield,
  UploadCloud,
  Settings2,
  Menu,
  X,
  LayoutGrid,
  Users,
  BookOpen,
  Dumbbell,
  Calendar as CalendarIcon,
  Video,
  Download,
  RefreshCw,
  CheckCircle2,
  GitCommit,
  History,
  Sparkles,
  RotateCw,
  Presentation,
  Scale
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import ConversionStatus from '@/components/ConversionStatus';
import WindowControlsToggle from '@/components/WindowControlsToggle';
import { getMediaUrl, checkSystemUpdates, applySystemUpdates, getSystemUpdateStatus, getSystemChangelog, getOnlineStats } from '@/services/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  // Online Stats (Admin only)
  const [onlineStats, setOnlineStats] = useState<{ online_count: number; online_users: any[] } | null>(null);

  // System Update Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateStep, setUpdateStep] = useState<'IDLE' | 'CHECKING' | 'READY' | 'APPLYING' | 'COMPLETED' | 'ERROR'>('IDLE');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateLog, setUpdateLog] = useState<string>('');

  // Changelog Modal State
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [changelogData, setChangelogData] = useState<any>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);

  useEffect(() => {
    if (user && user.role?.toUpperCase() === 'ADMIN') {
      const fetchOnline = () => {
        getOnlineStats()
          .then((data) => {
            if (data && typeof data.online_count === 'number') {
              setOnlineStats(data);
            }
          })
          .catch(() => {});
      };
      fetchOnline();
      const interval = setInterval(fetchOnline, 30000); // alle 30 Sekunden aktualisieren
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleOpenChangelog = async () => {
    setIsChangelogModalOpen(true);
    setChangelogLoading(true);
    try {
      const data = await getSystemChangelog();
      setChangelogData(data);
    } catch (err) {
      console.error('Fehler beim Laden des Changelogs:', err);
    } finally {
      setChangelogLoading(false);
    }
  };

  const handleOpenUpdateModal = async () => {
    setIsUpdateModalOpen(true);
    setUpdateStep('CHECKING');
    setUpdateLog('');
    try {
      const data = await checkSystemUpdates();
      setUpdateInfo(data);
      setUpdateStep('READY');
    } catch (err: any) {
      console.error('Fehler beim Prüfen von Updates:', err);
      setUpdateInfo({
        update_available: false,
        error: err?.message || 'Verbindung zum Server fehlgeschlagen.'
      });
      setUpdateStep('READY');
    }
  };

  const handleStartUpdate = async () => {
    setUpdateStep('APPLYING');
    setUpdateLog('Starte Update-Prozess auf dem Server...\n');

    try {
      await applySystemUpdates();
    } catch (err: any) {
      console.error('Fehler beim Starten des Updates:', err);
    }

    // Intervall-Polling für Update Status (jede Sekunde)
    const interval = setInterval(async () => {
      try {
        const res = await getSystemUpdateStatus();
        if (res && res.log) {
          setUpdateLog(res.log);
        }

        if (res?.status === 'completed') {
          setUpdateStep('COMPLETED');
          clearInterval(interval);
        } else if (res?.status === 'error') {
          setUpdateStep('ERROR');
          clearInterval(interval);
        }
      } catch (err) {
        // Ignorieren falls Server während pm2 reload kurz offline ist
      }
    }, 1200);

    // Timeout-Schutz nach 3 Minuten
    setTimeout(() => {
      clearInterval(interval);
      setUpdateStep((prev) => (prev === 'APPLYING' ? 'COMPLETED' : prev));
    }, 180000);
  };

  const { toast } = useToast();

  useEffect(() => {
    // Check if an update was just completed before page reload
    if (typeof window !== 'undefined') {
      const updateMessage = sessionStorage.getItem('matchtrack_update_success');
      if (updateMessage) {
        toast.success(updateMessage);
        sessionStorage.removeItem('matchtrack_update_success');
      }
    }

    // Check if already running in PWA standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                        (window.navigator as any).standalone === true;

    if (isStandalone) {
      setCanInstallPwa(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPwaPrompt(e);
      setCanInstallPwa(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [toast]);

  const handleFinishUpdateAndReload = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('matchtrack_update_success', 'Update erfolgreich eingespielt! System wurde neu geladen.');
      window.location.reload();
    }
  };

  const handleInstallPwa = async () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    const { outcome } = await pwaPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstallPwa(false);
      setPwaPrompt(null);
    }
  };

  const userRole = user?.role?.toUpperCase() || '';
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

  const drawerItems = [
    {
      label: "Dashboard",
      icon: LayoutGrid,
      href: "/",
      show: true,
    },
    {
      label: "Organizer",
      icon: CalendarIcon,
      href: "/organizer",
      show: hasModule('ORGANIZER'),
    },
    {
      label: "Kader & Spieler",
      icon: Users,
      href: "/players",
      show: hasModule('PLAYERS'),
    },
    {
      label: "Analyse & Spiele",
      icon: Video,
      href: "/matches",
      show: hasModule('MATCHES'),
    },
    {
      label: "Trainingsplan & Übungen",
      icon: Dumbbell,
      href: "/training",
      show: hasModule('TRAINING'),
    },
    {
      label: "Digitale Taktiktafel",
      icon: Presentation,
      href: "/tactics",
      show: hasModule('TACTICS'),
    },
    {
      label: "Profil & Einstellungen",
      icon: UserIcon,
      href: "/profile",
      show: true,
    },
    {
      label: "Upload Engine",
      icon: UploadCloud,
      href: "/admin/upload",
      show: canUpload,
    },
    {
      label: "Benutzer- & Teamverwaltung",
      icon: Users,
      href: "/admin/users",
      show: isAdmin,
    },
    {
      label: "System-Einstellungen",
      icon: Settings2,
      href: "/admin/settings",
      show: isAdmin,
    },
    {
      label: "Handbuch & Anleitungen",
      icon: BookOpen,
      href: "/guides",
      show: true,
    },
    {
      label: "Datenschutz (DSGVO)",
      icon: Shield,
      href: "/datenschutz",
      show: true,
    },
    {
      label: "Impressum",
      icon: Scale,
      href: "/impressum",
      show: true,
    },
  ];

  return (
    <>
      <header className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex-1 flex items-center gap-4">
              {user && (
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="rounded-xl p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all shadow-sm"
                  aria-label="Menü öffnen"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}

              <Link className="block text-primary" href="/">
                <span className="sr-only">Home</span>
                <Image
                  src="/logo_light_wide_full.png"
                  alt="MatchTracker Logo"
                  width={160}
                  height={36}
                  className="object-contain h-5 sm:h-7 w-auto transition-transform hover:scale-105"
                  priority
                />
              </Link>
            </div>

            <div className="md:flex md:items-center md:gap-4">
              <div className="flex items-center gap-4">
                <ConversionStatus />

                {user && (
                  <>
                    <div className="hidden sm:flex items-center gap-3 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50 backdrop-blur-sm">
                      {isAdmin && onlineStats && (
                        <>
                          <div
                            className="flex flex-col items-center px-3 cursor-pointer"
                            title={`Aktuell online (letzte 15 Min):\n${onlineStats.online_users.map(u => `• ${u.username} (${u.first_name || ''} ${u.last_name || ''})`).join('\n') || 'Keine aktiven User'}`}
                          >
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </span>
                            <span className="text-emerald-400 font-mono font-bold text-[10px] mt-1">
                              {onlineStats.online_count} {onlineStats.online_count === 1 ? 'USER' : 'USER'}
                            </span>
                          </div>
                          <div className="w-px h-6 bg-zinc-800" />
                        </>
                      )}
                      <div className="flex flex-col items-end px-3">
                         <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none">System Load</span>
                         <span className="text-emerald-500 font-mono font-bold text-[10px] mt-1">OPTIMAL</span>
                      </div>
                      <div className="w-px h-6 bg-zinc-800" />
                      <div className="flex flex-col items-start px-3">
                         <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none">Storage</span>
                         <span className="text-blue-500 font-mono font-bold text-[10px] mt-1">92% FREE</span>
                      </div>
                    </div>

                    <WindowControlsToggle />

                    <button
                      onClick={() => logout()}
                      className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 p-2 sm:px-4 sm:py-2 text-xs font-bold uppercase tracking-wider text-red-500 transition-all hover:bg-red-500/10 hover:text-red-400 active:scale-95 shrink-0"
                      title="Abmelden"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Abmelden</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-over Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[100] transition-opacity backdrop-blur-xs"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Left Slide-over Drawer */}
      <aside
        className={`fixed top-0 bottom-0 start-0 z-[100] w-72 bg-zinc-950 border-r border-zinc-800 shadow-2xl transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full justify-between">
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Drawer Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800">
              <Link href="/" className="flex items-center gap-2" onClick={() => setIsDrawerOpen(false)}>
                <Image
                  src="/logo_light_wide_full.png"
                  alt="MatchTracker Logo"
                  width={130}
                  height={30}
                  className="object-contain h-4 max-h-[1rem] w-auto"
                  priority
                />
              </Link>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-lg p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer User Profile (At top before menu) */}
            {user && (
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold uppercase text-white overflow-hidden shrink-0">
                    {user.avatar_path ? (
                      <Image
                        src={getMediaUrl(user.avatar_path)}
                        alt="Avatar"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.username ? user.username.substring(0, 2) : 'US'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{user.username}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email || user.role}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Drawer Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-2">
              {drawerItems
                .filter((item) => item.show)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsDrawerOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all"
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
          </div>

          {/* Drawer Footer (PWA Install & Build Info) */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-950 text-center space-y-3">
            {canInstallPwa && (
              <button
                onClick={handleInstallPwa}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Download className="w-4 h-4" /> App als PWA installieren
              </button>
            )}

            {/* Admin Update Button */}
            {isAdmin && (
              <button
                onClick={handleOpenUpdateModal}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                <span>Nach Updates suchen</span>
              </button>
            )}

            <button
              onClick={handleOpenChangelog}
              className="w-full text-center text-[10px] text-zinc-500 hover:text-primary font-mono tracking-wider transition-colors flex items-center justify-center gap-1.5 py-1"
              title="Klicken, um Versions-Changelog & Git-Historie anzuzeigen"
            >
              <History className="w-3 h-3 text-zinc-500 group-hover:text-primary" />
              <span>
                BUILD: {new Date().toLocaleString('de-DE', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* --- Changelog Modal --- */}
      {isChangelogModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Versions-Changelog & Historie
              </h3>
              <button
                onClick={() => setIsChangelogModalOpen(false)}
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {changelogLoading ? (
              <div className="py-12 text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                <p className="text-xs text-zinc-400 animate-pulse">Lade Git-Commit Historie...</p>
              </div>
            ) : changelogData && changelogData.commits && changelogData.commits.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 font-mono">
                  <span>Aktueller Stand:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <GitCommit className="w-3.5 h-3.5" /> {changelogData.current_hash}
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 scrollbar-none">
                  {changelogData.commits.map((c: any, idx: number) => (
                    <div
                      key={c.hash || idx}
                      className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1 hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span className="text-primary font-bold">{c.hash}</span>
                        <span>{c.date} • {c.author}</span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-200">
                        {c.message}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setIsChangelogModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-400 text-xs">
                Keine Git-Historie verfügbar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Admin System Update Modal --- */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-primary ${updateStep === 'CHECKING' || updateStep === 'APPLYING' ? 'animate-spin' : ''}`} />
                System-Update Manager
              </h3>
              {updateStep !== 'APPLYING' && (
                <button
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="text-zinc-400 hover:text-white text-lg font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Step 1: Checking Git repo */}
            {updateStep === 'CHECKING' && (
              <div className="py-8 text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                <p className="text-sm font-semibold text-zinc-300">Prüfe Git-Repository auf neue Commits...</p>
              </div>
            )}

            {/* Step 2: Show result & Prompt decisions */}
            {updateStep === 'READY' && updateInfo && (
              <div className="space-y-4">
                {updateInfo.update_available ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Neues Update verfügbar! ({updateInfo.commits_behind} Commits ausstehend)</span>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-xs space-y-2">
                      <div className="flex justify-between text-zinc-400">
                        <span>Aktueller Stand:</span>
                        <code className="text-zinc-300 font-mono">{updateInfo.local_commit}</code>
                      </div>
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Neuer Stand:</span>
                        <code className="font-mono">{updateInfo.remote_commit}</code>
                      </div>
                      <div className="pt-2 border-t border-zinc-800 text-zinc-300 font-sans italic">
                        &quot;{updateInfo.remote_message}&quot;
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Das Update führt automatisch ein <code className="text-zinc-200">git pull</code>, die Datenbank-Migration, den Next.js Frontend-Build sowie den PM2-Dienste-Neustart durch.
                    </p>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => setIsUpdateModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={handleStartUpdate}
                        className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-lg shadow-primary/20 flex items-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Update jetzt ausführen</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">System ist auf dem neuesten Stand!</h4>
                    <p className="text-xs text-zinc-400">Keine neuen Commits im Git Repository gefunden. (Commit: <code className="text-zinc-200">{updateInfo.local_commit}</code>)</p>
                    <button
                      onClick={() => setIsUpdateModalOpen(false)}
                      className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs mt-2"
                    >
                      Schließen
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Applying Update & Showing Live Log */}
            {(updateStep === 'APPLYING' || updateStep === 'COMPLETED' || updateStep === 'ERROR') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-300">
                    {updateStep === 'APPLYING' && "⏳ Update wird ausgeführt..."}
                    {updateStep === 'COMPLETED' && "✅ Update erfolgreich abgeschlossen!"}
                    {updateStep === 'ERROR' && "❌ Fehler beim Update-Prozess"}
                  </span>
                  {updateStep === 'APPLYING' && (
                    <span className="text-[10px] text-zinc-500 animate-pulse">Laufender Prozess...</span>
                  )}
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[11px] text-zinc-300 space-y-1">
                  <pre className="whitespace-pre-wrap">{updateLog || "Starte Skript..."}</pre>
                </div>

                {updateStep !== 'APPLYING' && (
                  <div className="flex justify-end gap-3 pt-2">
                    {updateStep === 'COMPLETED' ? (
                      <button
                        onClick={handleFinishUpdateAndReload}
                        className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Neuladen & Bestätigen</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsUpdateModalOpen(false)}
                        className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs"
                      >
                        Schließen
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
