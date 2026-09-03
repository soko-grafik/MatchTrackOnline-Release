"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PlayerToken {
  id: string;
  x: number; // Normalized 0.0 - 1.0 (relative to pitch boundary)
  y: number; // Normalized 0.0 - 1.0 (relative to pitch boundary)
  team: 'home' | 'away' | 'neutral' | 'referee';
  number: number;
  name: string;
  role: string;
  isGoalkeeper?: boolean;
  avatar_url?: string;
  customColor?: string;
}

export interface BallItem {
  id: string;
  x: number;
  y: number;
  z?: number;
}

export interface EquipmentItem {
  id: string;
  type: 'cone' | 'disc' | 'dummy' | 'goal_mini' | 'goal_full' | 'ladder';
  x: number;
  y: number;
  rotation?: number;
  color?: string;
}

export interface TacticalLine {
  id: string;
  type: 'pass_arrow' | 'run_arrow' | 'dribble_arrow' | 'press_arrow' | 'chain_line' | 'pen';
  points: { x: number; y: number }[];
  color: string;
  width?: number;
}

export interface TacticalZone {
  id: string;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label?: string;
}

export interface TacticalText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize?: number;
}

export interface TacticsFrame {
  id?: string;
  title?: string;
  duration?: number;
  players: PlayerToken[];
  balls: BallItem[];
  equipment: EquipmentItem[];
  lines: TacticalLine[];
  zones: TacticalZone[];
  texts: TacticalText[];
}

interface TacticsBoardCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  activeTool: string;
  selectedColor: string;
  pitchType: string;
  pitchStyle: string;
  showTacticalGrid: boolean;
  showHalfSpaces: boolean;
  homeColors: { primary: string; secondary: string; goalkeeper: string; text?: string };
  awayColors: { primary: string; secondary: string; goalkeeper: string; text?: string };
  playerLabelMode: 'number' | 'name' | 'initials' | 'role';
  laserFadeSeconds: number;
  autoChainLines: boolean;
  frames: TacticsFrame[];
  activeFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  isLooping: boolean;
  onUpdateCurrentFrame: (updater: (prev: TacticsFrame) => TacticsFrame) => void;
  onSelectElement?: (elementId: string | null) => void;
  onDoubleClickElement?: (elementId: string) => void;
  selectedElementId: string | null;
  onStepNextFrame?: () => void;
}

// =============================================================================
// PITCH GEOMETRY & ASPECT RATIO UTILITIES
// =============================================================================

export interface PitchMetrics {
  pitchRect: { x: number; y: number; w: number; h: number };
  borderRect: { x: number; y: number; w: number; h: number };
  toScreen: (nx: number, ny: number) => { x: number; y: number };
  toNorm: (sx: number, sy: number) => { normX: number; normY: number };
}

export function getPitchAspectRatio(type: string): number {
  switch (type) {
    case 'full_vertical':
      return 68 / 105; // ~0.648 (Vertical pitch)
    case 'field_40x20':
      return 40 / 20; // 2.0 (Wide 40x20m pitch)
    case 'half':
      return 68 / 52.5; // ~1.295 (Half pitch)
    case 'penalty_box':
      return 40 / 25; // 1.60 (Penalty box closeup)
    case 'field_youth_7v7':
      return 55 / 35; // ~1.571 (7v7 youth pitch)
    case 'funino_4_goals':
      return 32 / 24; // ~1.333 (Funino pitch)
    case 'full_horizontal':
    default:
      return 105 / 68; // ~1.544 (11v11 standard horizontal)
  }
}

export function computePitchMetrics(
  canvasW: number,
  canvasH: number,
  pitchType: string
): PitchMetrics {
  const outerPadding = 12;
  const availW = Math.max(80, canvasW - outerPadding * 2);
  const availH = Math.max(80, canvasH - outerPadding * 2);
  const targetAspect = getPitchAspectRatio(pitchType);

  let w = availW;
  let h = w / targetAspect;

  if (h > availH) {
    h = availH;
    w = h * targetAspect;
  }

  const pitchX = (canvasW - w) / 2;
  const pitchY = (canvasH - h) / 2;

  // Margin between grass edge and outer white line
  const grassMargin = Math.max(6, Math.min(12, Math.min(w, h) * 0.02));
  const borderX = pitchX + grassMargin;
  const borderY = pitchY + grassMargin;
  const borderW = w - grassMargin * 2;
  const borderH = h - grassMargin * 2;

  return {
    pitchRect: { x: pitchX, y: pitchY, w, h },
    borderRect: { x: borderX, y: borderY, w: borderW, h: borderH },
    toScreen: (nx: number, ny: number) => ({
      x: borderX + nx * borderW,
      y: borderY + ny * borderH
    }),
    toNorm: (sx: number, sy: number) => ({
      normX: Math.max(0, Math.min(1, (sx - borderX) / borderW)),
      normY: Math.max(0, Math.min(1, (sy - borderY) / borderH))
    })
  };
}

export default function TacticsBoardCanvas({
  canvasRef,
  activeTool,
  selectedColor,
  pitchType,
  pitchStyle,
  showTacticalGrid,
  showHalfSpaces,
  homeColors,
  awayColors,
  playerLabelMode,
  laserFadeSeconds,
  autoChainLines,
  frames,
  activeFrameIndex,
  isPlaying,
  playbackSpeed,
  isLooping,
  onUpdateCurrentFrame,
  onSelectElement,
  onDoubleClickElement,
  selectedElementId,
  onStepNextFrame
}: TacticsBoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interaction State
  const [draggedElement, setDraggedElement] = useState<{
    id: string;
    type: 'player' | 'ball' | 'equipment' | 'text' | 'zone';
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [currentLinePoints, setCurrentLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [laserPoints, setLaserPoints] = useState<{ x: number; y: number; time: number }[]>([]);
  const [currentZoneStart, setCurrentZoneStart] = useState<{ x: number; y: number } | null>(null);
  const [currentZoneRect, setCurrentZoneRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Animation interpolation state
  const animProgressRef = useRef<number>(0);
  const lastAnimTimeRef = useRef<number>(performance.now());

  // Current Frame Data safe fallback
  const currentFrame = frames[activeFrameIndex] || {
    players: [],
    balls: [],
    equipment: [],
    lines: [],
    zones: [],
    texts: []
  };

  const nextFrame = frames[(activeFrameIndex + 1) % frames.length] || currentFrame;

  // --- Coordinate Normalization Utilities ---
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, normX: 0, normY: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const metrics = computePitchMetrics(rect.width, rect.height, pitchType);
    const { normX, normY } = metrics.toNorm(sx, sy);
    return { x: sx, y: sy, normX, normY };
  };

  // --- Hit Testing ---
  const findHitElement = (
    normX: number,
    normY: number,
    metrics: PitchMetrics
  ) => {
    const thresholdPx = 28;
    const screenP = metrics.toScreen(normX, normY);

    // 1. Check Ball
    for (const b of currentFrame.balls || []) {
      const bScreen = metrics.toScreen(b.x, b.y);
      if (Math.hypot(bScreen.x - screenP.x, bScreen.y - screenP.y) < thresholdPx) {
        return { id: b.id, type: 'ball' as const, element: b };
      }
    }

    // 2. Check Players
    for (const p of currentFrame.players || []) {
      const pScreen = metrics.toScreen(p.x, p.y);
      if (Math.hypot(pScreen.x - screenP.x, pScreen.y - screenP.y) < thresholdPx) {
        return { id: p.id, type: 'player' as const, element: p };
      }
    }

    // 3. Check Equipment
    for (const eq of currentFrame.equipment || []) {
      const eqScreen = metrics.toScreen(eq.x, eq.y);
      if (Math.hypot(eqScreen.x - screenP.x, eqScreen.y - screenP.y) < thresholdPx) {
        return { id: eq.id, type: 'equipment' as const, element: eq };
      }
    }

    // 4. Check Texts
    for (const txt of currentFrame.texts || []) {
      const txtScreen = metrics.toScreen(txt.x, txt.y);
      const dx = Math.abs(txtScreen.x - screenP.x);
      const dy = Math.abs(txtScreen.y - screenP.y);
      if (dx < 40 && dy < 20) {
        return { id: txt.id, type: 'text' as const, element: txt };
      }
    }

    return null;
  };

  // --- Pointer Down Event ---
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { normX, normY } = getCanvasCoords(e);

    // Laserpointer Tool
    if (activeTool === 'laser') {
      setLaserPoints([{ x: normX, y: normY, time: performance.now() }]);
      return;
    }

    // Drawing Tools (Arrows, Lines, Pen)
    if (['pass_arrow', 'run_arrow', 'dribble_arrow', 'press_arrow', 'chain_line', 'pen'].includes(activeTool)) {
      setCurrentLinePoints([{ x: normX, y: normY }]);
      return;
    }

    // Zone Tools
    if (activeTool === 'zone_rect' || activeTool === 'zone_circle') {
      setCurrentZoneStart({ x: normX, y: normY });
      setCurrentZoneRect({ x: normX, y: normY, w: 0, h: 0 });
      return;
    }

    // Text Tool
    if (activeTool === 'text') {
      const textVal = prompt('Taktik-Notiz eingeben:');
      if (textVal && textVal.trim()) {
        const newText: TacticalText = {
          id: `txt_${Date.now()}`,
          x: normX,
          y: normY,
          text: textVal.trim(),
          color: selectedColor || '#ffffff',
          fontSize: 14
        };
        onUpdateCurrentFrame((prev) => ({
          ...prev,
          texts: [...(prev.texts || []), newText]
        }));
      }
      return;
    }

    // Spawning New Token Elements directly
    if (activeTool === 'add_player_home' || activeTool === 'add_player_away') {
      const isHome = activeTool === 'add_player_home';
      const count = (currentFrame.players || []).filter((p) => p.team === (isHome ? 'home' : 'away')).length;
      const newToken: PlayerToken = {
        id: `p_${isHome ? 'h' : 'a'}_${Date.now()}`,
        x: normX,
        y: normY,
        team: isHome ? 'home' : 'away',
        number: count + 1,
        name: isHome ? `H${count + 1}` : `G${count + 1}`,
        role: 'SP',
        isGoalkeeper: count === 0
      };
      onUpdateCurrentFrame((prev) => ({
        ...prev,
        players: [...(prev.players || []), newToken]
      }));
      return;
    }

    if (activeTool === 'add_ball') {
      const newBall: BallItem = {
        id: `ball_${Date.now()}`,
        x: normX,
        y: normY
      };
      onUpdateCurrentFrame((prev) => ({
        ...prev,
        balls: [...(prev.balls || []), newBall]
      }));
      return;
    }

    if (activeTool === 'add_cone') {
      const newEq: EquipmentItem = {
        id: `eq_${Date.now()}`,
        type: 'cone',
        x: normX,
        y: normY,
        color: selectedColor || '#f59e0b'
      };
      onUpdateCurrentFrame((prev) => ({
        ...prev,
        equipment: [...(prev.equipment || []), newEq]
      }));
      return;
    }

    if (activeTool === 'add_goal') {
      const newEq: EquipmentItem = {
        id: `eq_${Date.now()}`,
        type: 'goal_mini',
        x: normX,
        y: normY,
        color: '#eab308'
      };
      onUpdateCurrentFrame((prev) => ({
        ...prev,
        equipment: [...(prev.equipment || []), newEq]
      }));
      return;
    }

    if (activeTool === 'add_dummy') {
      const newEq: EquipmentItem = {
        id: `eq_${Date.now()}`,
        type: 'dummy',
        x: normX,
        y: normY,
        color: '#ef4444'
      };
      onUpdateCurrentFrame((prev) => ({
        ...prev,
        equipment: [...(prev.equipment || []), newEq]
      }));
      return;
    }

    // Default: Selection & Dragging
    const rect = canvas.getBoundingClientRect();
    const metrics = computePitchMetrics(rect.width, rect.height, pitchType);
    const hit = findHitElement(normX, normY, metrics);

    if (hit) {
      setDraggedElement({
        id: hit.id,
        type: hit.type,
        offsetX: hit.element.x - normX,
        offsetY: hit.element.y - normY
      });
      if (onSelectElement) {
        onSelectElement(hit.id);
      }
    } else {
      if (onSelectElement) {
        onSelectElement(null);
      }
    }
  };

  // --- Pointer Move Event ---
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { normX, normY } = getCanvasCoords(e);

    // Laserpointer
    if (activeTool === 'laser' && e.buttons > 0) {
      setLaserPoints((prev) => [...prev, { x: normX, y: normY, time: performance.now() }]);
      return;
    }

    // Line Drawing
    if (currentLinePoints.length > 0) {
      const last = currentLinePoints[currentLinePoints.length - 1];
      const dist = Math.hypot(normX - last.x, normY - last.y);
      if (dist > 0.015) {
        setCurrentLinePoints((prev) => [...prev, { x: normX, y: normY }]);
      }
      return;
    }

    // Zone Drawing
    if (currentZoneStart) {
      const minX = Math.min(currentZoneStart.x, normX);
      const minY = Math.min(currentZoneStart.y, normY);
      const w = Math.abs(normX - currentZoneStart.x);
      const h = Math.abs(normY - currentZoneStart.y);
      setCurrentZoneRect({ x: minX, y: minY, w, h });
      return;
    }

    // Dragging Selected Element
    if (draggedElement && e.buttons > 0) {
      const newX = Math.max(0.01, Math.min(0.99, normX + draggedElement.offsetX));
      const newY = Math.max(0.01, Math.min(0.99, normY + draggedElement.offsetY));

      onUpdateCurrentFrame((prev) => {
        if (draggedElement.type === 'player') {
          return {
            ...prev,
            players: prev.players.map((p) => (p.id === draggedElement.id ? { ...p, x: newX, y: newY } : p))
          };
        }
        if (draggedElement.type === 'ball') {
          return {
            ...prev,
            balls: prev.balls.map((b) => (b.id === draggedElement.id ? { ...b, x: newX, y: newY } : b))
          };
        }
        if (draggedElement.type === 'equipment') {
          return {
            ...prev,
            equipment: prev.equipment.map((eq) => (eq.id === draggedElement.id ? { ...eq, x: newX, y: newY } : eq))
          };
        }
        if (draggedElement.type === 'text') {
          return {
            ...prev,
            texts: prev.texts.map((t) => (t.id === draggedElement.id ? { ...t, x: newX, y: newY } : t))
          };
        }
        return prev;
      });
    }
  };

  // --- Pointer Up / End Event ---
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Finish Line Drawing
    if (currentLinePoints.length > 1) {
      const newLine: TacticalLine = {
        id: `line_${Date.now()}`,
        type: activeTool as any,
        points: currentLinePoints,
        color: selectedColor || '#ffffff'
      };
      onUpdateCurrentFrame((prev) => ({
        ...prev,
        lines: [...(prev.lines || []), newLine]
      }));
    }
    setCurrentLinePoints([]);

    // Finish Zone Drawing
    if (currentZoneRect && currentZoneRect.w > 0.02 && currentZoneRect.h > 0.02) {
      const newZone: TacticalZone = {
        id: `zone_${Date.now()}`,
        type: activeTool === 'zone_circle' ? 'circle' : 'rect',
        x: currentZoneRect.x,
        y: currentZoneRect.y,
        width: currentZoneRect.w,
        height: currentZoneRect.h,
        color: selectedColor || '#3b82f6'
      };
      onUpdateCurrentFrame((prev) => ({
        ...prev,
        zones: [...(prev.zones || []), newZone]
      }));
    }
    setCurrentZoneStart(null);
    setCurrentZoneRect(null);

    setDraggedElement(null);
  };

  // =========================================================================
  // RENDER ENGINE (60 FPS Canvas Loop)
  // =========================================================================
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Handle Resize / High-DPI
      const container = containerRef.current;
      if (container) {
        const dpr = window.devicePixelRatio || 1;
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }
        ctx.resetTransform?.();
        ctx.scale(dpr, dpr);
      }

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const now = performance.now();

      // Compute Unified Aspect Ratio Metrics
      const metrics = computePitchMetrics(width, height, pitchType);

      // --- Animation Playback Step ---
      let renderProgress = 0;
      if (isPlaying && frames.length > 1) {
        const delta = (now - lastAnimTimeRef.current) / 1000;
        lastAnimTimeRef.current = now;
        const frameDuration = (currentFrame.duration || 1.8) / (playbackSpeed || 1.0);
        animProgressRef.current += delta / frameDuration;

        if (animProgressRef.current >= 1.0) {
          animProgressRef.current = 0;
          if (onStepNextFrame) {
            onStepNextFrame();
          }
        }
        renderProgress = animProgressRef.current;
      } else {
        lastAnimTimeRef.current = now;
        animProgressRef.current = 0;
      }

      // Smooth Easing (cubic ease-in-out)
      const easeProgress =
        renderProgress < 0.5
          ? 4 * renderProgress * renderProgress * renderProgress
          : 1 - Math.pow(-2 * renderProgress + 2, 3) / 2;

      // 0. Clear canvas with dark surround background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Field Background & Pitch Lines
      drawPitch(ctx, metrics, pitchType, pitchStyle);

      // 2. Draw Tactical Overlays (Half-spaces / 18 Zones)
      if (showHalfSpaces) drawHalfSpaces(ctx, metrics, pitchType);
      if (showTacticalGrid) draw18Zones(ctx, metrics, pitchType);

      // 3. Draw Tactical Zones (Rectangles / Circles)
      drawZones(ctx, metrics, currentFrame.zones || []);
      if (currentZoneRect) {
        drawLiveZone(ctx, metrics, currentZoneRect, activeTool, selectedColor);
      }

      // 4. Draw Tactical Lines & Arrows
      drawLines(ctx, metrics, currentFrame.lines || []);
      if (currentLinePoints.length > 1) {
        drawLiveLine(ctx, metrics, currentLinePoints, activeTool, selectedColor);
      }

      // 5. Draw Chain Lines (Defensive Chain)
      if (autoChainLines) {
        drawAutoChainLines(ctx, metrics, currentFrame.players || [], homeColors.primary);
      }

      // 6. Draw Equipment (Cones, Goals, Dummies)
      drawEquipment(ctx, metrics, currentFrame.equipment || []);

      // 7. Draw Players (with smooth interpolation if playing)
      drawPlayers(
        ctx,
        metrics,
        currentFrame.players || [],
        isPlaying ? nextFrame.players || [] : null,
        easeProgress,
        homeColors,
        awayColors,
        playerLabelMode,
        selectedElementId
      );

      // 8. Draw Balls (with smooth interpolation if playing)
      drawBalls(
        ctx,
        metrics,
        currentFrame.balls || [],
        isPlaying ? nextFrame.balls || [] : null,
        easeProgress,
        selectedElementId
      );

      // 9. Draw Texts
      drawTexts(ctx, metrics, currentFrame.texts || []);

      // 10. Draw Laserpointer Glow & Fade Trail
      drawLaserpointer(ctx, metrics, laserPoints, now, laserFadeSeconds * 1000);

      // Clean expired laser points
      const fadeMs = laserFadeSeconds * 1000;
      setLaserPoints((prev) => prev.filter((p) => now - p.time < fadeMs));

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    activeFrameIndex,
    isPlaying,
    playbackSpeed,
    frames,
    pitchType,
    pitchStyle,
    showTacticalGrid,
    showHalfSpaces,
    homeColors,
    awayColors,
    playerLabelMode,
    laserFadeSeconds,
    autoChainLines,
    selectedElementId,
    currentLinePoints,
    laserPoints,
    currentZoneRect,
    activeTool,
    selectedColor
  ]);

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const metrics = computePitchMetrics(rect.width, rect.height, pitchType);
    const { normX, normY } = metrics.toNorm(sx, sy);
    const hit = findHitElement(normX, normY, metrics);
    if (hit && onDoubleClickElement) {
      onDoubleClickElement(hit.id);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex items-center justify-center select-none touch-none"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full cursor-crosshair block"
      />
    </div>
  );
}

// =============================================================================
// SUB-DRAWING ENGINE (Precise Coordinate Rendering)
// =============================================================================

function drawPitch(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  type: string,
  style: string
) {
  const { pitchRect, borderRect } = metrics;
  const { x: px, y: py, w: pw, h: ph } = pitchRect;
  const { x: bx, y: by, w: bw, h: bh } = borderRect;

  // 1. Draw Turf Grass Area with Rounded Corners
  ctx.save();
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(px, py, pw, ph, 16);
  } else {
    ctx.rect(px, py, pw, ph);
  }
  ctx.clip();

  // Background Styles
  if (style === 'dark_tactical') {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(px, py, pw, ph);
  } else if (style === 'chalkboard') {
    ctx.fillStyle = '#1c2826';
    ctx.fillRect(px, py, pw, ph);
  } else if (style === 'blueprint') {
    ctx.fillStyle = '#0f2744';
    ctx.fillRect(px, py, pw, ph);
  } else if (style === 'grass_striped') {
    const stripeCount = type === 'full_vertical' ? 12 : 10;
    if (type === 'full_vertical') {
      const stripeH = ph / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#166534';
        ctx.fillRect(px, py + i * stripeH, pw, stripeH);
      }
    } else {
      const stripeW = pw / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#166534';
        ctx.fillRect(px + i * stripeW, py, stripeW, ph);
      }
    }
  } else {
    const grad = ctx.createLinearGradient(px, py, px + pw, py + ph);
    grad.addColorStop(0, '#15803d');
    grad.addColorStop(1, '#14532d');
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, pw, ph);
  }

  // Turf Bevel Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  if (type === 'blank') return;

  // 2. Pitch Boundary & Line Markings
  const lineColor =
    style === 'dark_tactical'
      ? 'rgba(255, 255, 255, 0.45)'
      : style === 'chalkboard'
      ? 'rgba(255, 255, 255, 0.70)'
      : style === 'blueprint'
      ? 'rgba(147, 197, 253, 0.65)'
      : 'rgba(255, 255, 255, 0.88)';

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const midX = bx + bw / 2;
  const midY = by + bh / 2;

  // ---------------------------------------------------------------------------
  // TYPE A: FULL VERTICAL (Großfeld Hochformat)
  // ---------------------------------------------------------------------------
  if (type === 'full_vertical') {
    ctx.strokeRect(bx, by, bw, bh);

    // Center Line (Horizontal)
    ctx.beginPath();
    ctx.moveTo(bx, midY);
    ctx.lineTo(bx + bw, midY);
    ctx.stroke();

    // Center Circle & Spot
    const centerR = bw * 0.18;
    ctx.beginPath();
    ctx.arc(midX, midY, centerR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    // Top 16m Penalty Box
    const boxH = bh * 0.16;
    const boxW = bw * 0.55;
    const boxX = midX - boxW / 2;
    ctx.strokeRect(boxX, by, boxW, boxH);

    // Top 5m Goal Box
    const goalBoxH = bh * 0.06;
    const goalBoxW = bw * 0.28;
    const goalBoxX = midX - goalBoxW / 2;
    ctx.strokeRect(goalBoxX, by, goalBoxW, goalBoxH);

    // Top Penalty Spot & Arc
    const topPenY = by + bh * 0.11;
    ctx.beginPath(); ctx.arc(midX, topPenY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(midX, topPenY, centerR, 0.25, Math.PI - 0.25); ctx.stroke();

    // Bottom 16m Penalty Box
    ctx.strokeRect(boxX, by + bh - boxH, boxW, boxH);

    // Bottom 5m Goal Box
    ctx.strokeRect(goalBoxX, by + bh - goalBoxH, goalBoxW, goalBoxH);

    // Bottom Penalty Spot & Arc
    const botPenY = by + bh - bh * 0.11;
    ctx.beginPath(); ctx.arc(midX, botPenY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(midX, botPenY, centerR, Math.PI + 0.25, Math.PI * 2 - 0.25); ctx.stroke();

    // Corner Arcs
    const cornerR = 10;
    ctx.beginPath(); ctx.arc(bx, by, cornerR, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + bw, by, cornerR, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by + bh, cornerR, -Math.PI / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + bw, by + bh, cornerR, Math.PI, -Math.PI / 2); ctx.stroke();

    // Goals (Top & Bottom Nets)
    const goalW = bw * 0.24;
    const goalX = midX - goalW / 2;
    const goalDepth = 10;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.strokeRect(goalX, by - goalDepth, goalW, goalDepth);
    ctx.strokeRect(goalX, by + bh, goalW, goalDepth);
    return;
  }

  // ---------------------------------------------------------------------------
  // TYPE B: HALF PITCH (Halbfeld)
  // ---------------------------------------------------------------------------
  if (type === 'half') {
    ctx.strokeRect(bx, by, bw, bh);

    // Left 16m Box
    const boxW = bw * 0.32;
    const boxH = bh * 0.60;
    const boxY = midY - boxH / 2;
    ctx.strokeRect(bx, boxY, boxW, boxH);

    // Left 5m Box
    const goalBoxW = bw * 0.12;
    const goalBoxH = bh * 0.32;
    const goalBoxY = midY - goalBoxH / 2;
    ctx.strokeRect(bx, goalBoxY, goalBoxW, goalBoxH);

    // Penalty Spot & Arc
    const penX = bx + bw * 0.22;
    ctx.beginPath(); ctx.arc(penX, midY, 4, 0, Math.PI * 2); ctx.fillStyle = lineColor; ctx.fill();
    ctx.beginPath(); ctx.arc(penX, midY, bh * 0.20, -0.65, 0.65); ctx.stroke();

    // Center Line on Right Edge & Half Center Circle
    ctx.beginPath();
    ctx.moveTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + bh);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bx + bw, midY, bh * 0.22, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + bw, midY, 4, 0, Math.PI * 2); ctx.fill();

    // Goal Net Left
    const goalH = bh * 0.25;
    const goalY = midY - goalH / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.strokeRect(bx - 12, goalY, 12, goalH);
    return;
  }

  // ---------------------------------------------------------------------------
  // TYPE C: PENALTY BOX CLOSEUP (16m-Raum)
  // ---------------------------------------------------------------------------
  if (type === 'penalty_box') {
    ctx.strokeRect(bx, by, bw, bh);

    // Huge 16m Box
    const boxW = bw * 0.70;
    const boxH = bh * 0.85;
    const boxY = midY - boxH / 2;
    ctx.strokeRect(bx, boxY, boxW, boxH);

    // 5m Goal Box
    const goalBoxW = bw * 0.25;
    const goalBoxH = bh * 0.45;
    const goalBoxY = midY - goalBoxH / 2;
    ctx.strokeRect(bx, goalBoxY, goalBoxW, goalBoxH);

    // Penalty Spot
    const penX = bx + bw * 0.45;
    ctx.beginPath(); ctx.arc(penX, midY, 5, 0, Math.PI * 2); ctx.fillStyle = lineColor; ctx.fill();

    // Penalty Arc (D-Bogen)
    ctx.beginPath();
    ctx.arc(penX, midY, bh * 0.28, -0.75, 0.75);
    ctx.stroke();

    // Large Goal Net Left
    const goalH = bh * 0.35;
    const goalY = midY - goalH / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.strokeRect(bx - 14, goalY, 14, goalH);
    return;
  }

  // ---------------------------------------------------------------------------
  // TYPE D: 40 x 20 METER (Halle / Futsal / Kleinfeld)
  // ---------------------------------------------------------------------------
  if (type === 'field_40x20') {
    ctx.strokeRect(bx, by, bw, bh);

    // Center Line
    ctx.beginPath();
    ctx.moveTo(midX, by);
    ctx.lineTo(midX, by + bh);
    ctx.stroke();

    // Center Circle (3m Radius in proportion)
    const centerR = bh * 0.15;
    ctx.beginPath();
    ctx.arc(midX, midY, centerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(midX, midY, 4, 0, Math.PI * 2); ctx.fillStyle = lineColor; ctx.fill();

    // 6-Meter Curved D-Zone (Penalty Area) Left Side
    const goalH = bh * 0.26;
    const goalY1 = midY - goalH / 2;
    const goalY2 = midY + goalH / 2;
    const dRadius = bh * 0.30;

    ctx.beginPath();
    ctx.arc(bx, goalY1, dRadius, -Math.PI / 2, 0);
    ctx.lineTo(bx + dRadius, goalY2);
    ctx.arc(bx, goalY2, dRadius, 0, Math.PI / 2);
    ctx.stroke();

    // 7-Meter Penalty Spot Left
    const spot7mLeft = bx + dRadius * 1.16;
    ctx.beginPath(); ctx.arc(spot7mLeft, midY, 3.5, 0, Math.PI * 2); ctx.fill();

    // 6-Meter Curved D-Zone Right Side
    ctx.beginPath();
    ctx.arc(bx + bw, goalY1, dRadius, Math.PI, (3 * Math.PI) / 2);
    ctx.lineTo(bx + bw - dRadius, goalY2);
    ctx.arc(bx + bw, goalY2, dRadius, Math.PI / 2, Math.PI);
    ctx.stroke();

    // 7-Meter Penalty Spot Right
    const spot7mRight = bx + bw - dRadius * 1.16;
    ctx.beginPath(); ctx.arc(spot7mRight, midY, 3.5, 0, Math.PI * 2); ctx.fill();

    // Goals (Handball / Futsal 3x2m Goals Left & Right)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.strokeRect(bx - 10, goalY1, 10, goalH);
    ctx.strokeRect(bx + bw, goalY1, 10, goalH);

    // Dimension Tag
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('40 x 20 m (HALLE / KLEINFELD)', midX, by + 14);
    return;
  }

  // ---------------------------------------------------------------------------
  // TYPE E: FUNINO (4 Minitore & Schusszonen)
  // ---------------------------------------------------------------------------
  if (type === 'funino_4_goals') {
    ctx.strokeRect(bx, by, bw, bh);

    // Center Line
    ctx.beginPath();
    ctx.moveTo(midX, by);
    ctx.lineTo(midX, by + bh);
    ctx.stroke();

    // 6m Shooting Lines (Gestrichelte Schusszone links und rechts)
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    const shootZoneW = bw * 0.22;

    ctx.beginPath();
    ctx.moveTo(bx + shootZoneW, by);
    ctx.lineTo(bx + shootZoneW, by + bh);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx + bw - shootZoneW, by);
    ctx.lineTo(bx + bw - shootZoneW, by + bh);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4 Mini Goals (2 Left, 2 Right)
    const miniGoalH = bh * 0.16;
    const offsetTop = bh * 0.18;
    const offsetBot = bh * 0.82 - miniGoalH;

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3;
    // Left Top & Bottom
    ctx.strokeRect(bx - 8, by + offsetTop, 8, miniGoalH);
    ctx.strokeRect(bx - 8, by + offsetBot, 8, miniGoalH);
    // Right Top & Bottom
    ctx.strokeRect(bx + bw, by + offsetTop, 8, miniGoalH);
    ctx.strokeRect(bx + bw, by + offsetBot, 8, miniGoalH);

    // Labels for Shooting Zone
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCHUSSZONE (6m)', bx + shootZoneW / 2, midY);
    ctx.fillText('SCHUSSZONE (6m)', bx + bw - shootZoneW / 2, midY);
    return;
  }

  // ---------------------------------------------------------------------------
  // TYPE F: YOUTH FIELD (7er / 9er Kleinfeld)
  // ---------------------------------------------------------------------------
  if (type === 'field_youth_7v7') {
    ctx.strokeRect(bx, by, bw, bh);

    // Center Line & Circle
    ctx.beginPath();
    ctx.moveTo(midX, by);
    ctx.lineTo(midX, by + bh);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, bh * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(midX, midY, 3.5, 0, Math.PI * 2); ctx.fillStyle = lineColor; ctx.fill();

    // Compact Youth Penalty Boxes
    const boxW = bw * 0.18;
    const boxH = bh * 0.65;
    const boxY = midY - boxH / 2;
    ctx.strokeRect(bx, boxY, boxW, boxH);
    ctx.strokeRect(bx + bw - boxW, boxY, boxW, boxH);

    // Penalty Spots
    const penXLeft = bx + bw * 0.12;
    const penXRight = bx + bw - bw * 0.12;
    ctx.beginPath(); ctx.arc(penXLeft, midY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(penXRight, midY, 3.5, 0, Math.PI * 2); ctx.fill();

    // Youth Goals (5x2m)
    const goalH = bh * 0.22;
    const goalY = midY - goalH / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeRect(bx - 10, goalY, 10, goalH);
    ctx.strokeRect(bx + bw, goalY, 10, goalH);
    return;
  }

  // ---------------------------------------------------------------------------
  // TYPE G: FULL HORIZONTAL (Standard 11v11)
  // ---------------------------------------------------------------------------
  ctx.strokeRect(bx, by, bw, bh);

  // Center Line & Center Circle
  ctx.beginPath();
  ctx.moveTo(midX, by);
  ctx.lineTo(midX, by + bh);
  ctx.stroke();

  const centerR = bh * 0.18;
  ctx.beginPath();
  ctx.arc(midX, midY, centerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, midY, 4, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();

  // Left Penalty Box (16er)
  const boxW = bw * 0.16;
  const boxH = bh * 0.55;
  const boxY = midY - boxH / 2;
  ctx.strokeRect(bx, boxY, boxW, boxH);

  // Left 5m Box
  const goalBoxW = bw * 0.06;
  const goalBoxH = bh * 0.28;
  const goalBoxY = midY - goalBoxH / 2;
  ctx.strokeRect(bx, goalBoxY, goalBoxW, goalBoxH);

  // Left Penalty Spot & Arc
  const leftPenX = bx + bw * 0.11;
  ctx.beginPath();
  ctx.arc(leftPenX, midY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(leftPenX, midY, centerR, -0.65, 0.65);
  ctx.stroke();

  // Right Penalty Box (16er)
  ctx.strokeRect(bx + bw - boxW, boxY, boxW, boxH);

  // Right 5m Box
  ctx.strokeRect(bx + bw - goalBoxW, goalBoxY, goalBoxW, goalBoxH);

  // Right Penalty Spot & Arc
  const rightPenX = bx + bw - bw * 0.11;
  ctx.beginPath();
  ctx.arc(rightPenX, midY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(rightPenX, midY, centerR, Math.PI - 0.65, Math.PI + 0.65);
  ctx.stroke();

  // Corner Arcs
  const cornerR = 10;
  ctx.beginPath(); ctx.arc(bx, by, cornerR, 0, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx, by + bh, cornerR, -Math.PI / 2, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx + bw, by, cornerR, Math.PI / 2, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx + bw, by + bh, cornerR, Math.PI, -Math.PI / 2); ctx.stroke();

  // Goal Nets (Outer)
  const goalH = bh * 0.20;
  const goalY = midY - goalH / 2;
  const goalDepth = 10;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.strokeRect(bx - goalDepth, goalY, goalDepth, goalH);
  ctx.strokeRect(bx + bw, goalY, goalDepth, goalH);
}

function drawHalfSpaces(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  type: string
) {
  const { borderRect } = metrics;
  const { x: bx, y: by, w: bw, h: bh } = borderRect;

  // 5 Corridors
  const corridors = [
    { label: 'Flügel', ratio: 0.18, color: 'rgba(255, 255, 255, 0.02)' },
    { label: 'Halbraum', ratio: 0.22, color: 'rgba(99, 102, 241, 0.08)' },
    { label: 'Zentrum', ratio: 0.20, color: 'rgba(255, 255, 255, 0.02)' },
    { label: 'Halbraum', ratio: 0.22, color: 'rgba(99, 102, 241, 0.08)' },
    { label: 'Flügel', ratio: 0.18, color: 'rgba(255, 255, 255, 0.02)' }
  ];

  if (type === 'full_vertical') {
    let curX = bx;
    corridors.forEach((c) => {
      const cw = bw * c.ratio;
      ctx.fillStyle = c.color;
      ctx.fillRect(curX, by, cw, bh);

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, by);
      ctx.lineTo(curX, by + bh);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.label.toUpperCase(), curX + cw / 2, by + bh / 2);

      curX += cw;
    });
  } else {
    let curY = by;
    corridors.forEach((c) => {
      const ch = bh * c.ratio;
      ctx.fillStyle = c.color;
      ctx.fillRect(bx, curY, bw, ch);

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, curY);
      ctx.lineTo(bx + bw, curY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.label.toUpperCase(), bx + bw / 2, curY + ch / 2 + 4);

      curY += ch;
    });
  }
}

function draw18Zones(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  type: string
) {
  const { borderRect } = metrics;
  const { x: bx, y: by, w: bw, h: bh } = borderRect;

  const cols = type === 'full_vertical' ? 3 : 6;
  const rows = type === 'full_vertical' ? 6 : 3;
  const cellW = bw / cols;
  const cellH = bh / rows;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.0;

  let zoneNumber = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = bx + c * cellW;
      const y = by + r * cellH;

      ctx.strokeRect(x, y, cellW, cellH);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Z${zoneNumber}`, x + cellW / 2, y + cellH / 2 + 4);
      zoneNumber++;
    }
  }
  ctx.setLineDash([]);
}

function drawPlayers(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  currentPlayers: PlayerToken[],
  nextPlayers: PlayerToken[] | null,
  t: number,
  homeColors: any,
  awayColors: any,
  labelMode: string,
  selectedId: string | null
) {
  const radius = 18;

  currentPlayers.forEach((p) => {
    let normX = p.x;
    let normY = p.y;

    if (nextPlayers) {
      const target = nextPlayers.find((np) => np.id === p.id);
      if (target) {
        normX = p.x + (target.x - p.x) * t;
        normY = p.y + (target.y - p.y) * t;
      }
    }

    const { x: px, y: py } = metrics.toScreen(normX, normY);
    const isSelected = selectedId === p.id;
    const isHome = p.team === 'home';
    const isGK = p.isGoalkeeper || p.role === 'TW';

    let primaryColor = isHome
      ? (isGK ? homeColors.goalkeeper : homeColors.primary)
      : (isGK ? awayColors.goalkeeper : awayColors.primary);

    if (p.team === 'neutral') primaryColor = '#a855f7';
    if (p.team === 'referee') primaryColor = '#eab308';
    if (p.customColor) primaryColor = p.customColor;

    // Drop Shadow
    ctx.beginPath();
    ctx.arc(px, py + 3, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // Selection Ring Glow
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(px, py, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Token Body
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // Token Outer Rim
    ctx.strokeStyle = isHome ? (homeColors.secondary || '#ffffff') : (awayColors.secondary || '#ffffff');
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Label on Token
    let labelText = `${p.number || ''}`;
    if (labelMode === 'name') labelText = (p.name || '').slice(0, 4);
    else if (labelMode === 'initials') {
      const parts = (p.name || '').split(' ');
      labelText = parts.map((n) => n[0]).join('').slice(0, 3).toUpperCase();
    } else if (labelMode === 'role') labelText = p.role || 'SP';

    ctx.fillStyle = isHome ? (homeColors.text || '#ffffff') : (awayColors.text || '#ffffff');
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, px, py);

    // Sub-Label (Full Name Below Token)
    if (p.name && labelMode !== 'name') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(p.name, px, py + radius + 11);
    }
  });
}

function drawBalls(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  currentBalls: BallItem[],
  nextBalls: BallItem[] | null,
  t: number,
  selectedId: string | null
) {
  const radius = 9;

  currentBalls.forEach((b) => {
    let normX = b.x;
    let normY = b.y;

    if (nextBalls) {
      const target = nextBalls.find((nb) => nb.id === b.id);
      if (target) {
        normX = b.x + (target.x - b.x) * t;
        normY = b.y + (target.y - b.y) * t;
      }
    }

    const { x: bx, y: by } = metrics.toScreen(normX, normY);
    const isSelected = selectedId === b.id;

    // Drop Shadow
    ctx.beginPath();
    ctx.arc(bx, by + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Selection Ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(bx, by, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Classic Football Hex Pattern
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Black Center Patch
    ctx.beginPath();
    ctx.arc(bx, by, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#18181b';
    ctx.fill();
  });
}

function drawEquipment(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  equipment: EquipmentItem[]
) {
  equipment.forEach((eq) => {
    const { x: ex, y: ey } = metrics.toScreen(eq.x, eq.y);

    if (eq.type === 'cone') {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(9, 8);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fillStyle = eq.color || '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    } else if (eq.type === 'dummy') {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.beginPath();
      ctx.arc(0, -8, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeRect(-8, -2, 16, 16);
      ctx.restore();
    } else if (eq.type === 'goal_mini') {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.strokeRect(-12, -8, 24, 16);
      ctx.restore();
    }
  });
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  lines: TacticalLine[]
) {
  lines.forEach((l) => {
    if (!l.points || l.points.length < 2) return;
    renderTacticalLine(ctx, metrics, l.points, l.type, l.color, l.width || 3);
  });
}

function drawLiveLine(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  points: { x: number; y: number }[],
  toolType: string,
  color: string
) {
  if (points.length < 2) return;
  renderTacticalLine(ctx, metrics, points, toolType as any, color, 3);
}

function renderTacticalLine(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  normPoints: { x: number; y: number }[],
  type: string,
  color: string,
  lineWidth: number
) {
  const pts = normPoints.map((p) => metrics.toScreen(p.x, p.y));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'pass_arrow') {
    // Dashed Pass Line with Arrow Head
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowHead(ctx, pts[pts.length - 2], pts[pts.length - 1], color, 14);
  } else if (type === 'run_arrow') {
    // Solid Continuous Run Line with Arrow Head
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    drawArrowHead(ctx, pts[pts.length - 2], pts[pts.length - 1], color, 14);
  } else if (type === 'dribble_arrow') {
    // Wavy / Zigzag Dribble Line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    drawArrowHead(ctx, pts[pts.length - 2], pts[pts.length - 1], color, 14);
  } else if (type === 'press_arrow') {
    // Thick Pressing Arrow
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    drawArrowHead(ctx, pts[pts.length - 2], pts[pts.length - 1], color, 18);
  } else if (type === 'chain_line') {
    // Defensive Chain Connection
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // Standard Pen / Freehand
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  size: number
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 6),
    to.y - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 6),
    to.y - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawZones(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  zones: TacticalZone[]
) {
  zones.forEach((z) => {
    const { x: zx, y: zy } = metrics.toScreen(z.x, z.y);
    const zw = z.width * metrics.borderRect.w;
    const zh = z.height * metrics.borderRect.h;

    ctx.save();
    if (z.type === 'circle') {
      const rx = zw / 2;
      const ry = zh / 2;
      ctx.beginPath();
      ctx.ellipse(zx + rx, zy + ry, Math.max(5, rx), Math.max(5, ry), 0, 0, Math.PI * 2);
      ctx.fillStyle = `${z.color}33`; // 20% opacity
      ctx.fill();
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = `${z.color}33`;
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(zx, zy, zw, zh);
    }
    ctx.restore();
  });
}

function drawLiveZone(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  rect: { x: number; y: number; w: number; h: number },
  toolType: string,
  color: string
) {
  const { x: zx, y: zy } = metrics.toScreen(rect.x, rect.y);
  const zw = rect.w * metrics.borderRect.w;
  const zh = rect.h * metrics.borderRect.h;

  ctx.save();
  ctx.strokeStyle = color || '#3b82f6';
  ctx.fillStyle = `${color || '#3b82f6'}33`;
  ctx.lineWidth = 2;

  if (toolType === 'zone_circle') {
    ctx.beginPath();
    ctx.ellipse(zx + zw / 2, zy + zh / 2, Math.max(5, zw / 2), Math.max(5, zh / 2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(zx, zy, zw, zh);
    ctx.strokeRect(zx, zy, zw, zh);
  }
  ctx.restore();
}

function drawAutoChainLines(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  players: PlayerToken[],
  lineColor: string
) {
  const homeDefenders = players
    .filter((p) => p.team === 'home' && !p.isGoalkeeper && p.role !== 'TW')
    .sort((a, b) => a.y - b.y)
    .slice(0, 4);

  if (homeDefenders.length >= 2) {
    ctx.save();
    ctx.strokeStyle = `${lineColor}88`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const first = metrics.toScreen(homeDefenders[0].x, homeDefenders[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < homeDefenders.length; i++) {
      const p = metrics.toScreen(homeDefenders[i].x, homeDefenders[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawTexts(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  texts: TacticalText[]
) {
  texts.forEach((t) => {
    const { x: tx, y: ty } = metrics.toScreen(t.x, t.y);
    ctx.save();
    ctx.fillStyle = t.color || '#ffffff';
    ctx.font = `bold ${t.fontSize || 14}px sans-serif`;
    ctx.fillText(t.text, tx, ty);
    ctx.restore();
  });
}

function drawLaserpointer(
  ctx: CanvasRenderingContext2D,
  metrics: PitchMetrics,
  points: { x: number; y: number; time: number }[],
  currentTime: number,
  maxFadeDuration: number
) {
  if (points.length < 2) return;

  ctx.save();
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const age = currentTime - p2.time;
    if (age > maxFadeDuration) continue;

    const alpha = Math.max(0, 1 - age / maxFadeDuration);
    const s1 = metrics.toScreen(p1.x, p1.y);
    const s2 = metrics.toScreen(p2.x, p2.y);

    // Glowing Laser Trail
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
    ctx.lineWidth = 4 * alpha + 1;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner bright core
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}
