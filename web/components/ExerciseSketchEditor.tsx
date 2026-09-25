"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Square,
  Circle,
  ArrowRight,
  MoveRight,
  Type,
  Trash2,
  Save,
  Grid,
  Users,
  RotateCcw,
  RotateCw,
  Sparkles,
  Disc,
  Shield,
  Maximize,
  Minimize,
  UserX,
  Smartphone,
  Monitor,
  CircleDot,
  AlignJustify,
  Copy,
  ClipboardPaste,
  Settings2,
  Palette,
  ZoomIn,
  ZoomOut,
  X,
  Minus,
  Group,
  Ungroup,
  Layers,
  MousePointer
} from 'lucide-react';

import { useToast } from '@/contexts/ToastContext';

interface ElementItem {
  id: string;
  type: 'pitch' | 'cone' | 'disc' | 'ring' | 'ladder' | 'player' | 'goalkeeper' | 'dummy' | 'ball' | 'goal' | 'line' | 'text' | 'rect' | 'circle';
  subType?: string; // e.g. goal type ('mini', 'youth', 'full') or line type ('pass', 'run', 'dribble', 'straight', 'straight_dashed')
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  rotation?: number; // 0, 90, 180, 270 degrees
  color?: string;
  label?: string;
  size?: number; // scale percentage (e.g. 100)
  customWidth?: number;
  customDepth?: number;
  groupId?: string;
  filled?: boolean;
}

export interface ExerciseSketchEditorHandle {
  getDiagramData: () => {
    diagramData: any;
    thumbnailDataUrl: string;
  } | null;
}

interface ExerciseSketchEditorProps {
  initialData?: any;
  onSave?: (diagramData: any, thumbnailDataUrl: string) => void;
  onCancel?: () => void;
}

// Module-level caches for SVGs, preloaded images, and tinted icons across editor mounts
const globalSvgTexts: Record<string, string> = {};
const globalLoadedImages: Record<string, HTMLImageElement> = {};
const globalTintedCache: Record<string, HTMLImageElement> = {};

let preloadPromise: Promise<void> | null = null;

export function preloadEditorAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  if (typeof window === 'undefined') return Promise.resolve();

  preloadPromise = (async () => {
    const svgs = [
      { id: 'player', src: '/icons/player.svg' },
      { id: 'cone', src: '/icons/cone.svg' },
      { id: 'dummy', src: '/icons/dummy.svg' },
      { id: 'goalkeeper', src: '/icons/goalkeeper.svg' },
      { id: 'ring', src: '/icons/ring.svg' },
      { id: 'ladder', src: '/icons/ladder.svg' }
    ];

    const images = [
      { id: 'ball', src: '/icons/ball.svg' },
      { id: 'goal', src: '/icons/goal.svg' },
      { id: 'green_full', src: '/icons/pitches/green_full.svg' },
      { id: 'green_empty_near', src: '/icons/pitches/green_empty_near.svg' },
      { id: 'green_empty_far', src: '/icons/pitches/green_empty_far.svg' },
      { id: 'futsal_full', src: '/icons/pitches/futsal_full.svg' },
      { id: 'futsal_empty', src: '/icons/pitches/futsal_empty.svg' }
    ];

    await Promise.all([
      ...svgs.map(async ({ id, src }) => {
        if (globalSvgTexts[id]) return;
        try {
          const res = await fetch(src);
          if (res.ok) {
            globalSvgTexts[id] = await res.text();
          }
        } catch (err) {
          console.error(`Fehler beim Preloaden von SVG ${id}:`, err);
        }
      }),
      ...images.map(({ id, src }) => {
        if (globalLoadedImages[id] && globalLoadedImages[id].complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            globalLoadedImages[id] = img;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        });
      })
    ]);
  })();

  return preloadPromise;
}

if (typeof window !== 'undefined') {
  preloadEditorAssets();
}

const ExerciseSketchEditor = forwardRef<ExerciseSketchEditorHandle, ExerciseSketchEditorProps>(function ExerciseSketchEditor({
  initialData,
  onSave,
  onCancel
}, ref) {
  const { toast, confirm: confirmModal } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pitchType, setPitchType] = useState<
    'full' | 'half' | 'field_15x25' | 'field_35x25' | 'field_40x25' | 'blank' |
    'green_full' | 'green_empty_near' | 'green_empty_far' | 'futsal_full' | 'futsal_empty'
  >(
    initialData?.pitchType || initialData?.pitch_type || 'green_full'
  );
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    initialData?.orientation || 'landscape'
  );

  const [activeTool, setActiveTool] = useState<string>('select');
  const [selectedGoalType, setSelectedGoalType] = useState<'mini' | 'youth' | 'full'>('mini');
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444'); // Red default
  const [elements, setElements] = useState<ElementItem[]>(initialData?.elements || []);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [textInput, setTextInput] = useState('');

  // Background Tracing Image State
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [bgOpacity, setBgOpacity] = useState<number>(0.4); // Default 40% transparency for tracing
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTraceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBackgroundImage(img);
        toast.success('Vorlagen-Foto geladen! Du kannst die Übung jetzt auf der Vorlage nachzeichnen.');
      };

      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Fullscreen and Icons State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>(() => ({ ...globalLoadedImages }));

  const [playerSvgText, setPlayerSvgText] = useState<string | null>(() => globalSvgTexts.player || null);
  const [coneSvgText, setConeSvgText] = useState<string | null>(() => globalSvgTexts.cone || null);
  const [dummySvgText, setDummySvgText] = useState<string | null>(() => globalSvgTexts.dummy || null);
  const [goalkeeperSvgText, setGoalkeeperSvgText] = useState<string | null>(() => globalSvgTexts.goalkeeper || null);
  const [ringSvgText, setRingSvgText] = useState<string | null>(() => globalSvgTexts.ring || null);
  const [ladderSvgText, setLadderSvgText] = useState<string | null>(() => globalSvgTexts.ladder || null);

  const drawCanvasRef = useRef<() => void>(() => {});

  useEffect(() => {
    preloadEditorAssets().then(() => {
      setLoadedImages((prev) => ({ ...prev, ...globalLoadedImages }));
      if (globalSvgTexts.player) setPlayerSvgText(globalSvgTexts.player);
      if (globalSvgTexts.cone) setConeSvgText(globalSvgTexts.cone);
      if (globalSvgTexts.dummy) setDummySvgText(globalSvgTexts.dummy);
      if (globalSvgTexts.goalkeeper) setGoalkeeperSvgText(globalSvgTexts.goalkeeper);
      if (globalSvgTexts.ring) setRingSvgText(globalSvgTexts.ring);
      if (globalSvgTexts.ladder) setLadderSvgText(globalSvgTexts.ladder);
    });
  }, []);

  const getTintedImage = (
    type: 'player' | 'cone' | 'dummy' | 'goalkeeper' | 'ring' | 'ladder',
    svgText: string | null,
    targetHex: string,
    replaceColorHex: string
  ): HTMLImageElement | null => {
    const cacheKey = `${type}_${targetHex.toLowerCase()}`;
    if (globalTintedCache[cacheKey]) {
      return globalTintedCache[cacheKey];
    }
    const rawSvg = svgText || globalSvgTexts[type];
    if (!rawSvg) return null;

    const coloredSvg = rawSvg.replace(new RegExp(replaceColorHex, 'gi'), targetHex);
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coloredSvg)}`;

    const img = new Image();
    img.onload = () => {
      globalTintedCache[cacheKey] = img;
      drawCanvasRef.current();
    };
    img.src = dataUri;
    globalTintedCache[cacheKey] = img;
    return img;
  };

  const getRingImage = (color: string) => getTintedImage('ring', ringSvgText, color, '#EE7110');
  const getLadderImage = (color: string) => getTintedImage('ladder', ladderSvgText, color, '#EE7110');
  const getGoalkeeperImage = (color: string) => getTintedImage('goalkeeper', goalkeeperSvgText, color, '#9E2A6A');
  const getDummyImage = (color: string) => getTintedImage('dummy', dummySvgText, color, '#EE7110');
  const getConeImage = (color: string) => getTintedImage('cone', coneSvgText, color, '#EE7110');
  const getPlayerImage = (color: string) => getTintedImage('player', playerSvgText, color, '#0068B4');

  // Update state when initialData changes or loads
  useEffect(() => {
    if (initialData) {
      if (initialData.pitchType || initialData.pitch_type) {
        setPitchType(initialData.pitchType || initialData.pitch_type);
      }
      if (initialData.orientation) {
        setOrientation(initialData.orientation);
      }
      if (Array.isArray(initialData.elements)) {
        setElements(initialData.elements);
      }
    }
  }, [initialData]);

  // Pre-warm tinted assets for all elements in the current sketch
  useEffect(() => {
    elements.forEach((el) => {
      if (el.type === 'player') getPlayerImage(el.color || '#3b82f6');
      else if (el.type === 'goalkeeper') getGoalkeeperImage(el.color || '#eab308');
      else if (el.type === 'cone') getConeImage(el.color || '#ef4444');
      else if (el.type === 'dummy') getDummyImage(el.color || '#eab308');
      else if (el.type === 'ring') getRingImage(el.color || '#eab308');
      else if (el.type === 'ladder') getLadderImage(el.color || '#eab308');
    });
  }, [elements, playerSvgText, coneSvgText, dummySvgText, goalkeeperSvgText, ringSvgText, ladderSvgText]);

  // Redraw canvas on elements / pitch / orientation / tracing background change or asset load
  useEffect(() => {
    drawCanvas();
  }, [
    pitchType,
    orientation,
    elements,
    selectedElementId,
    selectedElementIds,
    backgroundImage,
    bgOpacity,
    loadedImages,
    playerSvgText,
    coneSvgText,
    dummySvgText,
    goalkeeperSvgText,
    ringSvgText,
    ladderSvgText
  ]);


  const drawPitch = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Check if current pitch is one of the new SVG pitches
    if (['green_full', 'green_empty_near', 'green_empty_far', 'futsal_full', 'futsal_empty'].includes(pitchType)) {
      const img = loadedImages[pitchType] || globalLoadedImages[pitchType];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        if (orientation === 'landscape') {
          // The SVG is native portrait (viewBox 0 0 751 751 or aspect), rotate 90 deg for landscape view
          ctx.translate(width / 2, height / 2);
          ctx.rotate((-90 * Math.PI) / 180);
          ctx.drawImage(img, -height / 2, -width / 2, height, width);
        } else {
          // Portrait
          ctx.drawImage(img, 0, 0, width, height);
        }
        ctx.restore();
        return;
      }
    }

    // Background
    if (pitchType === 'blank') {
      ctx.fillStyle = '#18181b'; // zinc-900
      ctx.fillRect(0, 0, width, height);
      return;
    }

    ctx.fillStyle = '#15803d'; // Green pitch
    ctx.fillRect(0, 0, width, height);

    // Mowing lines texture
    const stripeWidth = width / 10;
    for (let i = 0; i < 10; i += 2) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, height);
    }

    // Pitch Lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    const padding = 30;

    if (pitchType === 'full') {
      // Outer border
      ctx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
      // Center line
      const centerX = width / 2;
      ctx.beginPath();
      ctx.moveTo(centerX, padding);
      ctx.lineTo(centerX, height - padding);
      ctx.stroke();
      // Center circle
      ctx.beginPath();
      ctx.arc(centerX, height / 2, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, height / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Left Penalty Box
      ctx.strokeRect(padding, height / 2 - 90, 110, 180);
      ctx.strokeRect(padding, height / 2 - 45, 45, 90);
      // Right Penalty Box
      ctx.strokeRect(width - padding - 110, height / 2 - 90, 110, 180);
      ctx.strokeRect(width - padding - 45, height / 2 - 45, 45, 90);
    } else if (pitchType === 'half') {
      ctx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
      // Penalty Box top/center
      ctx.strokeRect(width / 2 - 120, padding, 240, 130);
      ctx.strokeRect(width / 2 - 60, padding, 120, 50);
      // Center Arc
      ctx.beginPath();
      ctx.arc(width / 2, height - padding, 70, Math.PI, 0);
      ctx.stroke();
    } else if (pitchType === 'field_15x25') {
      // 15x25 Spielfeld mit Hintergrund green_empty_near.svg
      const bgImg = loadedImages['green_empty_near'] || globalLoadedImages['green_empty_near'];
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.save();
        if (orientation === 'landscape') {
          ctx.translate(width / 2, height / 2);
          ctx.rotate((-90 * Math.PI) / 180);
          ctx.drawImage(bgImg, -height / 2, -width / 2, height, width);
        } else {
          ctx.drawImage(bgImg, 0, 0, width, height);
        }
        ctx.restore();
      }

      // Spielfeld-Begrenzung & Beschriftung
      const fieldW = orientation === 'landscape' ? width - padding * 4 : width - padding * 2.5;
      const fieldH = orientation === 'landscape' ? height - padding * 2.5 : height - padding * 4;
      const startX = (width - fieldW) / 2;
      const startY = (height - fieldH) / 2;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(startX, startY, fieldW, fieldH);

      // Eckmarkierungen / Fahnen-Linien
      const cornerSize = 12;
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(startX, startY + cornerSize); ctx.lineTo(startX + cornerSize, startY);
      // Top-Right
      ctx.moveTo(startX + fieldW - cornerSize, startY); ctx.lineTo(startX + fieldW, startY + cornerSize);
      // Bottom-Left
      ctx.moveTo(startX, startY + fieldH - cornerSize); ctx.lineTo(startX + cornerSize, startY + fieldH);
      // Bottom-Right
      ctx.moveTo(startX + fieldW - cornerSize, startY + fieldH); ctx.lineTo(startX + fieldW, startY + fieldH - cornerSize);
      ctx.stroke();

      // Beschriftung 15m x 25m
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText('15m × 25m Minifeld', width / 2, startY + 22);
      ctx.shadowBlur = 0;
    } else if (pitchType === 'field_40x25' || pitchType === 'field_35x25') {
      // 40x25 bzw. 35x25 Spielfeld mit Hintergrund green_empty_far.svg
      const bgImg = loadedImages['green_empty_far'] || globalLoadedImages['green_empty_far'];
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.save();
        if (orientation === 'landscape') {
          ctx.translate(width / 2, height / 2);
          ctx.rotate((-90 * Math.PI) / 180);
          ctx.drawImage(bgImg, -height / 2, -width / 2, height, width);
        } else {
          ctx.drawImage(bgImg, 0, 0, width, height);
        }
        ctx.restore();
      }

      const fieldW = orientation === 'landscape' ? width - padding * 3 : width - padding * 2.2;
      const fieldH = orientation === 'landscape' ? height - padding * 2.2 : height - padding * 3;
      const startX = (width - fieldW) / 2;
      const startY = (height - fieldH) / 2;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(startX, startY, fieldW, fieldH);

      // Mittellinie
      ctx.beginPath();
      if (orientation === 'landscape') {
        const centerX = width / 2;
        ctx.moveTo(centerX, startY);
        ctx.lineTo(centerX, startY + fieldH);
      } else {
        const centerY = height / 2;
        ctx.moveTo(startX, centerY);
        ctx.lineTo(startX + fieldW, centerY);
      }
      ctx.stroke();

      // Beschriftung
      const label = pitchType === 'field_40x25' ? '40m × 25m Feld' : '35m × 25m Feld';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(label, width / 2, startY + 22);
      ctx.shadowBlur = 0;
    }
  };

  const drawSoccerBall = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

    const scale = (el.size ? el.size / 100 : 1.0);
    const radius = 5.5 * scale;
    const ballImg = loadedImages.ball || globalLoadedImages.ball;

    if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
      // Draw ball image centered (half size of previous ~26px -> ~13px)
      const imgSize = radius * 2.4;
      ctx.drawImage(ballImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
    } else {
      // Fallback ball
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawGoal = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) {
      ctx.rotate((el.rotation * Math.PI) / 180);
    }

    let baseWidth = 60;
    let baseDepth = 25;

    if (el.subType === 'mini') {
      baseWidth = 32;
      baseDepth = 15;
    } else if (el.subType === 'youth') {
      baseWidth = 48;
      baseDepth = 20;
    }

    const scale = el.size ? el.size / 100 : 1.0;
    const gWidth = (el.customWidth || baseWidth) * scale;
    const gDepth = (el.customDepth || baseDepth) * scale;
    const goalImg = loadedImages.goal || globalLoadedImages.goal;

    if (goalImg && goalImg.complete && goalImg.naturalWidth > 0) {
      // The image is a 2D/3D perspective, we draw it scaled
      ctx.drawImage(goalImg, -gWidth / 2, -gDepth / 2, gWidth, gDepth);
    } else {
      // Fallback
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeStyle = el.color || '#ffffff';
      ctx.lineWidth = 2.5;

      ctx.fillRect(-gWidth / 2, -gDepth / 2, gWidth, gDepth);
      ctx.strokeRect(-gWidth / 2, -gDepth / 2, gWidth, gDepth);

      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-gWidth / 2, gDepth / 2);
      ctx.lineTo(gWidth / 2, gDepth / 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const stepX = gWidth / 4;
      for (let i = 1; i < 4; i++) {
        ctx.moveTo(-gWidth / 2 + stepX * i, -gDepth / 2);
        ctx.lineTo(-gWidth / 2 + stepX * i, gDepth / 2);
      }
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawCone = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

    const scale = (el.size ? el.size / 100 : 1.0);
    const mainColor = el.color || '#ef4444';
    const img = getConeImage(mainColor);

    if (img && img.complete && img.naturalWidth > 0) {
      // SVG viewBox is 9.1 x 5.8
      const w = 18 * scale;
      const h = (18 * 5.8 / 9.1) * scale;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      // Fallback
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.moveTo(0, -12 * scale);
      ctx.lineTo(-10 * scale, 10 * scale);
      ctx.lineTo(10 * scale, 10 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawDummy = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

    const scale = (el.size ? el.size / 100 : 1.0);
    const mainColor = el.color || '#eab308';
    const img = getDummyImage(mainColor);

    if (img && img.complete && img.naturalWidth > 0) {
      // SVG viewBox is 18.7 x 51.3
      const w = 18 * scale;
      const h = (18 * 51.3 / 18.7) * scale;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      // Fallback
      ctx.fillStyle = mainColor;
      ctx.fillRect(-6 * scale, -18 * scale, 12 * scale, 36 * scale);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-6 * scale, -18 * scale, 12 * scale, 36 * scale);
    }

    ctx.restore();
  };

  const drawRing = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

    const scale = (el.size ? el.size / 100 : 1.0);
    const mainColor = el.color || '#eab308';
    const img = getRingImage(mainColor);

    if (img && img.complete && img.naturalWidth > 0) {
      // SVG viewBox is 23.5 x 13
      const w = 24 * scale;
      const h = (24 * 13 / 23.5) * scale;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      // Fallback
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11 * scale, 6 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawLadder = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

    const scale = el.size ? el.size / 100 : 1.0;
    const mainColor = el.color || '#eab308';
    const img = getLadderImage(mainColor);

    if (img && img.complete && img.naturalWidth > 0) {
      // SVG viewBox is 92.6 x 14.6
      const w = 100 * scale;
      const h = (100 * 14.6 / 92.6) * scale;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      // Fallback
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(-50 * scale, -7.5 * scale, 100 * scale, 15 * scale);
    }

    ctx.restore();
  };

  const drawDisc = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);

    const scale = el.size ? el.size / 100 : 1.0;
    const outerRadius = 12 * scale;
    const innerRadius = 7 * scale;
    const holeRadius = 3.5 * scale;

    // Outer saucer cone base
    ctx.fillStyle = el.color || '#eab308';
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner slope ring highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center hole (Loch)
    ctx.fillStyle = pitchType === 'blank' ? '#18181b' : '#15803d';
    ctx.beginPath();
    ctx.arc(0, 0, holeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  };

  const drawPlayerIcon = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

    const scale = (el.size ? el.size / 100 : 1.0) * 1.1;
    ctx.scale(scale, scale);

    const mainColor = el.color || '#3b82f6';
    const img = getPlayerImage(mainColor);

    if (img && img.complete && img.naturalWidth > 0) {
      // The original SVG is 33.1x53.2
      // We'll map the size down to a nice icon size
      const imgW = 22; 
      const imgH = 22 * (53.2 / 33.1);
      ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
    } else {
      // Fallback
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -12, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.moveTo(-7, -5);
      ctx.lineTo(-14, -2);
      ctx.lineTo(-11, 6);
      ctx.lineTo(-7, 4);
      ctx.lineTo(-7, 13);
      ctx.lineTo(7, 13);
      ctx.lineTo(7, 4);
      ctx.lineTo(11, 6);
      ctx.lineTo(14, -2);
      ctx.lineTo(7, -5);
      ctx.closePath();
      ctx.fill();
    }

    // Player Number / Label inside jersey
    if (el.label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.fillText(el.label, 0, 4);
    }

    ctx.restore();
  };

  const drawGoalkeeperIcon = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

    const scale = (el.size ? el.size / 100 : 1.0) * 1.15;
    ctx.scale(scale, scale);

    const mainColor = el.color || '#eab308'; // Default yellow/neon or selected
    const img = getGoalkeeperImage(mainColor);

    if (img && img.complete && img.naturalWidth > 0) {
      // SVG viewBox is 27.2 x 51.1
      const imgW = 20;
      const imgH = 20 * (51.1 / 27.2);
      ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
    } else {
      // Fallback Head
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -13, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // GK Long-Sleeve Shirt
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.moveTo(-7, -6);
      ctx.lineTo(-16, -1);
      ctx.lineTo(-14, 7);
      ctx.lineTo(-7, 5);
      ctx.lineTo(-7, 14);
      ctx.lineTo(7, 14);
      ctx.lineTo(7, 5);
      ctx.lineTo(14, 7);
      ctx.lineTo(16, -1);
      ctx.lineTo(7, -6);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Goalkeeper Gloves
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-15, 3, 3.5, 0, Math.PI * 2);
      ctx.arc(15, 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Label or "TW"
    const labelText = el.label || 'TW';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'extrabold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 3;
    ctx.fillText(labelText, 0, 3);

    ctx.restore();
  };

  const drawShapeRect = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    const x1 = Math.min(el.x, el.x2 !== undefined ? el.x2 : el.x);
    const y1 = Math.min(el.y, el.y2 !== undefined ? el.y2 : el.y);
    const w = el.x2 !== undefined ? Math.abs(el.x2 - el.x) : (el.customWidth || 80);
    const h = el.y2 !== undefined ? Math.abs(el.y2 - el.y) : (el.customDepth || 60);

    const color = el.color || '#3b82f6';
    if (el.filled !== false) {
      ctx.fillStyle = color.startsWith('#') ? `${color}33` : 'rgba(59, 130, 246, 0.2)';
      ctx.fillRect(x1, y1, w, h);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    if (el.subType === 'dashed') {
      ctx.setLineDash([8, 6]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeRect(x1, y1, w, h);
    ctx.setLineDash([]);

    if (el.label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.label, x1 + w / 2, y1 + h / 2);
    }
    ctx.restore();
  };

  const drawShapeCircle = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    const radius = el.x2 !== undefined && el.y2 !== undefined
      ? Math.hypot(el.x2 - el.x, el.y2 - el.y)
      : (el.customWidth ? el.customWidth / 2 : 40);

    const color = el.color || '#eab308';
    ctx.beginPath();
    ctx.arc(el.x, el.y, Math.max(5, radius), 0, Math.PI * 2);

    if (el.filled !== false) {
      ctx.fillStyle = color.startsWith('#') ? `${color}33` : 'rgba(234, 179, 8, 0.2)';
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    if (el.subType === 'dashed') {
      ctx.setLineDash([8, 6]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (el.label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.label, el.x, el.y);
    }
    ctx.restore();
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset & draw background pitch
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPitch(ctx, canvas.width, canvas.height);

    // Draw background tracing image if loaded
    if (backgroundImage) {
      ctx.save();
      ctx.globalAlpha = bgOpacity;
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Draw elements
    elements.forEach((el) => {
      const isSelected = (selectedElementId === el.id) || selectedElementIds.includes(el.id);

      ctx.save();
      if (isSelected) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
      }

      if (el.type === 'rect') {
        drawShapeRect(ctx, el);
      } else if (el.type === 'circle') {
        drawShapeCircle(ctx, el);
      } else if (el.type === 'cone') {
        // Cone / Hütchen (SVG)
        drawCone(ctx, el);
      } else if (el.type === 'disc') {
        // Markierteller mit Loch
        drawDisc(ctx, el);
      } else if (el.type === 'ring') {
        // Koordinationsring / Ring
        drawRing(ctx, el);
      } else if (el.type === 'ladder') {
        // Koordinationsleiter
        drawLadder(ctx, el);
      } else if (el.type === 'player') {
        // Player (Trikot Icon)
        drawPlayerIcon(ctx, el);
      } else if (el.type === 'goalkeeper') {
        // Goalkeeper Icon (TW mit Handschuhen)
        drawGoalkeeperIcon(ctx, el);
      } else if (el.type === 'dummy') {
        // Freistoß-Dummy / Dummys
        drawDummy(ctx, el);
      } else if (el.type === 'ball') {
        // Real Soccer Ball Graphics
        drawSoccerBall(ctx, el);
      } else if (el.type === 'goal') {
        // Rotatable Goal Element (Mini / Youth / Full)
        drawGoal(ctx, el);
      } else if (el.type === 'line' && el.x2 !== undefined && el.y2 !== undefined) {
        // Line / Arrow / Pass path
        ctx.strokeStyle = el.color || '#ffffff';
        ctx.lineWidth = 3;
        const hasArrow = el.subType !== 'straight' && el.subType !== 'straight_dashed';

        if (el.subType === 'pass' || el.subType === 'straight_dashed') {
          ctx.setLineDash([7, 6]); // Dashed
        } else if (el.subType === 'dribble') {
          ctx.setLineDash([2, 5]); // Dotted
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Arrowhead if arrow type
        if (hasArrow) {
          const angle = Math.atan2(el.y2 - el.y, el.x2 - el.x);
          ctx.fillStyle = el.color || '#ffffff';
          ctx.beginPath();
          ctx.moveTo(el.x2, el.y2);
          ctx.lineTo(el.x2 - 12 * Math.cos(angle - Math.PI / 6), el.y2 - 12 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(el.x2 - 12 * Math.cos(angle + Math.PI / 6), el.y2 - 12 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      } else if (el.type === 'text' && el.label) {
        ctx.fillStyle = el.color || '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(el.label, el.x, el.y);
      }

      // Group badge indicator if element has a groupId
      if (el.groupId) {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(el.x + 12, el.y - 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // Draw active Marquee Selection Box if present
    if (selectionBox) {
      ctx.save();
      const minX = Math.min(selectionBox.x1, selectionBox.x2);
      const minY = Math.min(selectionBox.y1, selectionBox.y2);
      const boxW = Math.abs(selectionBox.x2 - selectionBox.x1);
      const boxH = Math.abs(selectionBox.y2 - selectionBox.y1);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(minX, minY, boxW, boxH);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(minX, minY, boxW, boxH);
      ctx.setLineDash([]);
      ctx.restore();
    }
  };
  drawCanvasRef.current = drawCanvas;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragInitialPositions, setDragInitialPositions] = useState<{ id: string; x: number; y: number; x2?: number; y2?: number }[]>([]);

  const isPointInElement = (x: number, y: number, el: ElementItem): boolean => {
    if (el.type === 'rect') {
      const x1 = Math.min(el.x, el.x2 !== undefined ? el.x2 : el.x);
      const y1 = Math.min(el.y, el.y2 !== undefined ? el.y2 : el.y);
      const w = el.x2 !== undefined ? Math.abs(el.x2 - el.x) : (el.customWidth || 80);
      const h = el.y2 !== undefined ? Math.abs(el.y2 - el.y) : (el.customDepth || 60);
      return x >= x1 - 10 && x <= x1 + w + 10 && y >= y1 - 10 && y <= y1 + h + 10;
    }
    if (el.type === 'circle') {
      const radius = el.x2 !== undefined && el.y2 !== undefined
        ? Math.hypot(el.x2 - el.x, el.y2 - el.y)
        : (el.customWidth ? el.customWidth / 2 : 40);
      return Math.hypot(el.x - x, el.y - y) <= Math.max(20, radius + 10);
    }
    if (el.type === 'line' && el.x2 !== undefined && el.y2 !== undefined) {
      // Distance from point to line segment
      const dx = el.x2 - el.x;
      const dy = el.y2 - el.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.hypot(el.x - x, el.y - y) < 25;
      const t = Math.max(0, Math.min(1, ((x - el.x) * dx + (y - el.y) * dy) / lenSq));
      const projX = el.x + t * dx;
      const projY = el.y + t * dy;
      return Math.hypot(projX - x, projY - y) < 20;
    }
    return Math.hypot(el.x - x, el.y - y) < 30;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const isMultiModifier = e.shiftKey || e.ctrlKey || e.metaKey;

    if (activeTool === 'select') {
      // Find clicked element (from topmost to bottommost)
      const found = elements.slice().reverse().find((el) => isPointInElement(x, y, el));

      if (found) {
        let targets = [found.id];
        // If element is part of a group, select all group members
        if (found.groupId) {
          const groupMembers = elements.filter((el) => el.groupId === found.groupId).map((el) => el.id);
          targets = Array.from(new Set([...targets, ...groupMembers]));
        }

        if (isMultiModifier) {
          setSelectedElementIds((prev) => {
            const next = new Set(prev);
            const isAlreadySelected = targets.every((id) => next.has(id));
            if (isAlreadySelected) {
              targets.forEach((id) => next.delete(id));
            } else {
              targets.forEach((id) => next.add(id));
            }
            const arr = Array.from(next);
            setSelectedElementId(arr.length === 1 ? arr[0] : null);
            return arr;
          });
        } else {
          // If already selected within multi-selection, keep multi-selection for group drag
          if (!selectedElementIds.includes(found.id)) {
            setSelectedElementIds(targets);
            setSelectedElementId(targets.length === 1 ? targets[0] : null);
          }
        }

        setIsDragging(true);
        setDragOffset({ x, y });
        // Snapshot initial positions of all elements that will move together
        const currentActiveIds = selectedElementIds.includes(found.id)
          ? selectedElementIds
          : targets;
        const initial = elements
          .filter((el) => currentActiveIds.includes(el.id))
          .map((el) => ({ id: el.id, x: el.x, y: el.y, x2: el.x2, y2: el.y2 }));
        setDragInitialPositions(initial);
      } else {
        // Clicked on empty space: start marquee selection box
        if (!isMultiModifier) {
          setSelectedElementId(null);
          setSelectedElementIds([]);
        }
        setIsMarqueeSelecting(true);
        setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
      }
    } else if (['pass', 'run', 'dribble', 'straight', 'straight_dashed', 'rect', 'circle'].includes(activeTool)) {
      setIsDrawing(true);
      setStartPos({ x, y });
    } else {
      // Add point element (cone, player, ball, goal, text)
      const newEl: ElementItem = {
        id: `el_${Date.now()}`,
        type: activeTool === 'cone' ? 'cone' : activeTool === 'disc' ? 'disc' : activeTool === 'ring' ? 'ring' : activeTool === 'ladder' ? 'ladder' : activeTool === 'player' ? 'player' : activeTool === 'goalkeeper' ? 'goalkeeper' : activeTool === 'dummy' ? 'dummy' : activeTool === 'ball' ? 'ball' : activeTool === 'goal' ? 'goal' : 'text',
        subType: activeTool === 'goal' ? selectedGoalType : undefined,
        x,
        y,
        rotation: 0,
        size: activeTool === 'disc' ? 40 : 100,
        color: activeTool === 'goalkeeper' ? (selectedColor === '#ef4444' ? '#eab308' : selectedColor) : selectedColor,
        label: activeTool === 'player' ? (textInput || '1') : activeTool === 'goalkeeper' ? (textInput || 'TW') : activeTool === 'text' ? (textInput || 'Station A') : undefined
      };
      setElements([...elements, newEl]);
      setSelectedElementId(newEl.id);
      setSelectedElementIds([newEl.id]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Handle Marquee Selection
    if (isMarqueeSelecting && selectionBox) {
      const nextBox = { ...selectionBox, x2: x, y2: y };
      setSelectionBox(nextBox);

      const minX = Math.min(nextBox.x1, nextBox.x2);
      const maxX = Math.max(nextBox.x1, nextBox.x2);
      const minY = Math.min(nextBox.y1, nextBox.y2);
      const maxY = Math.max(nextBox.y1, nextBox.y2);

      const insideIds = elements
        .filter((el) => {
          const elX2 = el.x2 !== undefined ? el.x2 : el.x;
          const elY2 = el.y2 !== undefined ? el.y2 : el.y;
          const left = Math.min(el.x, elX2);
          const right = Math.max(el.x, elX2);
          const top = Math.min(el.y, elY2);
          const bottom = Math.max(el.y, elY2);
          return right >= minX && left <= maxX && bottom >= minY && top <= maxY;
        })
        .map((el) => el.id);

      setSelectedElementIds(insideIds);
      setSelectedElementId(insideIds.length === 1 ? insideIds[0] : null);
      return;
    }

    // Handle Dragging selected elements (Simultaneous Multi-Drag)
    if (isDragging && activeTool === 'select' && dragInitialPositions.length > 0) {
      const deltaX = x - dragOffset.x;
      const deltaY = y - dragOffset.y;

      setElements((prevElements) =>
        prevElements.map((el) => {
          const init = dragInitialPositions.find((item) => item.id === el.id);
          if (init) {
            return {
              ...el,
              x: init.x + deltaX,
              y: init.y + deltaY,
              x2: init.x2 !== undefined ? init.x2 + deltaX : undefined,
              y2: init.y2 !== undefined ? init.y2 + deltaY : undefined
            };
          }
          return el;
        })
      );
      return;
    }

    // Handle Shape / Line Drawing Preview
    if (isDrawing && startPos) {
      drawCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 3;

      if (activeTool === 'rect') {
        const minX = Math.min(startPos.x, x);
        const minY = Math.min(startPos.y, y);
        const w = Math.abs(x - startPos.x);
        const h = Math.abs(y - startPos.y);
        ctx.fillStyle = selectedColor.startsWith('#') ? `${selectedColor}33` : 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(minX, minY, w, h);
        ctx.strokeRect(minX, minY, w, h);
      } else if (activeTool === 'circle') {
        const radius = Math.hypot(x - startPos.x, y - startPos.y);
        ctx.fillStyle = selectedColor.startsWith('#') ? `${selectedColor}33` : 'rgba(234, 179, 8, 0.2)';
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Line or arrow
        if (activeTool === 'pass' || activeTool === 'straight_dashed') {
          ctx.setLineDash([7, 6]);
        } else if (activeTool === 'dribble') {
          ctx.setLineDash([2, 5]);
        }
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (activeTool !== 'straight' && activeTool !== 'straight_dashed') {
          const angle = Math.atan2(y - startPos.y, x - startPos.x);
          ctx.fillStyle = selectedColor;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 12 * Math.cos(angle - Math.PI / 6), y - 12 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x - 12 * Math.cos(angle + Math.PI / 6), y - 12 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      setDragInitialPositions([]);
    }

    if (isMarqueeSelecting) {
      setIsMarqueeSelecting(false);
      setSelectionBox(null);
    }

    if (isDrawing && startPos) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      let newEl: ElementItem;
      if (activeTool === 'rect') {
        newEl = {
          id: `el_${Date.now()}`,
          type: 'rect',
          x: Math.min(startPos.x, x),
          y: Math.min(startPos.y, y),
          x2: Math.max(startPos.x, x),
          y2: Math.max(startPos.y, y),
          color: selectedColor,
          filled: true
        };
      } else if (activeTool === 'circle') {
        newEl = {
          id: `el_${Date.now()}`,
          type: 'circle',
          x: startPos.x,
          y: startPos.y,
          x2: x,
          y2: y,
          color: selectedColor,
          filled: true
        };
      } else {
        newEl = {
          id: `el_${Date.now()}`,
          type: 'line',
          subType: activeTool,
          x: startPos.x,
          y: startPos.y,
          x2: x,
          y2: y,
          color: selectedColor
        };
      }

      setElements([...elements, newEl]);
      setSelectedElementId(newEl.id);
      setSelectedElementIds([newEl.id]);
      setIsDrawing(false);
      setStartPos(null);
    }
  };

  // Clipboard state for Multi-Element Copy & Paste
  const [clipboard, setClipboard] = useState<ElementItem[]>([]);

  const getActiveSelectionIds = (): string[] => {
    if (selectedElementIds.length > 0) return selectedElementIds;
    if (selectedElementId) return [selectedElementId];
    return [];
  };

  const getElementTypeName = (el: ElementItem): string => {
    switch (el.type) {
      case 'rect': return 'Rechteck';
      case 'circle': return 'Kreis';
      case 'cone': return 'Hütchen';
      case 'disc': return 'Markierteller';
      case 'ring': return 'Koordinationsring';
      case 'ladder': return 'Koordinationsleiter';
      case 'player': return `Feldspieler ${el.label ? `#${el.label}` : ''}`;
      case 'goalkeeper': return `Torwart ${el.label ? `(${el.label})` : '(TW)'}`;
      case 'dummy': return 'Freistoß-Dummy';
      case 'ball': return 'Fußball';
      case 'goal':
        return el.subType === 'mini' ? 'Mini-Tor' : el.subType === 'youth' ? 'Jugend-Tor' : 'Groß-Tor';
      case 'line':
        return el.subType === 'pass'
          ? 'Passweg'
          : el.subType === 'dribble'
          ? 'Dribbling'
          : el.subType === 'straight_dashed'
          ? 'Gestrichelte Linie'
          : el.subType === 'straight'
          ? 'Gerade'
          : 'Laufweg';
      case 'text': return 'Text';
      default: return 'Element';
    }
  };

  const getElementIconEmoji = (type: string): string => {
    switch (type) {
      case 'rect': return '⬛';
      case 'circle': return '⭕';
      case 'cone': return '📐';
      case 'disc': return '🔘';
      case 'ring': return '⭕';
      case 'ladder': return '🪜';
      case 'player': return '🏃';
      case 'goalkeeper': return '🧤';
      case 'dummy': return '🧍';
      case 'ball': return '⚽';
      case 'goal': return '🥅';
      case 'line': return '↗️';
      case 'text': return '🔤';
      default: return '📍';
    }
  };

  const updateSelectedElement = (updates: Partial<ElementItem>) => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    setElements((prev) =>
      prev.map((el) => (activeIds.includes(el.id) ? { ...el, ...updates } : el))
    );
  };

  const handleRotateSelected = () => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    setElements((prev) =>
      prev.map((el) => {
        if (activeIds.includes(el.id)) {
          const currentRot = el.rotation || 0;
          return { ...el, rotation: (currentRot + 90) % 360 };
        }
        return el;
      })
    );
  };

  const handleResizeSelected = (delta: number) => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    setElements((prev) =>
      prev.map((el) => {
        if (activeIds.includes(el.id)) {
          const currentSize = el.size || 100;
          const newSize = Math.max(40, Math.min(250, currentSize + delta));
          return { ...el, size: newSize };
        }
        return el;
      })
    );
  };

  const handleDeleteSelected = () => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    setElements((prev) => prev.filter((el) => !activeIds.includes(el.id)));
    setSelectedElementId(null);
    setSelectedElementIds([]);
    toast.info(`${activeIds.length > 1 ? `${activeIds.length} Elemente` : 'Element'} gelöscht.`);
  };

  const handleCopy = () => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    const targets = elements.filter((item) => activeIds.includes(item.id));
    if (targets.length > 0) {
      setClipboard(targets.map((t) => ({ ...t })));
      toast.info(
        targets.length === 1
          ? `"${getElementTypeName(targets[0])}" kopiert.`
          : `${targets.length} Elemente kopiert.`
      );
    }
  };

  const handlePaste = () => {
    if (clipboard.length === 0) return;
    const canvas = canvasRef.current;
    const maxW = canvas?.width || 720;
    const maxH = canvas?.height || 720;

    // Check bounds offset
    const newItems: ElementItem[] = clipboard.map((item) => {
      let newX = item.x + 25;
      let newY = item.y + 25;
      if (newX > maxW - 30) newX = 40;
      if (newY > maxH - 30) newY = 40;

      return {
        ...item,
        id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        x: newX,
        y: newY,
        x2: item.x2 !== undefined ? item.x2 + 25 : undefined,
        y2: item.y2 !== undefined ? item.y2 + 25 : undefined
      };
    });

    setElements((prev) => [...prev, ...newItems]);
    const newIds = newItems.map((item) => item.id);
    setSelectedElementIds(newIds);
    setSelectedElementId(newIds.length === 1 ? newIds[0] : null);
    setClipboard(newItems);
    toast.success(`${newItems.length > 1 ? `${newItems.length} Elemente` : 'Element'} eingefügt.`);
  };

  const handleDuplicate = () => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    const targets = elements.filter((item) => activeIds.includes(item.id));
    if (targets.length === 0) return;

    const canvas = canvasRef.current;
    const maxW = canvas?.width || 720;
    const maxH = canvas?.height || 720;

    const newItems: ElementItem[] = targets.map((el) => {
      let newX = el.x + 25;
      let newY = el.y + 25;
      if (newX > maxW - 30) newX = 40;
      if (newY > maxH - 30) newY = 40;

      return {
        ...el,
        id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        x: newX,
        y: newY,
        x2: el.x2 !== undefined ? el.x2 + 25 : undefined,
        y2: el.y2 !== undefined ? el.y2 + 25 : undefined
      };
    });

    setElements((prev) => [...prev, ...newItems]);
    const newIds = newItems.map((item) => item.id);
    setSelectedElementIds(newIds);
    setSelectedElementId(newIds.length === 1 ? newIds[0] : null);
    setClipboard(newItems);
    toast.success(`${newItems.length > 1 ? `${newItems.length} Elemente` : 'Element'} dupliziert.`);
  };

  // Grouping & Ungrouping
  const handleGroupSelected = () => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length < 2) {
      toast.warning('Wähle mindestens 2 Elemente aus, um sie zu gruppieren.');
      return;
    }
    const newGroupId = `grp_${Date.now()}`;
    setElements((prev) =>
      prev.map((el) => (activeIds.includes(el.id) ? { ...el, groupId: newGroupId } : el))
    );
    toast.success(`${activeIds.length} Elemente gruppiert.`);
  };

  const handleUngroupSelected = () => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    setElements((prev) =>
      prev.map((el) => (activeIds.includes(el.id) ? { ...el, groupId: undefined } : el))
    );
    toast.info('Gruppierung aufgehoben.');
  };

  // Layer Ordering (Ebenen-Reihenfolge)
  const handleSendToBack = () => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    setElements((prev) => {
      const selected = prev.filter((el) => activeIds.includes(el.id));
      const remaining = prev.filter((el) => !activeIds.includes(el.id));
      return [...selected, ...remaining]; // First elements rendered are in background
    });
    toast.info('In den Hintergrund gesetzt.');
  };

  const handleBringToFront = () => {
    const activeIds = getActiveSelectionIds();
    if (activeIds.length === 0) return;
    setElements((prev) => {
      const selected = prev.filter((el) => activeIds.includes(el.id));
      const remaining = prev.filter((el) => !activeIds.includes(el.id));
      return [...remaining, ...selected]; // Last elements rendered are in foreground
    });
    toast.info('In den Vordergrund geholt.');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const activeIds = selectedElementIds.length > 0
        ? selectedElementIds
        : selectedElementId
        ? [selectedElementId]
        : [];

      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        if (activeIds.length > 0) {
          e.preventDefault();
          handleSendToBack();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        if (activeIds.length > 0) {
          e.preventDefault();
          handleBringToFront();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          handleUngroupSelected();
        } else {
          handleGroupSelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (activeIds.length > 0) {
          e.preventDefault();
          handleCopy();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
          e.preventDefault();
          handlePaste();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (activeIds.length > 0) {
          e.preventDefault();
          handleDuplicate();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allIds = elements.map((el) => el.id);
        setSelectedElementIds(allIds);
        setSelectedElementId(allIds.length === 1 ? allIds[0] : null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === 'Escape') {
        setSelectedElementId(null);
        setSelectedElementIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, selectedElementIds, clipboard, elements]);

  const handleClearAll = async () => {
    const isConfirmed = await confirmModal({
      title: 'Skizze zurücksetzen',
      message: 'Möchtest du die gesamte Skizze zurücksetzen?',
      confirmText: 'Zurücksetzen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (isConfirmed) {
      setElements([]);
      setSelectedElementId(null);
      toast.info('Skizze wurde zurückgesetzt.');
    }
  };

  const handleSaveDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const thumbnailDataUrl = canvas.toDataURL('image/png');
    if (onSave) {
      onSave({ elements, pitchType, orientation }, thumbnailDataUrl);
    }
  };

  useImperativeHandle(ref, () => ({
    getDiagramData: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return {
        diagramData: { elements, pitchType, orientation },
        thumbnailDataUrl: canvas.toDataURL('image/png')
      };
    }
  }), [elements, pitchType, orientation]);

  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

  return (
    <div className={`flex flex-col bg-zinc-950 p-4 gap-4 ${isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-none' : 'rounded-2xl border border-zinc-800'}`}>
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        {/* Pitch Selection */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mr-1">Feld:</span>
          
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider ml-1 mr-0.5">Außen:</span>
          {[
            { id: 'green_full', label: 'Vollfeld' },
            { id: 'field_15x25', label: '15×25m Minifeld' },
            { id: 'field_40x25', label: '40×25m Feld' },
            { id: 'green_empty_near', label: 'Torraum Nah' },
            { id: 'green_empty_far', label: 'Strafraum Fern' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPitchType(item.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                pitchType === item.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800'
              }`}
            >
              {item.label}
            </button>
          ))}

          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider ml-2 mr-0.5">Halle:</span>
          {[
            { id: 'futsal_full', label: 'Futsal Vollfeld' },
            { id: 'futsal_empty', label: 'Futsal Leer' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPitchType(item.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                pitchType === item.id
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800'
              }`}
            >
              {item.label}
            </button>
          ))}

          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-2 mr-0.5">Weitere:</span>
          {[
            { id: 'blank', label: 'Taktiktafel (Dunkel)' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPitchType(item.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                pitchType === item.id
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* View & Canvas Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOrientation(orientation === 'landscape' ? 'portrait' : 'landscape')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all shadow-sm"
            title={orientation === 'landscape' ? 'Zu Hochformat wechseln' : 'Zu Querformat wechseln'}
          >
            {orientation === 'landscape' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-primary" />
                <span>Querformat</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-primary" />
                <span>Hochformat</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-all"
            title={isFullscreen ? 'Vollbild beenden' : 'Vollbildmodus'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />} {isFullscreen ? 'Normal' : 'Vollbild'}
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Leeren
          </button>
        </div>
      </div>

      {/* Main Workspace (Tools Panel + Canvas + Properties Panel) */}
      <div className="flex flex-col xl:flex-row gap-4 items-start">
        {/* Left Elements / Tools Panel (2-Spaltig) */}
        <div className="w-full xl:w-72 flex flex-col gap-2 shrink-0">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 hidden lg:block">
            Werkzeuge & Akteure
          </div>

          {/* Tracing Background Image Section */}
          <div className="mb-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              🖼️ Vorlage zum Nachzeichnen
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleTraceImageUpload}
            />
            {!backgroundImage ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all border border-zinc-700/50"
              >
                <span>Foto als Vorlage laden</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Sichtbarkeit: {Math.round(bgOpacity * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setBackgroundImage(null)}
                    className="text-red-400 hover:text-red-300 text-[11px] font-bold underline"
                  >
                    Entfernen
                  </button>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={bgOpacity}
                  onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* 2-Spaltiges Werkzeug-Raster */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'select', label: 'Auswählen', icon: MousePointer, colSpan: 'col-span-2' },
              { id: 'player', label: 'Spieler', icon: Users },
              { id: 'goalkeeper', label: 'Torwart', icon: Shield },
              { id: 'ball', label: 'Ball', icon: Circle },
              { id: 'goal', label: 'Tor', icon: Grid },
              { id: 'cone', label: 'Hütchen', icon: Square },
              { id: 'disc', label: 'Teller', icon: Disc },
              { id: 'ring', label: 'Ring', icon: CircleDot },
              { id: 'ladder', label: 'Leiter', icon: AlignJustify },
              { id: 'dummy', label: 'Dummy', icon: UserX },
              { id: 'pass', label: 'Passweg (---)', icon: ArrowRight },
              { id: 'run', label: 'Laufweg (──)', icon: MoveRight },
              { id: 'straight_dashed', label: 'Linie (---)', icon: Minus },
              { id: 'straight', label: 'Linie (──)', icon: Minus },
              { id: 'rect', label: 'Rechteck', icon: Square },
              { id: 'circle', label: 'Kreis', icon: Circle },
              { id: 'text', label: 'Text', icon: Type, colSpan: 'col-span-2' }
            ].map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  title={tool.label}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                    tool.colSpan || ''
                  } ${
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 ring-1 ring-white/30'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tool.label}</span>
                </button>
              );
            })}
          </div>


          {/* Tor-Typ Auswahl bei gewähltem Tor-Tool */}
          {activeTool === 'goal' && (
            <div className="mt-2 w-full space-y-1 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Tor-Größe wählen:
              </label>
              {[
                { id: 'mini', label: '⚽ Mini-Tor' },
                { id: 'youth', label: '🥅 Jugend-Tor' },
                { id: 'full', label: '🏟️ Groß-Tor' }
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGoalType(g.id as any)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedGoalType === g.id
                      ? 'bg-primary text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {/* Text/Number Input for Player/Text Tool */}
          {(activeTool === 'player' || activeTool === 'text') && (
            <div className="mt-2 w-full">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Beschriftung / Nr.
              </label>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={activeTool === 'player' ? 'z. B. 10' : 'z. B. Hütchentor A'}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Right Canvas Area */}
        <div className="flex-1 w-full overflow-hidden flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800/80 p-2">
          {(() => {
            const isSquarePitch = ['green_full', 'futsal_full', 'futsal_empty'].includes(pitchType);
            const canvasWidth = isSquarePitch ? 720 : orientation === 'landscape' ? 720 : 480;
            const canvasHeight = isSquarePitch ? 720 : orientation === 'landscape' ? 480 : 720;

            return (
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className={`w-full ${
                  isSquarePitch
                    ? 'aspect-square max-w-[720px]'
                    : orientation === 'landscape'
                    ? 'aspect-[3/2] max-w-[720px]'
                    : 'aspect-[2/3] max-w-[480px]'
                } rounded-lg shadow-2xl cursor-crosshair touch-none ${isFullscreen ? 'max-w-full max-h-[80vh] w-auto h-auto' : ''}`}
              />
            );
          })()}
        </div>

        {/* Right Properties Panel / Item-Optionen */}
        <div className="w-full xl:w-72 flex flex-col gap-3.5 shrink-0 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {selectedElementIds.length > 1
                  ? `${selectedElementIds.length} Elemente gewählt`
                  : selectedElement
                  ? 'Element-Optionen'
                  : 'Eigenschaften'}
              </span>
            </div>
            {(selectedElement || selectedElementIds.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedElementId(null);
                  setSelectedElementIds([]);
                }}
                className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
                title="Auswahl aufheben (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {(selectedElement || selectedElementIds.length > 0) ? (
            <div className="space-y-3.5">
              {/* Selected Element Info Badge & Delete */}
              <div className="flex items-center justify-between bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {selectedElementIds.length > 1
                      ? '📑'
                      : selectedElement
                      ? getElementIconEmoji(selectedElement.type)
                      : '📍'}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-white block leading-tight">
                      {selectedElementIds.length > 1
                        ? `${selectedElementIds.length} Elemente ausgewählt`
                        : selectedElement
                        ? getElementTypeName(selectedElement)
                        : ''}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {selectedElementIds.length > 1
                        ? 'Mehrfachauswahl aktiv'
                        : selectedElement
                        ? `X: ${Math.round(selectedElement.x)} · Y: ${Math.round(selectedElement.y)}`
                        : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all text-xs"
                  title="Ausgewählte Elemente löschen (Entf)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Layer Ordering Actions */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Ebene / Reihenfolge
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleSendToBack}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all"
                    title="In den Hintergrund setzen (Ctrl+[)"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Hintergrund</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBringToFront}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all border border-zinc-700/50"
                    title="In den Vordergrund holen (Ctrl+])"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Vordergrund</span>
                  </button>
                </div>
              </div>

              {/* Grouping Actions */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Gruppierung
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleGroupSelected}
                    disabled={getActiveSelectionIds().length < 2}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Elemente gruppieren (Ctrl+G)"
                  >
                    <Group className="w-3.5 h-3.5" />
                    <span>Gruppieren</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUngroupSelected}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all border border-zinc-700/50"
                    title="Gruppe auflösen (Ctrl+Shift+G)"
                  >
                    <Ungroup className="w-3.5 h-3.5" />
                    <span>Trennen</span>
                  </button>
                </div>
              </div>

              {/* Copy / Duplicate / Paste Actions */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Aktionen
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-bold transition-all"
                    title="Elemente duplizieren (Ctrl+D)"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplizieren</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all border border-zinc-700/50"
                    title="In Zwischenablage kopieren (Ctrl+C)"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Kopieren</span>
                  </button>
                </div>
                {clipboard.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
                    title="Kopierte Elemente einfügen (Ctrl+V)"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>{clipboard.length > 1 ? `${clipboard.length} Elemente einfügen` : 'Einfügen'} (Ctrl+V)</span>
                  </button>
                )}
              </div>

              {/* Color Selection */}
              <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-primary" /> Farbe
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {selectedElement?.color || selectedColor}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#f97316', '#a855f7', '#ffffff', '#000000'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        setSelectedColor(col);
                        updateSelectedElement({ color: col });
                      }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        (selectedElement?.color || selectedColor) === col ? 'scale-125 border-white shadow-md' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <label
                    className="relative w-6 h-6 rounded-full border-2 border-dashed border-zinc-600 hover:border-white flex items-center justify-center cursor-pointer transition-all overflow-hidden"
                    title="Eigene Farbe wählen"
                  >
                    <input
                      type="color"
                      value={selectedElement?.color || selectedColor}
                      onChange={(e) => {
                        setSelectedColor(e.target.value);
                        updateSelectedElement({ color: e.target.value });
                      }}
                      className="opacity-0 absolute inset-0 cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-400">+</span>
                  </label>
                </div>
              </div>

              {/* Size / Scale */}
              <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ZoomIn className="w-3.5 h-3.5 text-primary" /> Größe
                  </span>
                  <span className="text-[11px] font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">
                    {selectedElement?.size || 100}%
                  </span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="250"
                  step="5"
                  value={selectedElement?.size || 100}
                  onChange={(e) => updateSelectedElement({ size: parseInt(e.target.value) })}
                  className="w-full accent-primary h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleResizeSelected(-20)}
                    className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold transition-all"
                  >
                    -20%
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedElement({ size: 100 })}
                    className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[11px] font-bold transition-all"
                    title="Auf 100% zurücksetzen"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResizeSelected(20)}
                    className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold transition-all"
                  >
                    +20%
                  </button>
                </div>
              </div>

              {/* Rotation */}
              <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5 text-primary" /> Drehung
                  </span>
                  <span className="text-[11px] font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">
                    {selectedElement?.rotation || 0}°
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRotateSelected}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 text-xs font-bold transition-all"
                  title="Element um 90° im Uhrzeigersinn drehen"
                >
                  <RotateCw className="w-3.5 h-3.5" /> +90° Drehen
                </button>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => updateSelectedElement({ rotation: deg })}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        (selectedElement?.rotation || 0) === deg
                          ? 'bg-primary text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>

              {/* Shape Specific Options: Rect / Circle (Fill & Border) */}
              {selectedElement && (selectedElement.type === 'rect' || selectedElement.type === 'circle') && (
                <div className="space-y-2 border-t border-zinc-800 pt-3">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Form-Optionen
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSelectedElement({ filled: !(selectedElement.filled !== false) })}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        selectedElement.filled !== false
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      {selectedElement.filled !== false ? '🎨 Gefüllt (Aktiv)' : '⭕ Nur Umriss'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedElement({ subType: selectedElement.subType === 'dashed' ? 'solid' : 'dashed' })}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        selectedElement.subType === 'dashed'
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      {selectedElement.subType === 'dashed' ? '--- Gestrichelt' : '── Durchgezogen'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={selectedElement.label || ''}
                    onChange={(e) => updateSelectedElement({ label: e.target.value })}
                    placeholder="Zonen-Beschriftung (z. B. Feld A)"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Type Specific Options: Goal */}
              {selectedElement?.type === 'goal' && (
                <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Tor-Größe wählen
                  </label>
                  <div className="space-y-1">
                    {[
                      { id: 'mini', label: '⚽ Mini-Tor' },
                      { id: 'youth', label: '🥅 Jugend-Tor' },
                      { id: 'full', label: '🏟️ Groß-Tor' }
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => updateSelectedElement({ subType: g.id })}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          (selectedElement.subType || 'mini') === g.id
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-zinc-950/60 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type Specific Options: Player / Goalkeeper / Text Label */}
              {selectedElement && ['player', 'goalkeeper', 'text'].includes(selectedElement.type) && (
                <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    {selectedElement.type === 'text' ? 'Text' : 'Trikotnummer / Name'}
                  </label>
                  <input
                    type="text"
                    value={selectedElement.label || ''}
                    onChange={(e) => updateSelectedElement({ label: e.target.value })}
                    placeholder={selectedElement.type === 'player' ? 'z. B. 10' : selectedElement.type === 'goalkeeper' ? 'TW' : 'Text eingeben'}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Type Specific Options: Line Style */}
              {selectedElement?.type === 'line' && (
                <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Linientyp
                  </label>
                  <div className="space-y-1">
                    {[
                      { id: 'pass', label: 'Passweg (Pfeil gestrichelt)' },
                      { id: 'run', label: 'Laufweg (Pfeil durchgezogen)' },
                      { id: 'dribble', label: 'Dribbling (Pfeil gepunktet)' },
                      { id: 'straight_dashed', label: 'Linie (Gestrichelt, ohne Pfeil)' },
                      { id: 'straight', label: 'Linie (Gerade, ohne Pfeil)' }
                    ].map((lt) => (
                      <button
                        key={lt.id}
                        type="button"
                        onClick={() => updateSelectedElement({ subType: lt.id })}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          (selectedElement.subType || 'pass') === lt.id
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-zinc-950/60 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                        }`}
                      >
                        {lt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {clipboard.length > 0 ? (
                <div className="p-3 rounded-xl bg-zinc-950/80 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-300 font-bold">
                    <span>{clipboard.length > 1 ? `${clipboard.length} Elemente in Ablage` : '1 Element in Ablage'}</span>
                    <span className="text-[10px] text-emerald-400 font-normal">Kopiert</span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Einfügen (Ctrl+V)</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-center text-zinc-500 space-y-1">
                  <p className="text-xs font-semibold text-zinc-300">Kein Element ausgewählt</p>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Klicke auf ein Element oder ziehe einen Rahmen mit der Maus, um mehrere Elemente zu markieren.
                  </p>
                </div>
              )}

              {/* Default Color for new items */}
              <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Standardfarbe für neue Items
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#f97316', '#a855f7', '#ffffff', '#000000'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedColor(col)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        selectedColor === col ? 'scale-125 border-white shadow-md' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <label
                    className="relative w-6 h-6 rounded-full border-2 border-dashed border-zinc-600 hover:border-white flex items-center justify-center cursor-pointer transition-all overflow-hidden"
                    title="Eigene Standardfarbe wählen"
                  >
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="opacity-0 absolute inset-0 cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-400">+</span>
                  </label>
                </div>
              </div>

              {/* Keyboard Shortcuts Info */}
              <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80 space-y-1.5 text-[11px] text-zinc-400">
                <span className="font-bold text-zinc-300 block mb-1">Tastatur-Shortcuts:</span>
                <div className="flex justify-between items-center">
                  <span>Mehrfachauswahl:</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-200 font-mono text-[10px]">Shift+Klick</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Gruppieren:</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-200 font-mono text-[10px]">Ctrl+G</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Gruppe trennen:</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-200 font-mono text-[10px]">Ctrl+Shift+G</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Alle auswählen:</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-200 font-mono text-[10px]">Ctrl+A</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Ebene vor / zurück:</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-200 font-mono text-[10px]">Ctrl+] / Ctrl+[</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Kopieren / Einfügen:</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-200 font-mono text-[10px]">Ctrl+C / V</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Duplizieren / Löschen:</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-200 font-mono text-[10px]">Ctrl+D / Entf</kbd>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ExerciseSketchEditor.displayName = 'ExerciseSketchEditor';

export default ExerciseSketchEditor;
