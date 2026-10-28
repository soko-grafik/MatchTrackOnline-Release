"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, ShieldCheck, Check, Settings2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';

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
    const stored = localStorage.getItem('matchtrack_cookie_consent');
    if (!stored) {
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
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-3 sm:p-6 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="w-full max-w-xl rounded-2xl bg-white border border-gray-200 shadow-2xl p-5 sm:p-7 space-y-4 sm:space-y-5 text-gray-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 animate-in zoom-in-95 duration-200">
        {/* Banner Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/50 dark:border-emerald-800/60 dark:text-emerald-400 shrink-0">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Datenschutz- & Speichereinstellungen
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Transparenzhinweis gem. § 25 TDDDG & Art. 6 DSGVO
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAcceptNecessary}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            title="Schließen & nur Notwendige akzeptieren"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed">
          MatchTrack nutzt lokale Browser-Speichertechnologien (<code className="text-emerald-600 dark:text-emerald-400 font-mono">localStorage</code>, <code className="text-emerald-600 dark:text-emerald-400 font-mono">sessionStorage</code>, <code className="text-emerald-600 dark:text-emerald-400 font-mono">ServiceWorker Cache</code>), um deine Anmeldung zu sichern, Spielanalysen bereitzustellen und die Plattform technisch zuverlässig zu betreiben.
        </p>

        {/* Detailed Category Settings */}
        {showDetails && (
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-zinc-800 animate-in fade-in">
            {/* 1. Necessary (Locked) */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 dark:bg-zinc-800/40 dark:border-zinc-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Technisch notwendig & essenziell</span>
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                    Immer aktiv
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                  Erforderlich für Login-Authentifizierung (JWT), sichere Sitzungen, PWA-Funktionalität und Plattform-Sicherheit.
                </p>
              </div>
              <div className="p-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Check className="w-5 h-5" />
              </div>
            </div>

            {/* 2. Functional */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 dark:bg-zinc-800/40 dark:border-zinc-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                  <Settings2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Komfort & Präferenzen</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                  Speichert deine bevorzugten Video-Player-Einstellungen (Lautstärke, Perspektive) und UI-Filter für ein optimales Nutzungserlebnis.
                </p>
              </div>
              <div className="shrink-0 mt-0.5">
                <Switch
                  checked={functional}
                  onChange={(e) => setFunctional(e.target.checked)}
                  aria-label="Komfort & Präferenzen aktivieren"
                />
              </div>
            </div>

            {/* 3. Analytics */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 dark:bg-zinc-800/40 dark:border-zinc-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                  <Cookie className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Statistiken & Plattformverbesserung</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                  Hilft Administratoren dabei, die Nutzung der Analysemodule aggregiert nachzuvollziehen, um MatchTrack kontinuierlich weiterzuentwickeln.
                </p>
              </div>
              <div className="shrink-0 mt-0.5">
                <Switch
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  aria-label="Statistiken & Plattformverbesserung aktivieren"
                />
              </div>
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
                className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                Auswahl speichern
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
                >
                  Alle akzeptieren
                </button>
                <button
                  type="button"
                  onClick={handleAcceptNecessary}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-lg bg-gray-100 hover:bg-gray-200/80 border border-gray-300 text-gray-800 text-xs font-semibold dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 dark:text-zinc-200 transition-all active:scale-95 cursor-pointer"
                >
                  Nur notwendige
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full sm:w-auto py-2.5 px-3 rounded-lg bg-gray-100 hover:bg-gray-200/80 border border-gray-200 text-gray-700 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{showDetails ? 'Weniger anzeigen' : 'Anpassen'}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <Link href="/datenschutz" target="_blank" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors underline">
              Datenschutzerklärung
            </Link>
            <Link href="/impressum" target="_blank" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors underline">
              Impressum
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
