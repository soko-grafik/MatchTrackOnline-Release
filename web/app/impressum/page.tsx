"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { getPublicLegalPages } from '@/services/api';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { ChevronLeft, Edit3, Printer, Building, Scale } from 'lucide-react';

export default function ImpressumPage() {
  const { user } = useAuth();
  const [imprintContent, setImprintContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicLegalPages()
      .then((data) => {
        if (data && data.imprint_content) {
          setImprintContent(data.imprint_content);
        }
      })
      .catch((err) => {
        console.error('Fehler beim Laden des Impressums:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-primary/30 selection:text-white">
      {/* Top Bar Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Zurück zur Startseite"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>

            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo_light_wide_full.png"
                alt="MatchTrack"
                width={130}
                height={30}
                className="object-contain h-5 w-auto"
                priority
              />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Seite drucken"
            >
              <Printer className="w-4 h-4" />
            </button>

            {isAdmin && (
              <Link
                href="/admin/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 text-xs font-bold transition-all shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Als Admin bearbeiten</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800/80 text-primary">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
              <Building className="w-6 h-6 text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gesetzliche Pflichtangaben</span>
              <h1 className="text-xl sm:text-2xl font-black text-white">Impressum</h1>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
              <p className="text-xs text-zinc-400">Lade Impressum...</p>
            </div>
          ) : (
            <MarkdownRenderer content={imprintContent} className="space-y-4" />
          )}

          {/* Legal Navigation Links */}
          <div className="mt-12 pt-6 border-t border-zinc-800 flex flex-wrap gap-4 justify-between items-center text-xs text-zinc-500">
            <span>© {new Date().getFullYear()} MatchTrack Online</span>
            <div className="flex gap-4">
              <Link href="/datenschutz" className="hover:text-primary transition-colors">Datenschutzerklärung</Link>
              <Link href="/terms" className="hover:text-primary transition-colors">Nutzungsbedingungen</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
