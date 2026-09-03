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
  Shield
} from 'lucide-react';

import { useToast } from '@/contexts/ToastContext';

interface ElementItem {
  id: string;
  type: 'pitch' | 'cone' | 'disc' | 'player' | 'goalkeeper' | 'ball' | 'goal' | 'line' | 'text';
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
  const [pitchType, setPitchType] = useState<'full' | 'half' | 'field_15x25' | 'field_35x25' | 'blank'>(
    initialData?.pitchType || initialData?.pitch_type || 'full'
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

  // Update state when initialData changes or loads

  useEffect(() => {
    if (initialData) {
      if (initialData.pitchType || initialData.pitch_type) {
        setPitchType(initialData.pitchType || initialData.pitch_type);
      }
      if (Array.isArray(initialData.elements)) {
        setElements(initialData.elements);
      }
    }
  }, [initialData]);

  // Redraw canvas on elements / pitch / tracing background change
  useEffect(() => {
    drawCanvas();
  }, [pitchType, elements, selectedElementId, backgroundImage, bgOpacity]);


  const drawPitch = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
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
      // 15x25 Spielfeld nur mit Randlinien & Eckfahnen-Markierungen
      const fieldW = width - padding * 4;
      const fieldH = height - padding * 2.5;
      const startX = (width - fieldW) / 2;
      const startY = (height - fieldH) / 2;

      ctx.strokeRect(startX, startY, fieldW, fieldH);

      // Beschriftung 15m x 25m
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('15m × 25m Minifeld', width / 2, startY + 20);
    } else if (pitchType === 'field_35x25') {
      // 35x25 Spielfeld mit Mittellinie
      const fieldW = width - padding * 3;
      const fieldH = height - padding * 2.2;
      const startX = (width - fieldW) / 2;
      const startY = (height - fieldH) / 2;

      ctx.strokeRect(startX, startY, fieldW, fieldH);

      // Gestrichelte / Durchgehende Mittellinie
      const centerX = width / 2;
      ctx.beginPath();
      ctx.moveTo(centerX, startY);
      ctx.lineTo(centerX, startY + fieldH);
      ctx.stroke();

      // Beschriftung 35m x 25m
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('35m × 25m Feld', width / 2, startY + 20);
    }

  };

  const drawSoccerBall = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number = 10) => {
    ctx.save();
    ctx.translate(x, y);

    // Ball Base Circle (White)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center Pentagon (Black)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    const pRadius = radius * 0.4;
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = pRadius * Math.cos(angle);
      const py = pRadius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Connecting lines to outer rim
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = pRadius * Math.cos(angle);
      const py = pRadius * Math.sin(angle);
      const rx = radius * Math.cos(angle);
      const ry = radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(rx, ry);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawGoal = (ctx: CanvasRenderingContext2D, el: ElementItem) => {
    ctx.save();
    ctx.translate(el.x, el.y);
    if (el.rotation) {
      ctx.rotate((el.rotation * Math.PI) / 180);
    }

    // Default Proportions per Type (breiter & realistischere Tiefe)
    let baseWidth = 60;
    let baseDepth = 15;

    if (el.subType === 'mini') {
      baseWidth = 32;
      baseDepth = 10;
    } else if (el.subType === 'youth') {
      baseWidth = 48;
      baseDepth = 13;
    }

    const scale = el.size ? el.size / 100 : 1.0;
    const gWidth = (el.customWidth || baseWidth) * scale;
    const gDepth = (el.customDepth || baseDepth) * scale;

    // Goal Frame & Net Fill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeStyle = el.color || '#ffffff';
    ctx.lineWidth = 2.5;

    // Draw Main Net Box
    ctx.fillRect(-gWidth / 2, -gDepth / 2, gWidth, gDepth);
    ctx.strokeRect(-gWidth / 2, -gDepth / 2, gWidth, gDepth);

    // Front Goal Line (Dickere Torlinie vorne)
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-gWidth / 2, gDepth / 2);
    ctx.lineTo(gWidth / 2, gDepth / 2);
    ctx.stroke();

    // Goal Net Mesh Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const stepX = gWidth / 4;
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(-gWidth / 2 + stepX * i, -gDepth / 2);
      ctx.lineTo(-gWidth / 2 + stepX * i, gDepth / 2);
    }
    ctx.stroke();

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

    // Head
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, -12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Jersey / Shirt Body
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

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Collar
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(0, -2);
    ctx.lineTo(3, -5);
    ctx.stroke();

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

    // Head
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

    // Label or "TW"
    const labelText = el.label || 'TW';
    ctx.fillStyle = '#000000';
    ctx.font = 'extrabold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 0, 4);

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
        // Cone / Hütchen (Triangle)
        ctx.fillStyle = el.color || '#ef4444';
        ctx.beginPath();
        ctx.moveTo(el.x, el.y - 12);
        ctx.lineTo(el.x - 10, el.y + 10);
        ctx.lineTo(el.x + 10, el.y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (el.type === 'disc') {
        // Markierteller mit Loch
        drawDisc(ctx, el);
      } else if (el.type === 'player') {
        // Player (Trikot Icon)
        drawPlayerIcon(ctx, el);
      } else if (el.type === 'goalkeeper') {
        // Goalkeeper Icon (TW mit Handschuhen)
        drawGoalkeeperIcon(ctx, el);
      } else if (el.type === 'ball') {
        // Real Soccer Ball Graphics
        drawSoccerBall(ctx, el.x, el.y, 11);
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
        type: activeTool === 'cone' ? 'cone' : activeTool === 'disc' ? 'disc' : activeTool === 'player' ? 'player' : activeTool === 'goalkeeper' ? 'goalkeeper' : activeTool === 'ball' ? 'ball' : activeTool === 'goal' ? 'goal' : 'text',
        subType: activeTool === 'goal' ? selectedGoalType : undefined,
        x,
        y,
        rotation: 0,
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

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
      onSave({ elements, pitchType }, thumbnailDataUrl);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-4 gap-4">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        {/* Pitch Selection */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Feld:</span>
          {[
            { id: 'full', label: 'Ganzes Feld' },
            { id: 'half', label: 'Halbfeld' },
            { id: 'field_35x25', label: '35x25m Feld' },
            { id: 'field_15x25', label: '15x25m Feld' },
            { id: 'blank', label: 'Leer' }
          ].map((item) => (

            <button
              key={item.id}
              type="button"
              onClick={() => setPitchType(item.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pitchType === item.id
                  ? 'bg-primary text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
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
            width={720}
            height={480}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="w-full max-w-[720px] aspect-[3/2] rounded-lg shadow-2xl cursor-crosshair touch-none"
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
