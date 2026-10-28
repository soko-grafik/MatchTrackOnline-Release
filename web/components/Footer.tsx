"use client";

import React from 'react';
import Link from 'next/link';
import { Cookie, Download } from 'lucide-react';

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  const handleOpenCookieSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-cookie-settings'));
    }
  };

  return (
    <footer className={`w-full border-t border-gray-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80 py-4 px-4 sm:px-6 text-gray-500 dark:text-zinc-500 text-xs transition-colors backdrop-blur-xs ${className}`}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span>© {new Date().getFullYear()} MatchTrack Online</span>
          <span className="hidden sm:inline text-gray-300 dark:text-zinc-700">•</span>
          <span className="text-[11px] text-gray-400 dark:text-zinc-600 font-mono hidden sm:inline">
            Sportanalyse & Video-Scouting
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <Link
            href="/impressum"
            className="hover:text-emerald-600 text-gray-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            Impressum
          </Link>

          <Link
            href="/datenschutz"
            className="hover:text-emerald-600 text-gray-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            Datenschutz
          </Link>

          <Link
            href="/terms"
            className="hover:text-emerald-600 text-gray-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            Nutzungsbedingungen
          </Link>

          <a
            href="/downloads/MatchTrack.apk"
            download="MatchTrack.apk"
            className="hover:text-emerald-600 text-gray-600 dark:text-zinc-400 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors font-medium"
            title="MatchTrack Android App (APK) herunterladen"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Android App (APK)</span>
          </a>

          <button
            type="button"
            onClick={handleOpenCookieSettings}
            className="hover:text-emerald-600 text-gray-600 dark:text-zinc-400 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
            title="Cookie- und Speichereinstellungen anpassen"
          >
            <Cookie className="w-3 h-3 text-amber-500" />
            <span>Cookies</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
