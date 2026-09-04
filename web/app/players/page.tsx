"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import ConfirmModal from '@/components/ConfirmModal';
import AlertDialog from '@/components/AlertDialog';
import { 
  Users, UserPlus, Upload, Search, Filter, MoveRight, 
  Trash2, Edit3, Shield, Star, Calendar, ArrowUpDown, Check, FileSpreadsheet, Eye, Gift, Printer, Download, MoreVertical
} from 'lucide-react';
import { getPlayers, createPlayer, updatePlayer, deletePlayer, transferPlayerTeam, importDfbCsv, getTeams, getMyTeams, syncBirthdaysToOrganizer, getMediaUrl } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

export default function PlayersPage() {
  const { user } = useAuth();
  const { toast, confirm: confirmModal } = useToast();

  const userRole = user?.role?.toUpperCase() || '';
  const isAdmin = userRole === 'ADMIN';

  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Check if current user has edit permission for the selected team
  const canEditCurrentTeam = (() => {
    if (isAdmin) return true;
    if (!user || !user.teams) return false;
    if (selectedTeamId === 'ALL') {
      // If ALL is selected, check if user has edit rights on ANY team
      return user.teams.some((t: any) => t.can_edit !== false);
    }
    const t = user.teams.find((item: any) => item.id === selectedTeamId);
    return t ? t.can_edit !== false : false;
  })();

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isMoreActionsMenuOpen, setIsMoreActionsMenuOpen] = useState(false);
  const moreActionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreActionsMenuOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      const target = e.target as Node;
      if (isMoreActionsMenuOpen && moreActionsMenuRef.current && !moreActionsMenuRef.current.contains(target)) {
        setIsMoreActionsMenuOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreActionsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside, true);
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true);
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMoreActionsMenuOpen]);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [selectedPlayerForTransfer, setSelectedPlayerForTransfer] = useState<any>(null);
  const [targetTeamId, setTargetTeamId] = useState<string>('');

  // Delete Confirm Modal
  const [deletePlayerId, setDeletePlayerId] = useState<string | null>(null);

  // Alert State
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  // New Player Form State
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newNat, setNewNat] = useState('D');
  const [newDfbId, setNewDfbId] = useState('');
  const [newJerseyNumber, setNewJerseyNumber] = useState('');
  const [newPosition, setNewPosition] = useState('Feldspieler');
  const [newTeamId, setNewTeamId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // DFB CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importTeamId, setImportTeamId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [selectedTeamId, searchQuery]);

  const fetchInitialData = async () => {
    setLoading(true);
    let defaultTeamId = 'ALL';
    try {
      const fetchedTeams = await getMyTeams();
      setTeams(fetchedTeams || []);
      if (fetchedTeams && fetchedTeams.length > 0) {
        // Find first team with write permissions for trainer
        const firstEditableTeam = fetchedTeams.find((t: any) => Boolean(t.can_edit));
        if (firstEditableTeam) {
          defaultTeamId = firstEditableTeam.id;
        } else {
          defaultTeamId = fetchedTeams[0].id;
        }

        if (firstEditableTeam) {
          setSelectedTeamId(defaultTeamId);
        }

        setNewTeamId(defaultTeamId);
        setImportTeamId(defaultTeamId);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    }
    await fetchPlayers(defaultTeamId);
    setLoading(false);
  };

  const fetchPlayers = async (teamIdOverride?: string) => {
    try {
      const effectiveTeamId = teamIdOverride !== undefined ? teamIdOverride : selectedTeamId;
      const data = await getPlayers({
        team_id: effectiveTeamId === 'ALL' ? undefined : effectiveTeamId,
        search: searchQuery || undefined
      });
      setPlayers(data || []);
    } catch (err) {
      console.error("Failed to fetch players:", err);
    }
  };
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedPlayers = [...players].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';
    if (sortColumn === 'name') {
      valA = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
      valB = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
    } else if (sortColumn === 'number') {
      valA = a.jersey_number !== undefined && a.jersey_number !== null ? Number(a.jersey_number) : 999;
      valB = b.jersey_number !== undefined && b.jersey_number !== null ? Number(b.jersey_number) : 999;
    } else if (sortColumn === 'team') {
      valA = (a.team_name || '').toLowerCase();
      valB = (b.team_name || '').toLowerCase();
    } else if (sortColumn === 'position') {
      valA = (a.position || '').toLowerCase();
      valB = (b.position || '').toLowerCase();
    } else if (sortColumn === 'dfb_id') {
      valA = (a.dfb_id || '').toLowerCase();
      valB = (b.dfb_id || '').toLowerCase();
    } else if (sortColumn === 'attendance') {
      valA = a.attendance_rate !== undefined ? a.attendance_rate : 100;
      valB = b.attendance_rate !== undefined ? b.attendance_rate : 100;
    } else if (sortColumn === 'rating') {
      valA = a.latest_rating ? Number(a.latest_rating) : 0;
      valB = b.latest_rating ? Number(b.latest_rating) : 0;
    } else if (sortColumn === 'eval_date') {
      valA = a.latest_eval_date || '';
      valB = b.latest_eval_date || '';
    }
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const exportToExcel = () => {
    if (sortedPlayers.length === 0) {
      toast.info('Keine Spieler zum Exportieren vorhanden.');
      return;
    }

    const headers = ['Rückennummer', 'Vorname', 'Nachname', 'Mannschaft', 'Position', 'DFB Passnummer', 'Geburtsdatum', 'Anwesenheit %', 'Letzte Note', 'Nationalität'];
    const csvRows = [headers.join(';')];

    sortedPlayers.forEach(p => {
      const row = [
        p.jersey_number || '',
        `"${p.first_name || ''}"`,
        `"${p.last_name || ''}"`,
        `"${p.team_name || ''}"`,
        `"${p.position || ''}"`,
        `"${p.dfb_id || ''}"`,
        `"${p.date_of_birth || ''}"`,
        `${p.attendance_rate !== undefined ? p.attendance_rate : 100}%`,
        p.latest_rating || '',
        `"${p.nationality || ''}"`
      ];
      csvRows.push(row.join(';'));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Spielerkader_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Excel/CSV Export erfolgreich heruntergeladen!');
  };

  const handlePrintRoster = () => {
    window.print();
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newLastName) {
      setAlertConfig({ isOpen: true, message: "Bitte Vorname und Nachname eingeben.", type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await createPlayer({
        first_name: newFirstName,
        last_name: newLastName,
        date_of_birth: newDob || null,
        nationality: newNat || 'D',
        dfb_id: newDfbId || null,
        jersey_number: newJerseyNumber ? parseInt(newJerseyNumber) : null,
        position: newPosition,
        team_id: newTeamId || null,
        notes: newNotes || null
      });

      setAlertConfig({ isOpen: true, message: `Spieler ${newFirstName} ${newLastName} erfolgreich angelegt!`, type: 'success' });
      setIsCreateModalOpen(false);
      resetCreateForm();
      fetchPlayers();
    } catch (err) {
      console.error("Error creating player:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Anlegen des Spielers.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetCreateForm = () => {
    setNewFirstName('');
    setNewLastName('');
    setNewDob('');
    setNewNat('D');
    setNewDfbId('');
    setNewJerseyNumber('');
    setNewPosition('Feldspieler');
    setNewNotes('');
  };

  const openEditPlayerModal = (player: any) => {
    setEditingPlayerId(player.id);
    setNewFirstName(player.first_name || '');
    setNewLastName(player.last_name || '');
    setNewDob(player.date_of_birth || '');
    setNewNat(player.nationality || 'D');
    setNewDfbId(player.dfb_id || '');
    setNewJerseyNumber(player.jersey_number ? String(player.jersey_number) : '');
    setNewPosition(player.position || 'Feldspieler');
    setNewTeamId(player.team_id || (teams[0]?.id || ''));
    setNewNotes(player.notes || '');
    setIsEditModalOpen(true);
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayerId || !newFirstName || !newLastName) return;

    setIsSaving(true);
    try {
      await updatePlayer(editingPlayerId, {
        first_name: newFirstName,
        last_name: newLastName,
        date_of_birth: newDob || null,
        nationality: newNat || 'D',
        dfb_id: newDfbId || null,
        jersey_number: newJerseyNumber ? parseInt(newJerseyNumber) : null,
        position: newPosition,
        team_id: newTeamId || null,
        notes: newNotes || null
      });

      setAlertConfig({ isOpen: true, message: `Spieler ${newFirstName} ${newLastName} erfolgreich aktualisiert!`, type: 'success' });
      setIsEditModalOpen(false);
      setEditingPlayerId(null);
      resetCreateForm();
      fetchPlayers();
    } catch (err) {
      console.error("Error updating player:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Aktualisieren des Spielers.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedPlayerForTransfer || !targetTeamId) return;

    try {
      await transferPlayerTeam(selectedPlayerForTransfer.id, targetTeamId);
      const targetTeam = teams.find(t => t.id === targetTeamId);
      setAlertConfig({
        isOpen: true,
        message: `${selectedPlayerForTransfer.first_name} ${selectedPlayerForTransfer.last_name} wurde erfolgreich in die Mannschaft '${targetTeam?.name || targetTeamId}' verschoben.`,
        type: 'success'
      });
      setIsTransferModalOpen(false);
      setSelectedPlayerForTransfer(null);
      fetchPlayers();
    } catch (err) {
      console.error("Failed to transfer player:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Verschieben des Spielers.", type: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletePlayerId) return;

    try {
      await deletePlayer(deletePlayerId);
      setAlertConfig({ isOpen: true, message: "Spieler erfolgreich gelöscht.", type: 'success' });
      setDeletePlayerId(null);
      fetchPlayers();
    } catch (err) {
      console.error("Failed to delete player:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Löschen des Spielers.", type: 'error' });
    }
  };

  const handleDfbCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile || !importTeamId) {
      setAlertConfig({ isOpen: true, message: "Bitte wähle eine CSV-Datei und eine Ziel-Mannschaft aus.", type: 'error' });
      return;
    }

    setIsImporting(true);
    try {
      const res = await importDfbCsv(importTeamId, csvFile);
      setAlertConfig({
        isOpen: true,
        message: res.message || "DFB.net CSV Import erfolgreich abgeschlossen!",
        type: 'success'
      });
      setIsImportModalOpen(false);
      setCsvFile(null);
      fetchPlayers();
    } catch (err: any) {
      console.error("Failed to import CSV:", err);
      setAlertConfig({
        isOpen: true,
        message: err.response?.data?.detail || "Fehler beim Importieren der DFB.net CSV-Datei.",
        type: 'error'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSyncBirthdays = async () => {
    try {
      const res = await syncBirthdaysToOrganizer();
      setAlertConfig({
        isOpen: true,
        message: res.message || "Geburtstage erfolgreich in den Organizer übertragen!",
        type: 'success'
      });
    } catch (err) {
      console.error("Failed to sync birthdays:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Synchronisieren der Geburtstage.", type: 'error' });
    }
  };

  const renderEvaluationTrafficLight = (evalDateStr?: string) => {
    if (!evalDateStr) {
      return (
        <span className="inline-flex items-center gap-1.5 text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          Keine Einschätzung
        </span>
      );
    }

    const evalDate = new Date(evalDateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - evalDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const formattedDate = evalDate.toLocaleDateString('de-DE');

    if (diffDays <= 30) {
      // <= 1 month (30 days): Green text
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-xs" title={`Eingeschätzt am ${formattedDate} (${diffDays} Tage her)`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          {formattedDate}
        </span>
      );
    } else if (diffDays <= 90) {
      // > 1 month & <= 3 months (90 days): Orange text
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-xs" title={`Eingeschätzt am ${formattedDate} (${diffDays} Tage her)`}>
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          {formattedDate}
        </span>
      );
    } else {
      // > 3 months (90 days): Red text
      return (
        <span className="inline-flex items-center gap-1.5 text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg text-xs" title={`Eingeschätzt am ${formattedDate} (${diffDays} Tage her - älter als 3 Monate)`}>
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          {formattedDate}
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-primary selection:text-white">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Kader & Spielerliste"
          subtitle="KADER VERWALTEN, DFB.NET CSV IMPORTIEREN & BEWERTUNGEN FÜHREN"
          rightElement={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-primary/20"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Neuer Spieler</span>
              </button>

              {/* 3-Dots Dropdown für weitere Aktionen */}
              <div className="relative" ref={moreActionsMenuRef}>
                <button
                  onClick={() => setIsMoreActionsMenuOpen(!isMoreActionsMenuOpen)}
                  className="p-2 sm:p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center"
                  title="Optionen & Aktionen"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {isMoreActionsMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 z-[110] space-y-1 text-xs font-semibold">
                    <button
                      onClick={() => {
                        setIsMoreActionsMenuOpen(false);
                        setIsImportModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 transition-all text-left"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>DFB.net CSV Import</span>
                    </button>

                    <div className="my-1 border-t border-zinc-800" />

                    <button
                      onClick={() => {
                        setIsMoreActionsMenuOpen(false);
                        handleSyncBirthdays();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-amber-300 hover:bg-zinc-800 transition-all text-left"
                    >
                      <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>🎂 Geburtstage in Organizer</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMoreActionsMenuOpen(false);
                        exportToExcel();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-emerald-400 hover:bg-zinc-800 transition-all text-left"
                    >
                      <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Excel Export</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMoreActionsMenuOpen(false);
                        handlePrintRoster();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-blue-400 hover:bg-zinc-800 transition-all text-left"
                    >
                      <Printer className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>PDF Drucken</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          }
        />

        {/* Filters & Search Toolbar */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Team Filter Pills (Flex-Wrap on Mobile so no horizontal scroll needed) */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setSelectedTeamId('ALL')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all ${
                selectedTeamId === 'ALL'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              Alle Mannschaften ({players.length})
            </button>

            {teams.map((t) => {
              const ut = user?.teams?.find((item: any) => item.id === t.id);
              const isEditableTeam = ut ? Boolean(ut.can_edit) : Boolean(t.can_edit);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                    selectedTeamId === t.id
                      ? 'bg-primary border-primary text-white shadow-md shadow-primary/20'
                      : 'bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <span>{t.name}</span>
                  {isEditableTeam && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0 inline-block ml-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name oder DFB-Passnummer suchen..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Players List View (Listen- & Tabellenansicht) */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <p className="text-zinc-500 text-sm mt-3">Lade Spielerliste...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-12 text-center">
            <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Keine Spieler gefunden</h3>
            <p className="text-zinc-400 text-xs max-w-md mx-auto mb-6">
              Es wurden noch keine Spieler für diesen Filter angelegt. Du kannst neue Spieler manuell erstellen oder direkt aus DFB.net per CSV importieren.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                DFB.net CSV Import
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Neuer Spieler
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile Cards Grid View (< md / 768px, optimized for Pixel 6a & smartphones) */}
            <div className="grid grid-cols-1 gap-3.5 md:hidden">
              {sortedPlayers.map((player) => (
                <div
                  key={`card_${player.id}`}
                  className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3.5 backdrop-blur-md"
                >
                  {/* Card Header: Avatar/Jersey, Name, Team & Direct Actions */}
                  {(() => {
                    const canEditThisPlayer = (() => {
                      if (!player.team_id) return true;
                      const tLoaded = teams.find((item: any) => item.id === player.team_id);
                      if (tLoaded) return Boolean(tLoaded.can_edit);
                      const tUser = user?.teams?.find((item: any) => item.id === player.team_id);
                      if (tUser) return Boolean(tUser.can_edit);
                      return isAdmin;
                    })();

                    return (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/players/${player.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-primary shrink-0 relative overflow-hidden">
                              {player.profile_image_url ? (
                                <img
                                  src={getMediaUrl(player.profile_image_url)}
                                  alt={player.first_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-base font-extrabold">
                                  {player.jersey_number ? `#${player.jersey_number}` : player.first_name[0]}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-white truncate hover:text-primary transition-colors">
                                {player.first_name} {player.last_name}
                              </h3>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold mt-0.5">
                                <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 inline-flex items-center gap-1">
                                  <span>{player.team_name || 'Kein Team'}</span>
                                  {canEditThisPlayer && <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0 inline-block ml-0.5" />}
                                </span>
                                <span>• {player.position || 'Feldspieler'}</span>
                              </div>
                            </div>
                          </Link>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Link
                              href={`/players/${player.id}`}
                              className="p-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl font-bold text-xs"
                              title="Profil öffnen"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            {canEditThisPlayer && (
                              <button
                                onClick={() => openEditPlayerModal(player)}
                                className="p-2 bg-zinc-800 text-zinc-400 hover:text-amber-400 rounded-xl"
                                title="Bearbeiten"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Mini Stats Footer: Attendance Rate, Latest Rating & Rating Date */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/60">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                            {player.attendance_rate !== undefined ? `${player.attendance_rate}%` : '100%'} Quote
                          </span>

                          {player.latest_rating ? (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400" /> {player.latest_rating}/10
                            </span>
                          ) : null}
                        </div>

                        <div>
                          {renderEvaluationTrafficLight(player.latest_eval_date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

            {/* Desktop Table View (>= md / 768px) */}
            <div className="hidden md:block bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/80 border-b border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400 select-none">
                      <th onClick={() => handleSort('number')} className="py-4 px-4 text-center w-12 cursor-pointer hover:text-white transition-colors">
                        <div className="flex items-center justify-center gap-1">
                          <span>#</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('name')} className="py-4 px-4 cursor-pointer hover:text-white transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>Spieler / Name</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('team')} className="py-4 px-4 cursor-pointer hover:text-white transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>Mannschaft</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('position')} className="py-4 px-4 cursor-pointer hover:text-white transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>Position</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('dfb_id')} className="py-4 px-4 cursor-pointer hover:text-white transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>DFB-Passnummer</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('attendance')} className="py-4 px-4 text-center cursor-pointer hover:text-white transition-colors">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Gesamt %</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('rating')} className="py-4 px-4 text-center cursor-pointer hover:text-white transition-colors">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Letzte Note</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('eval_date')} className="py-4 px-4 text-center cursor-pointer hover:text-white transition-colors">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Zuletzt eingeschätzt</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                        </div>
                      </th>
                      <th className="py-4 px-4 text-right pr-6">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {sortedPlayers.map((player) => (
                      <tr
                        key={player.id}
                        className="group hover:bg-zinc-800/40 transition-colors"
                      >
                        {/* Jersey / Number */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 inline-flex items-center justify-center font-bold text-xs text-primary">
                            {player.jersey_number ? `#${player.jersey_number}` : player.first_name[0]}
                          </span>
                        </td>

                        {/* Name & Avatar */}
                        <td className="py-3.5 px-4">
                          <Link href={`/players/${player.id}`} className="flex items-center gap-3 group-hover:text-primary transition-colors">
                            <div>
                              <div className="font-bold text-sm text-white group-hover:text-primary transition-colors">
                                {player.first_name} {player.last_name}
                              </div>
                              {player.nationality && (
                                <div className="text-[10px] text-zinc-500 font-semibold">Nat: {player.nationality}</div>
                              )}
                            </div>
                          </Link>
                        </td>

                        {/* Team */}
                        <td className="py-3.5 px-4">
                          {(() => {
                            const ut = user?.teams?.find((item: any) => item.id === player.team_id);
                            const tMatch = teams.find((item: any) => item.id === player.team_id);
                            const isEditableTeam = ut ? Boolean(ut.can_edit) : (tMatch ? Boolean(tMatch.can_edit) : false);
                            return (
                              <span className="text-xs font-bold text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/50 inline-flex items-center gap-1">
                                <span>{player.team_name || 'Keine Mannschaft'}</span>
                                {isEditableTeam && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0 inline-block ml-0.5" />}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Position */}
                        <td className="py-3.5 px-4 font-semibold text-zinc-400">
                          {player.position || 'Feldspieler'}
                        </td>

                        {/* DFB Passnummer */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-zinc-300">
                          {player.dfb_id || '—'}
                        </td>

                      {/* Anwesenheit Rate */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-xs font-bold">
                          <Check className="w-3 h-3" />
                          {player.attendance_rate !== undefined ? `${player.attendance_rate}%` : '100%'}
                        </span>
                      </td>

                      {/* Letzte Quartalsnote */}
                      <td className="py-3.5 px-4 text-center">
                        {player.latest_rating ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg text-xs font-bold">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {player.latest_rating} / 10
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-medium">—</span>
                        )}
                      </td>

                      {/* Traffic Light: Zuletzt eingeschätzt */}
                      <td className="py-3.5 px-4 text-center">
                        {renderEvaluationTrafficLight(player.latest_eval_date)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right pr-6">
                        {(() => {
                          const canEditThisPlayer = (() => {
                            if (!player.team_id) return true;
                            const tLoaded = teams.find((item: any) => item.id === player.team_id);
                            if (tLoaded) return Boolean(tLoaded.can_edit);
                            const tUser = user?.teams?.find((item: any) => item.id === player.team_id);
                            if (tUser) return Boolean(tUser.can_edit);
                            return isAdmin;
                          })();

                          return (
                            <div className="flex items-center justify-end gap-1.5">
                              {canEditThisPlayer && (
                                <button
                                  onClick={() => {
                                    setSelectedPlayerForTransfer(player);
                                    setTargetTeamId(player.team_id || (teams[0]?.id || ''));
                                    setIsTransferModalOpen(true);
                                  }}
                                  className="p-1.5 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all border border-zinc-700/50"
                                  title="In andere Mannschaft verschieben (z.B. E3 -> E2)"
                                >
                                  <MoveRight className="w-4 h-4 text-emerald-400" />
                                </button>
                              )}

                              {canEditThisPlayer && (
                                <button
                                  onClick={() => openEditPlayerModal(player)}
                                  className="p-1.5 bg-zinc-800/60 hover:bg-amber-600/20 hover:text-amber-400 text-zinc-400 rounded-lg transition-all border border-zinc-700/50"
                                  title="Spielerdaten bearbeiten"
                                >
                                  <Edit3 className="w-4 h-4 text-amber-400" />
                                </button>
                              )}

                              <Link
                                href={`/players/${player.id}`}
                                className="p-1.5 bg-zinc-800/60 hover:bg-primary/20 hover:text-primary text-zinc-400 rounded-lg transition-all border border-zinc-700/50"
                                title="Profil & Bewertung öffnen"
                              >
                                <Eye className="w-4 h-4 text-primary" />
                              </Link>

                              {canEditThisPlayer && (
                                <button
                                  onClick={() => setDeletePlayerId(player.id)}
                                  className="p-1.5 bg-zinc-800/60 hover:bg-red-600/20 hover:text-red-400 text-zinc-400 rounded-lg transition-all border border-zinc-700/50"
                                  title="Spieler löschen"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}
      </main>

      {/* --- Modal: Neuer Spieler anlegen --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Neuen Spieler anlegen
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreatePlayer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Vorname *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="z.B. Theo"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Nachname *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="z.B. Al Hamud"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Geburtsdatum</label>
                  <input
                    type="text"
                    value={newDob}
                    onChange={(e) => setNewDob(e.target.value)}
                    placeholder="z.B. 26.07.2017"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">DFB Passnummer</label>
                  <input
                    type="text"
                    value={newDfbId}
                    onChange={(e) => setNewDfbId(e.target.value)}
                    placeholder="z.B. 0727-4836"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Mannschaft</label>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {teams
                      .filter((t) => Boolean(t.can_edit))
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Position</label>
                  <select
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Torwart">Torwart</option>
                    <option value="Abwehr">Abwehr</option>
                    <option value="Mittelfeld">Mittelfeld</option>
                    <option value="Angriff">Angriff</option>
                    <option value="Feldspieler">Feldspieler</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20"
                >
                  {isSaving ? 'Speichere...' : 'Spieler Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Spieler bearbeiten --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                Spieler bearbeiten
              </h2>
              <button
                onClick={() => { setIsEditModalOpen(false); setEditingPlayerId(null); }}
                className="text-zinc-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdatePlayer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Vorname *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="z.B. Theo"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Nachname *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="z.B. Al Hamud"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Geburtsdatum</label>
                  <input
                    type="text"
                    value={newDob}
                    onChange={(e) => setNewDob(e.target.value)}
                    placeholder="z.B. 26.07.2017"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">DFB Passnummer</label>
                  <input
                    type="text"
                    value={newDfbId}
                    onChange={(e) => setNewDfbId(e.target.value)}
                    placeholder="z.B. 0727-4836"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Trikotnr.</label>
                  <input
                    type="number"
                    value={newJerseyNumber}
                    onChange={(e) => setNewJerseyNumber(e.target.value)}
                    placeholder="z.B. 10"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Mannschaft</label>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Position</label>
                  <select
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Torwart">Torwart</option>
                    <option value="Abwehr">Abwehr</option>
                    <option value="Mittelfeld">Mittelfeld</option>
                    <option value="Angriff">Angriff</option>
                    <option value="Feldspieler">Feldspieler</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingPlayerId(null); }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20"
                >
                  {isSaving ? 'Speichere...' : 'Änderungen Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: DFB.net CSV Import --- */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                DFB.net CSV Import
              </h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Importiere eine aus <strong>DFB.net</strong> exportierte CSV-Spielerliste. Die Felder <em>Name</em>, <em>Vorname</em>, <em>Geburtsdatum</em>, <em>Nationalität</em> und <em>Passnummer</em> werden automatisch zugewiesen.
            </p>

            {/* Help Hint: Wo exportiere ich die CSV in DFB.net? */}
            <div className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                <span>💡 Wo finde ich den CSV-Export in DFB.net?</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Öffne in <strong className="text-zinc-200">DFB.net</strong> die <strong className="text-zinc-200">Spielberechtigungsliste</strong> deiner Mannschaft und klicke unten auf den Button <strong className="text-amber-300">EXPORT</strong>, um die CSV-Datei herunterzuladen.
              </p>
              <div className="rounded-lg border border-zinc-800 bg-black/60 p-1.5 overflow-hidden">
                <img
                  src="/dfb_net_export_help.png"
                  alt="DFB.net Spielberechtigungsliste – EXPORT Button"
                  className="w-full rounded border border-zinc-700/60 object-cover"
                />
              </div>
            </div>

            <form onSubmit={handleDfbCsvImport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Ziel-Mannschaft auswählen *</label>
                <select
                  value={importTeamId}
                  onChange={(e) => setImportTeamId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                >
                  {teams
                    .filter((t) => Boolean(t.can_edit))
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">DFB.net CSV-Datei wählen *</label>
                <input
                  type="file"
                  accept=".csv, .txt"
                  required
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
                />
              </div>

              {csvFile && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                  <div className="font-bold text-emerald-400">Ausgewählte Datei: {csvFile.name}</div>
                  <div className="text-[11px] text-zinc-500">Größe: {(csvFile.size / 1024).toFixed(1)} KB</div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !csvFile}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
                >
                  {isImporting ? 'Importiere...' : 'CSV Jetzt Importieren'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Mannschaft verschieben --- */}
      {isTransferModalOpen && selectedPlayerForTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MoveRight className="w-5 h-5 text-emerald-400" />
                Spieler in andere Mannschaft verschieben
              </h2>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-zinc-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Verschiebe <strong className="text-white">{selectedPlayerForTransfer.first_name} {selectedPlayerForTransfer.last_name}</strong> in eine andere Mannschaft (z.&nbsp;B. von E3 zu E2).
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Neue Ziel-Mannschaft</label>
              <select
                value={targetTeamId}
                onChange={(e) => setTargetTeamId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                Verschieben Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deletePlayerId !== null}
        title="Spieler löschen"
        message="Bist du sicher, dass du diesen Spieler unwiderruflich löschen möchtest? Alle Anwesenheiten und Quartals-Bewertungen gehen dabei verloren."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletePlayerId(null)}
      />

      {/* Custom Alert */}
      <AlertDialog
        isOpen={alertConfig.isOpen}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
    </div>
  );
}
