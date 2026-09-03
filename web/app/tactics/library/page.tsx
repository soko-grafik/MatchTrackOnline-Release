"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Presentation,
  Plus,
  Search,
  Copy,
  Trash2,
  Layers,
  Filter
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/contexts/ToastContext';
import {
  getTacticsBoards,
  deleteTacticsBoard,
  duplicateTacticsBoard,
  getMediaUrl
} from '@/services/api';

export default function TacticsLibraryPage() {
  const router = useRouter();
  const { toast, confirm: confirmModal } = useToast();
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');

  const categories = [
    'Alle',
    'Aufstellung',
    'Offensive',
    'Defensive',
    'Standards',
    'Pressing',
    'Umschalten',
    'Allgemein'
  ];

  useEffect(() => {
    loadBoards();
  }, [selectedCategory]);

  const loadBoards = async () => {
    setLoading(true);
    try {
      const data = await getTacticsBoards({
        category: selectedCategory !== 'Alle' ? selectedCategory : undefined
      });
      if (Array.isArray(data)) {
        setBoards(data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Taktiken:', err);
      toast.error('Fehler beim Laden der Taktik-Bibliothek.');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const duplicated = await duplicateTacticsBoard(id);
      toast.success(`"${title}" erfolgreich dupliziert!`);
      setBoards((prev) => [duplicated, ...prev]);
    } catch (err) {
      console.error('Fehler beim Duplizieren:', err);
      toast.error('Fehler beim Duplizieren der Taktik.');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = await confirmModal({
      title: 'Taktiktafel löschen',
      message: `Möchtest du die Taktiktafel "${title}" wirklich unwiderruflich löschen?`,
      confirmText: 'Löschen',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await deleteTacticsBoard(id);
      toast.success(`"${title}" wurde gelöscht.`);
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      toast.error('Fehler beim Löschen der Taktiktafel.');
    }
  };

  const filteredBoards = boards.filter((b) => {
    const query = searchQuery.toLowerCase();
    const titleMatch = (b.title || '').toLowerCase().includes(query);
    const catMatch = (b.category || '').toLowerCase().includes(query);
    const teamMatch = (b.team_name || '').toLowerCase().includes(query);
    return titleMatch || catMatch || teamMatch;
  });

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 font-sans text-white">
      <Navbar />

      <main className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Taktik-Bibliothek & Spielzüge"
          subtitle="AUFSTELLUNGEN, PRESSINGABLÄUFE, STANDARDS & ANIMIERTE TAKTIKTAFELN"
          rightElement={
            <Link
              href="/tactics"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Neue Taktiktafel</span>
            </Link>
          }
        />

        {/* Top Filter & Search Actions Bar (Organizer-style) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          
          {/* Categories Pill Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
            <span className="hidden sm:inline text-xs font-bold text-zinc-400 uppercase tracking-wider me-1">
              Kategorie:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Taktiken durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl ps-9 pe-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>

        </div>

        {/* Boards Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs text-zinc-400">Lade gespeicherte Taktiken...</span>
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className="py-20 text-center space-y-4 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Presentation className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-white">Keine Taktiktafeln gefunden</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Erstelle deine erste interaktive Taktiktafel für Besprechungen und Spielzug-Planung.
              </p>
            </div>
            <Link
              href="/tactics"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Jetzt Taktiktafel öffnen
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredBoards.map((board) => (
              <div
                key={board.id}
                onClick={() => router.push(`/tactics?id=${board.id}`)}
                className="group relative flex flex-col rounded-3xl bg-zinc-900/60 border border-zinc-800/80 hover:border-indigo-500/40 hover:bg-zinc-900/90 shadow-xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.99]"
              >
                {/* Thumbnail Preview Area */}
                <div className="relative w-full aspect-video bg-zinc-950 border-b border-zinc-800 overflow-hidden flex items-center justify-center">
                  {board.thumbnail_path ? (
                    <img
                      src={getMediaUrl(board.thumbnail_path)}
                      alt={board.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2 text-zinc-600">
                      <Presentation className="w-8 h-8 opacity-40" />
                      <span className="text-[10px] font-mono font-semibold">Taktiktafel</span>
                    </div>
                  )}

                  {/* Category Badge Floating Top Left */}
                  <div className="absolute top-3 start-3">
                    <span className="px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[10px] font-bold text-indigo-300 backdrop-blur-md shadow-sm">
                      {board.category || 'Allgemein'}
                    </span>
                  </div>

                  {/* Number of Phases Floating Top Right */}
                  <div className="absolute top-3 end-3">
                    <span className="px-2 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-300 backdrop-blur-md shadow-sm flex items-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-400" />
                      {Array.isArray(board.frames_data) ? board.frames_data.length : 1} Phasen
                    </span>
                  </div>
                </div>

                {/* Card Content Info */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {board.title}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {board.description || 'Keine zusätzliche Beschreibung vorhanden.'}
                    </p>
                  </div>

                  {/* Meta Details & Action Buttons */}
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <span className="text-[11px] text-zinc-500">
                      {new Date(board.updated_at || board.created_at).toLocaleDateString('de-DE')}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleDuplicate(e, board.id, board.title)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-indigo-300 transition-colors"
                        title="Duplizieren"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, board.id, board.title)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
