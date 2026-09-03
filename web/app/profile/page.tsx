"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getMyProfile, updateMyProfile, updateMyPassword, updateMyPreferences, uploadMyAvatar, getMediaUrl, getTeams, sendTeamRequest } from '@/services/api';
import Navbar from '@/components/Navbar';
import AvatarCropModal from '@/components/AvatarCropModal';
import Image from 'next/image';
import {User, Lock, Bell, Shield, Camera, Check, AlertCircle, Loader2, CheckCircle2, Save, Sun, Moon, Monitor, Palette, Sparkles} from 'lucide-react';
import PageHeader from "@/components/PageHeader";


export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'teams' | 'appearance' | 'ai'>('profile');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // AI Settings states
  const [aiProvider, setAiProvider] = useState<'OPENAI' | 'GEMINI'>('OPENAI');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModelName, setAiModelName] = useState('');

  // Team Request states
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [requestTeamId, setRequestTeamId] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestStatus, setRequestStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Preferences states
  const [notifyNewVideo, setNotifyNewVideo] = useState(true);
  const [notifyAnalysis, setNotifyAnalysis] = useState(true);
  const [notifyOrganizerEvents, setNotifyOrganizerEvents] = useState(true);
  const [notifyOrganizerReminders, setNotifyOrganizerReminders] = useState(true);

  // Avatar Crop states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [profileData, teamsList] = await Promise.all([
        getMyProfile(),
        getTeams()
      ]);
      setProfile(profileData);
      setUsername(profileData.username || '');
      setEmail(profileData.email || '');
      setFirstName(profileData.first_name || '');
      setLastName(profileData.last_name || '');
      setAiProvider(profileData.ai_provider || 'OPENAI');
      setAiApiKey(profileData.ai_api_key || '');
      setAiModelName(profileData.ai_model_name || '');
      setNotifyNewVideo(profileData.notify_on_new_video ?? true);
      setNotifyAnalysis(profileData.notify_on_analysis ?? true);
      if (Array.isArray(teamsList)) {
        setAllTeams(teamsList);
      }
    } catch (err: any) {
      console.error("Fehler beim Laden des Profils:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTeamRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTeamId) return;
    setSendingRequest(true);
    setRequestStatus(null);
    try {
      await sendTeamRequest(requestTeamId, requestMessage);
      setRequestStatus({ type: 'success', text: 'Zuweisungsanfrage erfolgreich an den Administrator gesendet.' });
      setRequestTeamId('');
      setRequestMessage('');
    } catch (err: any) {
      setRequestStatus({ type: 'error', text: err.response?.data?.detail || 'Fehler beim Senden der Anfrage.' });
    } finally {
      setSendingRequest(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateMyProfile({
        username,
        email,
        first_name: firstName,
        last_name: lastName,
        ai_provider: aiProvider,
        ai_api_key: aiApiKey,
        ai_model_name: aiModelName
      });
      setMessage({ type: 'success', text: 'Profil- und KI-Einstellungen erfolgreich gespeichert.' });
      fetchProfile();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Fehler beim Speichern des Profils.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Die neuen Passwörter stimmen nicht überein.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateMyPassword({ current_password: currentPassword, new_password: newPassword });
      setMessage({ type: 'success', text: 'Passwort erfolgreich geändert.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Fehler beim Ändern des Passworts.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePreferencesSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateMyPreferences({ notify_on_new_video: notifyNewVideo, notify_on_analysis: notifyAnalysis });
      setMessage({ type: 'success', text: 'Benachrichtigungseinstellungen gespeichert.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Fehler beim Speichern der Einstellungen.' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropModalOpen(false);
    setSaving(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', croppedBlob, 'avatar.jpg');

    try {
      await uploadMyAvatar(formData);
      setMessage({ type: 'success', text: 'Profilbild erfolgreich aktualisiert.' });
      fetchProfile();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Fehler beim Hochladen des Profilbilds.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-primary/30">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <PageHeader
            title="Profil Einstellungen"
            subtitle="Verwalte dein Profil"
        />
        {/* Feedback Message */}
        {message && (
          <div className={`p-4 rounded-xl mb-6 border flex items-center gap-3 text-sm font-medium ${
            message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 border-b border-zinc-800 pb-3 mb-8 scrollbar-none">
          {[
            { id: 'profile', label: 'Profildaten', icon: <User className="w-4 h-4" /> },
            { id: 'appearance', label: 'Erscheinungsbild', icon: <Palette className="w-4 h-4" /> },
            { id: 'security', label: 'Sicherheit & Passwort', icon: <Lock className="w-4 h-4" /> },
            { id: 'notifications', label: 'Benachrichtigungen', icon: <Bell className="w-4 h-4" /> },
            { id: 'teams', label: 'Meine Mannschaften', icon: <Shield className="w-4 h-4" /> },
            ...(settings?.module_ai_assistant_enabled === true ? [{ id: 'ai', label: 'KI-Einstellungen', icon: <Sparkles className="w-4 h-4 text-amber-400" /> }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white'
                  : 'bg-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Profile Settings */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSave} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-3">Persönliche Angaben</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Vorname</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nachname</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Benutzername</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">E-Mail Adresse</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Speichern
              </button>
            </div>
          </form>
        )}
        {/* Tab: Appearance / Theme */}
        {activeTab === 'appearance' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-3">Erscheinungsbild (Theme)</h2>
              <p className="text-xs text-zinc-400 mt-2">Wähle dein bevorzugtes Farbschema für die MatchTrack Oberfläche.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {[
                { id: 'dark', label: 'Dunkel (Dark)', desc: 'Dunkles Design für optimale Übersicht', icon: <Moon className="w-6 h-6 text-emerald-400" /> },
                { id: 'light', label: 'Hell (Light)', desc: 'Helles, kontrastreiches Design', icon: <Sun className="w-6 h-6 text-amber-400" /> },
                { id: 'system', label: 'System (Auto)', desc: 'Folgt deinen Betriebssystem-Einstellungen', icon: <Monitor className="w-6 h-6 text-blue-400" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id as any)}
                  className={`p-5 rounded-2xl border flex flex-col items-start gap-3 transition-all text-left ${
                    theme === item.id
                      ? 'bg-primary/10 border-primary text-white ring-2 ring-primary/50 shadow-lg shadow-primary/10'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    {item.icon}
                    {theme === item.id && (
                      <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/20 px-2.5 py-0.5 rounded-full border border-primary/30">
                        <Check className="w-3.5 h-3.5" /> Aktiv
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white mb-1">{item.label}</div>
                    <div className="text-xs text-zinc-400 leading-relaxed">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Security & Password */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordSave} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-3">Passwort ändern</h2>
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Aktuelles Passwort</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Neues Passwort</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Neues Passwort wiederholen</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Passwort Aktualisieren
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Notifications */}
        {activeTab === 'notifications' && (
          <form onSubmit={handlePreferencesSave} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-3">E-Mail Benachrichtigungen</h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors">
                <div>
                  <div className="text-sm font-bold text-white">Neues Spielvideo hochgeladen</div>
                  <div className="text-xs text-zinc-400 mt-0.5">E-Mail senden, wenn ein neues Video für Ihre zugewiesene Mannschaft verfügbar ist.</div>
                </div>

                <div className="relative h-6 w-11 cursor-pointer rounded-full bg-zinc-700 transition-colors has-[:checked]:bg-primary">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={notifyNewVideo}
                    onChange={(e) => setNotifyNewVideo(e.target.checked)}
                  />
                  <span className="absolute inset-y-1 start-1 m-auto h-4 w-4 rounded-full bg-white transition-all peer-checked:start-6"></span>
                </div>
              </label>

              <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors">
                <div>
                  <div className="text-sm font-bold text-white">KI-Analysen & Heatmaps fertiggestellt</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Benachrichtigung erhalten, sobald die KI-Heatmap für ein abonniertes Spiel verarbeitet wurde.</div>
                </div>

                <div className="relative h-6 w-11 cursor-pointer rounded-full bg-zinc-700 transition-colors has-[:checked]:bg-primary">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={notifyAnalysis}
                    onChange={(e) => setNotifyAnalysis(e.target.checked)}
                  />
                  <span className="absolute inset-y-1 start-1 m-auto h-4 w-4 rounded-full bg-white transition-all peer-checked:start-6"></span>
                </div>
              </label>

              {/* Trainer Organizer Notifications */}
              <div className="border-t border-zinc-800 pt-4 mt-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Trainer Organizer & Kalender</h3>

                <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors">
                  <div>
                    <div className="text-sm font-bold text-white">Neue Termine & Spielplan-Importe</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Benachrichtigung (PWA & Mail) erhalten, wenn neue Spiele/Trainings eingetragen oder per fussball.de importiert werden.</div>
                  </div>

                  <div className="relative h-6 w-11 cursor-pointer rounded-full bg-zinc-700 transition-colors has-[:checked]:bg-primary">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={notifyOrganizerEvents}
                      onChange={(e) => setNotifyOrganizerEvents(e.target.checked)}
                    />
                    <span className="absolute inset-y-1 start-1 m-auto h-4 w-4 rounded-full bg-white transition-all peer-checked:start-6"></span>
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors">
                  <div>
                    <div className="text-sm font-bold text-white">Termin-Erinnerungen (24h vorher)</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Erinnert Sie automatisch am Vortag an anstehende Meisterschaftsspiele oder Trainingseinheiten.</div>
                  </div>

                  <div className="relative h-6 w-11 cursor-pointer rounded-full bg-zinc-700 transition-colors has-[:checked]:bg-primary">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={notifyOrganizerReminders}
                      onChange={(e) => setNotifyOrganizerReminders(e.target.checked)}
                    />
                    <span className="absolute inset-y-1 start-1 m-auto h-4 w-4 rounded-full bg-white transition-all peer-checked:start-6"></span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Einstellungen Speichern
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Teams */}
        {activeTab === 'teams' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-3">Zugewiesene Mannschaften</h2>
            {profile?.teams && profile.teams.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.teams.map((team: any) => (
                  <div key={team.id} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{team.name}</div>
                      {team.age_group && <div className="text-xs text-primary font-bold uppercase mt-0.5">{team.age_group}</div>}
                    </div>
                    <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                      Aktiv
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-sm">
                Keine Mannschaften zugewiesen. Wenden Sie sich an Ihren Administrator für Zuweisungen.
              </div>
            )}

            {/* Zuweisung anfragen */}
            <div className="pt-6 border-t border-zinc-800 space-y-4">
              <h3 className="text-md font-bold text-white">Weitere Mannschaft anfragen</h3>
              <p className="text-xs text-zinc-400">
                Wähle eine Mannschaft aus, für die du Freischaltung beantragen möchtest. Der Administrator wird per E-Mail benachrichtigt.
              </p>

              <form onSubmit={handleSendTeamRequest} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Mannschaft</label>
                  <select
                    value={requestTeamId}
                    onChange={(e) => setRequestTeamId(e.target.value)}
                    required
                    className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  >
                    <option value="">Mannschaft auswählen...</option>
                    {allTeams
                      .filter((t) => !profile?.teams?.some((pt: any) => pt.id === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.age_group ? `(${t.age_group})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nachricht (optional)</label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="z.B. Ich bin der neue Co-Trainer für diese Mannschaft."
                    rows={3}
                    className="w-full rounded-lg border-zinc-800 bg-zinc-950 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
                  />
                </div>

                {requestStatus && (
                  <div className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                    requestStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    {requestStatus.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{requestStatus.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sendingRequest || !requestTeamId}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-xs font-bold uppercase text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {sendingRequest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Anfrage senden
                </button>
              </form>
            </div>
          </div>
        )}

        {/* AI Settings Tab */}
        {activeTab === 'ai' && settings?.module_ai_assistant_enabled === true && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Persönliche KI-Einstellungen
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Hinterlege deinen eigenen API-Key (OpenAI oder Google Gemini) für Sprachbefehle und KI-Analysen.
              </p>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-2">KI-Anbieter wählen</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAiProvider('OPENAI')}
                    className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                      aiProvider === 'OPENAI' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    🤖 OpenAI (Whisper & GPT)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiProvider('GEMINI')}
                    className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                      aiProvider === 'GEMINI' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    ♊ Google Gemini (1.5 Flash)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">
                  {aiProvider === 'GEMINI' ? 'Google Gemini API Key' : 'OpenAI API Key'}
                </label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={aiProvider === 'GEMINI' ? 'AIzaSy...' : 'sk-proj-...'}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Der Schlüssel wird vertraulich gespeichert und exklusiv für deine KI-Sprachbefehle genutzt.
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>KI-Einstellungen Speichern</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Avatar Crop Modal */}
      <AvatarCropModal
        imageSrc={selectedImageSrc}
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
