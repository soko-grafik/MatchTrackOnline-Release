"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getAllUsers, updateUserRole, deleteUser, approveUser, getTeams, createTeam, updateTeam, deleteTeam, updateUserTeams, adminCreateUser, updateUserModulePermissions, getUserStatisticsOverview, getMediaUrl } from '@/services/api';
import { User as UserIcon, Trash2, Edit2, ChevronLeft, CheckCircle, XCircle, UploadCloud, Users as UsersIcon, Plus, ShieldAlert, BarChart3, Activity, Clock, Flame, Eye, Layers, ArrowUpRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import ConfirmModal from '@/components/ConfirmModal';
import AlertDialog from '@/components/AlertDialog';
import Navbar from '@/components/Navbar';
import UserBehaviorModal from '@/components/UserBehaviorModal';
import PageHeader from '@/components/PageHeader';

type UserRole = 'ADMIN' | 'TEAM_ADMIN' | 'TRAINER' | 'CO_TRAINER' | 'VIEWER' | 'admin' | 'team_admin' | 'trainer' | 'co_trainer' | 'viewer';

interface TeamItem {
  id: string;
  name: string;
  age_group?: string;
  can_edit?: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  is_approved: boolean;
  created_at: string;
  last_login?: string;
  teams?: TeamItem[];
  first_name?: string;
  last_name?: string;
  module_permissions?: Record<string, boolean>;
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast, confirm: confirmModal } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamAgeGroup, setNewTeamAgeGroup] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Edit Team State
  const [editingTeam, setEditingTeam] = useState<TeamItem | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamAgeGroup, setEditTeamAgeGroup] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);

  // Editing Teams for User Modal/Popover State
  const [editingUserTeams, setEditingUserTeams] = useState<User | null>(null);
  const [userTeamPerms, setUserTeamPerms] = useState<Record<string, { assigned: boolean; can_edit: boolean }>>({});
  const [savingUserTeams, setSavingUserTeams] = useState(false);

  // Editing Module Permissions State
  const [editingUserPerms, setEditingUserPerms] = useState<User | null>(null);
  const [permState, setPermState] = useState<Record<string, boolean>>({
    ORGANIZER: true,
    TACTICS: true,
    PLAYERS: true,
    MATCHES: true,
    TRAINING: true,
    AI: true,
  });
  const [savingPerms, setSavingPerms] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // New User Creation Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'TEAM_ADMIN' | 'TRAINER' | 'CO_TRAINER' | 'VIEWER'>('TRAINER');
  const [newUserTeamIds, setNewUserTeamIds] = useState<string[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  // User Statistics State
  const [activeMainTab, setActiveMainTab] = useState<'users' | 'statistics'>('users');
  const [statsOverview, setStatsOverview] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedStatsUserId, setSelectedStatsUserId] = useState<string | null>(null);

  const fetchStatisticsOverview = async () => {
    setStatsLoading(true);
    try {
      const data = await getUserStatisticsOverview();
      setStatsOverview(data);
    } catch (err: any) {
      console.error("Failed to load user statistics overview:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || user.role.toUpperCase() !== 'ADMIN')) {
      router.push('/');
      return;
    }
    if (user && user.role.toUpperCase() === 'ADMIN') {
      fetchUsersAndTeams();
    }
  }, [user, authLoading]);

  const fetchUsersAndTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, teamsData] = await Promise.all([
        getAllUsers(),
        getTeams()
      ]);

      if (usersData.error) setError(usersData.error);
      else setUsers(usersData);

      if (Array.isArray(teamsData)) setTeams(teamsData);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Laden der Daten.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setError(null);
    try {
      await updateUserRole(userId, newRole);
      fetchUsersAndTeams();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Aktualisieren der Rolle.");
    }
  };

  const handleApprovalToggle = async (userId: string, currentStatus: boolean) => {
    setError(null);
    try {
      await approveUser(userId, !currentStatus);
      fetchUsersAndTeams();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Aktualisieren der Freigabe.");
    }
  };

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type?: 'info' | 'success' | 'warning' | 'error'; title?: string }>({
    isOpen: false,
    message: '',
    type: 'error'
  });

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      await createTeam(newTeamName.trim(), newTeamAgeGroup.trim() || undefined);
      setNewTeamName('');
      setNewTeamAgeGroup('');
      fetchUsersAndTeams();
    } catch (err: any) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.detail || "Fehler beim Erstellen der Mannschaft.", type: 'error' });
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const isConfirmed = await confirmModal({
      title: 'Mannschaft löschen',
      message: `Möchtest du die Mannschaft "${teamName}" wirklich löschen?`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await deleteTeam(teamId);
      toast.success(`Mannschaft "${teamName}" erfolgreich gelöscht.`);
      fetchUsersAndTeams();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Fehler beim Löschen der Mannschaft.");
    }
  };

  const openEditTeamModal = (t: TeamItem) => {
    setEditingTeam(t);
    setEditTeamName(t.name || '');
    setEditTeamAgeGroup(t.age_group || '');
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editTeamName.trim()) return;
    setSavingTeam(true);
    try {
      await updateTeam(editingTeam.id, {
        name: editTeamName.trim(),
        age_group: editTeamAgeGroup.trim() || undefined
      });
      setEditingTeam(null);
      setAlertConfig({ isOpen: true, message: "Mannschaft erfolgreich aktualisiert!", type: 'success' });
      fetchUsersAndTeams();
    } catch (err: any) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.detail || "Fehler beim Bearbeiten der Mannschaft.", type: 'error' });
    } finally {
      setSavingTeam(false);
    }
  };

  const handleOpenUserTeamsModal = (u: User) => {
    setEditingUserTeams(u);
    const initialPerms: Record<string, { assigned: boolean; can_edit: boolean }> = {};
    teams.forEach((t) => {
      const found = u.teams?.find((ut) => ut.id === t.id);
      initialPerms[t.id] = {
        assigned: !!found,
        can_edit: found ? (found.can_edit !== undefined ? found.can_edit : true) : true,
      };
    });
    setUserTeamPerms(initialPerms);
  };

  const handleSaveUserTeams = async () => {
    if (!editingUserTeams) return;
    setSavingUserTeams(true);
    try {
      const payload = Object.entries(userTeamPerms)
        .filter(([_, item]) => item.assigned)
        .map(([team_id, item]) => ({ team_id, can_edit: item.can_edit }));

      await updateUserTeams(editingUserTeams.id, payload);
      setEditingUserTeams(null);
      fetchUsersAndTeams();
    } catch (err: any) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.detail || "Fehler beim Speichern der Mannschaften.", type: 'error' });
    } finally {
      setSavingUserTeams(false);
    }
  };

  const openPermModal = (u: User) => {
    setEditingUserPerms(u);
    const roleUpper = u.role.toUpperCase();
    const isDefaultNo = roleUpper === 'VIEWER';
    const existing = u.module_permissions || {};

    setPermState({
      ORGANIZER: existing.ORGANIZER !== undefined ? existing.ORGANIZER : !isDefaultNo,
      TACTICS: existing.TACTICS !== undefined ? existing.TACTICS : !isDefaultNo,
      PLAYERS: existing.PLAYERS !== undefined ? existing.PLAYERS : !isDefaultNo,
      MATCHES: existing.MATCHES !== undefined ? existing.MATCHES : true,
      TRAINING: existing.TRAINING !== undefined ? existing.TRAINING : !isDefaultNo,
      AI: existing.AI !== undefined ? existing.AI : true,
    });
  };


  const handleSavePermissions = async () => {
    if (!editingUserPerms) return;
    setSavingPerms(true);
    try {
      await updateUserModulePermissions(editingUserPerms.id, permState);
      setEditingUserPerms(null);
      setAlertConfig({ isOpen: true, message: `Modul-Rechte für ${editingUserPerms.username} aktualisiert!`, type: 'success' });
      fetchUsersAndTeams();
    } catch (err: any) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.detail || "Fehler beim Speichern der Modul-Rechte.", type: 'error' });
    } finally {
      setSavingPerms(false);
    }
  };


  const handleDeleteRequest = (user: User) => {
    setUserToDelete(user);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setError(null);
    try {
      await deleteUser(userToDelete.id);
      fetchUsersAndTeams(); // Refresh list
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Löschen des Benutzers.");
    } finally {
      setIsConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim() || !newFirstName.trim() || !newLastName.trim()) {
      setAddUserError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    setCreatingUser(true);
    setAddUserError(null);
    try {
      await adminCreateUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword.trim(),
        role: newUserRole,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        team_ids: newUserTeamIds,
      });
      setIsAddUserModalOpen(false);
      // Reset form
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewFirstName('');
      setNewLastName('');
      setNewUserRole('TRAINER');
      setNewUserTeamIds([]);
      
      setAlertConfig({ isOpen: true, message: "Benutzer erfolgreich erstellt.", type: 'success', title: "Erfolg" });
      fetchUsersAndTeams();
    } catch (err: any) {
      setAddUserError(err.response?.data?.detail || "Fehler beim Erstellen des Benutzers.");
    } finally {
      setCreatingUser(false);
    }
  };

  if (authLoading || (user && user.role.toUpperCase() !== 'ADMIN')) {
    return null; // Render nothing or a loading spinner while redirecting
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 font-sans text-white">
      <Navbar />

      <main className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8">

        <PageHeader
          title="Benutzer & Teams"
          subtitle="VERWALTUNG, ROLLEN & MANNSCHAFTS-ZUWEISUNG"
          rightElement={
            activeMainTab === 'users' ? (
              <button
                onClick={() => setIsAddUserModalOpen(true)}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:bg-primary-hover active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Benutzer hinzufügen</span>
              </button>
            ) : (
              <button
                onClick={fetchStatisticsOverview}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:bg-blue-500 active:scale-95"
              >
                <RefreshCw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
                <span>Statistiken aktualisieren</span>
              </button>
            )
          }
        />

        {/* Main Navigation Tabs */}
        <div className="flex items-center gap-3 mb-6 border-b border-zinc-800 pb-3">
          <button
            onClick={() => setActiveMainTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeMainTab === 'users'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800'
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span>Benutzer & Teams</span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('statistics');
              if (!statsOverview) fetchStatisticsOverview();
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeMainTab === 'statistics'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Verhaltens-Statistiken</span>
          </button>
        </div>

        {activeMainTab === 'statistics' ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            {statsLoading && !statsOverview ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500"></div>
                <p className="animate-pulse text-zinc-500">Lade Verhaltens-Statistiken...</p>
              </div>
            ) : statsOverview ? (
              <>
                {/* Platform Summary KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Aktive Nutzer</span>
                      <UsersIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-black text-white">
                      {statsOverview.summary?.active_today || 0} <span className="text-xs font-normal text-zinc-400">Heute (DAU)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-2 font-mono">
                      <span>7 Tage: <strong>{statsOverview.summary?.active_7d || 0}</strong></span>
                      <span>•</span>
                      <span>30 Tage: <strong>{statsOverview.summary?.active_30d || 0}</strong></span>
                    </div>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Gesamt Watch-Time</span>
                      <Clock className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-white">
                      {statsOverview.summary?.total_watch_time_mins || 0} <span className="text-xs font-normal text-zinc-400">Minuten</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                      {statsOverview.summary?.total_views || 0} Match-Aufrufe
                    </p>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Video-Analysen</span>
                      <Activity className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-black text-white">
                      {(statsOverview.summary?.total_comments || 0) + (statsOverview.summary?.total_drawings || 0)}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                      {statsOverview.summary?.total_comments || 0} Notizen, {statsOverview.summary?.total_drawings || 0} Zeichnungen
                    </p>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Taktik & Training</span>
                      <Layers className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-black text-white">
                      {(statsOverview.summary?.total_tactics || 0) + (statsOverview.summary?.total_trainings || 0)}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                      {statsOverview.summary?.total_tactics || 0} Taktiken, {statsOverview.summary?.total_trainings || 0} Pläne
                    </p>
                  </div>
                </div>

                {/* User Behavior Ranking Table */}
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl">
                  <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Trainer- & Nutzer-Aktivitätsranking</h3>
                      <p className="text-xs text-zinc-400">Übersicht aller Benutzer nach Interaktionen, Logins und Analysezeit</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-800">
                      <thead className="bg-zinc-950/60">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-400">Benutzer</th>
                          <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-400">Rolle</th>
                          <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">Aktionen</th>
                          <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">Logins</th>
                          <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">Watch-Time</th>
                          <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-400">Letzte Aktivität</th>
                          <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-400">Detail-Analyse</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/80 bg-zinc-900/40">
                        {(statsOverview.user_ranking || []).map((u: any) => (
                          <tr key={u.id} className="hover:bg-zinc-800/40 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white overflow-hidden flex-shrink-0">
                                  {u.avatar_path ? (
                                    <img src={getMediaUrl(u.avatar_path)} alt={u.username} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{(u.first_name?.[0] || u.username?.[0] || 'U').toUpperCase()}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white">
                                    {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                                  </div>
                                  <div className="text-xs text-zinc-400">@{u.username}</div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {u.role}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <span className="font-mono text-xs font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                                {u.total_actions}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center whitespace-nowrap font-mono text-xs text-zinc-300">
                              {u.logins_count}
                            </td>

                            <td className="px-6 py-4 text-center whitespace-nowrap font-mono text-xs text-emerald-400 font-bold">
                              {u.watch_time_mins} Min.
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400 font-mono">
                              {u.last_active ? new Date(u.last_active).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nie'}
                            </td>

                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedStatsUserId(u.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95"
                              >
                                <Activity className="w-3.5 h-3.5" />
                                <span>Verhalten</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-zinc-500">Keine Statistikdaten verfügbar.</div>
            )}
          </div>
        ) : (
          <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
            <p className="animate-pulse text-zinc-500">Lade Benutzerdaten...</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
            <p className="mb-2 font-semibold">Hoppla!</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-800">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Benutzername
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      E-Mail
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Rolle
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Zugewiesene Teams
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Registriert am
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Letzter Login
                    </th>
                    <th scope="col" className="relative px-6 py-4">
                      <span className="sr-only">Aktionen</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {users.map((u) => (
                    <tr key={u.id} className={`transition-colors hover:bg-zinc-800/50 ${!u.is_approved ? 'bg-primary/5' : ''}`}>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center">
                          <UserIcon className="mr-3 h-4 w-4 text-zinc-500" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">
                              {u.username}
                              {!u.is_approved && (
                                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                  Neu
                                </span>
                              )}
                            </span>
                            {(u.first_name || u.last_name) && (
                              <span className="text-xs text-zinc-500">
                                {u.first_name || ''} {u.last_name || ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-zinc-400">{u.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center">
                          {u.is_approved ? (
                            <span className="flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                              <CheckCircle className="mr-1 h-3 w-3" /> Freigegeben
                            </span>
                          ) : (
                            <span className="flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                              <XCircle className="mr-1 h-3 w-3" /> Ausstehend
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <select
                          value={u.role.toUpperCase()}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="block w-full rounded-lg border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-primary focus:ring-primary"
                          disabled={u.id === user?.id}
                        >
                          <option value="VIEWER">Viewer</option>
                          <option value="CO_TRAINER">Co-Trainer</option>
                          <option value="TRAINER">Trainer</option>
                          <option value="TEAM_ADMIN">TeamAdmin</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.teams && u.teams.length > 0 ? (
                            u.teams.map((t) => (
                              <span
                                key={t.id}
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 ${
                                  t.can_edit === false
                                    ? 'border-zinc-700 bg-zinc-800 text-zinc-400'
                                    : 'border-primary/30 bg-primary/20 text-primary'
                                }`}
                                title={t.can_edit === false ? 'Nur Lesezugriff' : 'Vollzugriff (Lesen & Schreiben)'}
                              >
                                <span>{t.name}</span>
                                {t.can_edit === false && <span className="text-[9px] text-amber-400 font-normal">(Nur Lesen)</span>}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs italic text-zinc-600">Keine Teams</span>
                          )}
                          {(u.role.toUpperCase() === 'TRAINER' || u.role.toUpperCase() === 'CO_TRAINER' || u.role.toUpperCase() === 'TEAM_ADMIN' || u.role.toUpperCase() === 'ADMIN') && (
                            <button
                              onClick={() => handleOpenUserTeamsModal(u)}
                              className="ml-2 rounded-md bg-zinc-800 p-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                              title="Teams zuweisen"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {u.last_login ? (
                          <div className="flex flex-col">
                            <span className="text-zinc-200 font-medium">{new Date(u.last_login).toLocaleDateString()}</span>
                            <span className="text-[11px] text-zinc-500">{new Date(u.last_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-zinc-600">Noch nie</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedStatsUserId(u.id)}
                            className="rounded-lg bg-zinc-800 hover:bg-blue-600/20 hover:text-blue-400 border border-zinc-700/50 px-2.5 py-1.5 text-xs font-bold text-zinc-300 transition-all flex items-center gap-1"
                            title="360° Verhaltens- und Aktivitäts-Analyse anzeigen"
                          >
                            <Activity className="h-3.5 w-3.5 text-blue-400" />
                            <span>Aktivität</span>
                          </button>

                          <button
                            onClick={() => openPermModal(u)}
                            className="rounded-lg bg-zinc-800 hover:bg-amber-600/20 hover:text-amber-400 border border-zinc-700/50 px-2.5 py-1.5 text-xs font-bold text-zinc-300 transition-all flex items-center gap-1"
                            title="Zugriff auf einzelne Module (Organizer, Kader, Training etc.) anpassen"
                          >
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                            <span>Rechte</span>
                          </button>

                          {!u.is_approved ? (
                            <button
                              onClick={() => handleApprovalToggle(u.id, u.is_approved)}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover"
                            >
                              Freischalten
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApprovalToggle(u.id, u.is_approved)}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-all hover:text-white"
                              disabled={u.id === user?.id}
                            >
                              Sperren
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteRequest(u)}
                            className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Benutzer löschen"
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section: Mannschaftsverwaltung */}
        <section className="mt-16 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                <UsersIcon className="h-5 w-5 text-primary" />
                Mannschaftsverwaltung
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                Erstelle neue Mannschaften oder verwalte bestehende Teams für die Video-Zuweisung.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateTeam} className="mb-8 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row">
            <input
              type="text"
              placeholder="Mannschaftsname (z. B. 1. Herren, E-Junioren)..."
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="flex-1 rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
            <input
              type="text"
              placeholder="Altersklasse (z. B. U11, optional)..."
              value={newTeamAgeGroup}
              onChange={(e) => setNewTeamAgeGroup(e.target.value)}
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-48"
            />
            <button
              type="submit"
              disabled={creatingTeam}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-primary-hover disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Team erstellen
            </button>
          </form>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {teams.map((t) => (
              <div key={t.id} className="group flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition-all hover:border-zinc-700">
                <div>
                  <h4 className="text-sm font-bold text-white">{t.name}</h4>
                  {t.age_group && <span className="text-[10px] font-semibold uppercase text-zinc-500">{t.age_group}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditTeamModal(t)}
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-amber-500/10 hover:text-amber-400"
                    title="Mannschaft bearbeiten"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(t.id, t.name)}
                    className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Mannschaft löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>
      )}

      {/* --- Modal: Mannschaft bearbeiten --- */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                Mannschaft bearbeiten
              </h2>
              <button
                onClick={() => setEditingTeam(null)}
                className="text-zinc-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Mannschaftsname *</label>
                <input
                  type="text"
                  required
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  placeholder="z. B. E3-Junioren"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Altersklasse (optional)</label>
                <input
                  type="text"
                  value={editTeamAgeGroup}
                  onChange={(e) => setEditTeamAgeGroup(e.target.value)}
                  placeholder="z. B. U11"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={savingTeam}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20"
                >
                  {savingTeam ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Trainer Mannschaften zuweisen */}
      {editingUserTeams && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">
                Teams & Rechte zuweisen für {editingUserTeams.username}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Wähle die zugewiesenen Mannschaften aus und lege fest, ob der Benutzer den Kader bearbeiten oder nur einsehen darf.
              </p>
            </div>

            <div className="max-h-72 space-y-2.5 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              {teams.map((t) => {
                const item = userTeamPerms[t.id] || { assigned: false, can_edit: true };
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                      item.assigned
                        ? 'border-zinc-700 bg-zinc-950'
                        : 'border-zinc-800/60 bg-zinc-950/40 opacity-60'
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.assigned}
                        onChange={() => {
                          setUserTeamPerms({
                            ...userTeamPerms,
                            [t.id]: { ...item, assigned: !item.assigned }
                          });
                        }}
                        className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-primary focus:ring-offset-zinc-900"
                      />
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-bold text-white truncate">{t.name}</span>
                        {t.age_group && <span className="text-[10px] text-zinc-500">{t.age_group}</span>}
                      </div>
                    </label>

                    {item.assigned && (
                      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setUserTeamPerms({
                              ...userTeamPerms,
                              [t.id]: { ...item, can_edit: true }
                            });
                          }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                            item.can_edit
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Lesen & Schreiben
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUserTeamPerms({
                              ...userTeamPerms,
                              [t.id]: { ...item, can_edit: false }
                            });
                          }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                            !item.can_edit
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Nur Lesen
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingUserTeams(null)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSaveUserTeams}
                disabled={savingUserTeams}
                className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-white transition-all hover:bg-primary-hover disabled:bg-zinc-700 shadow-md shadow-primary/20"
              >
                {savingUserTeams ? 'Speichern...' : 'Teams & Rechte Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Benutzer hinzufügen */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-white">
              Neuen Benutzer anlegen
            </h3>
            <p className="mb-6 text-xs text-zinc-400">
              Erstelle einen neuen Benutzer und weise ihm direkt eine Rolle und Mannschaften zu.
            </p>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Vorname</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nachname</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white focus:border-primary focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Benutzername</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white focus:border-primary focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">E-Mail</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white focus:border-primary focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Passwort</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white focus:border-primary focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Rolle</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white focus:border-primary focus:ring-primary"
                >
                  <option value="VIEWER">Viewer (Zuschauer)</option>
                  <option value="CO_TRAINER">Co-Trainer</option>
                  <option value="TRAINER">Trainer</option>
                  <option value="TEAM_ADMIN">TeamAdmin (Upload für zugewiesene Teams)</option>
                  <option value="ADMIN">Admin (Vollzugriff)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">Mannschaften zuweisen (optional)</label>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-2">
                  {teams.map((t) => {
                    const isChecked = newUserTeamIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-zinc-800 text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setNewUserTeamIds(newUserTeamIds.filter(id => id !== t.id));
                            } else {
                              setNewUserTeamIds([...newUserTeamIds, t.id]);
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-primary"
                        />
                        <span className="text-white">{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {addUserError && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-center text-xs text-red-400">
                  {addUserError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-white transition-all hover:bg-primary-hover disabled:bg-zinc-700"
                >
                  {creatingUser ? 'Erstellt...' : 'Benutzer erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Modul-Rechte verwalten --- */}
      {editingUserPerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Modul-Rechte anpassen
              </h2>
              <button
                onClick={() => setEditingUserPerms(null)}
                className="text-zinc-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="text-xs text-zinc-400">
              Passen Sie die Zugriffsrechte für <strong className="text-white font-mono">{editingUserPerms.username}</strong> ({editingUserPerms.role}) individuell an:
            </div>

            <div className="space-y-3">
              {[
                { id: 'ORGANIZER', label: 'Organizer', desc: 'Spielplan, Trainingskalender & Termine' },
                { id: 'TACTICS', label: 'Digitale Taktiktafel', desc: 'Interaktive Taktik-Boards, Animationen & Vorlieben' },
                { id: 'PLAYERS', label: 'Kader & Spieler', desc: 'Roster, Anwesenheit, Matrix & PDF-Berichte' },
                { id: 'MATCHES', label: 'Analyse & Spiele', desc: 'Video-Player, Event-Tagging & Heatmaps' },
                { id: 'TRAINING', label: 'Trainingsplan & Übungen', desc: 'Übungsdatenbank & Einheiten' },
                { id: 'AI', label: '🤖 KI-Sprachassistent & Foto-Scanner', desc: 'Spracheingabe, Noten-Erfassung & KI-Karten-Scanner' },
              ].map((mod) => (

                <label key={mod.id} className="flex items-start justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-700 transition-all">
                  <div>
                    <div className="text-xs font-bold text-white">{mod.label}</div>
                    <div className="text-[11px] text-zinc-500">{mod.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!permState[mod.id]}
                    onChange={(e) => setPermState({ ...permState, [mod.id]: e.target.checked })}
                    className="w-4 h-4 accent-primary rounded cursor-pointer mt-0.5"
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingUserPerms(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20"
              >
                {savingPerms ? 'Speichere...' : 'Rechte Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Benutzer löschen"
        message={`Bist du sicher, dass du den Benutzer "${userToDelete?.username}" endgültig löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmText="Benutzer löschen"
        onConfirm={confirmDelete}
        onCancel={() => setIsConfirmOpen(false)}
      />

      <AlertDialog
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {selectedStatsUserId && (
        <UserBehaviorModal
          isOpen={!!selectedStatsUserId}
          onClose={() => setSelectedStatsUserId(null)}
          userId={selectedStatsUserId}
        />
      )}
      </main>

    </div>
  );
}
