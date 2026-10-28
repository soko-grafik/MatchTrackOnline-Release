"use client";

import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Mail, Copy, Check, Lock, Unlock, Eye, EyeOff, ShieldCheck, Share2, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';

interface LiveStreamShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

export default function LiveStreamShareModal({
  isOpen,
  onClose,
  isAdmin
}: LiveStreamShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [streamTitle, setStreamTitle] = useState('MatchTrack Livestream');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/live`);
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

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      await api.put('/admin/livestream', {
        is_protected: isProtected,
        password: isProtected ? password : '',
        title: streamTitle
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

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl text-gray-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 p-4 shrink-0">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold">Livestream teilen & schützen</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Share Channels */}
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
            <p className="text-[11px] text-gray-500 dark:text-zinc-500">
              Dieser Link führt direkt zum Web-Player. Externe Zuschauer benötigen keinen Account.
            </p>
          </div>

          {/* Admin: Password Protection Section */}
          {isAdmin ? (
            <div className="border-t border-gray-200 dark:border-zinc-800 pt-5 space-y-4">
              <div className="flex items-center justify-between">
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

                {/* Switch Toggle */}
                <button
                  type="button"
                  onClick={() => setIsProtected(!isProtected)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
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
                        className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 pr-20 text-xs font-mono text-gray-900 dark:text-white focus:border-primary focus:outline-none"
                      />
                      <div className="absolute inset-y-0 right-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                          title={showPassword ? 'Verbergen' : 'Anzeigen'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyPassword}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                          title="Passwort kopieren"
                        >
                          {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isSaving ? 'Speichere...' : 'Schutz aktualisieren'}</span>
                    </button>

                    {saveSuccess === true && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                        Gespeichert!
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
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Du kannst den obigen Link kopieren und an Freunde, Familie oder Fans weiterleiten, um den Stream gemeinsam live anzusehen.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
