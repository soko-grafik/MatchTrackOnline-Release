"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Server, 
  Database, 
  User, 
  Settings, 
  ArrowRight, 
  ArrowLeft, 
  Globe, 
  Cpu, 
  FolderLock, 
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface PrereqCheck {
  id: string;
  name: string;
  status: 'success' | 'warning' | 'error';
  details: string;
}

export default function InstallWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [lang, setLang] = useState<'de' | 'en'>('de');
  
  // Step 2: Hosting Type & Dependency Setup
  const [hostingType, setHostingType] = useState<'cgi' | 'vps'>('cgi');
  const [installingDeps, setInstallingDeps] = useState(false);
  const [depInstallResult, setDepInstallResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // Step 3: Tech Prereqs Check
  const [prereqLoading, setPrereqLoading] = useState(false);
  const [prereqs, setPrereqs] = useState<PrereqCheck[]>([]);
  const [customFfmpegPath, setCustomFfmpegPath] = useState('');
  const [prereqsSuccess, setPrereqsSuccess] = useState(false);

  // Step 4: Modules Configuration
  const [moduleStitching, setModuleStitching] = useState(true);
  const [moduleHeatmap, setModuleHeatmap] = useState(true);
  const [moduleVideoColor, setModuleVideoColor] = useState(true);
  const [moduleHls, setModuleHls] = useState(true);
  const [moduleFisheye, setModuleFisheye] = useState(true);
  const [moduleAvailability, setModuleAvailability] = useState<any>(null);
  const [checkingModules, setCheckingModules] = useState(false);

  // Step 5: Database Configuration
  const [dbType, setDbType] = useState<'sqlite' | 'mysql'>('sqlite');
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPort, setDbPort] = useState(3306);
  const [dbName, setDbName] = useState('matchtracker');
  const [dbUser, setDbUser] = useState('');
  const [dbPass, setDbPass] = useState('');
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Step 6: Admin Registration
  const [adminUser, setAdminUser] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');
  const [adminError, setAdminError] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Step 7: App & SMTP Config
  const [appName, setAppName] = useState('MatchTracker');
  const [appUrl, setAppUrl] = useState('http://localhost:3000');
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [savingAppConfig, setSavingAppConfig] = useState(false);

  // Step 8: Completion
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState('');

  // Translations
  const t = {
    de: {
      title: "MatchTracker Installation",
      welcome: "Willkommen beim MatchTracker Setup",
      welcome_desc: "Dieser Wizard führt Sie durch die Einrichtung der MatchTracker Plattform auf Ihrem Server. Bitte stellen Sie sicher, dass alle Daten bereitliegen.",
      language: "Sprachauswahl / Language",
      next: "Weiter",
      back: "Zurück",
      step: "Schritt",
      of: "von",
      hosting_title: "Hosting-Umgebung & Abhängigkeiten",
      hosting_desc: "Wählen Sie Ihren Server-Typ aus. MatchTracker kann für Standard VPS/Rootserver oder optimiert im CGI-Modus für Shared Hosting (wie 1blu) betrieben werden.",
      shared_hosting: "Shared Webspace (CGI)",
      shared_hosting_desc: "Für Webhosting-Pakete ohne SSH- oder Root-Zugriff. Die Python-Bibliotheken werden in einen lokalen Ordner (backend/lib) installiert.",
      vps_hosting: "VPS / Rootserver / Managed Server",
      vps_hosting_desc: "Für vollen SSH-Zugriff. Sie können Python-Abhängigkeiten in ein Virtual Environment (venv) installieren und persistente Serverprozesse (Uvicorn) nutzen.",
      dep_setup_title: "Abhängigkeiten einrichten",
      dep_setup_btn: "Bibliotheken installieren",
      dep_installing: "Installiere Bibliotheken in backend/lib...",
      dep_installing_desc: "Dies kann bis zu 15 Sekunden dauern...",
      prereq_title: "Server-Voraussetzungsprüfung",
      prereq_desc: "Wir prüfen, ob Ihr System die technischen Voraussetzungen für den Betrieb von MatchTracker erfüllt.",
      prereq_btn: "Voraussetzungen prüfen",
      ffmpeg_path_lbl: "Eigener FFmpeg Pfad (optional):",
      ffmpeg_path_placeholder: "z.B. /usr/bin/ffmpeg oder Leerlassen für Standardsuche",
      prereq_failed_warning: "Einige kritische Systemprüfungen sind fehlgeschlagen. Bitte beheben Sie diese, um fortzufahren.",
      module_title: "Modul-Konfiguration",
      module_desc: "Aktivieren oder deaktivieren Sie optionale Module basierend auf den Serverkapazitäten. Schwächere Hoster (wie Shared CGI) können ressourcenintensive Funktionen deaktivieren.",
      module_stitching: "Video Stitching-Modul",
      module_stitching_desc: "Fügt zwei Halbbild-Videos nahtlos zusammen. Benötigt OpenCV und Ultralytics (KI).",
      module_heatmap: "Heatmap-Generator",
      module_heatmap_desc: "Generiert Laufwege und Aktivitäts-Heatmaps der Spieler. Benötigt NumPy und Matplotlib.",
      module_color: "Video-Farbkorrektur",
      module_color_desc: "Ermöglicht Kontrast, Sättigung, Farbton und Helligkeitsanpassungen. Benötigt OpenCV.",
      module_hls: "HLS Streaming-Konvertierung",
      module_hls_desc: "Konvertiert hochgeladene MP4-Videos in das adaptive HLS-Format für ruckelfreies Abspielen im Web. Benötigt FFmpeg.",
      module_fisheye: "Fisheye-Objektivkorrektur",
      module_fisheye_desc: "Entzerrt Weitwinkel-Aufnahmen für eine flache Feldansicht. Benötigt OpenCV.",
      module_available: "Verfügbar",
      module_unavailable: "Bibliotheken fehlen (Deaktivierung empfohlen)",
      db_title: "Datenbankverbindung einrichten",
      db_desc: "Wählen Sie den gewünschten Datenbanktyp und tragen Sie die Zugangsdaten ein.",
      db_type_lbl: "Datenbanktyp",
      sqlite_desc: "SQLite benötigt keine Konfiguration und speichert alle Daten in einer lokalen Datei im Backend. Empfohlen für Shared Webspace.",
      mysql_desc: "MySQL/MariaDB ist performant und wird für größere Installationen auf VPS/Managed Server empfohlen.",
      db_host_lbl: "Datenbank-Host / IP",
      db_port_lbl: "Port",
      db_name_lbl: "Datenbankname",
      db_user_lbl: "Benutzername",
      db_pass_lbl: "Passwort",
      db_test_btn: "Verbindung testen",
      db_test_success: "Verbindung erfolgreich hergestellt!",
      admin_title: "Administrator-Konto erstellen",
      admin_desc: "Erstellen Sie das erste Benutzerkonto. Dieses Konto wird Administrationsrechte besitzen.",
      admin_user_lbl: "Benutzername",
      admin_email_lbl: "E-Mail-Adresse",
      admin_pass_lbl: "Passwort",
      admin_confirm_lbl: "Passwort bestätigen",
      app_title: "Anwendungseinstellungen",
      app_desc: "Geben Sie die grundlegenden Konfigurationen der Benutzeroberfläche und optional Mail-Einstellungen (SMTP) für Benachrichtigungen ein.",
      app_name_lbl: "Name der Anwendung",
      app_url_lbl: "Anwendungs-URL",
      timezone_lbl: "Zeitzone",
      smtp_title: "SMTP E-Mail-Konfiguration (optional)",
      smtp_host_lbl: "SMTP Host",
      smtp_port_lbl: "SMTP Port",
      smtp_user_lbl: "SMTP Benutzername",
      smtp_pass_lbl: "SMTP Passwort",
      smtp_from_lbl: "Absender E-Mail (From)",
      complete_title: "Installation abschließen",
      complete_desc: "Alle Einstellungen wurden erfasst. Klicken Sie unten auf 'Abschließen', um die Installation zu sperren und die Anwendung zu starten.",
      complete_btn: "Installation abschließen",
      completed_success: "Herzlichen Glückwunsch! MatchTracker wurde erfolgreich installiert.",
      completed_redirect: "Sie werden in Kürze zur Login-Seite weitergeleitet...",
    },
    en: {
      title: "MatchTracker Installation",
      welcome: "Welcome to the MatchTracker Setup",
      welcome_desc: "This wizard guides you through setting up the MatchTracker platform on your server. Please make sure you have all configuration details ready.",
      language: "Sprachauswahl / Language",
      next: "Next",
      back: "Back",
      step: "Step",
      of: "of",
      hosting_title: "Hosting Environment & Dependencies",
      hosting_desc: "Select your server type. MatchTracker can run on standard VPS/Root servers, or optimized in CGI mode for Shared Hosting spaces (e.g. 1blu).",
      shared_hosting: "Shared Webspace (CGI)",
      shared_hosting_desc: "For web hosting packages without SSH or root access. Python libraries will be installed in a local folder (backend/lib).",
      vps_hosting: "VPS / Root Server / Managed Server",
      vps_hosting_desc: "For full SSH access. You can install Python dependencies in a Virtual Environment (venv) and run persistent server processes (Uvicorn).",
      dep_setup_title: "Setup Dependencies",
      dep_setup_btn: "Install Libraries",
      dep_installing: "Installing libraries to backend/lib...",
      dep_installing_desc: "This may take up to 15 seconds...",
      prereq_title: "Server Prerequisite Check",
      prereq_desc: "We check if your system meets the technical prerequisites to run MatchTracker.",
      prereq_btn: "Check Prerequisites",
      ffmpeg_path_lbl: "Custom FFmpeg Path (optional):",
      ffmpeg_path_placeholder: "e.g. /usr/bin/ffmpeg or leave empty for default search",
      prereq_failed_warning: "Some critical system checks failed. Please fix them before continuing.",
      module_title: "Module Configuration",
      module_desc: "Enable or disable optional modules based on server capabilities. Low-power hosts (like Shared CGI) can disable heavy processing.",
      module_stitching: "Video Stitching Module",
      module_stitching_desc: "Stitches two half-field video clips seamlessly. Requires OpenCV and Ultralytics (AI).",
      module_heatmap: "Heatmap Generator",
      module_heatmap_desc: "Generates player activity heatmaps and running paths. Requires NumPy and Matplotlib.",
      module_color: "Video Color Adjustments",
      module_color_desc: "Allows adjustments of contrast, saturation, hue and brightness. Requires OpenCV.",
      module_hls: "HLS Streaming Conversion",
      module_hls_desc: "Converts uploaded MP4 videos to adaptive HLS stream for buffer-free playback. Requires FFmpeg.",
      module_fisheye: "Fisheye Lens Correction",
      module_fisheye_desc: "Corrects wide-angle lens distortions for a flat-field perspective. Requires OpenCV.",
      module_available: "Available",
      module_unavailable: "Missing libraries (Deactivation recommended)",
      db_title: "Setup Database Connection",
      db_desc: "Select the database engine and insert your access credentials.",
      db_type_lbl: "Database Type",
      sqlite_desc: "SQLite requires no configuration and saves everything in a local file in the backend. Recommended for Shared Webspace.",
      mysql_desc: "MySQL/MariaDB is high performance and recommended for larger production setups on VPS/Managed Servers.",
      db_host_lbl: "Database Host / IP",
      db_port_lbl: "Port",
      db_name_lbl: "Database Name",
      db_user_lbl: "Username",
      db_pass_lbl: "Password",
      db_test_btn: "Test Connection",
      db_test_success: "Successfully connected to database!",
      admin_title: "Create Administrator Account",
      admin_desc: "Create the first user account. This account will have full administrator rights.",
      admin_user_lbl: "Username",
      admin_email_lbl: "Email Address",
      admin_pass_lbl: "Password",
      admin_confirm_lbl: "Confirm Password",
      app_title: "Application Settings",
      app_desc: "Enter general branding properties and optional mail settings (SMTP) for system notifications.",
      app_name_lbl: "Application Name",
      app_url_lbl: "Application URL",
      timezone_lbl: "Timezone",
      smtp_title: "SMTP Email Configuration (optional)",
      smtp_host_lbl: "SMTP Host",
      smtp_port_lbl: "SMTP Port",
      smtp_user_lbl: "SMTP Username",
      smtp_pass_lbl: "SMTP Password",
      smtp_from_lbl: "Sender Email (From)",
      complete_title: "Complete Installation",
      complete_desc: "All settings have been configured. Click 'Complete' below to lock down the installer and start the application.",
      complete_btn: "Complete Installation",
      completed_success: "Congratulations! MatchTracker was successfully installed.",
      completed_redirect: "You will be redirected to the login page shortly...",
    }
  };

  // Step 3 Prereq Runner
  const runPrereqChecks = async () => {
    setPrereqLoading(true);
    try {
      const response = await api.post('/install/prereqs', null, {
        params: { custom_ffmpeg_path: customFfmpegPath || undefined }
      });
      setPrereqs(response.data.checks);
      setPrereqsSuccess(response.data.success);
    } catch (e) {
      console.error(e);
      alert(lang === 'de' ? "Fehler bei der Überprüfung der Voraussetzungen." : "Error while checking prerequisites.");
    } finally {
      setPrereqLoading(false);
    }
  };

  // Step 4 Module Availability Fetcher
  const fetchModuleAvailability = async () => {
    setCheckingModules(true);
    try {
      const response = await api.post('/install/configure-modules', {
        module_stitching_enabled: moduleStitching,
        module_heatmap_enabled: moduleHeatmap,
        module_video_color_enabled: moduleVideoColor,
        module_hls_enabled: moduleHls,
        module_fisheye_enabled: moduleFisheye
      });
      setModuleAvailability(response.data.availability);
      
      // Auto-toggle off modules that aren't available
      if (response.data.availability) {
        if (!response.data.availability.stitching.available) setModuleStitching(false);
        if (!response.data.availability.heatmap.available) setModuleHeatmap(false);
        if (!response.data.availability.video_color.available) setModuleVideoColor(false);
        if (!response.data.availability.fisheye.available) setModuleFisheye(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingModules(false);
    }
  };

  // Step 2 Dependency Setup Trigger
  const setupDependencies = async () => {
    setInstallingDeps(true);
    setDepInstallResult(null);
    try {
      const response = await api.post('/install/setup-dependencies', { hosting_type: hostingType });
      setDepInstallResult({
        success: response.data.success,
        message: response.data.message,
        details: response.data.details
      });
      if (response.data.success) {
        // Trigger prerequisite refresh in background
        runPrereqChecks();
      }
    } catch (e: any) {
      setDepInstallResult({
        success: false,
        message: lang === 'de' ? "Verbindungsfehler bei der Installation." : "Network error during installation.",
        details: e.response?.data?.detail || e.message
      });
    } finally {
      setInstallingDeps(false);
    }
  };

  // Step 5 DB Tester
  const testDbConnection = async () => {
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const response = await api.post('/install/configure-db', {
        db_type: dbType,
        db_host: dbHost,
        db_port: dbPort,
        db_name: dbName,
        db_user: dbUser,
        db_pass: dbPass
      });
      setDbTestResult({
        success: response.data.success,
        message: response.data.success 
          ? (lang === 'de' ? t.de.db_test_success : t.en.db_test_success)
          : response.data.error
      });
    } catch (e: any) {
      setDbTestResult({
        success: false,
        message: e.response?.data?.detail || e.message
      });
    } finally {
      setTestingDb(false);
    }
  };

  // Step 6 Admin Creation
  const handleCreateAdmin = async () => {
    if (!adminUser || !adminEmail || !adminPass) {
      setAdminError(lang === 'de' ? "Bitte alle Felder ausfüllen." : "Please fill out all fields.");
      return;
    }
    if (adminPass !== adminPassConfirm) {
      setAdminError(lang === 'de' ? "Passwörter stimmen nicht überein." : "Passwords do not match.");
      return;
    }
    setAdminError('');
    setCreatingAdmin(true);

    try {
      // First seed modules to DB
      await api.post('/install/seed-db', {
        module_stitching_enabled: moduleStitching,
        module_heatmap_enabled: moduleHeatmap,
        module_video_color_enabled: moduleVideoColor,
        module_hls_enabled: moduleHls,
        module_fisheye_enabled: moduleFisheye
      });

      // Then create admin
      const response = await api.post('/install/create-admin', {
        username: adminUser,
        email: adminEmail,
        password: adminPass
      });

      if (response.data.success) {
        setStep(7);
      } else {
        setAdminError(response.data.error || "Fehler beim Erstellen.");
      }
    } catch (e: any) {
      setAdminError(e.response?.data?.detail || e.message);
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Step 7 Saving App Configuration
  const handleSaveAppConfig = async () => {
    setSavingAppConfig(true);
    try {
      const response = await api.post('/install/configure-app', {
        app_name: appName,
        app_url: appUrl,
        timezone,
        smtp_host: smtpHost || undefined,
        smtp_port: smtpPort || undefined,
        smtp_user: smtpUser || undefined,
        smtp_pass: smtpPass || undefined,
        smtp_from: smtpFrom || undefined
      });
      if (response.data.success) {
        setStep(8);
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message);
    } finally {
      setSavingAppConfig(false);
    }
  };

  // Step 8 complete installation
  const handleCompleteInstallation = async () => {
    setCompleting(true);
    setCompletionError('');
    try {
      const response = await api.post('/install/complete');
      if (response.data.success) {
        setStep(9);
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      }
    } catch (e: any) {
      setCompletionError(e.response?.data?.detail || e.message);
    } finally {
      setCompleting(false);
    }
  };

  // Load modules config & run initial prereqs on step loads
  useEffect(() => {
    if (step === 3 && prereqs.length === 0) {
      runPrereqChecks();
    }
    if (step === 4 && !moduleAvailability) {
      fetchModuleAvailability();
    }
  }, [step]);

  const activeT = lang === 'de' ? t.de : t.en;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between font-sans selection:bg-emerald-500/30 selection:text-emerald-400">
      
      {/* Navbar Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-emerald-600 to-teal-400 p-2.5 rounded-xl shadow-lg shadow-emerald-500/10">
            <Cpu className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              MatchTrack Setup
            </h1>
            <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">Installer Console</p>
          </div>
        </div>

        {/* Language select */}
        <button 
          onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
          className="flex items-center gap-2 text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white px-3.5 py-1.5 rounded-xl transition-all shadow-inner"
        >
          <Globe className="w-3.5 h-3.5 text-zinc-500" />
          <span>{lang === 'de' ? 'English' : 'Deutsch'}</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 flex flex-col justify-center">
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl relative">
          
          {/* Top Progress bar */}
          {step <= 8 && (
            <div className="w-full bg-zinc-950 h-1.5 flex">
              <div 
                className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full transition-all duration-500" 
                style={{ width: `${(step / 8) * 100}%` }}
              />
            </div>
          )}

          <div className="p-8 sm:p-10">
            
            {/* Header Steps indicator */}
            {step <= 8 && (
              <div className="flex items-center justify-between mb-8">
                <span className="text-xs font-mono text-zinc-500 tracking-wider">
                  {activeT.step.toUpperCase()} {step} {activeT.of} 8
                </span>
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shadow-sm animate-pulse">
                  System Online
                </span>
              </div>
            )}

            {/* STEP 1: WELCOME */}
            {step === 1 && (
              <div className="space-y-6 text-center py-6">
                <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/25 mb-4 shadow-lg shadow-emerald-500/5">
                  <Sparkles className="w-10 h-10 text-emerald-400 animate-spin-slow" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight">{activeT.welcome}</h2>
                <p className="text-zinc-400 max-w-lg mx-auto leading-relaxed">{activeT.welcome_desc}</p>
                
                <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800 max-w-md mx-auto mt-8 flex flex-col gap-3 text-left">
                  <span className="text-xs font-mono text-zinc-500">{activeT.language}:</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setLang('de')}
                      className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${lang === 'de' ? 'bg-emerald-600/10 border-emerald-500/60 text-white shadow-md' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Deutsch (German)
                    </button>
                    <button 
                      onClick={() => setLang('en')}
                      className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${lang === 'en' ? 'bg-emerald-600/10 border-emerald-500/60 text-white shadow-md' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                    >
                      English (English)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: HOSTING TYPE */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Server className="w-6 h-6 text-emerald-500 animate-pulse" />
                    <span>{activeT.hosting_title}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">{activeT.hosting_desc}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {/* CGI */}
                  <div 
                    onClick={() => setHostingType('cgi')}
                    className={`p-6 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${hostingType === 'cgi' ? 'bg-emerald-600/5 border-emerald-500 text-white shadow-lg' : 'bg-zinc-950/20 border-zinc-800 hover:border-zinc-700 text-zinc-400'}`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`p-2 rounded-xl border ${hostingType === 'cgi' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>C</span>
                        <h3 className="font-bold text-zinc-100">{activeT.shared_hosting}</h3>
                      </div>
                      <p className="text-xs leading-relaxed opacity-80">{activeT.shared_hosting_desc}</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 mt-4 block">Recommended for 1blu, Strato, Hostinger...</span>
                  </div>

                  {/* VPS */}
                  <div 
                    onClick={() => setHostingType('vps')}
                    className={`p-6 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${hostingType === 'vps' ? 'bg-emerald-600/5 border-emerald-500 text-white shadow-lg' : 'bg-zinc-950/20 border-zinc-800 hover:border-zinc-700 text-zinc-400'}`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`p-2 rounded-xl border ${hostingType === 'vps' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>V</span>
                        <h3 className="font-bold text-zinc-100">{activeT.vps_hosting}</h3>
                      </div>
                      <p className="text-xs leading-relaxed opacity-80">{activeT.vps_hosting_desc}</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 mt-4 block">Recommended for Netcup, Hetzner, AWS, DigitalOcean...</span>
                  </div>
                </div>

                {hostingType === 'cgi' && (
                  <div className="mt-8 bg-zinc-950/60 rounded-2xl border border-zinc-800/80 p-5">
                    <h3 className="text-sm font-semibold text-zinc-200 mb-2">{activeT.dep_setup_title}</h3>
                    <p className="text-xs text-zinc-400 mb-4">
                      {lang === 'de' 
                        ? "Um im CGI-Modus lauffähig zu sein, müssen notwendige Bibliotheken im Ordner 'backend/lib' bereitliegen. Sie können den Vorgang hier anstoßen." 
                        : "To work in CGI mode, required libraries need to be present inside 'backend/lib'. You can trigger the process here."}
                    </p>
                    <button
                      onClick={setupDependencies}
                      disabled={installingDeps}
                      className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                    >
                      {installingDeps ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{activeT.dep_installing}</span>
                        </>
                      ) : (
                        <span>{activeT.dep_setup_btn}</span>
                      )}
                    </button>
                    {installingDeps && (
                      <p className="text-[10px] text-zinc-500 mt-2 italic">{activeT.dep_installing_desc}</p>
                    )}

                    {depInstallResult && (
                      <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${depInstallResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                        {depInstallResult.success ? (
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-xs font-semibold">{depInstallResult.message}</p>
                          {depInstallResult.details && (
                            <pre className="text-[10px] mt-2 font-mono whitespace-pre-wrap opacity-75 max-h-32 overflow-y-auto">
                              {depInstallResult.details}
                            </pre>
                          )}
                          {!depInstallResult.success && (
                            <p className="text-[10px] mt-2 leading-relaxed text-zinc-400">
                              {lang === 'de'
                                ? "Hinweis: Sie können die Bibliotheken auch als vorkompiliertes ZIP herunterladen und manuell per FTP in 'backend/lib' entpacken."
                                : "Note: You can also download the pre-compiled libraries ZIP and extract them manually into 'backend/lib' using FTP."}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: PRE-REQS */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 animate-pulse" />
                    <span>{activeT.prereq_title}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">{activeT.prereq_desc}</p>
                </div>

                {/* Custom FFmpeg input */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-850 flex flex-col md:flex-row md:items-end gap-3 justify-between">
                  <div className="flex-1">
                    <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.ffmpeg_path_lbl}</label>
                    <input 
                      type="text" 
                      value={customFfmpegPath}
                      onChange={(e) => setCustomFfmpegPath(e.target.value)}
                      placeholder={activeT.ffmpeg_path_placeholder}
                      className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none p-2.5 rounded-xl text-zinc-200"
                    />
                  </div>
                  <button 
                    onClick={runPrereqChecks}
                    disabled={prereqLoading}
                    className="flex items-center justify-center gap-2 text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 px-5 py-3 rounded-xl transition-all disabled:opacity-50 flex-shrink-0 shadow-sm"
                  >
                    {prereqLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{lang === 'de' ? 'Prüfe...' : 'Checking...'}</span>
                      </>
                    ) : (
                      <span>{activeT.prereq_btn}</span>
                    )}
                  </button>
                </div>

                {/* Checklist results */}
                <div className="space-y-3 mt-6">
                  {prereqs.map((chk) => (
                    <div 
                      key={chk.id}
                      className="p-4 rounded-2xl border bg-zinc-950/20 border-zinc-850 flex items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {chk.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        {chk.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                        {chk.status === 'error' && <XCircle className="w-5 h-5 text-rose-500" />}
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-200">{chk.name}</h4>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{chk.details}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        chk.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                        chk.status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-rose-500/10 text-rose-400'
                      }`}>
                        {chk.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>

                {!prereqLoading && prereqs.length > 0 && !prereqsSuccess && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 mt-4 text-rose-400">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium">{activeT.prereq_failed_warning}</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: MODULE CONFIG */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Layers className="w-6 h-6 text-emerald-500 animate-pulse" />
                    <span>{activeT.module_title}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">{activeT.module_desc}</p>
                </div>

                {checkingModules ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
                    <p className="text-xs text-zinc-400">{lang === 'de' ? "Überprüfe Serverbibliotheken..." : "Checking server libraries..."}</p>
                  </div>
                ) : (
                  <div className="space-y-4 mt-6">
                    {/* Stitching */}
                    <div className="p-4 rounded-2xl border border-zinc-850 bg-zinc-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-200">{activeT.module_stitching}</h4>
                          {moduleAvailability && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              moduleAvailability.stitching.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {moduleAvailability.stitching.available ? activeT.module_available : activeT.module_unavailable}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">{activeT.module_stitching_desc}</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={moduleStitching}
                        onChange={(e) => setModuleStitching(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-800 bg-zinc-900 cursor-pointer self-start md:self-center"
                      />
                    </div>

                    {/* Heatmap */}
                    <div className="p-4 rounded-2xl border border-zinc-850 bg-zinc-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-200">{activeT.module_heatmap}</h4>
                          {moduleAvailability && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              moduleAvailability.heatmap.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {moduleAvailability.heatmap.available ? activeT.module_available : activeT.module_unavailable}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">{activeT.module_heatmap_desc}</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={moduleHeatmap}
                        onChange={(e) => setModuleHeatmap(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-800 bg-zinc-900 cursor-pointer self-start md:self-center"
                      />
                    </div>

                    {/* Color adjustment */}
                    <div className="p-4 rounded-2xl border border-zinc-850 bg-zinc-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-200">{activeT.module_color}</h4>
                          {moduleAvailability && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              moduleAvailability.video_color.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {moduleAvailability.video_color.available ? activeT.module_available : activeT.module_unavailable}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">{activeT.module_color_desc}</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={moduleVideoColor}
                        onChange={(e) => setModuleVideoColor(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-800 bg-zinc-900 cursor-pointer self-start md:self-center"
                      />
                    </div>

                    {/* HLS */}
                    <div className="p-4 rounded-2xl border border-zinc-850 bg-zinc-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-200">{activeT.module_hls}</h4>
                        <p className="text-[10px] text-zinc-400 mt-1">{activeT.module_hls_desc}</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={moduleHls}
                        onChange={(e) => setModuleHls(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-800 bg-zinc-900 cursor-pointer self-start md:self-center"
                      />
                    </div>

                    {/* Fisheye */}
                    <div className="p-4 rounded-2xl border border-zinc-850 bg-zinc-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-200">{activeT.module_fisheye}</h4>
                          {moduleAvailability && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              moduleAvailability.fisheye.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {moduleAvailability.fisheye.available ? activeT.module_available : activeT.module_unavailable}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">{activeT.module_fisheye_desc}</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={moduleFisheye}
                        onChange={(e) => setModuleFisheye(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-800 bg-zinc-900 cursor-pointer self-start md:self-center"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: DATABASE CONFIG */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Database className="w-6 h-6 text-emerald-500 animate-pulse" />
                    <span>{activeT.db_title}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">{activeT.db_desc}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  {/* SQLite */}
                  <div 
                    onClick={() => setDbType('sqlite')}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${dbType === 'sqlite' ? 'bg-emerald-600/5 border-emerald-500 text-white shadow-lg' : 'bg-zinc-950/20 border-zinc-800 hover:border-zinc-700 text-zinc-400'}`}
                  >
                    <div>
                      <h3 className="font-bold text-sm text-zinc-100">SQLite (Embedded)</h3>
                      <p className="text-[11px] leading-relaxed opacity-85 mt-2">{activeT.sqlite_desc}</p>
                    </div>
                  </div>

                  {/* MySQL */}
                  <div 
                    onClick={() => setDbType('mysql')}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${dbType === 'mysql' ? 'bg-emerald-600/5 border-emerald-500 text-white shadow-lg' : 'bg-zinc-950/20 border-zinc-800 hover:border-zinc-700 text-zinc-400'}`}
                  >
                    <div>
                      <h3 className="font-bold text-sm text-zinc-100">MySQL / MariaDB</h3>
                      <p className="text-[11px] leading-relaxed opacity-85 mt-2">{activeT.mysql_desc}</p>
                    </div>
                  </div>
                </div>

                {dbType === 'mysql' && (
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/30 rounded-2xl border border-zinc-850 p-6">
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.db_host_lbl}</label>
                      <input 
                        type="text" 
                        value={dbHost}
                        onChange={(e) => setDbHost(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.db_port_lbl}</label>
                      <input 
                        type="number" 
                        value={dbPort}
                        onChange={(e) => setDbPort(parseInt(e.target.value))}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.db_name_lbl}</label>
                      <input 
                        type="text" 
                        value={dbName}
                        onChange={(e) => setDbName(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.db_user_lbl}</label>
                      <input 
                        type="text" 
                        value={dbUser}
                        onChange={(e) => setDbUser(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.db_pass_lbl}</label>
                      <input 
                        type="password" 
                        value={dbPass}
                        onChange={(e) => setDbPass(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>

                    <div className="sm:col-span-2 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-900 pt-4">
                      <button
                        onClick={testDbConnection}
                        disabled={testingDb}
                        className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-inner"
                      >
                        {testingDb && <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
                        <span>{activeT.db_test_btn}</span>
                      </button>

                      {dbTestResult && (
                        <div className={`flex items-center gap-2 text-xs ${dbTestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {dbTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 flex-shrink-0" />
                          )}
                          <span className="font-semibold leading-tight">{dbTestResult.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 6: ADMIN REGISTRATION */}
            {step === 6 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <User className="w-6 h-6 text-emerald-500 animate-pulse" />
                    <span>{activeT.admin_title}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">{activeT.admin_desc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/30 border border-zinc-850 rounded-2xl p-6 mt-6">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.admin_user_lbl}</label>
                    <input 
                      type="text" 
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.admin_email_lbl}</label>
                    <input 
                      type="email" 
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                    />
                  </div>
                  <div className="relative">
                    <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.admin_pass_lbl}</label>
                    <input 
                      type={showAdminPass ? "text" : "password"}
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200 pr-10"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowAdminPass(!showAdminPass)}
                      className="absolute right-3 top-[34px] text-zinc-400 hover:text-zinc-200"
                    >
                      {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.admin_confirm_lbl}</label>
                    <input 
                      type={showAdminPass ? "text" : "password"}
                      value={adminPassConfirm}
                      onChange={(e) => setAdminPassConfirm(e.target.value)}
                      className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                    />
                  </div>
                </div>

                {adminError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 mt-4 text-rose-400">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium leading-relaxed">{adminError}</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 7: APP CONFIG */}
            {step === 7 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Settings className="w-6 h-6 text-emerald-500 animate-pulse" />
                    <span>{activeT.app_title}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">{activeT.app_desc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/30 border border-zinc-850 rounded-2xl p-6 mt-6">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.app_name_lbl}</label>
                    <input 
                      type="text" 
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.app_url_lbl}</label>
                    <input 
                      type="text" 
                      value={appUrl}
                      onChange={(e) => setAppUrl(e.target.value)}
                      className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.timezone_lbl}</label>
                    <input 
                      type="text" 
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                    />
                  </div>
                </div>

                {/* SMTP configuration fold */}
                <div className="mt-8 bg-zinc-950/20 border border-zinc-850/80 rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-zinc-200 mb-4">{activeT.smtp_title}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.smtp_host_lbl}</label>
                      <input 
                        type="text" 
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="e.g. smtp.mailgun.org"
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.smtp_port_lbl}</label>
                      <input 
                        type="number" 
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.smtp_user_lbl}</label>
                      <input 
                        type="text" 
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.smtp_pass_lbl}</label>
                      <input 
                        type="password" 
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-mono text-zinc-400 block mb-1.5">{activeT.smtp_from_lbl}</label>
                      <input 
                        type="email" 
                        value={smtpFrom}
                        onChange={(e) => setSmtpFrom(e.target.value)}
                        placeholder="noreply@matchtrack.de"
                        className="w-full text-xs font-mono bg-zinc-900 border border-zinc-800 focus:border-zinc-750 outline-none p-2.5 rounded-xl text-zinc-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8: COMPLETION SCREEN */}
            {step === 8 && (
              <div className="space-y-6 text-center py-6">
                <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/25 mb-4 shadow-lg shadow-emerald-500/5">
                  <FolderLock className="w-10 h-10 text-emerald-400 animate-bounce" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight">{activeT.complete_title}</h2>
                <p className="text-zinc-400 max-w-lg mx-auto leading-relaxed">{activeT.complete_desc}</p>
                
                {completionError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 mt-4 text-rose-400 text-left max-w-md mx-auto">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium leading-relaxed">{completionError}</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 9: SUCCESS / REDIRECT */}
            {step === 9 && (
              <div className="space-y-6 text-center py-10">
                <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 mb-4 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-emerald-400">{activeT.completed_success}</h2>
                <p className="text-zinc-400 max-w-sm mx-auto animate-pulse text-sm leading-relaxed">{activeT.completed_redirect}</p>
                
                <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden max-w-xs mx-auto mt-6">
                  <div className="bg-emerald-500 h-full w-full animate-loading-bar" />
                </div>
              </div>
            )}

          </div>

          {/* Bottom Footer Controls */}
          {step <= 8 && (
            <div className="border-t border-zinc-800/80 bg-zinc-950/20 px-8 py-5 flex items-center justify-between gap-4">
              {/* Back btn */}
              <button
                onClick={() => setStep(step - 1)}
                disabled={step === 1 || completing}
                className="flex items-center gap-2 text-xs font-semibold px-4.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-inner"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{activeT.back}</span>
              </button>

              {/* Next / Action btn */}
              {step < 6 && (
                <button
                  onClick={() => {
                    if (step === 3 && !prereqsSuccess) {
                      if (!confirm(lang === 'de' ? "Voraussetzungen sind nicht alle erfüllt. Trotzdem fortfahren?" : "Prerequisites checks are not fully satisfied. Proceed anyway?")) return;
                    }
                    if (step === 5 && dbType === 'mysql' && !dbTestResult?.success) {
                      if (!confirm(lang === 'de' ? "Die Datenbank-Verbindung wurde nicht erfolgreich getestet. Trotzdem fortfahren?" : "Database connection has not been successfully tested. Proceed anyway?")) return;
                    }
                    setStep(step + 1);
                  }}
                  className="flex items-center gap-2 text-xs font-semibold px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20"
                >
                  <span>{activeT.next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 6 && (
                <button
                  onClick={handleCreateAdmin}
                  disabled={creatingAdmin}
                  className="flex items-center gap-2 text-xs font-semibold px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md disabled:opacity-50"
                >
                  {creatingAdmin && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{activeT.next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 7 && (
                <button
                  onClick={handleSaveAppConfig}
                  disabled={savingAppConfig}
                  className="flex items-center gap-2 text-xs font-semibold px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md disabled:opacity-50"
                >
                  {savingAppConfig && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{activeT.next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 8 && (
                <button
                  onClick={handleCompleteInstallation}
                  disabled={completing}
                  className="flex items-center gap-2 text-xs font-bold px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 border border-emerald-400/20"
                >
                  {completing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{activeT.complete_btn}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-6 border-t border-zinc-900 bg-zinc-950/40 text-center text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
        MatchTrack Platform Console v1.0.0
      </footer>

      {/* CSS overrides for custom animations */}
      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
        @keyframes loading-bar {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loading-bar 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

    </div>
  );
}
