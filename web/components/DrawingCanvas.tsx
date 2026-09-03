"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Tool } from './DrawingToolbar';

export interface DrawingShape {
  id: string;
  type: Tool;
  color: string;
  points: { x: number; y: number }[];
  text?: string;
  duration: number; // in ms
}

interface DrawingCanvasProps {
  activeTool: Tool;
  activeColor: string;
  shapes: DrawingShape[];
  setShapes: React.Dispatch<React.SetStateAction<DrawingShape[]>>;
  isDrawingMode: boolean;
  videoWidth: number;
  videoHeight: number;
  shapeDuration: number;
  setShapeDuration: (duration: number) => void;
}

const DrawingCanvas = ({
  activeTool,
  activeColor,
  shapes,
  setShapes,
  isDrawingMode,
  videoWidth,
  videoHeight,
  shapeDuration,
  setShapeDuration,
}: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<DrawingShape | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  const getNormalisedCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    return { x, y };
  };

  const handleSelectShape = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool !== 'select') return;
    const { x, y } = getNormalisedCoordinates(e);

    // Find the top-most shape at the click position
    const clickedShape = [...shapes].reverse().find(shape => {
      if (shape.points.length < 2) return false;
      // Simple bounding box check for now
      const xs = shape.points.map(p => p.x);
      const ys = shape.points.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    });

    if (clickedShape) {
      setSelectedShapeId(clickedShape.id);
      setShapeDuration(clickedShape.duration);
    } else {
      setSelectedShapeId(null);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool === 'select') {
      handleSelectShape(e);
      return;
    }
    if (!isDrawingMode) return;
    e.preventDefault();
    const { x, y } = getNormalisedCoordinates(e);
    setIsDrawing(true);
    setSelectedShapeId(null);

    const newShape: DrawingShape = {
      id: Math.random().toString(36).substring(7),
      type: activeTool,
      color: activeColor,
      points: [{ x, y }],
      duration: shapeDuration,
    };

    setCurrentShape(newShape);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentShape) return;
    e.preventDefault();
    const { x, y } = getNormalisedCoordinates(e);

    setCurrentShape(prev => {
      if (!prev) return null;
      
      if (prev.type === 'pen') {
        return { ...prev, points: [...prev.points, { x, y }] };
      }
      return { ...prev, points: [prev.points[0], { x, y }] };
    });
  };

  const endDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentShape) return;
    e.preventDefault();
    
    if (currentShape.type === 'text') {
      const text = prompt('Text eingeben:');
      if (text) {
        setShapes(prev => [...prev, { ...currentShape, text }]);
      }
    } else {
      if (currentShape.points.length > 1 || currentShape.type !== 'pen') {
         const start = currentShape.points[0];
         const end = currentShape.points[currentShape.points.length - 1];
         const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
         if (distance > 0.01) {
            setShapes(prev => [...prev, currentShape]);
         }
      }
    }

    setIsDrawing(false);
    setCurrentShape(null);
  };

  useEffect(() => {
    if (selectedShapeId) {
      setShapes(shapes => shapes.map(s => s.id === selectedShapeId ? { ...s, duration: shapeDuration } : s));
    }
  }, [shapeDuration, selectedShapeId, setShapes]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const allShapes = [...shapes];
    if (currentShape) allShapes.push(currentShape);

    allShapes.forEach(shape => {
      if (shape.points.length === 0) return;

      const toAbsX = (px: number) => px * width;
      const toAbsY = (py: number) => py * height;

      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (selectedShapeId === shape.id) {
        ctx.shadowColor = "white";
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
      
      ctx.beginPath();

      if (shape.type === 'pen') {
        const first = shape.points[0];
        ctx.moveTo(toAbsX(first.x), toAbsY(first.y));
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(toAbsX(shape.points[i].x), toAbsY(shape.points[i].y));
        }
        ctx.stroke();
      } else if (shape.type === 'rect') {
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];
        const w = toAbsX(end.x) - toAbsX(start.x);
        const h = toAbsY(end.y) - toAbsY(start.y);
        ctx.strokeRect(toAbsX(start.x), toAbsY(start.y), w, h);
      } else if (shape.type === 'circle') {
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];
        const radius = Math.sqrt(
          Math.pow(toAbsX(end.x) - toAbsX(start.x), 2) +
          Math.pow(toAbsY(end.y) - toAbsY(start.y), 2)
        );
        ctx.arc(toAbsX(start.x), toAbsY(start.y), radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (shape.type === 'arrow' || shape.type === 'line') {
        if (shape.points.length < 2) return;
        const headlen = 20;
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];
        const fromX = toAbsX(start.x);
        const fromY = toAbsY(start.y);
        const toX = toAbsX(end.x);
        const toY = toAbsY(end.y);
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        if (shape.type === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
      } else if (shape.type === 'text' && shape.text) {
        const pos = shape.points[0];
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText(shape.text, toAbsX(pos.x), toAbsY(pos.y));
      }
    });
  }, [shapes, currentShape, videoWidth, videoHeight, selectedShapeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }
    
    let animId: number;
    const renderLoop = () => {
      renderCanvas();
      if (isDrawing) {
        animId = requestAnimationFrame(renderLoop);
      }
    };
    
    renderLoop();
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [renderCanvas, videoWidth, videoHeight, isDrawing]);


  return (
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={endDrawing}
      className={`absolute inset-0 z-50 w-full h-full pointer-events-auto ${activeTool === 'select' ? 'cursor-pointer' : 'cursor-crosshair'}`}
      style={{ touchAction: 'none' }}
    />
  );
}

export default React.memo(DrawingCanvas);
