"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import {
  getTacticsPreferences,
  getTacticsBoard,
  createTacticsBoard,
  updateTacticsBoard
} from '@/services/api';

import TacticsToolbar from './TacticsToolbar';
import TacticsBoardCanvas, {
  TacticsFrame,
  PlayerToken,
  BallItem
} from './TacticsBoardCanvas';
import TacticsTimeline from './TacticsTimeline';
import TacticsPreferencesModal from './TacticsPreferencesModal';
import TacticsFormationModal from './TacticsFormationModal';
import TacticsSquadDrawer from './TacticsSquadDrawer';
import TacticsPresentationOverlay from './TacticsPresentationOverlay';
import TacticsExportModal from './TacticsExportModal';
import TacticsPlayerEditModal from './TacticsPlayerEditModal';
import { Edit3, Trash2, X } from 'lucide-react';

interface TacticsBoardProps {
  initialBoardId?: string;
}

export default function TacticsBoard({ initialBoardId }: TacticsBoardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null!);

  // Board Meta State
  const [boardId, setBoardId] = useState<string | null>(initialBoardId || null);
  const [boardTitle, setBoardTitle] = useState<string>('Neue Taktik');
  const [category, setCategory] = useState<string>('Allgemein');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isShared, setIsShared] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Active Tool & Style State
  const [activeTool, setActiveTool] = useState<string>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#3b82f6');
  const [pitchType, setPitchType] = useState<string>('full_horizontal');
  const [pitchStyle, setPitchStyle] = useState<string>('grass_classic');
  const [showTacticalGrid, setShowTacticalGrid] = useState<boolean>(false);
  const [showHalfSpaces, setShowHalfSpaces] = useState<boolean>(false);
  const [autoChainLines, setAutoChainLines] = useState<boolean>(false);
  const [laserFadeSeconds, setLaserFadeSeconds] = useState<number>(1.5);
  const [playerLabelMode, setPlayerLabelMode] = useState<'number' | 'name' | 'initials' | 'role'>('number');

  // Colors
  const [homeColors, setHomeColors] = useState({
    primary: '#3b82f6',
    secondary: '#ffffff',
    goalkeeper: '#10b981',
    text: '#ffffff'
  });
  const [awayColors, setAwayColors] = useState({
    primary: '#ef4444',
    secondary: '#ffffff',
    goalkeeper: '#f59e0b',
    text: '#ffffff'
  });

  // Default Standard 11v11 Pitch Setup
  const createDefaultHomeTeam = (): PlayerToken[] => [
    { id: 'h1', x: 0.08, y: 0.50, team: 'home', number: 1, name: 'TW', role: 'TW', isGoalkeeper: true },
    { id: 'h2', x: 0.24, y: 0.15, team: 'home', number: 3, name: 'LV', role: 'LV' },
    { id: 'h3', x: 0.22, y: 0.38, team: 'home', number: 4, name: 'IV', role: 'IV' },
    { id: 'h4', x: 0.22, y: 0.62, team: 'home', number: 5, name: 'IV', role: 'IV' },
    { id: 'h5', x: 0.24, y: 0.85, team: 'home', number: 2, name: 'RV', role: 'RV' },
    { id: 'h6', x: 0.36, y: 0.50, team: 'home', number: 6, name: 'DM', role: 'DM' },
    { id: 'h7', x: 0.48, y: 0.32, team: 'home', number: 8, name: 'ZM', role: 'ZM' },
    { id: 'h8', x: 0.48, y: 0.68, team: 'home', number: 10, name: 'ZM', role: 'ZM' },
    { id: 'h9', x: 0.66, y: 0.18, team: 'home', number: 11, name: 'LA', role: 'LA' },
    { id: 'h10', x: 0.70, y: 0.50, team: 'home', number: 9, name: 'ST', role: 'ST' },
    { id: 'h11', x: 0.66, y: 0.82, team: 'home', number: 7, name: 'RA', role: 'RA' }
  ];

  // Multi-Phase Animation Frames State
  const [frames, setFrames] = useState<TacticsFrame[]>([
    {
      id: 'f1',
      title: 'Phase 1: Grundaufstellung',
      duration: 1.8,
      players: createDefaultHomeTeam(),
      balls: [{ id: 'b1', x: 0.50, y: 0.50 }],
      equipment: [],
      lines: [],
      zones: [],
      texts: []
    }
  ]);

  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(true);

  // History (Undo / Redo)
  const [undoStack, setUndoStack] = useState<TacticsFrame[][]>([]);
  const [redoStack, setRedoStack] = useState<TacticsFrame[][]>([]);

  // Modals Visibility
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isFormationsOpen, setIsFormationsOpen] = useState(false);
  const [isSquadDrawerOpen, setIsSquadDrawerOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // --- 1. Load User Preferences on Mount ---
  useEffect(() => {
    loadUserPreferences();
  }, []);

  // --- 2. Load Board Data if initialBoardId provided ---
  useEffect(() => {
    if (initialBoardId) {
      loadBoard(initialBoardId);
    }
  }, [initialBoardId]);

  const loadUserPreferences = async () => {
    try {
      const prefs = await getTacticsPreferences();
      if (prefs) {
        applyPreferences(prefs);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Vorlieben:', err);
    }
  };

  const applyPreferences = (prefs: any) => {
    if (prefs.default_pitch_type) setPitchType(prefs.default_pitch_type);
    if (prefs.default_pitch_style) setPitchStyle(prefs.default_pitch_style);
    if (prefs.default_tool) setActiveTool(prefs.default_tool);
    if (prefs.default_player_label_mode) setPlayerLabelMode(prefs.default_player_label_mode);
    if (prefs.laser_fade_seconds) setLaserFadeSeconds(prefs.laser_fade_seconds);
    if (prefs.animation_speed) setPlaybackSpeed(prefs.animation_speed);
    if (prefs.auto_chain_lines !== undefined) setAutoChainLines(prefs.auto_chain_lines);
    if (prefs.show_tactical_grid !== undefined) setShowTacticalGrid(prefs.show_tactical_grid);

    if (prefs.home_team_colors) {
      setHomeColors({
        primary: prefs.home_team_colors.primary || '#3b82f6',
        secondary: prefs.home_team_colors.secondary || '#ffffff',
        goalkeeper: prefs.home_team_colors.goalkeeper || '#10b981',
        text: prefs.home_team_colors.text || '#ffffff'
      });
      setSelectedColor(prefs.home_team_colors.primary || '#3b82f6');
    }
    if (prefs.away_team_colors) {
      setAwayColors({
        primary: prefs.away_team_colors.primary || '#ef4444',
        secondary: prefs.away_team_colors.secondary || '#ffffff',
        goalkeeper: prefs.away_team_colors.goalkeeper || '#f59e0b',
        text: prefs.away_team_colors.text || '#ffffff'
      });
    }
  };

  const loadBoard = async (id: string) => {
    try {
      const data = await getTacticsBoard(id);
      if (data) {
        setBoardId(data.id);
        setBoardTitle(data.title || 'Taktik');
        setCategory(data.category || 'Allgemein');
        setTeamId(data.team_id || null);
        setIsShared(Boolean(data.is_shared));
        if (data.pitch_type) setPitchType(data.pitch_type);
        if (data.pitch_style) setPitchStyle(data.pitch_style);
        if (Array.isArray(data.frames_data) && data.frames_data.length > 0) {
          setFrames(data.frames_data);
          setActiveFrameIndex(0);
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden der Tafel:', err);
      toast.error('Fehler beim Laden der Taktiktafel.');
    }
  };

  // --- Frame Update with Undo/Redo Record ---
  const handleUpdateCurrentFrame = (updater: (prev: TacticsFrame) => TacticsFrame) => {
    setUndoStack((prev) => [...prev.slice(-20), frames]);
    setRedoStack([]);

    setFrames((prevFrames) => {
      const nextFrames = [...prevFrames];
      const cur = nextFrames[activeFrameIndex] || {
        players: [],
        balls: [],
        equipment: [],
        lines: [],
        zones: [],
        texts: []
      };
      nextFrames[activeFrameIndex] = updater(cur);
      return nextFrames;
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevFrames = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, frames]);
    setUndoStack((prev) => prev.slice(0, -1));
    setFrames(prevFrames);
    if (activeFrameIndex >= prevFrames.length) {
      setActiveFrameIndex(prevFrames.length - 1);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextFrames = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, frames]);
    setRedoStack((prev) => prev.slice(0, -1));
    setFrames(nextFrames);
  };

  // --- Timeline Frame Management ---
  const handleAddFrame = () => {
    const curFrame = frames[activeFrameIndex];
    // Copy positions from current frame to maintain continuity
    const newFrame: TacticsFrame = {
      id: `f_${Date.now()}`,
      title: `Phase ${frames.length + 1}`,
      duration: 1.8,
      players: JSON.parse(JSON.stringify(curFrame.players || [])),
      balls: JSON.parse(JSON.stringify(curFrame.balls || [])),
      equipment: JSON.parse(JSON.stringify(curFrame.equipment || [])),
      lines: [], // Fresh drawings for new phase
      zones: JSON.parse(JSON.stringify(curFrame.zones || [])),
      texts: []
    };

    setFrames((prev) => [...prev, newFrame]);
    setActiveFrameIndex(frames.length);
    toast.success(`Phase ${frames.length + 1} hinzugefügt!`);
  };

  const handleDuplicateFrame = (index: number) => {
    const target = frames[index];
    if (!target) return;
    const copy: TacticsFrame = {
      ...JSON.parse(JSON.stringify(target)),
      id: `f_${Date.now()}`,
      title: `${target.title || `Phase ${index + 1}`} (Kopie)`
    };
    const nextFrames = [...frames];
    nextFrames.splice(index + 1, 0, copy);
    setFrames(nextFrames);
    setActiveFrameIndex(index + 1);
    toast.success('Phase dupliziert.');
  };

  const handleDeleteFrame = (index: number) => {
    if (frames.length <= 1) return;
    const nextFrames = frames.filter((_, i) => i !== index);
    setFrames(nextFrames);
    setActiveFrameIndex(Math.max(0, Math.min(index, nextFrames.length - 1)));
    toast.success('Phase gelöscht.');
  };

  const handleUpdateFrameTitle = (index: number, title: string) => {
    setFrames((prev) =>
      prev.map((f, i) => (i === index ? { ...f, title } : f))
    );
  };

  // --- Playback Stepping ---
  const handleStepNextFrame = () => {
    if (activeFrameIndex < frames.length - 1) {
      setActiveFrameIndex((prev) => prev + 1);
    } else if (isLooping) {
      setActiveFrameIndex(0);
    } else {
      setIsPlaying(false);
    }
  };

  // --- Clear Drawings on Current Phase ---
  const handleClearDrawings = () => {
    handleUpdateCurrentFrame((prev) => ({
      ...prev,
      lines: [],
      zones: [],
      texts: []
    }));
    toast.success('Zeichnungen dieser Phase geleert.');
  };

  // --- Delete Selected Element ---
  const handleDeleteSelected = () => {
    if (!selectedElementId) return;
    handleUpdateCurrentFrame((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== selectedElementId),
      balls: prev.balls.filter((b) => b.id !== selectedElementId),
      equipment: prev.equipment.filter((eq) => eq.id !== selectedElementId),
      texts: prev.texts.filter((t) => t.id !== selectedElementId)
    }));
    setSelectedElementId(null);
    toast.success('Element gelöscht.');
  };

  // --- Apply Formation to Current Frame ---
  const handleApplyFormation = (positionsData: any[]) => {
    handleUpdateCurrentFrame((prev) => {
      const existingHomeTokens = prev.players.filter((p) => p.team === 'home');
      const otherTokens = prev.players.filter((p) => p.team !== 'home');

      const updatedHome: PlayerToken[] = positionsData.map((pos, idx) => {
        const existing = existingHomeTokens[idx];
        return {
          id: existing?.id || `p_h_${idx + 1}`,
          x: pos.x,
          y: pos.y,
          team: 'home',
          number: existing?.number || pos.number || idx + 1,
          name: existing?.name || pos.label || `H${idx + 1}`,
          role: pos.role || existing?.role || 'SP',
          isGoalkeeper: pos.role === 'TW' || idx === 0
        };
      });

      return {
        ...prev,
        players: [...updatedHome, ...otherTokens]
      };
    });
  };

  // --- Add Player Token from Squad Drawer ---
  const handleAddPlayerToken = (playerData: any) => {
    const newToken: PlayerToken = {
      id: playerData.id,
      x: playerData.team === 'home' ? 0.35 : 0.65,
      y: 0.50,
      team: playerData.team,
      number: playerData.number,
      name: playerData.name,
      role: playerData.role,
      avatar_url: playerData.avatar_url,
      isGoalkeeper: playerData.role === 'TW'
    };

    handleUpdateCurrentFrame((prev) => ({
      ...prev,
      players: [...prev.players, newToken]
    }));
    toast.success(`${playerData.name} aufgestellt!`);
  };

  // --- Save Board to Cloud API ---
  const handleSaveBoard = async () => {
    setIsSaving(true);
    try {
      // Generate Thumbnail Data URL
      let thumbnailDataUrl: string | null = null;
      if (canvasRef.current) {
        thumbnailDataUrl = canvasRef.current.toDataURL('image/png', 0.85);
      }

      const payload = {
        title: boardTitle.trim() || 'Neue Taktik',
        description: '',
        category: category || 'Allgemein',
        team_id: teamId,
        pitch_type: pitchType,
        pitch_style: pitchStyle,
        is_shared: isShared,
        frames_data: frames,
        thumbnail_data: thumbnailDataUrl
      };

      if (boardId) {
        await updateTacticsBoard(boardId, payload);
        toast.success('Taktiktafel erfolgreich aktualisiert!');
      } else {
        const created = await createTacticsBoard(payload);
        if (created?.id) {
          setBoardId(created.id);
        }
        toast.success('Taktiktafel neu in der Cloud gespeichert!');
      }
    } catch (err: any) {
      console.error('Fehler beim Speichern der Taktiktafel:', err);
      toast.error('Fehler beim Speichern der Taktiktafel.');
    } finally {
      setIsSaving(false);
    }
  };

  const [isPlayerEditOpen, setIsPlayerEditOpen] = useState<boolean>(false);
  const selectedPlayer =
    frames[activeFrameIndex]?.players?.find((p) => p.id === selectedElementId) || null;

  const handleUpdatePlayer = (updated: Partial<PlayerToken>) => {
    if (!selectedElementId) return;
    handleUpdateCurrentFrame((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === selectedElementId ? { ...p, ...updated } : p))
    }));
  };

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-4rem)] min-h-[640px] max-h-screen overflow-hidden p-2 sm:p-4 gap-2 sm:gap-3 bg-zinc-950 font-sans">
      
      {/* 1. Top Header & Ribbon Toolbar */}
      <TacticsToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        selectedColor={selectedColor}
        onSelectColor={setSelectedColor}
        pitchType={pitchType}
        onChangePitchType={setPitchType}
        pitchStyle={pitchStyle}
        onChangePitchStyle={setPitchStyle}
        showTacticalGrid={showTacticalGrid}
        onToggleTacticalGrid={() => setShowTacticalGrid((prev) => !prev)}
        showHalfSpaces={showHalfSpaces}
        onToggleHalfSpaces={() => setShowHalfSpaces((prev) => !prev)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onClearDrawings={handleClearDrawings}
        onDeleteSelected={handleDeleteSelected}
        hasSelection={Boolean(selectedElementId)}
        onOpenFormations={() => setIsFormationsOpen(true)}
        onOpenSquadDrawer={() => setIsSquadDrawerOpen(true)}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onTogglePresentation={() => setIsPresentationOpen(true)}
        onSaveBoard={handleSaveBoard}
        isSaving={isSaving}
        onOpenLibrary={() => router.push('/tactics/library')}
        boardTitle={boardTitle}
        onChangeTitle={setBoardTitle}
        category={category}
        onChangeCategory={setCategory}
        homeColor={homeColors.primary}
        awayColor={awayColors.primary}
      />

      {/* 2. Central Interactive Pitch Canvas */}
      <div className="flex-1 w-full relative min-h-0">
        <TacticsBoardCanvas
          canvasRef={canvasRef}
          activeTool={activeTool}
          selectedColor={selectedColor}
          pitchType={pitchType}
          pitchStyle={pitchStyle}
          showTacticalGrid={showTacticalGrid}
          showHalfSpaces={showHalfSpaces}
          homeColors={homeColors}
          awayColors={awayColors}
          playerLabelMode={playerLabelMode}
          laserFadeSeconds={laserFadeSeconds}
          autoChainLines={autoChainLines}
          frames={frames}
          activeFrameIndex={activeFrameIndex}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          isLooping={isLooping}
          onUpdateCurrentFrame={handleUpdateCurrentFrame}
          onSelectElement={setSelectedElementId}
          onDoubleClickElement={(id) => {
            setSelectedElementId(id);
            setIsPlayerEditOpen(true);
          }}
          selectedElementId={selectedElementId}
          onStepNextFrame={handleStepNextFrame}
        />

        {/* Floating Quick Player Inspector Bar (when a player token is selected) */}
        {selectedPlayer && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-2 sm:px-4 rounded-2xl bg-zinc-950/90 border border-zinc-700/80 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
            
            {/* Player Token Preview Badge */}
            <button
              type="button"
              onClick={() => setIsPlayerEditOpen(true)}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-md shrink-0 active:scale-95 transition-transform"
              style={{
                backgroundColor:
                  selectedPlayer.customColor ||
                  (selectedPlayer.team === 'home'
                    ? selectedPlayer.isGoalkeeper ? homeColors.goalkeeper : homeColors.primary
                    : selectedPlayer.isGoalkeeper ? awayColors.goalkeeper : awayColors.primary),
                borderColor: '#ffffff',
                color: '#ffffff'
              }}
              title="Klicken zum Öffnen des Bearbeiten-Dialogs"
            >
              {selectedPlayer.number || 1}
            </button>

            {/* Quick Name / Label Edit Input */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Name:</span>
              <input
                type="text"
                value={selectedPlayer.name || ''}
                onChange={(e) => handleUpdatePlayer({ name: e.target.value })}
                placeholder="z. B. Müller, IV"
                className="w-24 sm:w-32 bg-transparent text-xs font-bold text-white focus:outline-none placeholder-zinc-600"
              />
            </div>

            {/* Quick Number Edit Input */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1.5 focus-within:border-indigo-500">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Nr:</span>
              <input
                type="number"
                min="1"
                max="99"
                value={selectedPlayer.number || 1}
                onChange={(e) => handleUpdatePlayer({ number: parseInt(e.target.value) || 1 })}
                className="w-10 bg-transparent text-xs font-bold font-mono text-white text-center focus:outline-none"
              />
            </div>

            {/* Quick Role Selector */}
            <select
              value={selectedPlayer.role || 'SP'}
              onChange={(e) => handleUpdatePlayer({ role: e.target.value, isGoalkeeper: e.target.value === 'TW' })}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1.5 text-xs font-bold text-zinc-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              {['TW', 'LV', 'IV', 'LIV', 'RIV', 'RV', 'DM', 'ZM', 'LM', 'RM', 'OM', 'LA', 'RA', 'MS', 'ST', 'JOKER'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Open Full Edit Modal */}
            <button
              type="button"
              onClick={() => setIsPlayerEditOpen(true)}
              className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white transition-all active:scale-95"
              title="Alle Eigenschaften bearbeiten (Farbe, Rolle, Torwart)"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {/* Delete Player Button */}
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 hover:text-white transition-all active:scale-95"
              title="Spieler löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Close Inspector */}
            <button
              type="button"
              onClick={() => setSelectedElementId(null)}
              className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
              title="Auswahl aufheben"
            >
              <X className="w-3.5 h-3.5" />
            </button>

          </div>
        )}
      </div>

      {/* 3. Bottom Keyframing Timeline */}
      <TacticsTimeline
        frames={frames}
        activeFrameIndex={activeFrameIndex}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        isLooping={isLooping}
        onSelectFrame={setActiveFrameIndex}
        onAddFrame={handleAddFrame}
        onDuplicateFrame={handleDuplicateFrame}
        onDeleteFrame={handleDeleteFrame}
        onTogglePlay={() => setIsPlaying((prev) => !prev)}
        onToggleLoop={() => setIsLooping((prev) => !prev)}
        onChangeSpeed={setPlaybackSpeed}
        onUpdateFrameTitle={handleUpdateFrameTitle}
      />

      {/* --- Modals & Overlays --- */}

      {/* 1. Trainer Preferences Modal */}
      <TacticsPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        onPreferencesUpdated={applyPreferences}
      />

      {/* 2. Formation Modal */}
      <TacticsFormationModal
        isOpen={isFormationsOpen}
        onClose={() => setIsFormationsOpen(false)}
        currentPlayers={frames[activeFrameIndex]?.players || []}
        onApplyFormation={handleApplyFormation}
      />

      {/* 3. Squad Drawer */}
      <TacticsSquadDrawer
        isOpen={isSquadDrawerOpen}
        onClose={() => setIsSquadDrawerOpen(false)}
        onAddPlayerToken={handleAddPlayerToken}
      />

      {/* 4. Presentation Overlay (Tablet / Fullscreen) */}
      <TacticsPresentationOverlay
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        activeFrameIndex={activeFrameIndex}
        totalFrames={frames.length}
        isPlaying={isPlaying}
        currentTool={activeTool}
        onTogglePlay={() => setIsPlaying((prev) => !prev)}
        onNextFrame={() => setActiveFrameIndex((prev) => Math.min(frames.length - 1, prev + 1))}
        onPrevFrame={() => setActiveFrameIndex((prev) => Math.max(0, prev - 1))}
        onSelectTool={setActiveTool}
        currentFrameTitle={frames[activeFrameIndex]?.title}
      />

      {/* 5. Export Modal */}
      <TacticsExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        boardTitle={boardTitle}
        boardData={{
          title: boardTitle,
          pitchType,
          pitchStyle,
          frames
        }}
        canvasRef={canvasRef}
      />

      {/* 6. Player Edit Modal */}
      <TacticsPlayerEditModal
        isOpen={isPlayerEditOpen}
        onClose={() => setIsPlayerEditOpen(false)}
        player={selectedPlayer}
        onUpdatePlayer={handleUpdatePlayer}
        onDeletePlayer={handleDeleteSelected}
        homeColor={homeColors.primary}
        awayColor={awayColors.primary}
      />

    </div>
  );
}
