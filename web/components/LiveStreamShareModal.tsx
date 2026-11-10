"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, MessageCircle, Mail, Copy, Check, Lock, Unlock, Eye, EyeOff, 
  ShieldCheck, Share2, AlertCircle, Video, Sliders, Film, Play, Pause, 
  Layers, Settings2, RefreshCw 
} from 'lucide-react';
import { api } from '@/services/api';

interface LiveStreamShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onOpenStitchModal?: () => void;
  onOpenRecordingsModal?: () => void;
}

export default function LiveStreamShareModal({
  isOpen,
  onClose,
  isAdmin,
  onOpenStitchModal,
  onOpenRecordingsModal
}: LiveStreamShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedRtmp, setCopiedRtmp] = useState<string | null>(null);

  // Settings
  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [streamTitle, setStreamTitle] = useState('MatchTrack Livestream');
  const [streamMode, setStreamMode] = useState<'multi_cam' | 'stitched'>('multi_cam');
  const [isPublished, setIsPublished] = useState(false);
  const [cam1Name, setCam1Name] = useState('Kamera 1 (Links)');
  const [cam2Name, setCam2Name] = useState('Kamera 2 (Rechts)');
  const [savePermanently, setSavePermanently] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const [shareUrl, setShareUrl] = useState('');
  const [host, setHost] = useState('');
  const [activeCamTab, setActiveCamTab] = useState<'cam1' | 'cam2'>('cam1');
  const [streamClientTab, setStreamClientTab] = useState<'dji' | 'obs'>('dji');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/live`);
      setHost(window.location.hostname);
    }
  }, []);

  useEffect(() => {
    if (isOpen && isAdmin) {
      loadAdminSettings();
    }
  }, [isOpen, isAdmin]);

  const loadAdminSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const res = await api.get('/admin/livestream');
      if (res.data) {
        setIsProtected(!!res.data.is_protected);
        setPassword(res.data.password || '');
        if (res.data.title) setStreamTitle(res.data.title);
        if (res.data.mode) setStreamMode(res.data.mode);
        setIsPublished(!!res.data.is_published);
        if (res.data.cam1_name) setCam1Name(res.data.cam1_name);
        if (res.data.cam2_name) setCam2Name(res.data.cam2_name);
        if (res.data.save_recording !== undefined) setSavePermanently(!!res.data.save_recording);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Livestream-Einstellungen:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const copyRtmpText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRtmp(id);
    setTimeout(() => setCopiedRtmp(null), 2000);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      await api.put('/admin/livestream', {
        is_protected: isProtected,
        password: isProtected ? password : '',
        title: streamTitle,
        mode: streamMode,
        is_published: isPublished,
        cam1_name: cam1Name,
        cam2_name: cam2Name,
        save_recording: savePermanently
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setSaveSuccess(false);
      setTimeout(() => setSaveSuccess(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(
    `Schau dir den Livestream auf MatchTrack an: ${streamTitle}${
      isProtected && password ? ` (Passwort: ${password})` : ''
    }`
  );

  const domain = host || 'matchtrack.de';
  const cam1RtmpUrl = `rtmp://${domain}:1935/live/cam1`;
  const cam2RtmpUrl = `rtmp://${domain}:1935/live/cam2`;
  const obsServerUrl = `rtmp://${domain}:1935/live`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl text-gray-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 p-4 shrink-0 bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Livestream Einstellungen & Teilen
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Verwalte Zugangsdaten, Kameras, Modus und Freigabe.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1">

          {/* Quick Sharing Channels */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-xs font-bold"
            >
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <span>WhatsApp</span>
            </a>

            <a
              href={`mailto:?subject=${encodeURIComponent(`MatchTrack Livestream: ${streamTitle}`)}&body=${encodedText}%0A%0A${encodedUrl}`}
              className="flex items-center justify-center gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-xs font-bold"
            >
              <Mail className="w-4 h-4 text-blue-500" />
              <span>E-Mail</span>
            </a>
          </div>

          {/* Direct Share Link */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Öffentlicher Zuschauer-Link
            </label>
            <div className="flex gap-2 rounded-xl border border-gray-300 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 p-1.5">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 truncate bg-transparent px-3 text-xs font-mono text-gray-800 dark:text-zinc-300 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-transparent hover:bg-gray-100 dark:hover:bg-zinc-700'
                }`}
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedLink ? 'Kopiert' : 'Kopieren'}</span>
              </button>
            </div>
          </div>

          {/* Admin Management Section */}
          {isAdmin && (
            <div className="border-t border-gray-200 dark:border-zinc-800 pt-5 space-y-5">
              
              {/* 1. Go-Live & Modus Switch */}
              <div className="space-y-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Zuschauer-Freigabe (Broadcast Go-Live)
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                      {isPublished ? 'Stream ist öffentlich freigegeben' : 'Zuschauer sehen Warteraum bis zur Freigabe'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPublished(!isPublished)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      isPublished ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isPublished ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Modus Auswahl */}
                <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-zinc-800">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                    Livestream-Modus
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStreamMode('multi_cam')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        streamMode === 'multi_cam'
                          ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500/40 text-blue-700 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Video className="h-3.5 w-3.5" /> Multi-Kamera
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">
                        Zuschauer schalten frei zwischen Kamera 1 & 2 um.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStreamMode('stitched')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        streamMode === 'stitched'
                          ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-500/40 text-purple-700 dark:text-purple-300'
                          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Layers className="h-3.5 w-3.5" /> Live-Stitching
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">
                        VPS stitcht 1 Panorama. Umschalter verborgen.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Stream Titel */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                    Stream Titel / Spielbezeichnung
                  </label>
                  <input
                    type="text"
                    value={streamTitle}
                    onChange={(e) => setStreamTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none"
                  />
                </div>

                {/* Aufnahme Speicher-Verhalten */}
                <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-zinc-800">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                    Aufnahme-Verhalten nach Stream-Ende
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSavePermanently(true)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        savePermanently
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="font-bold text-xs">💾 Dauerhaft speichern</div>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">
                        Stream bleibt auf dem Server für spätere Match-Analysen.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSavePermanently(false)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        !savePermanently
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-500/40 text-amber-700 dark:text-amber-300'
                          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="font-bold text-xs">🗑 Automatisch löschen</div>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">
                        Datei wird nach Abschluss gelöscht (schont VPS-Speicher).
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. RTMP Ingest Zugangsdaten für beide Kameras */}
              <div className="space-y-3 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/60">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Kamera RTMP-Zugangsdaten (Ingest)
                  </h4>
                  <div className="flex rounded-lg bg-gray-200 dark:bg-zinc-800 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setStreamClientTab('dji')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        streamClientTab === 'dji' ? 'bg-white dark:bg-zinc-900 text-primary shadow-xs' : 'text-gray-600 dark:text-zinc-400'
                      }`}
                    >
                      DJI Mimo
                    </button>
                    <button
                      type="button"
                      onClick={() => setStreamClientTab('obs')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        streamClientTab === 'obs' ? 'bg-white dark:bg-zinc-900 text-primary shadow-xs' : 'text-gray-600 dark:text-zinc-400'
                      }`}
                    >
                      OBS Studio
                    </button>
                  </div>
                </div>

                {/* Kamera Tabs */}
                <div className="flex border-b border-gray-200 dark:border-zinc-800 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCamTab('cam1')}
                    className={`pb-1.5 text-xs font-bold transition-all border-b-2 ${
                      activeCamTab === 'cam1' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-zinc-400'
                    }`}
                  >
                    📹 Kamera 1 (Links)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCamTab('cam2')}
                    className={`pb-1.5 text-xs font-bold transition-all border-b-2 ${
                      activeCamTab === 'cam2' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-zinc-400'
                    }`}
                  >
                    📹 Kamera 2 (Rechts)
                  </button>
                </div>

                {/* Zugangsdaten Box */}
                {streamClientTab === 'dji' ? (
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 block mb-0.5">
                        RTMP-URL für {activeCamTab === 'cam1' ? 'Kamera 1' : 'Kamera 2'}
                      </span>
                      <code className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate block select-all">
                        {activeCamTab === 'cam1' ? cam1RtmpUrl : cam2RtmpUrl}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyRtmpText(activeCamTab === 'cam1' ? cam1RtmpUrl : cam2RtmpUrl, `dji-${activeCamTab}`)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 text-xs font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-1"
                    >
                      {copiedRtmp === `dji-${activeCamTab}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedRtmp === `dji-${activeCamTab}` ? 'Kopiert' : 'Kopieren'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 block">OBS Server</span>
                        <code className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate block select-all">
                          {obsServerUrl}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyRtmpText(obsServerUrl, 'obs-server')}
                        className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white"
                      >
                        {copiedRtmp === 'obs-server' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 block">Stream-Schlüssel</span>
                        <code className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold block select-all">
                          {activeCamTab === 'cam1' ? 'cam1' : 'cam2'}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyRtmpText(activeCamTab === 'cam1' ? 'cam1' : 'cam2', `obs-key-${activeCamTab}`)}
                        className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white"
                      >
                        {copiedRtmp === `obs-key-${activeCamTab}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Passwortschutz */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/60">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${isProtected ? 'bg-amber-500/10 text-amber-500' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}>
                    {isProtected ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold">Passwortschutz für externe Zuschauer</h3>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                      Gäste müssen vor dem Abspielen ein Passwort eingeben.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsProtected(!isProtected)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    isProtected ? 'bg-primary' : 'bg-gray-200 dark:bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isProtected ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {isProtected && (
                <div className="space-y-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                      Zugangspasswort
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Passwort eingeben..."
                        className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 pr-20 text-xs font-mono text-gray-900 dark:text-white focus:outline-none"
                      />
                      <div className="absolute inset-y-0 right-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyPassword}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                        >
                          {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Speichern Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSaving ? 'Speichere...' : 'Einstellungen speichern'}</span>
                </button>

                {saveSuccess === true && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Gespeichert!
                  </span>
                )}
                {saveSuccess === false && (
                  <span className="text-xs font-bold text-red-500 animate-in fade-in">
                    Fehler beim Speichern
                  </span>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Schließen
          </button>
        </div>

      </div>
    </div>
  );
}
