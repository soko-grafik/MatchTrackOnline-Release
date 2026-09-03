"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AlertDialog from '@/components/AlertDialog';
import PrintablePlayerReportModal from '@/components/PrintablePlayerReportModal';
import { 
  ArrowLeft, Users, Star, Calendar, Check, X, Printer, Plus, Edit3, 
  TrendingUp, Award, Activity, HeartPulse, UserCheck, ShieldAlert, Sparkles, Filter, Shield, Trash2
} from 'lucide-react';
import { 
  getPlayer, getPlayerAttendance, recordAttendance, 
  getPlayerEvaluations, createPlayerEvaluation, updatePlayerEvaluation, approvePlayerEvaluation, deletePlayerEvaluation, getTeams 
} from '@/services/api';

import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

export default function PlayerDetailPage() {
  const { user } = useAuth();
  const { toast, confirm: confirmModal } = useToast();
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;

  const [player, setPlayer] = useState<any>(null);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [taggedEvents, setTaggedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // PDF Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // New Attendance Modal State
  const [isAttModalOpen, setIsAttModalOpen] = useState(false);
  const [attType, setAttType] = useState('TRAINING');
  const [attStatus, setAttStatus] = useState('PRESENT');
  const [attReason, setAttReason] = useState('KRANKHEIT');
  const [attNotes, setAttNotes] = useState('');

  // Evaluation Form State (1-10 Matrix)
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [editingEvalId, setEditingEvalId] = useState<number | null>(null);
  const [evalDate, setEvalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [overallNotes, setOverallNotes] = useState<string>('');

  // 16 Criteria State (1-10)
  const [techBallControl, setTechBallControl] = useState(7);
  const [techDribbling, setTechDribbling] = useState(7);
  const [techPassing, setTechPassing] = useState(7);
  const [techShooting, setTechShooting] = useState(7);
  const [techBothFeet, setTechBothFeet] = useState(6);

  const [tactIntelligence, setTactIntelligence] = useState(7);
  const [tactSpaceCreation, setTactSpaceCreation] = useState(7);
  const [tactTransition, setTactTransition] = useState(7);
  const [tactOneOnOne, setTactOneOnOne] = useState(7);

  const [physSpeed, setPhysSpeed] = useState(7);
  const [physAgility, setPhysAgility] = useState(7);
  const [physMobility, setPhysMobility] = useState(7);

  const [mentTeamwork, setMentTeamwork] = useState(8);
  const [mentAttitude, setMentAttitude] = useState(8);
  const [mentLearning, setMentLearning] = useState(8);
  const [mentFairplay, setMentFairplay] = useState(9);

  // Chart Interactive Criteria Visibility Toggles
  const [visibleChartKeys, setVisibleChartKeys] = useState<Record<string, boolean>>({
    overall_rating: true,
    tech_ball_control: false,
    tech_passing: false,
    tact_intelligence: false,
    phys_speed: false,
    ment_attitude: false,
  });

  // Alert State
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (playerId) {
      fetchPlayerData();
    }
  }, [playerId]);

  const fetchPlayerData = async () => {
    setLoading(true);
    try {
      const [pData, attData, evData, tData, tEvents] = await Promise.all([
        getPlayer(playerId),
        getPlayerAttendance(playerId),
        getPlayerEvaluations(playerId),
        getTeams(),
        import('@/services/api').then(m => m.getPlayerTaggedEvents(playerId))
      ]);
      setPlayer(pData);
      setAttendances(attData || []);
      setEvaluations(evData || []);
      setTeams(tData || []);
      setTaggedEvents(tEvents || []);
    } catch (err) {
      console.error("Failed to load player data:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Laden des Spielerprofils.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordAttendance({
        player_id: playerId,
        event_type: attType,
        status: attStatus,
        absence_reason: attStatus === 'PRESENT' ? null : attReason,
        notes: attNotes || null
      });

      setAlertConfig({ isOpen: true, message: "Anwesenheit erfolgreich gespeichert!", type: 'success' });
      setIsAttModalOpen(false);
      setAttNotes('');
      fetchPlayerData();
    } catch (err) {
      console.error("Failed to record attendance:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Speichern der Anwesenheit.", type: 'error' });
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    const evalData = {
      player_id: playerId,
      evaluation_date: evalDate ? new Date(evalDate).toISOString() : new Date().toISOString(),
      overall_notes: overallNotes,

      tech_ball_control: techBallControl,
      tech_dribbling: techDribbling,
      tech_passing: techPassing,
      tech_shooting: techShooting,
      tech_both_feet: techBothFeet,

      tact_intelligence: tactIntelligence,
      tact_space_creation: tactSpaceCreation,
      tact_transition: tactTransition,
      tact_one_on_one: tactOneOnOne,

      phys_speed: physSpeed,
      phys_agility: physAgility,
      phys_mobility: physMobility,

      ment_teamwork: mentTeamwork,
      ment_attitude: mentAttitude,
      ment_learning: mentLearning,
      ment_fairplay: mentFairplay
    };

    try {
      if (editingEvalId) {
        await updatePlayerEvaluation(editingEvalId, evalData);
        setAlertConfig({ isOpen: true, message: "Bewertung erfolgreich aktualisiert!", type: 'success' });
      } else {
        await createPlayerEvaluation(playerId, evalData);
        setAlertConfig({ isOpen: true, message: "Neue Bewertung erfolgreich gespeichert!", type: 'success' });
      }
      setIsEvalModalOpen(false);
      fetchPlayerData();
    } catch (err) {
      console.error("Failed to save evaluation:", err);
      setAlertConfig({ isOpen: true, message: "Fehler beim Speichern der Bewertung.", type: 'error' });
    }
  };

  const handleApproveEvaluation = async (evalId: number) => {
    try {
      await approvePlayerEvaluation(evalId);
      setAlertConfig({ isOpen: true, message: "Bewertung erfolgreich freigegeben!", type: 'success' });
      fetchPlayerData();
    } catch (err: any) {
      console.error("Failed to approve evaluation:", err);
      setAlertConfig({ isOpen: true, message: err.response?.data?.detail || "Fehler bei der Freigabe der Bewertung.", type: 'error' });
    }
  };

  const handleDeleteEvaluation = async (evalId: number) => {
    const isConfirmed = await confirmModal({
      title: 'Bewertung löschen',
      message: 'Möchtest du diese Bewertung wirklich unwiderruflich löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await deletePlayerEvaluation(evalId);
      toast.success("Bewertung erfolgreich gelöscht!");
      fetchPlayerData();
    } catch (err: any) {
      console.error("Failed to delete evaluation:", err);
      toast.error(err.response?.data?.detail || "Fehler beim Löschen der Bewertung.");
    }
  };

  const [prevEval, setPrevEval] = useState<any>(null);

  const openNewEvalModal = () => {
    setEditingEvalId(null);
    setEvalDate(new Date().toISOString().split('T')[0]);
    setOverallNotes('');

    // Pre-populate with values from the latest evaluation if available
    const latestEval = evaluations && evaluations.length > 0 ? evaluations[0] : null;
    setPrevEval(latestEval);

    if (latestEval) {
      setTechBallControl(latestEval.tech_ball_control ?? 7);
      setTechDribbling(latestEval.tech_dribbling ?? 7);
      setTechPassing(latestEval.tech_passing ?? 7);
      setTechShooting(latestEval.tech_shooting ?? 7);
      setTechBothFeet(latestEval.tech_both_feet ?? 6);

      setTactIntelligence(latestEval.tact_intelligence ?? 7);
      setTactSpaceCreation(latestEval.tact_space_creation ?? 7);
      setTactTransition(latestEval.tact_transition ?? 7);
      setTactOneOnOne(latestEval.tact_one_on_one ?? 7);

      setPhysSpeed(latestEval.phys_speed ?? 7);
      setPhysAgility(latestEval.phys_agility ?? 7);
      setPhysMobility(latestEval.phys_mobility ?? 7);

      setMentTeamwork(latestEval.ment_teamwork ?? 8);
      setMentAttitude(latestEval.ment_attitude ?? 8);
      setMentLearning(latestEval.ment_learning ?? 8);
      setMentFairplay(latestEval.ment_fairplay ?? 9);
    } else {
      // Default fallback values if no previous evaluation exists
      setTechBallControl(7);
      setTechDribbling(7);
      setTechPassing(7);
      setTechShooting(7);
      setTechBothFeet(6);

      setTactIntelligence(7);
      setTactSpaceCreation(7);
      setTactTransition(7);
      setTactOneOnOne(7);

      setPhysSpeed(7);
      setPhysAgility(7);
      setPhysMobility(7);

      setMentTeamwork(8);
      setMentAttitude(8);
      setMentLearning(8);
      setMentFairplay(9);
    }

    setIsEvalModalOpen(true);
  };

  const openEditEvalModal = (ev: any) => {
    setEditingEvalId(ev.id);
    setPrevEval(null); // When editing an existing evaluation, do not show comparison badges
    const dStr = ev.evaluation_date ? new Date(ev.evaluation_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    setEvalDate(dStr);
    setOverallNotes(ev.overall_notes || '');

    setTechBallControl(ev.tech_ball_control);
    setTechDribbling(ev.tech_dribbling);
    setTechPassing(ev.tech_passing);
    setTechShooting(ev.tech_shooting);
    setTechBothFeet(ev.tech_both_feet);

    setTactIntelligence(ev.tact_intelligence);
    setTactSpaceCreation(ev.tact_space_creation);
    setTactTransition(ev.tact_transition);
    setTactOneOnOne(ev.tact_one_on_one);

    setPhysSpeed(ev.phys_speed);
    setPhysAgility(ev.phys_agility);
    setPhysMobility(ev.phys_mobility);

    setMentTeamwork(ev.ment_teamwork);
    setMentAttitude(ev.ment_attitude);
    setMentLearning(ev.ment_learning);
    setMentFairplay(ev.ment_fairplay);

    setIsEvalModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          <p className="text-zinc-500 text-sm mt-3">Lade Spielerprofil...</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8 text-center">
        <h2 className="text-xl font-bold text-red-400">Spieler nicht gefunden</h2>
        <Link href="/players" className="text-primary hover:underline text-xs mt-4 inline-block">
          Zurück zur Spielerliste
        </Link>
      </div>
    );
  }

  // Attendance stats
  const totalAtt = attendances.length;
  const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
  const attRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 100;

  // Attendance breakdown for Training vs Match
  const trainingAtts = attendances.filter(a => a.event_type === 'TRAINING' || !a.event_type);
  const totalTraining = trainingAtts.length;
  const presentTraining = trainingAtts.filter(a => a.status === 'PRESENT').length;

  const matchAtts = attendances.filter(a => a.event_type === 'MATCH');
  const totalMatch = matchAtts.length;
  const presentMatch = matchAtts.filter(a => a.status === 'PRESENT').length;

  const krankheitCount = attendances.filter(a => a.absence_reason === 'KRANKHEIT').length;
  const privatesCount = attendances.filter(a => a.absence_reason === 'PRIVATES').length;
  const verletzungCount = attendances.filter(a => a.absence_reason === 'VERLETZUNG').length;

  const latestEval = evaluations.length > 0 ? evaluations[evaluations.length - 1] : null;

  // Chart Criteria Options
  const chartCriteriaOptions = [
    { key: 'overall_rating', label: 'Gesamtschnitt', color: '#10b981' },
    { key: 'tech_ball_control', label: 'Ballkontrolle', color: '#3b82f6' },
    { key: 'tech_passing', label: 'Passspiel', color: '#6366f1' },
    { key: 'tact_intelligence', label: 'Spielintelligenz', color: '#8b5cf6' },
    { key: 'phys_speed', label: 'Schnelligkeit', color: '#f59e0b' },
    { key: 'ment_attitude', label: 'Einstellung', color: '#ec4899' },
  ];

  const userRole = user?.role?.toUpperCase() || '';
  const isAdmin = userRole === 'ADMIN';
  const canEditPlayer = (() => {
    if (!player) return false;
    if (!player.team_id) return true;
    const tUser = user?.teams?.find((item: any) => item.id === player.team_id);
    if (tUser) return Boolean(tUser.can_edit);
    return isAdmin;
  })();

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-primary selection:text-white pb-16">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          href="/players"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-bold mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zum Kader</span>
        </Link>

        {/* Player Header Banner */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 lg:p-8 mb-8 relative overflow-hidden shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 border border-primary/30 flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-primary/20">
                {player.jersey_number ? `#${player.jersey_number}` : player.first_name[0]}
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
                  <Shield className="w-4 h-4" />
                  {canEditPlayer && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                  <span>{player.team_name || 'Keine Mannschaft'}</span>
                </div>
                <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                  {player.first_name} {player.last_name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-2 font-medium">
                  {player.position && <span className="bg-zinc-800 px-2.5 py-1 rounded-lg text-zinc-300 font-bold">{player.position}</span>}
                  {player.date_of_birth && <span>Geb.: <strong className="text-zinc-200">{player.date_of_birth}</strong></span>}
                  {player.dfb_id && <span>Pass-Nr: <strong className="font-mono text-zinc-200">{player.dfb_id}</strong></span>}
                  {player.nationality && <span>Nat: <strong className="text-zinc-200">{player.nationality}</strong></span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>PDF Bericht Drucken</span>
              </button>

              {canEditPlayer && (
                <button
                  onClick={openNewEvalModal}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-primary/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Neue Quartals-Bewertung</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Dashboard Grid: Stats (Left) & Fortschritts-Analyse Chart (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8 items-stretch">

          {/* Left Column (4 Cols): Stats & Actions */}
          <div className="lg:col-span-4 flex flex-col gap-4">

            {/* Row 1: Anwesenheitsquote & Gesamtschnitt (Side-by-Side) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Anwesenheitsquote */}
              <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl flex flex-col justify-between">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Anwesenheit</span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 flex items-center gap-2 my-1">
                  <UserCheck className="w-6 h-6 shrink-0" />
                  <span>{attRate}%</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-medium">{presentCount} von {totalAtt} Einheiten</span>
              </div>

              {/* Gesamtschnitt (Note) */}
              <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-4 backdrop-blur-xl shadow-xl flex flex-col justify-between">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Gesamtschnitt</span>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 flex items-center gap-2 my-1">
                  <Star className="w-6 h-6 fill-amber-400 shrink-0" />
                  <span>{latestEval ? latestEval.overall_rating.toFixed(1) : '—'}</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-medium">Skala 1 - 10</span>
              </div>
            </div>

            {/* Row 2: Trainings- & Spiel-Teilnahme Counter */}
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-xl shadow-xl">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-3">Teilnahme-Counter</span>
              <div className="space-y-3">
                {/* Training counter */}
                <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-2xl">
                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-zinc-300">🏋️ Trainingseinheiten</span>
                    <span className="text-emerald-400 font-mono">{presentTraining} / {totalTraining}</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${totalTraining > 0 ? (presentTraining / totalTraining) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">An {presentTraining} von {totalTraining} Trainingseinheiten teilgenommen</span>
                </div>

                {/* Match counter */}
                <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-2xl">
                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-zinc-300">⚽ Meisterschafts-Spiele</span>
                    <span className="text-blue-400 font-mono">{presentMatch} / {totalMatch}</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${totalMatch > 0 ? (presentMatch / totalMatch) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">An {presentMatch} von {totalMatch} Spielen teilgenommen</span>
                </div>
              </div>
            </div>

            {/* Card 3: Anwesenheit erfassen */}
            {canEditPlayer && (
              <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-xl shadow-xl">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Anwesenheit erfassen</span>
                <button
                  onClick={() => setIsAttModalOpen(true)}
                  className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-2xl text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Einheit / Spiel eintragen</span>
                </button>
              </div>
            )}

            {/* Card 4: Absagegründe */}
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-xl shadow-xl">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Absagegründe</span>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-xl flex-1 text-center">Krank: {krankheitCount}</span>
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-xl flex-1 text-center">Privat: {privatesCount}</span>
                <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-xl flex-1 text-center">Verletzt: {verletzungCount}</span>
              </div>
            </div>
          </div>

          {/* Right Column (8 Cols): Fortschritts-Analyse Chart */}
          <div className="lg:col-span-8 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 lg:p-7 backdrop-blur-2xl shadow-2xl relative overflow-hidden flex flex-col justify-between">
            {/* Ambient Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-0.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>Fortschritts-Analyse</span>
                </div>
                <h2 className="text-lg font-extrabold text-white tracking-tight">Entwicklungsverlauf über die Quartale</h2>
              </div>

              {/* Interactive Toggle Pill Controls */}
              <div className="flex flex-wrap items-center gap-1.5">
                {chartCriteriaOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setVisibleChartKeys(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                      visibleChartKeys[opt.key]
                        ? 'bg-zinc-800 text-white border-zinc-600 shadow-zinc-900/50'
                        : 'bg-zinc-950/60 text-zinc-500 border-zinc-800/80 hover:text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: opt.color }}></span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Smooth Area & Line Chart (without fixed h-80/md:h-96) */}
            {evaluations.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 text-xs border border-dashed border-zinc-800/80 rounded-2xl bg-zinc-950/40 my-auto">
                <TrendingUp className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                Noch keine Quartals-Bewertungen vorhanden. Erstelle die erste Bewertung, um das Verlaufsdiagramm zu aktivieren.
              </div>
            ) : (
              <div className="w-full relative flex-1 flex flex-col justify-between">
                <div className="w-full relative flex-1 min-h-[220px]">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 800 240" preserveAspectRatio="none">
                    <defs>
                      {chartCriteriaOptions.map(opt => (
                        <linearGradient key={`grad-${opt.key}`} id={`grad-${opt.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={opt.color} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={opt.color} stopOpacity="0.0" />
                        </linearGradient>
                      ))}
                    </defs>

                    {/* Horizontal Grid Lines & Rating Axis Labels */}
                    {[2, 4, 6, 8, 10].map(val => {
                      const y = 220 - (val / 10) * 190;
                      return (
                        <g key={val}>
                          <line x1="45" y1={y} x2="785" y2={y} stroke="#27272a" strokeDasharray="4 4" strokeWidth="1" />
                          <text x="22" y={y + 4} fill="#a1a1aa" fontSize="11" fontWeight="700" textAnchor="end">{val}</text>
                        </g>
                      );
                    })}

                    {/* Plot Smooth Curves & Glow Area Fills */}
                    {chartCriteriaOptions.map(opt => {
                      if (!visibleChartKeys[opt.key]) return null;

                      const points = evaluations.map((ev, idx) => {
                        const x = 60 + (idx / Math.max(1, evaluations.length - 1)) * 710;
                        const val = ev[opt.key] !== undefined ? Number(ev[opt.key]) : 5;
                        const y = 220 - (val / 10) * 190;
                        const dateFormatted = ev.evaluation_date ? new Date(ev.evaluation_date).toLocaleDateString('de-DE') : `${ev.eval_quarter || ''} ${ev.eval_year || ''}`;
                        return { x, y, val, labelDate: dateFormatted };
                      });

                      // Smooth Bezier Curve Calculations
                      let smoothPath = `M ${points[0].x} ${points[0].y}`;
                      if (points.length === 2) {
                        smoothPath = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
                      } else if (points.length > 2) {
                        for (let i = 0; i < points.length - 1; i++) {
                          const curr = points[i];
                          const next = points[i + 1];
                          const mx = (curr.x + next.x) / 2;
                          smoothPath += ` C ${mx} ${curr.y}, ${mx} ${next.y}, ${next.x} ${next.y}`;
                        }
                      }

                      const firstP = points[0];
                      const lastP = points[points.length - 1];
                      const areaPath = `${smoothPath} L ${lastP.x} 220 L ${firstP.x} 220 Z`;

                      return (
                        <g key={opt.key} className="transition-all duration-300">
                          {/* Area Gradient Fill */}
                          <path d={areaPath} fill={`url(#grad-${opt.key})`} />

                          {/* Smooth Line Path */}
                          <path
                            d={smoothPath}
                            fill="none"
                            stroke={opt.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="drop-shadow-md"
                          />

                          {/* Solid Small Data Points (no hole) */}
                          {points.map((p, pIdx) => (
                            <g key={pIdx} className="group/node cursor-pointer">
                              {/* Hover aura */}
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="7"
                                fill={opt.color}
                                fillOpacity="0.25"
                                className="transition-all duration-200 group-hover/node:r-10"
                              />
                              {/* Solid Data Node */}
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="3.5"
                                fill={opt.color}
                                className="transition-all duration-200 group-hover/node:r-5"
                              />
                              {/* Value Label above node */}
                              <text
                                x={p.x}
                                y={p.y - 10}
                                fill="#ffffff"
                                fontSize="11"
                                fontWeight="800"
                                textAnchor="middle"
                                className="opacity-0 group-hover/node:opacity-100 transition-opacity duration-200"
                              >
                                {p.val.toFixed(1)}
                              </text>
                              <title>{`${opt.label}: ${p.val.toFixed(1)}/10 (${p.labelDate})`}</title>
                            </g>
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* X-Axis Date Labels */}
                <div className="flex justify-between pl-12 pr-4 mt-2 text-[11px] font-extrabold text-zinc-400 border-t border-zinc-800/80 pt-2">
                  {evaluations.map((ev, idx) => {
                    const dateFormatted = ev.evaluation_date ? new Date(ev.evaluation_date).toLocaleDateString('de-DE') : `${ev.eval_quarter || ''} ${ev.eval_year || ''}`;
                    return (
                      <div key={ev.id || idx} className="flex flex-col items-center">
                        <span className="text-zinc-300 font-bold">{dateFormatted}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{(ev.overall_rating || 0).toFixed(1)} / 10</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section: 16-Kriterien Quartals-Bewertungsmatrix (1-10) */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 lg:p-8 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>16-Kriterien Bewertung</span>
              </div>
              <h2 className="text-xl font-bold text-white">Quartals-Bewertungsmatrix (Skala 1 bis 10)</h2>
            </div>

            {canEditPlayer && (
              <button
                onClick={openNewEvalModal}
                className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Neue Bewertung</span>
              </button>
            )}
          </div>

          {evaluations.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs border border-zinc-800 rounded-2xl">
              Noch keine Bewertungen angelegt. Klicke auf <strong>"Neue Bewertung"</strong>, um den Spieler nach den 16 Kriterien zu beurteilen.
            </div>
          ) : (
            <div className="space-y-6">
              {evaluations.map(ev => (
                <div key={ev.id} className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-all space-y-4">
                  <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 pb-3 gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-xl text-xs font-black">
                        {ev.evaluation_date ? new Date(ev.evaluation_date).toLocaleDateString('de-DE') : `${ev.eval_quarter || ''} ${ev.eval_year || ''}`}
                      </span>
                      <span className="text-sm font-bold text-white">
                        Gesamtschnitt: <strong className="text-amber-400 font-mono text-base">{ev.overall_rating.toFixed(1)} / 10</strong>
                      </span>

                      {/* Ersteller Name */}
                      <span className="text-xs text-zinc-400 font-medium bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">
                        Erstellt von: <strong className="text-zinc-200">{ev.created_by_user_name || 'Trainer'}</strong>
                      </span>

                      {/* Approval Status */}
                      {!ev.is_approved ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-xs">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          ⏳ Freigabe ausstehend (durch Admin/Team-Admin)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-xs" title={ev.approved_by_user_name ? `Freigegeben von ${ev.approved_by_user_name}` : 'Freigegeben'}>
                          <span>✓ Freigegeben</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {canEditPlayer && !ev.is_approved && (
                        <button
                          onClick={() => handleApproveEvaluation(ev.id)}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                          title="Diese Bewertung als Admin/Team-Admin freigeben"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Freigeben</span>
                        </button>
                      )}

                      {canEditPlayer && (
                        <button
                          onClick={() => openEditEvalModal(ev)}
                          className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-primary" />
                          <span>Bearbeiten</span>
                        </button>
                      )}

                      {canEditPlayer && (
                        <button
                          onClick={() => handleDeleteEvaluation(ev.id)}
                          className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                          title="Diese Bewertung löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Löschen</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4 Categories Accordion / Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {/* Category 1 */}
                    <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/60">
                      <h4 className="font-bold text-blue-400 mb-2 border-b border-zinc-800 pb-1">1. Technik</h4>
                      <div className="space-y-1.5 text-[11px] text-zinc-300">
                        <div className="flex justify-between"><span>Ballkontrolle:</span><strong className="font-mono text-white">{ev.tech_ball_control}/10</strong></div>
                        <div className="flex justify-between"><span>Dribbling:</span><strong className="font-mono text-white">{ev.tech_dribbling}/10</strong></div>
                        <div className="flex justify-between"><span>Passspiel:</span><strong className="font-mono text-white">{ev.tech_passing}/10</strong></div>
                        <div className="flex justify-between"><span>Torschuss:</span><strong className="font-mono text-white">{ev.tech_shooting}/10</strong></div>
                        <div className="flex justify-between"><span>Beidfüßigkeit:</span><strong className="font-mono text-white">{ev.tech_both_feet}/10</strong></div>
                      </div>
                    </div>

                    {/* Category 2 */}
                    <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/60">
                      <h4 className="font-bold text-purple-400 mb-2 border-b border-zinc-800 pb-1">2. Taktik</h4>
                      <div className="space-y-1.5 text-[11px] text-zinc-300">
                        <div className="flex justify-between"><span>Spielintelligenz:</span><strong className="font-mono text-white">{ev.tact_intelligence}/10</strong></div>
                        <div className="flex justify-between"><span>Freilaufverhalten:</span><strong className="font-mono text-white">{ev.tact_space_creation}/10</strong></div>
                        <div className="flex justify-between"><span>Umschaltspiel:</span><strong className="font-mono text-white">{ev.tact_transition}/10</strong></div>
                        <div className="flex justify-between"><span>1-gegen-1:</span><strong className="font-mono text-white">{ev.tact_one_on_one}/10</strong></div>
                      </div>
                    </div>

                    {/* Category 3 */}
                    <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/60">
                      <h4 className="font-bold text-amber-400 mb-2 border-b border-zinc-800 pb-1">3. Physis & Koordination</h4>
                      <div className="space-y-1.5 text-[11px] text-zinc-300">
                        <div className="flex justify-between"><span>Schnelligkeit:</span><strong className="font-mono text-white">{ev.phys_speed}/10</strong></div>
                        <div className="flex justify-between"><span>Gewandtheit:</span><strong className="font-mono text-white">{ev.phys_agility}/10</strong></div>
                        <div className="flex justify-between"><span>Beweglichkeit:</span><strong className="font-mono text-white">{ev.phys_mobility}/10</strong></div>
                      </div>
                    </div>

                    {/* Category 4 */}
                    <div className="bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/60">
                      <h4 className="font-bold text-emerald-400 mb-2 border-b border-zinc-800 pb-1">4. Mental & Sozial</h4>
                      <div className="space-y-1.5 text-[11px] text-zinc-300">
                        <div className="flex justify-between"><span>Teamgeist:</span><strong className="font-mono text-white">{ev.ment_teamwork}/10</strong></div>
                        <div className="flex justify-between"><span>Einstellung:</span><strong className="font-mono text-white">{ev.ment_attitude}/10</strong></div>
                        <div className="flex justify-between"><span>Lernbereitschaft:</span><strong className="font-mono text-white">{ev.ment_learning}/10</strong></div>
                        <div className="flex justify-between"><span>Fairplay:</span><strong className="font-mono text-white">{ev.ment_fairplay}/10</strong></div>
                      </div>
                    </div>
                  </div>

                  {ev.overall_notes && (
                    <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-300 italic">
                      <strong className="text-zinc-400 not-italic block mb-0.5">Trainerfazit:</strong>
                      {ev.overall_notes}
                    </div>
                  )}

                  {ev.raw_transcript && (
                    <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 text-xs text-zinc-300">
                      <strong className="text-emerald-400 not-italic block mb-0.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" /> KI-Spracheingabe / Transkript:
                      </strong>
                      "{ev.raw_transcript}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- Neuer Bereich: Video-Szenen --- */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Sparkles className="w-48 h-48" />
          </div>
          
          <div className="flex items-start justify-between mb-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-0.5">
                <Sparkles className="w-4 h-4" />
                <span>Video-Szenen</span>
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">Erwähnungen in der Videoanalyse</h2>
            </div>
          </div>

          {taggedEvents.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
              Dieser Spieler wurde noch in keinem Video-Kommentar erwähnt.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {taggedEvents.map(event => (
                <div key={event.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 transition-all hover:border-zinc-600 group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-white text-sm">{event.match_name}</h4>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {event.match_date ? new Date(event.match_date).toLocaleDateString('de-DE') : ''}
                      </div>
                    </div>
                    <div className="bg-zinc-800 px-2.5 py-1 rounded-full text-xs font-mono font-bold text-zinc-300">
                      {Math.floor(event.video_time_ms / 60000)}:
                      {Math.floor((event.video_time_ms % 60000) / 1000).toString().padStart(2, '0')}
                    </div>
                  </div>
                  
                  <div className="text-sm text-zinc-300 bg-black/20 p-3 rounded-xl border border-white/5 mb-3">
                    {event.details?.text}
                  </div>
                  
                  <Link href={`/matches?id=${event.match_id}&t=${event.video_time_ms}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white transition-colors bg-primary/10 hover:bg-primary px-3 py-1.5 rounded-full">
                    <span>Szene im Player öffnen</span>
                    <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* --- Modal: Anwesenheit erfassen --- */}
      {isAttModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white">Anwesenheit / Absage erfassen</h2>
              <button onClick={() => setIsAttModalOpen(false)} className="text-zinc-400 hover:text-white text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleRecordAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Typ</label>
                <select
                  value={attType}
                  onChange={(e) => setAttType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                >
                  <option value="TRAINING">Training</option>
                  <option value="MATCH">Spiel</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Status</label>
                <select
                  value={attStatus}
                  onChange={(e) => setAttStatus(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                >
                  <option value="PRESENT">Anwesend</option>
                  <option value="EXCUSED">Entschuldigt abgesagt</option>
                  <option value="ABSENT">Unentschuldigt gefehlt</option>
                </select>
              </div>

              {attStatus !== 'PRESENT' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Absagegrund</label>
                  <select
                    value={attReason}
                    onChange={(e) => setAttReason(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="KRANKHEIT">Krankheit</option>
                    <option value="PRIVATES">Privates / Schule</option>
                    <option value="VERLETZUNG">Verletzung</option>
                    <option value="SONSTIGES">Sonstiges</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Notizen (optional)</label>
                <input
                  type="text"
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                  placeholder="z.B. Grippe, Schulausflug..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsAttModalOpen(false)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold">Abbrechen</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: 16-Kriterien Quartals-Bewertung (1-10 Matrix) --- */}
      {isEvalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            {/* Modal Header (Fixed) */}
            <div className="flex items-center justify-between border-b border-zinc-800 p-4 sm:p-5 shrink-0 bg-zinc-950/60">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400 shrink-0" />
                <span>{editingEvalId ? 'Bewertung bearbeiten' : 'Neue Bewertung (Skala 1 bis 10)'}</span>
              </h2>
              <button onClick={() => setIsEvalModalOpen(false)} className="text-zinc-400 hover:text-white text-xl font-bold p-1">&times;</button>
            </div>

            {/* Form with Scrollable Content & Sticky Footer */}
            <form onSubmit={handleSaveEvaluation} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Evaluation Date Selection */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Bewertungs-Datum *</label>
                  <input
                    type="date"
                    required
                    value={evalDate}
                    onChange={(e) => setEvalDate(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary w-full sm:w-auto"
                  />
                </div>

                {/* Info Banner when previous evaluation values are available */}
                {!editingEvalId && prevEval && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center justify-between">
                    <span className="font-semibold">
                      💡 Vorbelegt mit den Werten der letzten Bewertung ({new Date(prevEval.evaluation_date).toLocaleDateString('de-DE')})
                    </span>
                    <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-200 px-2 py-0.5 rounded-md font-mono">
                      Alt: {prevEval.tech_ball_control ?? '-'}
                    </span>
                  </div>
                )}

                {/* 1. Technik (5 Kriterien) */}
                <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-3">
                  <h3 className="font-bold text-blue-400 text-xs uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                    <span>1. Technische Fähigkeiten</span>
                    {!editingEvalId && prevEval && <span className="text-[10px] text-zinc-500 font-normal normal-case">Badges zeigen den alten Wert</span>}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Ballkontrolle & -annahme:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tech_ball_control !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tech_ball_control}</span>
                          )}
                          <strong className="text-blue-400 font-bold">{techBallControl}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={techBallControl} onChange={(e) => setTechBallControl(parseInt(e.target.value))} className="w-full h-2 accent-blue-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Dribbling & Ballführung:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tech_dribbling !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tech_dribbling}</span>
                          )}
                          <strong className="text-blue-400 font-bold">{techDribbling}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={techDribbling} onChange={(e) => setTechDribbling(parseInt(e.target.value))} className="w-full h-2 accent-blue-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Passspiel (Präzision & Schärfe):</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tech_passing !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tech_passing}</span>
                          )}
                          <strong className="text-blue-400 font-bold">{techPassing}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={techPassing} onChange={(e) => setTechPassing(parseInt(e.target.value))} className="w-full h-2 accent-blue-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Torschuss & Abschluss:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tech_shooting !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tech_shooting}</span>
                          )}
                          <strong className="text-blue-400 font-bold">{techShooting}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={techShooting} onChange={(e) => setTechShooting(parseInt(e.target.value))} className="w-full h-2 accent-blue-500 cursor-pointer" />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Beidfüßigkeit (Nutzung schwacher Fuß):</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tech_both_feet !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tech_both_feet}</span>
                          )}
                          <strong className="text-blue-400 font-bold">{techBothFeet}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={techBothFeet} onChange={(e) => setTechBothFeet(parseInt(e.target.value))} className="w-full h-2 accent-blue-500 cursor-pointer" />
                    </div>
                  </div>
                </div>

                {/* 2. Taktik (4 Kriterien) */}
                <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-3">
                  <h3 className="font-bold text-purple-400 text-xs uppercase tracking-wider border-b border-zinc-800 pb-1.5">2. Taktisches Grundverhalten</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Spielintelligenz & Übersicht:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tact_intelligence !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tact_intelligence}</span>
                          )}
                          <strong className="text-purple-400 font-bold">{tactIntelligence}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={tactIntelligence} onChange={(e) => setTactIntelligence(parseInt(e.target.value))} className="w-full h-2 accent-purple-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Freilaufverhalten & Räume:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tact_space_creation !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tact_space_creation}</span>
                          )}
                          <strong className="text-purple-400 font-bold">{tactSpaceCreation}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={tactSpaceCreation} onChange={(e) => setTactSpaceCreation(parseInt(e.target.value))} className="w-full h-2 accent-purple-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Umschaltspiel (Offensiv/Defensiv):</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tact_transition !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tact_transition}</span>
                          )}
                          <strong className="text-purple-400 font-bold">{tactTransition}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={tactTransition} onChange={(e) => setTactTransition(parseInt(e.target.value))} className="w-full h-2 accent-purple-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Zweikampfverhalten 1-gegen-1:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.tact_one_on_one !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.tact_one_on_one}</span>
                          )}
                          <strong className="text-purple-400 font-bold">{tactOneOnOne}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={tactOneOnOne} onChange={(e) => setTactOneOnOne(parseInt(e.target.value))} className="w-full h-2 accent-purple-500 cursor-pointer" />
                    </div>
                  </div>
                </div>

                {/* 3. Physis (3 Kriterien) */}
                <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-3">
                  <h3 className="font-bold text-amber-400 text-xs uppercase tracking-wider border-b border-zinc-800 pb-1.5">3. Physische & Koordinative Aspekte</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Schnelligkeit & Antritt:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.phys_speed !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.phys_speed}</span>
                          )}
                          <strong className="text-amber-400 font-bold">{physSpeed}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={physSpeed} onChange={(e) => setPhysSpeed(parseInt(e.target.value))} className="w-full h-2 accent-amber-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Gewandtheit & Wendigkeit:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.phys_agility !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.phys_agility}</span>
                          )}
                          <strong className="text-amber-400 font-bold">{physAgility}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={physAgility} onChange={(e) => setPhysAgility(parseInt(e.target.value))} className="w-full h-2 accent-amber-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Beweglichkeit & Koordination:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.phys_mobility !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.phys_mobility}</span>
                          )}
                          <strong className="text-amber-400 font-bold">{physMobility}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={physMobility} onChange={(e) => setPhysMobility(parseInt(e.target.value))} className="w-full h-2 accent-amber-500 cursor-pointer" />
                    </div>
                  </div>
                </div>

                {/* 4. Mental & Sozial (4 Kriterien) */}
                <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-3">
                  <h3 className="font-bold text-emerald-400 text-xs uppercase tracking-wider border-b border-zinc-800 pb-1.5">4. Mentale & Soziale Faktoren</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Teamgeist & Hilfsbereitschaft:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.ment_teamwork !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.ment_teamwork}</span>
                          )}
                          <strong className="text-emerald-400 font-bold">{mentTeamwork}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={mentTeamwork} onChange={(e) => setMentTeamwork(parseInt(e.target.value))} className="w-full h-2 accent-emerald-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Einstellung & Trainingsfleiß:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.ment_attitude !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.ment_attitude}</span>
                          )}
                          <strong className="text-emerald-400 font-bold">{mentAttitude}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={mentAttitude} onChange={(e) => setMentAttitude(parseInt(e.target.value))} className="w-full h-2 accent-emerald-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Lernbereitschaft (Anweisungen):</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.ment_learning !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.ment_learning}</span>
                          )}
                          <strong className="text-emerald-400 font-bold">{mentLearning}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={mentLearning} onChange={(e) => setMentLearning(parseInt(e.target.value))} className="w-full h-2 accent-emerald-500 cursor-pointer" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-medium text-zinc-300">Fairplay & Respekt:</label>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {!editingEvalId && prevEval && prevEval.ment_fairplay !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]" title="Letzter Wert">Alt: {prevEval.ment_fairplay}</span>
                          )}
                          <strong className="text-emerald-400 font-bold">{mentFairplay}</strong>
                        </div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={mentFairplay} onChange={(e) => setMentFairplay(parseInt(e.target.value))} className="w-full h-2 accent-emerald-500 cursor-pointer" />
                    </div>
                  </div>
                </div>

                {/* Overall Fazit */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Gesamteinschätzung / Trainerfazit</label>
                  <textarea
                    rows={3}
                    value={overallNotes}
                    onChange={(e) => setOverallNotes(e.target.value)}
                    placeholder="Zusammenfassung der Stärken, Potenziale und Entwicklungsziele..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary"
                  ></textarea>
                </div>
              </div>

              {/* Sticky Modal Footer (Fixed at Bottom for Mobile) */}
              <div className="flex justify-end gap-3 p-4 sm:p-5 border-t border-zinc-800 shrink-0 bg-zinc-950/80 backdrop-blur-md">
                <button type="button" onClick={() => setIsEvalModalOpen(false)} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all">Abbrechen</button>
                <button type="submit" className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all">Bewertung Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Report Modal */}
      <PrintablePlayerReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        player={player}
        evaluations={evaluations}
        attendances={attendances}
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
