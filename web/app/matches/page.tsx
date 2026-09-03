"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Play, UploadCloud, LayoutGrid, List } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import SecureDeleteModal from '@/components/SecureDeleteModal';
import EditMatchModal from '@/components/EditMatchModal';
import Navbar from '@/components/Navbar';
import FilterBar from '@/components/FilterBar';
import MatchCard from '@/components/MatchCard';
import MatchListItem from '@/components/MatchListItem';
import PageHeader from '@/components/PageHeader';
import AlertDialog from '@/components/AlertDialog';
import LiveStreamModal from '@/components/LiveStreamModal';
import { useMatches } from '@/hooks/useMatches';
import MatchDetailContent from './MatchDetailContent';

function MatchesMainContent() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get('id');

  if (matchId) {
    return <MatchDetailContent />;
  }

  return <MatchesListView />;
}

function MatchesListView() {
  const { user } = useAuth();
  const {
    filteredMatches,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filterSubscribed,
    setFilterSubscribed,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    handleDelete,
    handleEdit,
    handleToggleSubscription,
  } = useMatches();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gridCols, setGridCols] = useState<3 | 5 | 7>(5);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<any | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState<any | null>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('matchtrack_view_mode');
    if (savedMode === 'grid' || savedMode === 'list') {
      setViewMode(savedMode);
    }
    const savedCols = localStorage.getItem('matchtrack_grid_cols');
    if (savedCols) {
      const parsed = parseInt(savedCols, 10);
      if (parsed === 3 || parsed === 5 || parsed === 7) {
        setGridCols(parsed as 3 | 5 | 7);
      }
    }
  }, []);

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('matchtrack_view_mode', mode);
  };

  const handleSetGridCols = (cols: 3 | 5 | 7) => {
    setGridCols(cols);
    localStorage.setItem('matchtrack_grid_cols', cols.toString());
  };

  const onDeleteRequest = (e: React.MouseEvent, match: any) => {
    e.preventDefault();
    e.stopPropagation();
    setMatchToDelete(match);
    setIsDeleteModalOpen(true);
  };

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type?: 'info' | 'success' | 'warning' | 'error'; title?: string }>({
    isOpen: false,
    message: '',
    type: 'error'
  });

  const confirmDelete = async () => {
    if (!matchToDelete) return;
    try {
      await handleDelete(matchToDelete.id);
    } catch (err) {
      setAlertConfig({
        isOpen: true,
        message: "Fehler beim Löschen des Spiels.",
        type: 'error'
      });
    } finally {
      setIsDeleteModalOpen(false);
      setMatchToDelete(null);
    }
  };

  const onEditRequest = (e: React.MouseEvent, match: any) => {
    e.preventDefault();
    e.stopPropagation();
    setMatchToEdit(match);
    setIsEditModalOpen(true);
  };

  const confirmEdit = async (updatedData: any) => {
    if (!matchToEdit) return;
    try {
      await handleEdit(matchToEdit.id, updatedData);
    } catch (err) {
      setAlertConfig({
        isOpen: true,
        message: "Fehler beim Speichern der Änderungen.",
        type: 'error'
      });
    } finally {
      setIsEditModalOpen(false);
      setMatchToEdit(null);
    }
  };

  const getGridColsClass = () => {
    if (gridCols === 3) {
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6";
    }
    if (gridCols === 7) {
      return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-4";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6";
  };

  const [isLiveStreamModalOpen, setIsLiveStreamModalOpen] = useState(false);

  return (
    <div className="relative flex flex-col min-h-screen bg-zinc-950 text-white font-sans">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 pb-8">
        <div>
            <PageHeader
              title="Analyse & Spiele"
              subtitle="ÜBERSICHT ALLER SPIELE & ANALYSEN"
              rightElement={
                <button
                  onClick={() => setIsLiveStreamModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/20 transition-all active:scale-95 shadow-sm"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span>Livestream</span>
                </button>
              }
            />

            <FilterBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterSubscribed={filterSubscribed}
              setFilterSubscribed={setFilterSubscribed}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              sortBy={sortBy}
              setSortBy={setSortBy}
              viewMode={viewMode}
              setViewMode={handleSetViewMode}
              gridCols={gridCols}
              setGridCols={handleSetGridCols}
            />

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-2xl animate-spin mb-4"></div>
                <p className="text-zinc-500 animate-pulse">Lade Spieldaten...</p>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-red-400 max-w-md mx-auto text-center">
                <p className="font-semibold mb-2">Hoppla!</p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="py-32 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-600">
                <Play className="w-12 h-12 mb-4 opacity-20" />
                <p>{searchQuery || filterSubscribed ? 'Keine Spiele gefunden, die den Filtern entsprechen.' : 'Noch keine Spiele aufgezeichnet.'}</p>
                {(searchQuery || filterSubscribed) && (
                  <button
                    onClick={() => {setSearchQuery(''); setFilterSubscribed(false);}}
                    className="mt-4 text-blue-500 hover:underline text-sm font-medium"
                  >
                    Alle Filter zurücksetzen
                  </button>
                )}
              </div>
            ) : (
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  {viewMode === 'grid' ? (
                    <LayoutGrid className="w-5 h-5 text-zinc-500" />
                  ) : (
                    <List className="w-5 h-5 text-zinc-500" />
                  )}
                  <h2 className="text-xl font-semibold text-zinc-200">
                    {searchQuery || filterSubscribed ? 'Suchergebnisse' : 'Alle Spiele'}
                    <span className="ml-3 text-xs font-medium text-zinc-400 bg-zinc-800/50 px-2.5 py-0.5 rounded-2xl border border-zinc-700/50">
                      {filteredMatches.length}
                    </span>
                  </h2>
                </div>

                {viewMode === 'grid' ? (
                  <div className={getGridColsClass()}>
                    {filteredMatches.map(match => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        user={user}
                        onToggleSubscription={(e, match) => handleToggleSubscription(match)}
                        onEditRequest={onEditRequest}
                        onDeleteRequest={onDeleteRequest}
                        allowDelete={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMatches.map(match => (
                      <MatchListItem
                        key={match.id}
                        match={match}
                        user={user}
                        onToggleSubscription={(e, match) => handleToggleSubscription(match)}
                        onEditRequest={onEditRequest}
                        onDeleteRequest={onDeleteRequest}
                        allowDelete={true}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
        </div>

        <SecureDeleteModal
          isOpen={isDeleteModalOpen}
          title="Spiel endgültig löschen"
          message={`Bist du sicher, dass du das Spiel "${matchToDelete?.name || matchToDelete?.id}" löschen möchtest? Diese Aktion entfernt alle Daten, Kommentare und Video-Dateien unwiderruflich vom Server.`}
          onConfirm={confirmDelete}
          onCancel={() => setIsDeleteModalOpen(false)}
        />

        {matchToEdit && (
          <EditMatchModal
            isOpen={isEditModalOpen}
            onClose={() => { setIsEditModalOpen(false); setMatchToEdit(null); }}
            onSave={confirmEdit}
            match={matchToEdit}
          />
        )}

        <AlertDialog
          isOpen={alertConfig.isOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        />

        <LiveStreamModal
          isOpen={isLiveStreamModalOpen}
          onClose={() => setIsLiveStreamModalOpen(false)}
        />
      </main>
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    }>
      <MatchesMainContent />
    </Suspense>
  );
}

