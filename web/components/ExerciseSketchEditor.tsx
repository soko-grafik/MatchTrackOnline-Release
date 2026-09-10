"use client";

import { useState, useRef, useEffect } from 'react';
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
  Monitor
} from 'lucide-react';

import { useToast } from '@/contexts/ToastContext';

interface ElementItem {
  id: string;
  type: 'pitch' | 'cone' | 'disc' | 'player' | 'goalkeeper' | 'dummy' | 'ball' | 'goal' | 'line' | 'text';
  subType?: string; // e.g. goal type ('mini', 'youth', 'full') or line type ('pass', 'run', 'dribble')
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
}

interface ExerciseSketchEditorProps {
  initialData?: any;
  onSave?: (diagramData: any, thumbnailDataUrl: string) => void;
  onCancel?: () => void;
}

export default function ExerciseSketchEditor({
  initialData,
  onSave,
  onCancel
}: ExerciseSketchEditorProps) {
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
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
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
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});

  const [playerSvgText, setPlayerSvgText] = useState<string | null>(null);
  const tintedPlayersRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const ballImg = new Image();
    ballImg.src = '/icons/ball.svg';
    ballImg.onload = () => {
      setLoadedImages(prev => ({ ...prev, ball: ballImg }));
    };

    const goalImg = new Image();
    goalImg.src = '/icons/goal.svg';
    goalImg.onload = () => {
      setLoadedImages(prev => ({ ...prev, goal: goalImg }));
    };

    fetch('/icons/player.svg')
      .then(res => res.text())
      .then(text => setPlayerSvgText(text))
      .catch(err => console.error('Fehler beim Laden der Spieler SVG', err));

    fetch('/icons/cone.svg')
      .then(res => res.text())
      .then(text => setConeSvgText(text))
      .catch(err => console.error('Fehler beim Laden der Hütchen SVG', err));

    fetch('/icons/dummy.svg')
      .then(res => res.text())
      .then(text => setDummySvgText(text))
      .catch(err => console.error('Fehler beim Laden der Dummy SVG', err));

    fetch('/icons/goalkeeper.svg')
      .then(res => res.text())
      .then(text => setGoalkeeperSvgText(text))
      .catch(err => console.error('Fehler beim Laden der Torwart SVG', err));

    const pitchFiles = [
      { id: 'green_full', src: '/icons/pitches/green_full.svg' },
      { id: 'green_empty_near', src: '/icons/pitches/green_empty_near.svg' },
      { id: 'green_empty_far', src: '/icons/pitches/green_empty_far.svg' },
      { id: 'futsal_full', src: '/icons/pitches/futsal_full.svg' },
      { id: 'futsal_empty', src: '/icons/pitches/futsal_empty.svg' }
    ];

    pitchFiles.forEach(({ id, src }) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setLoadedImages(prev => ({ ...prev, [id]: img }));
      };
    });
  }, []);

  const [coneSvgText, setConeSvgText] = useState<string | null>(null);
  const tintedConesRef = useRef<Record<string, HTMLImageElement>>({});

  const [dummySvgText, setDummySvgText] = useState<string | null>(null);
  const tintedDummiesRef = useRef<Record<string, HTMLImageElement>>({});

  const [goalkeeperSvgText, setGoalkeeperSvgText] = useState<string | null>(null);
  const tintedGoalkeepersRef = useRef<Record<string, HTMLImageElement>>({});

  const getGoalkeeperImage = (color: string) => {
    if (tintedGoalkeepersRef.current[color]) return tintedGoalkeepersRef.current[color];
    if (!goalkeeperSvgText) return null;

    const coloredSvg = goalkeeperSvgText.replace(/#9E2A6A/gi, color);
    const blob = new Blob([coloredSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      tintedGoalkeepersRef.current[color] = img;
      drawCanvas();
    };
    tintedGoalkeepersRef.current[color] = img;
    return img;
  };

  const getDummyImage = (color: string) => {
    if (tintedDummiesRef.current[color]) return tintedDummiesRef.current[color];
    if (!dummySvgText) return null;

    const coloredSvg = dummySvgText.replace(/#EE7110/gi, color);
    const blob = new Blob([coloredSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      tintedDummiesRef.current[color] = img;
      drawCanvas();
    };
    tintedDummiesRef.current[color] = img;
    return img;
  };

  const getConeImage = (color: string) => {
    if (tintedConesRef.current[color]) return tintedConesRef.current[color];
    if (!coneSvgText) return null;

    const coloredSvg = coneSvgText.replace(/#EE7110/gi, color);
    const blob = new Blob([coloredSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      tintedConesRef.current[color] = img;
      drawCanvas();
    };
    tintedConesRef.current[color] = img;
    return img;
  };

  const getPlayerImage = (color: string) => {
    if (tintedPlayersRef.current[color]) return tintedPlayersRef.current[color];
    if (!playerSvgText) return null;

    const coloredSvg = playerSvgText.replace(/#0068B4/gi, color);
    const blob = new Blob([coloredSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.src = url;
    img.onload = () => {
       tintedPlayersRef.current[color] = img;
       drawCanvas(); // Re-render when loaded
    };
    tintedPlayersRef.current[color] = img; 
    return img;
  };

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

  // Redraw canvas on elements / pitch / orientation / tracing background change
  useEffect(() => {
    drawCanvas();
  }, [pitchType, orientation, elements, selectedElementId, backgroundImage, bgOpacity, loadedImages]);


  const drawPitch = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Check if current pitch is one of the new SVG pitches
    if (['green_full', 'green_empty_near', 'green_empty_far', 'futsal_full', 'futsal_empty'].includes(pitchType)) {
      const img = loadedImages[pitchType];
      if (img && img.complete) {
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
      const bgImg = loadedImages['green_empty_near'];
      if (bgImg && bgImg.complete) {
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
      const bgImg = loadedImages['green_empty_far'];
      if (bgImg && bgImg.complete) {
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

    if (loadedImages.ball) {
      // Draw ball image centered (half size of previous ~26px -> ~13px)
      const imgSize = radius * 2.4;
      ctx.drawImage(loadedImages.ball, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
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

    if (loadedImages.goal) {
      // The image is a 2D/3D perspective, we draw it scaled
      ctx.drawImage(loadedImages.goal, -gWidth / 2, -gDepth / 2, gWidth, gDepth);
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

    if (img && img.complete) {
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

    if (img && img.complete) {
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

    if (img && img.complete) {
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

    if (img && img.complete) {
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
      const isSelected = el.id === selectedElementId;

      ctx.save();
      if (isSelected) {
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 12;
      }

      if (el.type === 'cone') {
        // Cone / Hütchen (SVG)
        drawCone(ctx, el);
      } else if (el.type === 'disc') {
        // Markierteller mit Loch
        drawDisc(ctx, el);
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
        if (el.subType === 'pass') {
          ctx.setLineDash([6, 6]); // Dashed for pass
        } else if (el.subType === 'dribble') {
          ctx.setLineDash([2, 4]); // Dotted
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Arrowhead
        const angle = Math.atan2(el.y2 - el.y, el.x2 - el.x);
        ctx.fillStyle = el.color || '#ffffff';
        ctx.beginPath();
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(el.x2 - 12 * Math.cos(angle - Math.PI / 6), el.y2 - 12 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(el.x2 - 12 * Math.cos(angle + Math.PI / 6), el.y2 - 12 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (el.type === 'text' && el.label) {
        ctx.fillStyle = el.color || '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(el.label, el.x, el.y);
      }

      ctx.restore();
    });
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (activeTool === 'select') {
      // Find clicked element
      const found = elements.slice().reverse().find((el) => {
        const dist = Math.hypot(el.x - x, el.y - y);
        return dist < 30;
      });

      if (found) {
        setSelectedElementId(found.id);
        setIsDragging(true);
        setDragOffset({ x: x - found.x, y: y - found.y });
      } else {
        setSelectedElementId(null);
      }
    } else if (['pass', 'run', 'dribble'].includes(activeTool)) {
      setIsDrawing(true);
      setStartPos({ x, y });
    } else {
      // Add point element (cone, player, ball, goal, text)
      const newEl: ElementItem = {
        id: `el_${Date.now()}`,
        type: activeTool === 'cone' ? 'cone' : activeTool === 'disc' ? 'disc' : activeTool === 'player' ? 'player' : activeTool === 'goalkeeper' ? 'goalkeeper' : activeTool === 'dummy' ? 'dummy' : activeTool === 'ball' ? 'ball' : activeTool === 'goal' ? 'goal' : 'text',
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
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Handle Dragging selected element
    if (isDragging && selectedElementId && activeTool === 'select') {
      setElements((prevElements) =>
        prevElements.map((el) => {
          if (el.id === selectedElementId) {
            const dx = x - dragOffset.x - el.x;
            const dy = y - dragOffset.y - el.y;
            if (el.type === 'line' && el.x2 !== undefined && el.y2 !== undefined) {
              return {
                ...el,
                x: x - dragOffset.x,
                y: y - dragOffset.y,
                x2: el.x2 + dx,
                y2: el.y2 + dy
              };
            }
            return {
              ...el,
              x: x - dragOffset.x,
              y: y - dragOffset.y
            };
          }
          return el;
        })
      );
      return;
    }

    // Handle Line Drawing Preview
    if (isDrawing && startPos) {
      drawCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 3;
      if (activeTool === 'pass') ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
    }

    if (isDrawing && startPos) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      const newEl: ElementItem = {
        id: `el_${Date.now()}`,
        type: 'line',
        subType: activeTool,
        x: startPos.x,
        y: startPos.y,
        x2: x,
        y2: y,
        color: selectedColor
      };
      setElements([...elements, newEl]);
      setIsDrawing(false);
      setStartPos(null);
    }
  };

  const handleRotateSelected = () => {
    if (!selectedElementId) return;
    setElements(
      elements.map((el) => {
        if (el.id === selectedElementId) {
          const currentRot = el.rotation || 0;
          return { ...el, rotation: (currentRot + 90) % 360 };
        }
        return el;
      })
    );
  };

  const handleResizeSelected = (delta: number) => {
    if (!selectedElementId) return;
    setElements(
      elements.map((el) => {
        if (el.id === selectedElementId) {
          const currentSize = el.size || 100;
          const newSize = Math.max(40, Math.min(250, currentSize + delta));
          return { ...el, size: newSize };
        }
        return el;
      })
    );
  };

  const handleDeleteSelected = () => {
    if (!selectedElementId) return;
    setElements(elements.filter((el) => el.id !== selectedElementId));
    setSelectedElementId(null);
  };

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

        {/* Color Palette */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Farbe:</span>
          {['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#ffffff', '#000000'].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                selectedColor === color ? 'scale-125 border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {selectedElementId && (
            <>
              <button
                type="button"
                onClick={() => handleResizeSelected(20)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-bold transition-all"
                title="Größe vergrößern"
              >
                🔍+ Größer
              </button>
              <button
                type="button"
                onClick={() => handleResizeSelected(-20)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-bold transition-all"
                title="Größe verkleinern"
              >
                🔍- Kleiner
              </button>
              <button
                type="button"
                onClick={handleRotateSelected}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-bold transition-all"
                title="Element um 90° drehen"
              >
                <RotateCw className="w-4 h-4" /> 90° Drehen
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-bold transition-all"
              >
                <Trash2 className="w-4 h-4" /> Löschen
              </button>
            </>
          )}
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

      {/* Main Workspace (Tools Panel + Canvas) */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Left Elements / Tools Panel */}
        <div className="w-full lg:w-60 flex flex-col gap-2 shrink-0">
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

          {[
            { id: 'select', label: 'Auswählen & Verschieben', icon: Square },
            { id: 'cone', label: 'Hütchen', icon: Square },
            { id: 'disc', label: 'Markierteller (Loch)', icon: Disc },
            { id: 'player', label: 'Feldspieler (Trikot)', icon: Users },
            { id: 'goalkeeper', label: 'Torwart (TW)', icon: Shield },
            { id: 'dummy', label: 'Freistoß-Dummy', icon: UserX },
            { id: 'ball', label: 'Fußball (Real)', icon: Circle },
            { id: 'goal', label: 'Tor (Drehbar)', icon: Grid },
            { id: 'pass', label: 'Passweg (---)', icon: ArrowRight },
            { id: 'run', label: 'Laufweg (──)', icon: ArrowRight },
            { id: 'text', label: 'Text', icon: Type }
          ].map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all w-full text-left ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tool.label}</span>
              </button>
            );
          })}


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
          <canvas
            ref={canvasRef}
            width={orientation === 'landscape' ? 720 : 480}
            height={orientation === 'landscape' ? 480 : 720}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className={`w-full ${orientation === 'landscape' ? 'aspect-[3/2] max-w-[720px]' : 'aspect-[2/3] max-w-[480px]'} rounded-lg shadow-2xl cursor-crosshair touch-none ${isFullscreen ? 'max-w-full max-h-[80vh] w-auto h-auto' : ''}`}
          />
        </div>
      </div>

      {/* Bottom Save / Cancel Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white text-xs font-bold transition-all"
          >
            Abbrechen
          </button>
        )}
        <button
          type="button"
          onClick={handleSaveDiagram}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
        >
          <Save className="w-4 h-4" /> Skizze übernehmen & Speichern
        </button>
      </div>
    </div>
  );
}
