"use client";

import { useState, useEffect } from 'react';
import {
  X,
  Save,
  Palette,
  Sliders,
  Sparkles,
  Zap,
  RotateCcw,
  Eye,
  Check,
  Shield,
  Layers,
  Grid
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { getTacticsPreferences, saveTacticsPreferences } from '@/services/api';

interface TacticsPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreferencesUpdated: (prefs: any) => void;
}

export default function TacticsPreferencesModal({
  isOpen,
  onClose,
  onPreferencesUpdated
}: TacticsPreferencesModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [defaultPitchType, setDefaultPitchType] = useState('full_horizontal');
  const [defaultPitchStyle, setDefaultPitchStyle] = useState('grass_classic');
  const [defaultPlayerLabelMode, setDefaultPlayerLabelMode] = useState('number');
  const [defaultTool, setDefaultTool] = useState('select');
  const [laserFadeSeconds, setLaserFadeSeconds] = useState(1.5);
  const [animationSpeed, setAnimationSpeed] = useState(1.0);
  const [autoChainLines, setAutoChainLines] = useState(false);
  const [showTacticalGrid, setShowTacticalGrid] = useState(false);

  // Team Colors
  const [homePrimary, setHomePrimary] = useState('#3b82f6');
  const [homeSecondary, setHomeSecondary] = useState('#ffffff');
  const [homeGK, setHomeGK] = useState('#10b981');
  const [awayPrimary, setAwayPrimary] = useState('#ef4444');
  const [awaySecondary, setAwaySecondary] = useState('#ffffff');
  const [awayGK, setAwayGK] = useState('#f59e0b');
  const [neutralReferee, setNeutralReferee] = useState('#eab308');
  const [neutralJoker, setNeutralJoker] = useState('#a855f7');

  useEffect(() => {
    if (isOpen) {
      loadPreferences();
    }
  }, [isOpen]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const data = await getTacticsPreferences();
      if (data) {
        setDefaultPitchType(data.default_pitch_type || 'full_horizontal');
        setDefaultPitchStyle(data.default_pitch_style || 'grass_classic');
        setDefaultPlayerLabelMode(data.default_player_label_mode || 'number');
        setDefaultTool(data.default_tool || 'select');
        setLaserFadeSeconds(data.laser_fade_seconds ?? 1.5);
        setAnimationSpeed(data.animation_speed ?? 1.0);
        setAutoChainLines(Boolean(data.auto_chain_lines));
        setShowTacticalGrid(Boolean(data.show_tactical_grid));

        if (data.home_team_colors) {
          setHomePrimary(data.home_team_colors.primary || '#3b82f6');
          setHomeSecondary(data.home_team_colors.secondary || '#ffffff');
          setHomeGK(data.home_team_colors.goalkeeper || '#10b981');
        }
        if (data.away_team_colors) {
          setAwayPrimary(data.away_team_colors.primary || '#ef4444');
          setAwaySecondary(data.away_team_colors.secondary || '#ffffff');
          setAwayGK(data.away_team_colors.goalkeeper || '#f59e0b');
        }
        if (data.neutral_colors) {
          setNeutralReferee(data.neutral_colors.referee || '#eab308');
          setNeutralJoker(data.neutral_colors.joker || '#a855f7');
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden der Vorlieben:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        default_pitch_type: defaultPitchType,
        default_pitch_style: defaultPitchStyle,
        home_team_colors: {
          primary: homePrimary,
          secondary: homeSecondary,
          goalkeeper: homeGK,
          text: '#ffffff'
        },
        away_team_colors: {
          primary: awayPrimary,
          secondary: awaySecondary,
          goalkeeper: awayGK,
          text: '#ffffff'
        },
        neutral_colors: {
          referee: neutralReferee,
          joker: neutralJoker
        },
        default_player_label_mode: defaultPlayerLabelMode,
        default_tool: defaultTool,
        laser_fade_seconds: parseFloat(laserFadeSeconds.toString()),
        animation_speed: parseFloat(animationSpeed.toString()),
        auto_chain_lines: autoChainLines,
        show_tactical_grid: showTacticalGrid,
        custom_settings: {}
      };

      const updated = await saveTacticsPreferences(payload);
      toast.success('Deine persönlichen Taktiktafel-Vorlieben wurden gespeichert!');
      onPreferencesUpdated(updated || payload);
      onClose();
    } catch (err: any) {
      console.error('Fehler beim Speichern der Vorlieben:', err);
      toast.error('Fehler beim Speichern der Vorlieben.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Meine Taktiktafel-Vorlieben
              </h2>
              <p className="text-xs text-zinc-400">
                Passe dein persönliches Trainer-Setup an (Farben, Rasen, Laserpointer & Tools)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-zinc-300 custom-scrollbar">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs text-zinc-400">Lade persönliche Einstellungen...</span>
            </div>
          ) : (
            <>
              {/* 1. Spielfeld & Design */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                  <Grid className="w-4 h-4" /> Spielfeld & Rasen-Optik
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Standard-Spielfeld
                    </label>
                    <select
                      value={defaultPitchType}
                      onChange={(e) => setDefaultPitchType(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                    >
                      <option value="full_horizontal">Großfeld (Querformat / Horizontal)</option>
                      <option value="full_vertical">Großfeld (Hochformat / Vertikal)</option>
                      <option value="half">Halbfeld (Angriff / Abwehr)</option>
                      <option value="penalty_box">16-Meter-Raum (Box)</option>
                      <option value="field_40x20">Halle / Kleinfeld (40 x 20m)</option>
                      <option value="field_youth_7v7">Kleinfeld (7er / 9er Jugend)</option>
                      <option value="funino_4_goals">Funino (4 Minitore)</option>
                      <option value="blank">Freie Taktikfläche (Ohne Linien)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Rasen-Stil
                    </label>
                    <select
                      value={defaultPitchStyle}
                      onChange={(e) => setDefaultPitchStyle(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                    >
                      <option value="grass_classic">Klassischer Rasen (Dunkelgrün)</option>
                      <option value="grass_striped">Moderner Streifenrasen (Zweifarbig)</option>
                      <option value="dark_tactical">Dark Tactical Board (High-Contrast)</option>
                      <option value="chalkboard">Kreidetafel (Chalkboard Slate)</option>
                      <option value="blueprint">Blaupause (Taktik-Blueprint)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Team-Farben & Trikots */}
              <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                  <Palette className="w-4 h-4" /> Team-Farben & Trikots
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Heimteam */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                    <span className="text-xs font-bold text-white block">Eigenes Team (Heim)</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Trikot</span>
                        <input
                          type="color"
                          value={homePrimary}
                          onChange={(e) => setHomePrimary(e.target.value)}
                          className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Hose/Akzent</span>
                        <input
                          type="color"
                          value={homeSecondary}
                          onChange={(e) => setHomeSecondary(e.target.value)}
                          className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Torwart</span>
                        <input
                          type="color"
                          value={homeGK}
                          onChange={(e) => setHomeGK(e.target.value)}
                          className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gastteam */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                    <span className="text-xs font-bold text-white block">Gegner (Gast)</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Trikot</span>
                        <input
                          type="color"
                          value={awayPrimary}
                          onChange={(e) => setAwayPrimary(e.target.value)}
                          className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Hose/Akzent</span>
                        <input
                          type="color"
                          value={awaySecondary}
                          onChange={(e) => setAwaySecondary(e.target.value)}
                          className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Torwart</span>
                        <input
                          type="color"
                          value={awayGK}
                          onChange={(e) => setAwayGK(e.target.value)}
                          className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-white block">Schiedsrichter</span>
                      <span className="text-[10px] text-zinc-500">Signal-Farbe</span>
                    </div>
                    <input
                      type="color"
                      value={neutralReferee}
                      onChange={(e) => setNeutralReferee(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-white block">Neutral / Joker</span>
                      <span className="text-[10px] text-zinc-500">Trainings-Joker</span>
                    </div>
                    <input
                      type="color"
                      value={neutralJoker}
                      onChange={(e) => setNeutralJoker(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Spieler-Beschriftung & Tools */}
              <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                  <Eye className="w-4 h-4" /> Darstellung & Werkzeuge
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Spieler-Beschriftung
                    </label>
                    <select
                      value={defaultPlayerLabelMode}
                      onChange={(e) => setDefaultPlayerLabelMode(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                    >
                      <option value="number">Rückennummer (z. B. 1, 9, 10)</option>
                      <option value="name">Nachname / Spitzname</option>
                      <option value="initials">Initialen (z. B. MM, CR)</option>
                      <option value="role">Position / Rolle (z. B. TW, IV, ST)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Standard-Werkzeug beim Start
                    </label>
                    <select
                      value={defaultTool}
                      onChange={(e) => setDefaultTool(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                    >
                      <option value="select">Auswählen & Bewegen (Drag)</option>
                      <option value="laser">Laserpointer (Präsentation)</option>
                      <option value="pass_arrow">Pass-Pfeil (Gestrichelt)</option>
                      <option value="run_arrow">Laufweg-Pfeil (Durchgezogen)</option>
                      <option value="dribble_arrow">Dribbling-Pfeil (Gewellt)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Laserpointer & Animation */}
              <div className="space-y-4 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                  <Zap className="w-4 h-4" /> Laserpointer & Sequenzen
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-400">Laserpointer Verblassen</span>
                      <span className="text-indigo-400 font-mono font-bold">{laserFadeSeconds}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="4.0"
                      step="0.1"
                      value={laserFadeSeconds}
                      onChange={(e) => setLaserFadeSeconds(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      Dauer bis gezeichnete Laser-Linien automatisch sanft verschwinden
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-400">Animations-Geschwindigkeit</span>
                      <span className="text-indigo-400 font-mono font-bold">{animationSpeed}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={animationSpeed}
                      onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      Standard-Wiedergabetempo zwischen Taktikphasen
                    </span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoChainLines}
                      onChange={(e) => setAutoChainLines(e.target.checked)}
                      className="w-4 h-4 rounded-md accent-indigo-500 bg-zinc-950 border-zinc-800"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Kettenlinien automatisch</span>
                      <span className="text-[10px] text-zinc-400">Abwehrkette automatisch verbinden</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={showTacticalGrid}
                      onChange={(e) => setShowTacticalGrid(e.target.checked)}
                      className="w-4 h-4 rounded-md accent-indigo-500 bg-zinc-950 border-zinc-800"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Taktisches Raster</span>
                      <span className="text-[10px] text-zinc-400">Halbräume & 18-Zonen anzeigen</span>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all active:scale-95"
          >
            Abbrechen
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Speichere...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Vorlieben speichern</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
