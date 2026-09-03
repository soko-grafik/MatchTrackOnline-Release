"use client";

import {
  MousePointer,
  Zap,
  MoveRight,
  ArrowRight,
  Activity,
  Shield,
  Layers,
  Square,
  Circle,
  Type,
  Disc,
  Flag,
  Goal,
  Undo2,
  Redo2,
  Trash2,
  Eraser,
  Grid,
  Palette,
  Maximize2,
  Download,
  Users,
  Sliders,
  Save,
  Plus,
  Compass,
  FolderOpen
} from 'lucide-react';

interface TacticsToolbarProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
  selectedColor: string;
  onSelectColor: (color: string) => void;
  pitchType: string;
  onChangePitchType: (type: string) => void;
  pitchStyle: string;
  onChangePitchStyle: (style: string) => void;
  showTacticalGrid: boolean;
  onToggleTacticalGrid: () => void;
  showHalfSpaces: boolean;
  onToggleHalfSpaces: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearDrawings: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  onOpenFormations: () => void;
  onOpenSquadDrawer: () => void;
  onOpenPreferences: () => void;
  onOpenExport: () => void;
  onTogglePresentation: () => void;
  onSaveBoard: () => void;
  isSaving: boolean;
  onOpenLibrary?: () => void;
  boardTitle: string;
  onChangeTitle: (title: string) => void;
  category?: string;
  onChangeCategory?: (category: string) => void;
  homeColor: string;
  awayColor: string;
}

export default function TacticsToolbar({
  activeTool,
  onSelectTool,
  selectedColor,
  onSelectColor,
  pitchType,
  onChangePitchType,
  pitchStyle,
  onChangePitchStyle,
  showTacticalGrid,
  onToggleTacticalGrid,
  showHalfSpaces,
  onToggleHalfSpaces,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClearDrawings,
  onDeleteSelected,
  hasSelection,
  onOpenFormations,
  onOpenSquadDrawer,
  onOpenPreferences,
  onOpenExport,
  onTogglePresentation,
  onSaveBoard,
  isSaving,
  onOpenLibrary,
  boardTitle,
  onChangeTitle,
  category = 'Allgemein',
  onChangeCategory,
  homeColor,
  awayColor
}: TacticsToolbarProps) {

  const colorPalette = [
    homeColor || '#3b82f6',
    awayColor || '#ef4444',
    '#eab308', // Yellow
    '#10b981', // Green
    '#ffffff', // White
    '#000000', // Black
    '#ec4899', // Pink
    '#06b6d4'  // Cyan
  ];

  return (
    <div className="w-full flex flex-col gap-2.5">
      
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5 sm:py-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800 backdrop-blur-md shadow-xl">
        
        {/* Left: Title & Category & Quick Switchers */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-[280px]">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all active:scale-95 shrink-0"
            title="Taktik-Bibliothek öffnen"
          >
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Bibliothek</span>
          </button>

          <div className="w-px h-6 bg-zinc-800 hidden sm:block" />

          {/* Title Input */}
          <input
            type="text"
            value={boardTitle}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="Titel des Spielzugs..."
            className="flex-1 min-w-[120px] max-w-xs sm:max-w-sm bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />

          {/* Category Dropdown */}
          {onChangeCategory && (
            <select
              value={category}
              onChange={(e) => onChangeCategory(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-300 focus:border-indigo-500 focus:outline-none cursor-pointer shrink-0"
              title="Kategorie der Taktiktafel auswählen"
            >
              <option value="Allgemein">📂 Allgemein</option>
              <option value="Aufstellung">📋 Aufstellung</option>
              <option value="Offensive">⚔️ Offensive</option>
              <option value="Defensive">🛡️ Defensive</option>
              <option value="Standards">🎯 Standards</option>
              <option value="Pressing">⚡ Pressing</option>
              <option value="Umschalten">🔄 Umschalten</option>
            </select>
          )}
        </div>

        {/* Center: Pitch & Field Selectors */}
        <div className="flex items-center gap-2">
          {/* Pitch Type Selector */}
          <select
            value={pitchType}
            onChange={(e) => onChangePitchType(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
          >
            <option value="full_horizontal">Ganzfeld (Quer)</option>
            <option value="full_vertical">Ganzfeld (Hoch)</option>
            <option value="half">Halbfeld</option>
            <option value="penalty_box">16m-Raum</option>
            <option value="field_40x20">Halle / Kleinfeld (40 x 20m)</option>
            <option value="field_youth_7v7">Kleinfeld (7er/9er)</option>
            <option value="funino_4_goals">Funino (4 Tore)</option>
            <option value="blank">Freie Taktikfläche</option>
          </select>

          {/* Pitch Style Selector */}
          <select
            value={pitchStyle}
            onChange={(e) => onChangePitchStyle(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white focus:outline-hidden focus:border-indigo-500 transition-colors hidden md:block"
          >
            <option value="grass_classic">Klassisch Grün</option>
            <option value="grass_striped">Streifenrasen</option>
            <option value="dark_tactical">Dark Tactical</option>
            <option value="chalkboard">Kreidetafel</option>
            <option value="blueprint">Blaupause</option>
          </select>

          {/* Tactical Overlays Toggles */}
          <button
            type="button"
            onClick={onToggleHalfSpaces}
            className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 hidden lg:flex items-center gap-1.5 ${
              showHalfSpaces
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Halbräume & Korridore einblenden"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Halbräume</span>
          </button>

          <button
            type="button"
            onClick={onToggleTacticalGrid}
            className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 hidden lg:flex items-center gap-1.5 ${
              showTacticalGrid
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="18-Zonen-Raster nach Pep Guardiola einblenden"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>18 Zonen</span>
          </button>
        </div>

        {/* Right: Modals & Save Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Squad Drawer Toggle */}
          <button
            type="button"
            onClick={onOpenSquadDrawer}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all active:scale-95"
            title="Spieler aus Kader aufstellen"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Kader</span>
          </button>

          {/* Formations Modal Toggle */}
          <button
            type="button"
            onClick={onOpenFormations}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold transition-all active:scale-95"
            title="Aufstellungen & Formationen"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Formation</span>
          </button>

          {/* Presentation Mode Toggle */}
          <button
            type="button"
            onClick={onTogglePresentation}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
            title="Vollbild-Präsentationsmodus (Kabine / Tablet)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Preferences Modal */}
          <button
            type="button"
            onClick={onOpenPreferences}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
            title="Persönliche Trainer-Vorlieben"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Export Modal */}
          <button
            type="button"
            onClick={onOpenExport}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
            title="Taktik exportieren (PNG / PDF)"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={onSaveBoard}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
            title="Taktiktafel in der Cloud speichern"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Speichern</span>
          </button>
        </div>

      </div>

      {/* Main Tools Ribbon (Touch Optimized - min 48px target) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:px-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-md shadow-lg overflow-x-auto custom-scrollbar">
        
        {/* Drawing & Pointer Tools */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Select Tool */}
          <button
            type="button"
            onClick={() => onSelectTool('select')}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              activeTool === 'select'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Objekt auswählen & verschieben"
          >
            <MousePointer className="w-4 h-4" />
            <span className="text-[9px]">Bewegen</span>
          </button>

          {/* Laserpointer */}
          <button
            type="button"
            onClick={() => onSelectTool('laser')}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              activeTool === 'laser'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400'
                : 'bg-zinc-900 border border-zinc-800 text-rose-400 hover:text-rose-300 hover:bg-zinc-800'
            }`}
            title="Laserpointer (Linien verblassen automatisch)"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span className="text-[9px]">Laser</span>
          </button>

          <div className="w-px h-7 bg-zinc-800 mx-1" />

          {/* Pass Arrow (Dashed) */}
          <button
            type="button"
            onClick={() => onSelectTool('pass_arrow')}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              activeTool === 'pass_arrow'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Passweg (Gestrichelter Pfeil)"
          >
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            <span className="text-[9px]">Pass</span>
          </button>

          {/* Run Arrow (Solid) */}
          <button
            type="button"
            onClick={() => onSelectTool('run_arrow')}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              activeTool === 'run_arrow'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Laufweg ohne Ball (Durchgezogener Pfeil)"
          >
            <MoveRight className="w-4 h-4" />
            <span className="text-[9px]">Lauf</span>
          </button>

          {/* Dribble Arrow (Wavy) */}
          <button
            type="button"
            onClick={() => onSelectTool('dribble_arrow')}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              activeTool === 'dribble_arrow'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Dribbling mit Ball (Gewellter Pfeil)"
          >
            <Activity className="w-4 h-4" />
            <span className="text-[9px]">Dribbling</span>
          </button>

          {/* Chain Line (Defense) */}
          <button
            type="button"
            onClick={() => onSelectTool('chain_line')}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              activeTool === 'chain_line'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Ketten-Linie (Abwehrkette verbinden)"
          >
            <Shield className="w-4 h-4" />
            <span className="text-[9px]">Kette</span>
          </button>

          {/* Zone Rectangle */}
          <button
            type="button"
            onClick={() => onSelectTool('zone_rect')}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              activeTool === 'zone_rect'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Taktische Zone (Rechteck)"
          >
            <Square className="w-4 h-4" />
            <span className="text-[9px]">Zone</span>
          </button>

          {/* Text Tool */}
          <button
            type="button"
            onClick={() => onSelectTool('text')}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              activeTool === 'text'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Text & Notiz auf dem Feld platzieren"
          >
            <Type className="w-4 h-4" />
            <span className="text-[9px]">Text</span>
          </button>
        </div>

        {/* Elements / Spawn Tokens Quick Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 border-s border-zinc-800/80 ps-2">
          {/* Add Home Player Token */}
          <button
            type="button"
            onClick={() => onSelectTool('add_player_home')}
            className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-zinc-900 border border-blue-500/40 hover:bg-blue-500/10 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95"
            title="Neuen Heim-Spieler hinzufügen"
          >
            <div
              className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-[8px] text-white font-mono"
              style={{ backgroundColor: homeColor || '#3b82f6' }}
            >
              H
            </div>
            <span className="text-[9px] text-blue-300">+ Heim</span>
          </button>

          {/* Add Away Player Token */}
          <button
            type="button"
            onClick={() => onSelectTool('add_player_away')}
            className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-zinc-900 border border-red-500/40 hover:bg-red-500/10 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95"
            title="Neuen Gast-Spieler hinzufügen"
          >
            <div
              className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-[8px] text-white font-mono"
              style={{ backgroundColor: awayColor || '#ef4444' }}
            >
              G
            </div>
            <span className="text-[9px] text-red-300">+ Gast</span>
          </button>

          {/* Add Ball */}
          <button
            type="button"
            onClick={() => onSelectTool('add_ball')}
            className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95"
            title="Ball platzieren"
          >
            <div className="w-4 h-4 rounded-full bg-white border border-zinc-900 flex items-center justify-center shadow-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
            </div>
            <span className="text-[9px] text-zinc-300">+ Ball</span>
          </button>

          {/* Add Cone */}
          <button
            type="button"
            onClick={() => onSelectTool('add_cone')}
            className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95"
            title="Hütchen / Markierungsteller"
          >
            <Disc className="w-4 h-4 text-amber-400" />
            <span className="text-[9px] text-amber-300">Hütchen</span>
          </button>

          {/* Add Goal */}
          <button
            type="button"
            onClick={() => onSelectTool('add_goal')}
            className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95"
            title="Minitor / Jugendtor platzieren"
          >
            <Goal className="w-4 h-4 text-emerald-400" />
            <span className="text-[9px] text-emerald-300">Tor</span>
          </button>
        </div>

        {/* Color Palette Selector */}
        <div className="flex items-center gap-1.5 shrink-0 border-s border-zinc-800/80 ps-2">
          {colorPalette.map((color, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectColor(color)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition-all active:scale-95 ${
                selectedColor === color
                  ? 'border-white scale-110 shadow-lg shadow-white/20'
                  : 'border-zinc-800/80 opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: color }}
              title={`Farbe: ${color}`}
            />
          ))}
        </div>

        {/* Undo / Redo & Delete Actions */}
        <div className="flex items-center gap-1 shrink-0 border-s border-zinc-800/80 ps-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            title="Rückgängig"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            title="Wiederholen"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {hasSelection && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="px-3 h-10 rounded-xl bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-300 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95"
              title="Ausgewähltes Element löschen"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Löschen</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearDrawings}
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
            title="Alle Zeichnungen dieser Phase leeren"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
}
