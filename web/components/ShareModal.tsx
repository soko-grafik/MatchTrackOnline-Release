"use client";

import { X, MessageCircle, Mail, Copy, Check, Lock, Unlock, Eye, EyeOff, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchName: string;
  matchId: string;
  isPasswordProtected: boolean;
  currentPassword?: string;
  passwordExpiresAt?: string | null;
  onSavePasswordProtection: (isProtected: boolean, password?: string, expiresAt?: string | null) => Promise<void>;
}

export default function ShareModal({ 
  isOpen, 
  onClose, 
  matchName, 
  matchId,
  isPasswordProtected: initialIsPasswordProtected,
  currentPassword: initialCurrentPassword,
  passwordExpiresAt: initialPasswordExpiresAt,
  onSavePasswordProtection
}: ShareModalProps) {
  const [copied, setCheckCopied] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [isProtected, setIsProtected] = useState(initialIsPasswordProtected);
  const [password, setPassword] = useState(initialCurrentPassword || '');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    setIsProtected(initialIsPasswordProtected);
    setPassword(initialCurrentPassword || '');
    if (initialPasswordExpiresAt) {
      try {
        const d = new Date(initialPasswordExpiresAt);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setExpiresAt(formatted);
      } catch {
        setExpiresAt(null);
      }
    } else {
      setExpiresAt(null);
    }
  }, [initialIsPasswordProtected, initialCurrentPassword, initialPasswordExpiresAt]);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/matches?id=${matchId}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`Schau dir dieses Spiel auf MatchTracker an: ${matchName}`);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCheckCopied(true);
    setTimeout(() => setCheckCopied(false), 2000);
  };

  const handleSetPresetExpiry = (hours: number | null) => {
    if (hours === null) {
      setExpiresAt(null);
      return;
    }
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
    setExpiresAt(formatted);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      const isoExpiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;
      await onSavePasswordProtection(
        isProtected,
        isProtected ? password : undefined,
        isProtected ? isoExpiresAt : null
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (error) {
      console.error("Failed to save password protection:", error);
      setSaveSuccess(false);
      setTimeout(() => setSaveSuccess(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: <MessageCircle className="h-6 w-6 text-emerald-500" />,
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      color: 'hover:bg-emerald-500/10 border-zinc-800'
    },
    {
      name: 'E-Mail',
      icon: <Mail className="h-6 w-6 text-blue-500" />,
      href: `mailto:?subject=${encodeURIComponent(`MatchTracker: ${matchName}`)}&body=${encodedText}%0A%0A${encodedUrl}`,
      color: 'hover:bg-blue-500/10 border-zinc-800'
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 shrink-0">
          <h2 className="text-lg font-bold text-white">Spiel teilen & schützen</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Share Options */}
          <div className="grid grid-cols-2 gap-4">
            {shareOptions.map((option) => (
              <a
                key={option.name}
                href={option.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex flex-col items-center justify-center gap-3 rounded-xl border p-4 transition-all ${option.color} bg-zinc-900`}
              >
                <div className="transition-transform group-hover:scale-110">
                  {option.icon}
                </div>
                <span className="text-sm font-bold text-zinc-300 group-hover:text-white">{option.name}</span>
              </a>
            ))}
          </div>

          {/* Direct Link */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Direktlink kopieren</label>
            <div className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 truncate bg-transparent px-3 text-sm text-zinc-400 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition-colors ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
          </div>

          {/* Hinweis für externes Teilen */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-blue-200 block mb-0.5">Zugriff & Passwortschutz:</span>
              Angemeldete Benutzer mit Account haben direkten Zugriff auf alle Videos. Ein Passwort & Ablaufdatum greifen ausschließlich für **externe Personen ohne Benutzerkonto**.
            </div>
          </div>

          {/* Password Protection */}
          <div className="space-y-4 border-t border-zinc-800 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isProtected ? <Lock className="h-5 w-5 text-red-400" /> : <Unlock className="h-5 w-5 text-emerald-400" />}
                <label htmlFor="password-toggle" className="cursor-pointer text-sm font-bold text-white">
                  Passwortschutz aktivieren
                </label>
              </div>
              
              <label htmlFor="password-toggle" className="relative h-6 w-12 cursor-pointer rounded-full bg-zinc-700 transition-colors has-[:checked]:bg-primary">
                <input
                  type="checkbox"
                  id="password-toggle"
                  className="peer sr-only"
                  checked={isProtected}
                  onChange={(e) => setIsProtected(e.target.checked)}
                />
                <span className="absolute inset-y-1 start-1 m-auto h-4 w-4 rounded-full bg-white transition-all peer-checked:start-7"></span>
              </label>
            </div>

            {isProtected && (
              <div className="space-y-4 pt-2">
                {/* Passwort Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="match-password" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Passwort
                    </label>
                    {password && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(password);
                          setCopiedPass(true);
                          setTimeout(() => setCopiedPass(false), 2000);
                        }}
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        {copiedPass ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedPass ? 'Passwort kopiert!' : 'Passwort kopieren'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="match-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Passwort eingeben"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 pr-10 text-sm text-white shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                      title={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expiry Settings */}
                <div className="space-y-2 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Gültigkeit des externen Zugriffs
                    </span>
                    {expiresAt ? (
                      <span className="text-amber-400 text-[11px] font-mono">
                        Bis {new Date(expiresAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-emerald-400 text-[11px] font-mono">Unbegrenzt</span>
                    )}
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSetPresetExpiry(24)}
                      className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors border border-zinc-700/50"
                    >
                      24 Std.
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetExpiry(24 * 7)}
                      className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors border border-zinc-700/50"
                    >
                      7 Tage
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetExpiry(24 * 30)}
                      className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors border border-zinc-700/50"
                    >
                      30 Tage
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetExpiry(null)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
                        expiresAt === null
                          ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 font-bold'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700/50'
                      }`}
                    >
                      Nie
                    </button>
                  </div>

                  {/* Custom Datetime Input */}
                  <div className="pt-2">
                    <label htmlFor="custom-expiry-date" className="block text-[10px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-400" />
                      Individuelles Ablaufdatum & Uhrzeit:
                    </label>
                    <input
                      type="datetime-local"
                      id="custom-expiry-date"
                      value={expiresAt || ''}
                      onChange={(e) => setExpiresAt(e.target.value || null)}
                      className="w-full rounded-lg border border-zinc-700/70 bg-zinc-950 p-2 text-xs text-white shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-scheme-dark"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving || (isProtected && !password)}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition-colors ${
                isSaving
                  ? 'bg-primary/50 text-white cursor-not-allowed'
                  : saveSuccess === true
                    ? 'bg-emerald-600 text-white'
                    : saveSuccess === false
                      ? 'bg-red-600 text-white'
                      : 'bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
              ) : saveSuccess === true ? (
                <>
                  <Check className="h-4 w-4" /> Gespeichert!
                </>
              ) : saveSuccess === false ? (
                <>
                  <X className="h-4 w-4" /> Fehler!
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Einstellungen speichern
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
