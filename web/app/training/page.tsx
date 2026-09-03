"use client";

import { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Users,
  Clock,
  Layers,
  Pencil,
  Trash2,
  CheckCircle2,
  Printer,
  Sparkles,
  GripVertical,
  ChevronRight,
  Globe,
  Lock,
  Share2,
  Camera,
  Loader2
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import PrintableTrainingModal from '@/components/PrintableTrainingModal';
import ExerciseSketchEditor from '@/components/ExerciseSketchEditor';
import {
  getExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  getTrainingSessions,
  createTrainingSession,
  updateTrainingSession,
  deleteTrainingSession,
  toggleShareTrainingSession,
  scanExerciseCard,
  getMediaUrl
} from '@/services/api';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export default function TrainingPage() {
  const { user } = useAuth();
  const { toast, confirm: confirmModal } = useToast();
  const [activeTab, setActiveTab] = useState<'exercises' | 'sessions'>('exercises');
  const [exercises, setExercises] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState('Alle');
  const [selectedFocus, setSelectedFocus] = useState('Alle');
  const [authorFilter, setAuthorFilter] = useState<'ALL' | 'MINE' | 'OTHERS'>('ALL');

  // Custom Focus Areas (Admins can add new ones)
  const [focusAreas, setFocusAreas] = useState<string[]>([
    'Passspiel',
    'Koordination',
    'Torschuss',
    'Taktik',
    'Athletik',
    'Umschaltspiel',
    'Zweikampf',
    'Dribbling & Finten',
    'Torwartspiel'
  ]);
  const [newFocusInput, setNewFocusInput] = useState('');
  const [isAddingCustomFocus, setIsAddingCustomFocus] = useState(false);

  // Modals & Creation / Editing state
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [draggedExerciseId, setDraggedExerciseId] = useState<number | null>(null);
  const [expandedSessionIds, setExpandedSessionIds] = useState<number[]>([]);
  const [modalExerciseSearch, setModalExerciseSearch] = useState('');
  const [printingSession, setPrintingSession] = useState<any | null>(null);
  const [showSketchEditor, setShowSketchEditor] = useState(false);

  // Exercise Form
  const [exerciseForm, setExerciseForm] = useState({
    title: '',
    description: '',
    coaching_points: '',
    age_group: 'U10-U13',
    focus_area: 'Passspiel',
    min_players: 6,
    max_players: 12,
    duration_minutes: 15,
    materials: ['Hütchen', 'Bälle'],
    diagram_data: null as any,
    thumbnail_path: ''
  });

  // Session Form
  const [sessionForm, setSessionForm] = useState<{
    title: string;
    methodology: string;
    age_group: string;
    target_duration_minutes: number;
    notes: string;
    is_shared: boolean;
    assignedExercises: any[];
  }>({
    title: '',
    methodology: 'Trainingsphilosophie Deutschland',
    age_group: 'U10-U13',
    target_duration_minutes: 90,
    notes: '',
    is_shared: false,
    assignedExercises: []
  });

  // Toast warning state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const handleScanCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    toast.info('Kartothekkarte wird per KI gescannt...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await scanExerciseCard(formData);

      if (res && res.data) {
        const d = res.data;
        setExerciseForm(prev => ({
          ...prev,
          title: d.title || prev.title,
          description: d.description || prev.description,
          coaching_points: d.coaching_points || prev.coaching_points,
          focus_area: d.focus_area || prev.focus_area,
          age_group: d.age_group || prev.age_group,
          min_players: d.min_players || prev.min_players,
          max_players: d.max_players || prev.max_players,
          duration_minutes: d.duration_minutes || prev.duration_minutes,
          materials: Array.isArray(d.materials) ? d.materials : prev.materials
        }));
        toast.success('Kartothekkarte erfolgreich gescannt & eingetragen!');
      } else {
        toast.warning('Scan abgeschlossen, konnte Text jedoch nicht vollständig erfassen.');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Fehler beim Scannen der Karte. Bitte KI-Key in den Einstellungen prüfen.';
      toast.error(errMsg);
    } finally {
      setIsScanning(false);
    }
  };

  const canEdit = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'TEAM_ADMIN' || user?.role?.toUpperCase() === 'TRAINER';

  useEffect(() => {
    loadData();
  }, []);



  const loadData = async () => {
    setLoading(true);
    try {
      const [exData, sesData] = await Promise.all([
        getExercises(),
        getTrainingSessions()
      ]);
      if (Array.isArray(exData)) {
        setExercises(exData);
        // Collect existing focus areas
        const existingFocuses = exData.map(e => e.focus_area).filter(Boolean);
        setFocusAreas(prev => Array.from(new Set([...prev, ...existingFocuses])));
      }
      if (Array.isArray(sesData)) setSessions(sesData);
    } catch (err) {
      console.error('Fehler beim Laden der Trainingsdaten:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomFocusArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFocusInput.trim()) return;
    const clean = newFocusInput.trim();
    if (!focusAreas.includes(clean)) {
      setFocusAreas(prev => [...prev, clean]);
    }
    setExerciseForm(prev => ({ ...prev, focus_area: clean }));
    setNewFocusInput('');
    setIsAddingCustomFocus(false);
  };

  const openNewExerciseModal = () => {
    setEditingExerciseId(null);
    setExerciseForm({
      title: '',
      description: '',
      coaching_points: '',
      age_group: 'U10-U13',
      focus_area: 'Passspiel',
      min_players: 6,
      max_players: 12,
      duration_minutes: 15,
      materials: ['Hütchen', 'Bälle'],
      diagram_data: null,
      thumbnail_path: ''
    });
    setShowSketchEditor(false);
    setIsExerciseModalOpen(true);
  };

  const openEditExerciseModal = (ex: any) => {
    setEditingExerciseId(ex.id);
    setExerciseForm({
      title: ex.title || '',
      description: ex.description || '',
      coaching_points: ex.coaching_points || '',
      age_group: ex.age_group || 'U10-U13',
      focus_area: ex.focus_area || 'Passspiel',
      min_players: ex.min_players || 6,
      max_players: ex.max_players || 12,
      duration_minutes: ex.duration_minutes || 15,
      materials: ex.materials || ['Hütchen', 'Bälle'],
      diagram_data: ex.diagram_data || null,
      thumbnail_path: ex.thumbnail_path || ''
    });
    setShowSketchEditor(false);
    setIsExerciseModalOpen(true);
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExerciseId) {
        await updateExercise(editingExerciseId, exerciseForm);
      } else {
        await createExercise(exerciseForm);
      }
      setIsExerciseModalOpen(false);
      setShowSketchEditor(false);
      loadData();
      toast.success(editingExerciseId ? 'Übung erfolgreich aktualisiert' : 'Übung erfolgreich erstellt');
    } catch (err) {
      toast.error('Fehler beim Speichern der Übung');
    }
  };

  const handleDeleteExercise = async (id: number) => {
    const isConfirmed = await confirmModal({
      title: 'Übung löschen',
      message: 'Möchtest du diese Übung wirklich löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await deleteExercise(id);
      loadData();
      toast.success('Übung gelöscht');
    } catch (err) {
      toast.error('Fehler beim Löschen der Übung');
    }
  };

  const toggleSessionAccordion = (sessionId: number) => {
    setExpandedSessionIds(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const openNewSessionModal = () => {
    setEditingSessionId(null);
    setSessionForm({
      title: '',
      methodology: 'Trainingsphilosophie Deutschland',
      age_group: 'U10-U13',
      target_duration_minutes: 90,
      notes: '',
      is_shared: false,
      assignedExercises: []
    });
    setIsSessionModalOpen(true);
  };

  const openEditSessionModal = (ses: any) => {
    setEditingSessionId(ses.id);
    const assigned = (ses.exercises || []).map((e: any, idx: number) => ({
      exercise_id: e.exercise_id,
      section_name: e.section_name || 'Aktivierung',
      tempId: `ex-${e.exercise_id}-${idx}-${Date.now()}`
    }));

    const totalMin = assigned.reduce((acc: number, item: any) => {
      const exDetail = exercises.find(x => x.id === item.exercise_id);
      return acc + (exDetail?.duration_minutes || 0);
    }, 0);

    setSessionForm({
      title: ses.title || '',
      methodology: ses.methodology || 'Trainingsphilosophie Deutschland',
      age_group: ses.age_group || 'U10-U13',
      target_duration_minutes: totalMin > 0 ? totalMin : 90,
      notes: ses.notes || '',
      is_shared: !!ses.is_shared,
      assignedExercises: assigned
    });
    setIsSessionModalOpen(true);
  };

  const addExerciseToSection = (exerciseId: number, sectionName: string) => {
    const newItem = {
      exercise_id: exerciseId,
      section_name: sectionName,
      tempId: `ex-${exerciseId}-${Date.now()}-${Math.random()}`
    };
    setSessionForm(prev => ({
      ...prev,
      assignedExercises: [...prev.assignedExercises, newItem]
    }));
  };

  const removeExerciseFromSession = (tempId: string) => {
    setSessionForm(prev => ({
      ...prev,
      assignedExercises: prev.assignedExercises.filter(item => item.tempId !== tempId)
    }));
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate total duration of assigned exercises
    const currentTotalDuration = sessionForm.assignedExercises.reduce((acc, item) => {
      const exDetail = exercises.find(x => x.id === item.exercise_id);
      return acc + (exDetail?.duration_minutes || 0);
    }, 0);

    if (currentTotalDuration < sessionForm.target_duration_minutes) {
      const diff = sessionForm.target_duration_minutes - currentTotalDuration;
      triggerToast(`⚠️ Warnung: Die gewählten Übungen ergeben zusammen ${currentTotalDuration} Min. Für die Zielzeit von ${sessionForm.target_duration_minutes} Min. fehlen noch ${diff} Minuten!`);
    }

    try {
      const exercisesPayload = sessionForm.assignedExercises.map((item, idx) => ({
        exercise_id: item.exercise_id,
        order_index: idx + 1,
        section_name: item.section_name
      }));

      if (editingSessionId) {
        await updateTrainingSession(editingSessionId, {
          ...sessionForm,
          exercises: exercisesPayload
        });
      } else {
        await createTrainingSession({
          ...sessionForm,
          exercises: exercisesPayload
        });
      }
      setIsSessionModalOpen(false);
      loadData();
      toast.success(editingSessionId ? 'Trainingsplan erfolgreich aktualisiert' : 'Trainingsplan erfolgreich erstellt');
    } catch (err) {
      toast.error('Fehler beim Speichern des Trainingsplans');
    }
  };

  const handleDeleteSession = async (id: number) => {
    const isConfirmed = await confirmModal({
      title: 'Trainingsplan löschen',
      message: 'Möchtest du diesen Trainingsplan wirklich löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await deleteTrainingSession(id);
      loadData();
      toast.success('Trainingsplan gelöscht');
    } catch (err) {
      toast.error('Fehler beim Löschen des Trainingsplans');
    }
  };

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.title.toLowerCase().includes(searchQuery.toLowerCase()) || ex.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAge = selectedAge === 'Alle' || ex.age_group === selectedAge;
    const matchesFocus = selectedFocus === 'Alle' || ex.focus_area === selectedFocus;

    let matchesAuthor = true;
    if (authorFilter === 'MINE') {
      matchesAuthor = ex.created_by === user?.id || ex.creator?.id === user?.id;
    } else if (authorFilter === 'OTHERS') {
      matchesAuthor = ex.created_by !== user?.id && ex.creator?.id !== user?.id;
    }

    return matchesSearch && matchesAge && matchesFocus && matchesAuthor;
  });

  const handleToggleShareSession = async (sessionId: number) => {
    try {
      const updated = await toggleShareTrainingSession(sessionId);
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
      triggerToast(updated.is_shared ? 'Trainingsplan freigegeben' : 'Freigabe aufgehoben');
    } catch (err) {
      console.error('Fehler beim Teilen:', err);
      triggerToast('Fehler beim Ändern des Freigabestatus');
    }
  };

  const filteredSessions = sessions.filter(ses => {
    const isMine = ses.created_by === user?.id || ses.creator?.id === user?.id;
    if (authorFilter === 'MINE') return isMine;
    if (authorFilter === 'OTHERS') return !isMine && (ses.is_shared || user?.role?.toUpperCase() === 'ADMIN');
    return isMine || ses.is_shared || user?.role?.toUpperCase() === 'ADMIN';
  });

  const handleExportPDF = (ses: any) => {
    setPrintingSession(ses);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 font-sans text-white">
      <Navbar />

      <main className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Trainingsplan & Wissensdatenbank"
          subtitle="ÜBUNGS-BIBLIOTHEK, FT-GRAPHICS SKIZZEN-EDITOR & TRAININGS-ZUSAMMENSTELLUNG"
        />

        {/* Navigation Tabs */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('exercises')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'exercises'
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Übungs-Bibliothek ({exercises.length})
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'sessions'
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" /> Trainingspläne ({sessions.length})
            </button>
          </div>

          {canEdit && (
            <div className="flex items-center gap-3">
              {activeTab === 'exercises' ? (
                <button
                  onClick={openNewExerciseModal}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
                >
                  <Plus className="w-4 h-4" /> Neue Übung anlegen
                </button>
              ) : (
                <button
                  onClick={openNewSessionModal}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
                >
                  <Plus className="w-4 h-4" /> Neuen Trainingsplan erstellen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Content 1: Exercises Library */}
        {activeTab === 'exercises' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="space-y-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-400">Urheber:</span>
                  <button
                    onClick={() => setAuthorFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      authorFilter === 'ALL'
                        ? 'bg-zinc-800 text-white border border-zinc-700'
                        : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Alle Übungen
                  </button>
                  <button
                    onClick={() => setAuthorFilter('MINE')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      authorFilter === 'MINE'
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    👤 Meine eigenen Übungen
                  </button>
                  <button
                    onClick={() => setAuthorFilter('OTHERS')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      authorFilter === 'OTHERS'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    👥 Von anderen Trainern
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-4 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Übung suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={selectedAge}
                    onChange={(e) => setSelectedAge(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
                  >
                    <option value="Alle">Alle Altersklassen</option>
                    <option value="U7-U9">U7 - U9 (G & F-Jugend)</option>
                    <option value="U10-U13">U10 - U13 (E & D-Jugend)</option>
                    <option value="U14-U19">U14 - U19 (C bis A-Jugend)</option>
                    <option value="Senioren">Senioren / Herren / Damen</option>
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={selectedFocus}
                    onChange={(e) => setSelectedFocus(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
                  >
                    <option value="Alle">Alle Schwerpunkte</option>
                    {focusAreas.map((fa) => (
                      <option key={fa} value={fa}>{fa}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Exercises Grid */}
            {filteredExercises.length === 0 ? (
              <div className="text-center py-16 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
                <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Keine Übungen gefunden</h3>
                <p className="text-xs text-zinc-400 mt-1">Lege die erste Übung an oder passe deine Filter an.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredExercises.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden hover:border-zinc-700 transition-all group"
                  >
                    {/* Thumbnail / Diagram */}
                    <div className="h-44 bg-zinc-950 relative flex items-center justify-center border-b border-zinc-800 overflow-hidden">
                      {ex.thumbnail_path ? (
                        <img
                          src={ex.thumbnail_path.startsWith('data:') || ex.thumbnail_path.startsWith('http') ? ex.thumbnail_path : getMediaUrl(ex.thumbnail_path)}
                          alt={ex.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-4 text-zinc-600">
                          <Sparkles className="w-8 h-8 mx-auto mb-1 opacity-40" />
                          <span className="text-[10px] font-mono uppercase tracking-wider">Taktik-Skizze</span>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-zinc-900/90 backdrop-blur-md text-[10px] font-bold text-primary border border-primary/20">
                        {ex.age_group}
                      </span>
                      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-zinc-900/90 backdrop-blur-md text-[10px] font-bold text-zinc-300 border border-zinc-700">
                        {ex.focus_area}
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors">{ex.title}</h3>
                        {ex.description && (
                          <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">{ex.description}</p>
                        )}
                      </div>

                      <div className="space-y-3 border-t border-zinc-800/80 pt-3">
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{ex.min_players}-{ex.max_players} Spieler</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{ex.duration_minutes} Min</span>
                          </div>
                        </div>

                        {canEdit && (
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/40">
                            <button
                              onClick={() => openEditExerciseModal(ex)}
                              className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all text-xs font-bold flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Bearbeiten
                            </button>
                            <button
                              onClick={() => handleDeleteExercise(ex.id)}
                              className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Trainingspläne */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            {/* Filter Bar for Sessions */}
            <div className="space-y-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400">Urheber:</span>
                <button
                  onClick={() => setAuthorFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    authorFilter === 'ALL'
                      ? 'bg-zinc-800 text-white border border-zinc-700'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Alle Trainingspläne
                </button>
                <button
                  onClick={() => setAuthorFilter('MINE')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    authorFilter === 'MINE'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  👤 Meine eigenen Pläne
                </button>
                <button
                  onClick={() => setAuthorFilter('OTHERS')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    authorFilter === 'OTHERS'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  👥 Von anderen Trainern
                </button>
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-16 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
                <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Keine Trainingspläne für diesen Filter vorhanden</h3>
                <p className="text-xs text-zinc-400 mt-1">Erstelle einen neuen Trainingsplan oder passe deinen Urheber-Filter an.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredSessions.map((ses) => (
                  <div key={ses.id} id={`session-pdf-${ses.id}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/20 text-primary border border-primary/30">
                            {ses.age_group}
                          </span>
                          {ses.is_shared ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1" title="Für alle Trainer freigegeben">
                              <Globe className="w-3 h-3" /> Freigegeben
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1" title="Nur für dich sichtbar">
                              <Lock className="w-3 h-3 text-zinc-500" /> Privat
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-white mt-1.5">{ses.title}</h3>
                        <p className="text-xs text-zinc-400">
                          {ses.methodology}
                          {ses.created_by_user_id !== user?.id && (
                            <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                              👤 von {ses.creator_name || 'Trainer'}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="session-actions flex items-center gap-2">
                        {canEdit && (ses.created_by_user_id === user?.id || user?.role?.toUpperCase() === 'ADMIN') && (
                          <button
                            onClick={() => handleToggleShareSession(ses.id)}
                            className={`p-2 rounded-lg transition-all text-xs border ${
                              ses.is_shared
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                            }`}
                            title={ses.is_shared ? "Für Trainer freigegeben (Klicken zum Aufheben)" : "Privat (Klicken zum Teilen mit Trainern)"}
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleExportPDF(ses)}
                          className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all text-xs"
                          title="Als PDF exportieren"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditSessionModal(ses)}
                              className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all text-xs"
                              title="Bearbeiten"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(ses.id)}
                              className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const isExpanded = expandedSessionIds.includes(ses.id);
                      const exerciseCount = ses.exercises?.length || 0;

                      return (
                        <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                          <button
                            type="button"
                            onClick={() => toggleSessionAccordion(ses.id)}
                            className="w-full flex items-center justify-between text-xs font-bold text-zinc-300 hover:text-white transition-colors py-1 group/acc"
                          >
                            <span className="flex items-center gap-1.5">
                              <ChevronRight className={`w-3.5 h-3.5 text-primary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              Enthaltene Übungen ({exerciseCount})
                            </span>
                            <span className="text-[10px] text-zinc-500 font-normal group-hover/acc:text-zinc-300">
                              {isExpanded ? 'Einklappen ▲' : 'Ausklappen ▼'}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                              {(() => {
                                const grouped: { [key: string]: any[] } = {};
                                (ses.exercises || []).forEach((exItem: any) => {
                                  const sec = exItem.section_name || 'Hauptteil';
                                  if (!grouped[sec]) grouped[sec] = [];
                                  grouped[sec].push(exItem);
                                });

                                return Object.entries(grouped).map(([secName, exList]) => (
                                  <div key={secName} className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded border border-primary/20 inline-block">
                                      {secName}
                                    </span>
                                    <div className="space-y-1">
                                      {exList.map((exItem: any, idx: number) => {
                                        const exDetail = exItem.exercise || exercises.find(x => x.id === exItem.exercise_id);
                                        const exTitle = exDetail?.title || exItem.title || 'Übung';
                                        const exFocus = exDetail?.focus_area || exItem.focus_area || '';
                                        const exDuration = exDetail?.duration_minutes || exItem.duration_minutes || 15;
                                        return (
                                          <div key={exItem.id || idx} className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                              <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                {idx + 1}
                                              </span>
                                              <div>
                                                <h4 className="font-bold text-xs text-white leading-tight">{exTitle}</h4>
                                                <span className="text-[10px] text-zinc-500">{exFocus} · {exDuration} Min</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal: Übung anlegen / bearbeiten */}
        {isExerciseModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
            <div className="w-[95vw] max-w-7xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-white">
                    {editingExerciseId ? 'Übung bearbeiten' : 'Neue Übung in Wissensdatenbank eintragen'}
                  </h3>
                  
                  {/* Camera / Scan Card Button */}
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleScanCardUpload}
                  />
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => scanInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 text-xs font-bold transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
                    title="Fotografiere eine Übungskarte (Text & Daten werden per KI ausgelesen)"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Analysiere Karte...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-amber-400" />
                        <span>📷 Karte scannen</span>
                      </>
                    )}
                  </button>
                </div>
                <button onClick={() => setIsExerciseModalOpen(false)} className="text-zinc-500 hover:text-white text-lg">✕</button>
              </div>


              <form onSubmit={handleSaveExercise} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1.5">Titel der Übung</label>
                    <input
                      type="text"
                      required
                      value={exerciseForm.title}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, title: e.target.value })}
                      placeholder="z. B. 4-gegen-2 Freilaufspiel"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1.5">Altersklasse</label>
                    <select
                      value={exerciseForm.age_group}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, age_group: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="U7-U9">U7 - U9</option>
                      <option value="U10-U13">U10 - U13</option>
                      <option value="U14-U19">U14 - U19</option>
                      <option value="Senioren">Senioren</option>
                      <option value="Alle">Alle</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-zinc-400">Trainingsschwerpunkt</label>
                      {canEdit && !isAddingCustomFocus && (
                        <button
                          type="button"
                          onClick={() => setIsAddingCustomFocus(true)}
                          className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Neuer Schwerpunkt
                        </button>
                      )}
                    </div>

                    {isAddingCustomFocus ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={newFocusInput}
                          onChange={(e) => setNewFocusInput(e.target.value)}
                          placeholder="Neuen Schwerpunkt..."
                          className="w-full rounded-xl border border-primary bg-zinc-900 px-3 py-2 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomFocusArea}
                          className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold shrink-0"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingCustomFocus(false)}
                          className="text-zinc-500 hover:text-white text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        value={exerciseForm.focus_area}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, focus_area: e.target.value })}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                      >
                        {focusAreas.map((fa) => (
                          <option key={fa} value={fa}>{fa}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-400 block mb-1.5">Min. Spieler</label>
                      <input
                        type="number"
                        value={exerciseForm.min_players}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, min_players: parseInt(e.target.value) || 2 })}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-400 block mb-1.5">Dauer (Min)</label>
                      <input
                        type="number"
                        value={exerciseForm.duration_minutes}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, duration_minutes: parseInt(e.target.value) || 10 })}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-zinc-400 block mb-1.5">Coaching-Punkte</label>
                    <input
                      type="text"
                      value={exerciseForm.coaching_points}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, coaching_points: e.target.value })}
                      placeholder="z. B. Sauberes Passspiel, offene Stellung, Kommunikation"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1.5">Ablauf & Beschreibung</label>
                  <textarea
                    rows={4}
                    value={exerciseForm.description}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                    placeholder="Detaillierte Ablaufbeschreibung..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Sketch Editor Section */}
                <div className="border-t border-zinc-800 pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-white">FT-Graphics Taktik-Skizze</span>
                    <button
                      type="button"
                      onClick={() => setShowSketchEditor(!showSketchEditor)}
                      className="text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20"
                    >
                      {showSketchEditor ? 'Skizzen-Editor verbergen' : 'Skizze im Editor zeichnen / anpassen'}
                    </button>
                  </div>

                  {showSketchEditor && (
                    <ExerciseSketchEditor
                      initialData={exerciseForm.diagram_data}
                      onSave={(diagramData, thumbnailDataUrl) => {
                        setExerciseForm({
                          ...exerciseForm,
                          diagram_data: diagramData,
                          thumbnail_path: thumbnailDataUrl
                        });
                        setShowSketchEditor(false);
                      }}
                    />
                  )}
                </div>

                <div className="flex justify-end gap-3 border-t border-zinc-800 pt-5">
                  <button
                    type="button"
                    onClick={() => setIsExerciseModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-bold hover:text-white"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover"
                  >
                    {editingExerciseId ? 'Änderungen Speichern' : 'Übung Speichern'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Neuen Trainingsplan anlegen */}
        {isSessionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
            <div className="w-[95vw] max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <h3 className="text-xl font-bold text-white">{editingSessionId ? 'Trainingsplan bearbeiten' : 'Neuen Trainingsplan zusammenstellen'}</h3>
                <button onClick={() => setIsSessionModalOpen(false)} className="text-zinc-500 hover:text-white text-lg">✕</button>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1.5">Titel der Einheit</label>
                    <input
                      type="text"
                      required
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                      placeholder="z. B. Dienstag - Gegenpressing"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1.5">Altersklasse</label>
                    <select
                      value={sessionForm.age_group}
                      onChange={(e) => setSessionForm({ ...sessionForm, age_group: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="U7-U9">U7 - U9</option>
                      <option value="U10-U13">U10 - U13</option>
                      <option value="U14-U19">U14 - U19</option>
                      <option value="Senioren">Senioren</option>
                      <option value="Alle">Alle</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1.5">Strukturmodell / Philosophie</label>
                    <select
                      value={sessionForm.methodology}
                      onChange={(e) => setSessionForm({ ...sessionForm, methodology: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="Trainingsphilosophie Deutschland">Trainingsphilosophie Deutschland (Standard)</option>
                      <option value="3 + 3">3 + 3 (3 Basiselemente + 3 Spielformen)</option>
                      <option value="Freie Struktur">Freie Struktur</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1.5">Zielzeit (Minuten)</label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={240}
                      value={sessionForm.target_duration_minutes}
                      onChange={(e) => setSessionForm({ ...sessionForm, target_duration_minutes: parseInt(e.target.value) || 90 })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <input
                    type="checkbox"
                    id="is_shared"
                    checked={sessionForm.is_shared}
                    onChange={(e) => setSessionForm({ ...sessionForm, is_shared: e.target.checked })}
                    className="w-4 h-4 rounded accent-primary bg-zinc-950 border-zinc-800 cursor-pointer"
                  />
                  <label htmlFor="is_shared" className="text-xs font-bold text-zinc-300 cursor-pointer flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    Für andere Trainer freigeben (In der Trainer-Bibliothek teilen)
                  </label>
                </div>

                {/* Split Layout: Available Exercises (Left) vs Section Blocks (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 border-t border-zinc-800">
                  {/* Left Column: Verfügbare Übungen */}
                  <div className="lg:col-span-5 space-y-3">
                    {(() => {
                      const filteredModalExercises = exercises.filter(ex => {
                        if (!modalExerciseSearch.trim()) return true;
                        const q = modalExerciseSearch.toLowerCase();
                        return (
                          ex.title.toLowerCase().includes(q) ||
                          (ex.description && ex.description.toLowerCase().includes(q)) ||
                          (ex.focus_area && ex.focus_area.toLowerCase().includes(q))
                        );
                      });

                      return (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                Verfügbare Übungen ({filteredModalExercises.length})
                              </h4>
                            </div>

                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <input
                                type="text"
                                value={modalExerciseSearch}
                                onChange={(e) => setModalExerciseSearch(e.target.value)}
                                placeholder="Übungen durchsuchen..."
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="max-h-[440px] overflow-y-auto space-y-2.5 pr-1">
                            {filteredModalExercises.length === 0 ? (
                              <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                                Keine Übung für "{modalExerciseSearch}" gefunden.
                              </div>
                            ) : (
                              filteredModalExercises.map((ex) => (
                                <div
                                  key={ex.id}
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedExerciseId(ex.id);
                                    e.dataTransfer.setData('text/plain', ex.id.toString());
                                  }}
                                  onDragEnd={() => setDraggedExerciseId(null)}
                                  className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-primary/50 cursor-grab active:cursor-grabbing transition-all group select-none flex items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <GripVertical className="w-4 h-4 text-zinc-600 group-hover:text-primary transition-colors shrink-0" />
                                    <div className="min-w-0">
                                      <h5 className="font-bold text-xs text-white truncate">{ex.title}</h5>
                                      <span className="text-[10px] text-zinc-400 block truncate">
                                        {ex.duration_minutes} Min. • {ex.focus_area} ({ex.age_group})
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase px-2 py-1 rounded bg-zinc-800/80 border border-zinc-700/50 shrink-0">
                                    Ziehen ↗
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Right Column: Trainingsblöcke */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Trainings-Struktur ({sessionForm.methodology})</h4>
                      {(() => {
                        const totalMin = sessionForm.assignedExercises.reduce((acc, item) => {
                          const exDetail = exercises.find(x => x.id === item.exercise_id);
                          return acc + (exDetail?.duration_minutes || 0);
                        }, 0);
                        const isOk = totalMin >= sessionForm.target_duration_minutes;
                        return (
                          <span className={`text-xs font-bold ${isOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                            Gesamtdauer: {totalMin} / {sessionForm.target_duration_minutes} Min.
                          </span>
                        );
                      })()}
                    </div>

                    {sessionForm.methodology === 'Trainingsphilosophie Deutschland' ? (
                      <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                        {[
                          { name: 'Aktivierung', label: '1. Aktivierung', targetMin: 15 },
                          { name: 'Spielblock 1', label: '2. Spielblock 1', targetMin: 30 },
                          { name: 'Zwischenblock', label: '3. Zwischenblock', targetMin: 15 },
                          { name: 'Spielblock 2', label: '4. Spielblock 2', targetMin: 30 }
                        ].map((sec) => {
                          const assignedInSec = sessionForm.assignedExercises.filter(item => item.section_name === sec.name);
                          const secDuration = assignedInSec.reduce((acc, item) => {
                            const exDetail = exercises.find(x => x.id === item.exercise_id);
                            return acc + (exDetail?.duration_minutes || 0);
                          }, 0);

                          return (
                            <div
                              key={sec.name}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'copy';
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedExerciseId) {
                                  addExerciseToSection(draggedExerciseId, sec.name);
                                  setDraggedExerciseId(null);
                                }
                              }}
                              className={`p-3.5 rounded-xl bg-zinc-900 border transition-all space-y-2 ${
                                draggedExerciseId
                                  ? 'border-dashed border-primary/70 bg-primary/10 shadow-lg shadow-primary/10'
                                  : 'border-zinc-800'
                              }`}
                            >
                              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                                  <span>{sec.label}</span>
                                </span>
                                <span className={`text-[11px] font-bold ${secDuration >= sec.targetMin ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                  {secDuration} / {sec.targetMin} Min.
                                </span>
                              </div>

                              {assignedInSec.length === 0 ? (
                                <div className="text-[11px] text-zinc-500 italic py-2 text-center border border-dashed border-zinc-800/60 rounded-lg">
                                  Übung hierher ziehen oder unten zuweisen
                                </div>
                              ) : (
                                <div className="space-y-1.5 pt-1">
                                  {assignedInSec.map((item, idx) => {
                                    const exDetail = exercises.find(x => x.id === item.exercise_id);
                                    return (
                                      <div key={item.tempId || idx} className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                                        <div>
                                          <span className="font-bold text-white">{exDetail?.title || 'Übung'}</span>
                                          <span className="text-[10px] text-zinc-400 ml-2">({exDetail?.duration_minutes || 15} Min.)</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removeExerciseFromSession(item.tempId)}
                                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                                          title="Entfernen"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Generic or 3+3 view */
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedExerciseId) {
                            addExerciseToSection(draggedExerciseId, 'Hauptteil');
                            setDraggedExerciseId(null);
                          }
                        }}
                        className={`space-y-3 max-h-[460px] overflow-y-auto pr-1 p-2 rounded-xl border transition-all ${
                          draggedExerciseId ? 'border-dashed border-primary/70 bg-primary/10' : 'border-transparent'
                        }`}
                      >
                        {sessionForm.assignedExercises.length === 0 ? (
                          <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                            Wähle links Übungen aus oder ziehe sie hierher, um sie deinem Trainingsplan zuzuweisen.
                          </div>
                        ) : (
                          sessionForm.assignedExercises.map((item, idx) => {
                            const exDetail = exercises.find(x => x.id === item.exercise_id);
                            return (
                              <div key={item.tempId || idx} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
                                <div>
                                  <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold mr-2">{item.section_name}</span>
                                  <span className="font-bold text-white">{exDetail?.title || 'Übung'}</span>
                                  <span className="text-[10px] text-zinc-400 ml-2">({exDetail?.duration_minutes || 15} Min.)</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeExerciseFromSession(item.tempId)}
                                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsSessionModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-bold hover:text-white"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover"
                  >
                    Trainingsplan Speichern
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5-Second Toast Warning Container */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-[200] max-w-md bg-amber-500/90 text-black border border-amber-400 p-4 rounded-2xl shadow-2xl backdrop-blur-md animate-bounce">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1 text-xs font-extrabold leading-snug">
                {toastMessage}
              </div>
              <button onClick={() => setToastMessage(null)} className="text-black/60 hover:text-black text-xs font-bold">✕</button>
            </div>
          </div>
        )}
        {/* Printable Training Plan Modal */}
        {printingSession && (
          <PrintableTrainingModal
            session={printingSession}
            exercisesList={exercises}
            onClose={() => setPrintingSession(null)}
          />
        )}
      </main>
    </div>
  );
}
