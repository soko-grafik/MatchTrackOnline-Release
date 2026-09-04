"use client";

import Link from 'next/link';
import { Cookie, Shield, Scale } from 'lucide-react';

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
    <footer className={`w-full border-t border-zinc-900 bg-zinc-950/80 py-4 px-4 sm:px-6 text-zinc-500 text-xs ${className}`}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span>© {new Date().getFullYear()} MatchTrack Online</span>
          <span className="hidden sm:inline text-zinc-700">•</span>
          <span className="text-[11px] text-zinc-600 font-mono hidden sm:inline">Sportanalyse & Video-Scouting</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <Link
            href="/impressum"
            className="hover:text-primary text-zinc-400 transition-colors"
          >
            Impressum
          </Link>

          <Link
            href="/datenschutz"
            className="hover:text-primary text-zinc-400 transition-colors"
          >
            Datenschutz
          </Link>

          <Link
            href="/terms"
            className="hover:text-primary text-zinc-400 transition-colors"
          >
            Nutzungsbedingungen
          </Link>

          <button
            type="button"
            onClick={handleOpenCookieSettings}
            className="hover:text-primary text-zinc-400 flex items-center gap-1 transition-colors"
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
