"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, ShieldCheck, Check, Settings2, X, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsentState {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
}

export default function CookieConsentBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    // Check if consent is already recorded
    const stored = localStorage.getItem('matchtrack_cookie_consent');
    if (!stored) {
      // Delay showing banner slightly for smooth UX
      const timer = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(timer);
    } else {
      try {
        const parsed: ConsentState = JSON.parse(stored);
        setFunctional(!!parsed.functional);
        setAnalytics(!!parsed.analytics);
      } catch (e) {
        setIsOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    // Listen to manual open trigger from Footer / Privacy page
    const handleOpenSettings = () => {
      setShowDetails(true);
      setIsOpen(true);
    };

    window.addEventListener('open-cookie-settings', handleOpenSettings);
    return () => window.removeEventListener('open-cookie-settings', handleOpenSettings);
  }, []);

  const saveConsent = (allowFunctional: boolean, allowAnalytics: boolean) => {
    const consent: ConsentState = {
      necessary: true,
      functional: allowFunctional,
      analytics: allowAnalytics,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('matchtrack_cookie_consent', JSON.stringify(consent));
    setFunctional(allowFunctional);
    setAnalytics(allowAnalytics);
    setIsOpen(false);
    setShowDetails(false);

    // Dispatch event so analytics modules know consent status
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: consent }));
  };

  const handleAcceptAll = () => {
    saveConsent(true, true);
  };

  const handleAcceptNecessary = () => {
    saveConsent(false, false);
  };

  const handleSaveCustom = () => {
    saveConsent(functional, analytics);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="w-full max-w-xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-7 space-y-5 text-white animate-in zoom-in-95 duration-200">
        {/* Banner Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Datenschutz- & Speichereinstellungen
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Transparenzhinweis gem. § 25 TDDDG & Art. 6 DSGVO
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAcceptNecessary}
            className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors"
            title="Schließen & nur Notwendige akzeptieren"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-300 leading-relaxed">
          MatchTrack nutzt lokale Browser-Speichertechnologien (<code className="text-emerald-400 font-mono">localStorage</code>, <code className="text-emerald-400 font-mono">sessionStorage</code>, <code className="text-emerald-400 font-mono">ServiceWorker Cache</code>), um deine Anmeldung zu sichern, Spielanalysen bereitzustellen und die Plattform technisch zuverlässig zu betreiben.
        </p>

        {/* Detailed Category Settings */}
        {showDetails && (
          <div className="space-y-3 pt-2 border-t border-zinc-800/80 animate-in fade-in">
            {/* 1. Necessary (Locked) */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Technisch notwendig & essenziell</span>
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Immer aktiv
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Erforderlich für Login-Authentifizierung (JWT), sichere Sitzungen, PWA-Funktionalität und Plattform-Sicherheit.
                </p>
              </div>
              <div className="p-1 text-emerald-400">
                <Check className="w-5 h-5" />
              </div>
            </div>

            {/* 2. Functional */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Settings2 className="w-4 h-4 text-blue-400" />
                  <span>Komfort & Präferenzen</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Speichert deine bevorzugten Video-Player-Einstellungen (Lautstärke, Perspektive) und UI-Filter für ein optimales Nutzungserlebnis.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={functional}
                  onChange={(e) => setFunctional(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* 3. Analytics */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Cookie className="w-4 h-4 text-purple-400" />
                  <span>Statistiken & Plattformverbesserung</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Hilft Administratoren dabei, die Nutzung der Analysemodule aggregiert nachzuvollziehen, um MatchTrack kontinuierlich weiterzuentwickeln.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        )}

        {/* Footer & Actions */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {showDetails ? (
              <button
                type="button"
                onClick={handleSaveCustom}
                className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                Auswahl speichern
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
                >
                  Alle akzeptieren
                </button>
                <button
                  type="button"
                  onClick={handleAcceptNecessary}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all active:scale-95"
                >
                  Nur notwendige
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5"
            >
              <span>{showDetails ? 'Weniger anzeigen' : 'Anpassen'}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/60">
            <Link href="/datenschutz" target="_blank" className="hover:text-primary transition-colors underline">
              Datenschutzerklärung
            </Link>
            <Link href="/impressum" target="_blank" className="hover:text-primary transition-colors underline">
              Impressum
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
