"use client";

import React, { useEffect, useRef, useCallback, RefObject } from 'react';

interface TrackingOverlayProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  trackingData: any[];
  selectedTrackId: number | null;
  isDrawingMode: boolean;
  events: any[];
}

function hexToRgba(hex: string, alpha: number) {
  let r = 0, g = 0, b = 0;
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (hex.startsWith('rgb')) {
      return hex;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const TrackingOverlay = ({
  videoRef,
  trackingData,
  selectedTrackId,
  isDrawingMode,
  events,
}: TrackingOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const renderCanvas = useCallback(() => {
    if (!isMounted.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      animationRef.current = requestAnimationFrame(renderCanvas);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = window.devicePixelRatio || 1;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationRef.current = requestAnimationFrame(renderCanvas);
      return;
    }

    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = video.clientWidth / video.clientHeight;

    let drawW, drawH, offsetX, offsetY;

    if (containerRatio > videoRatio) {
      drawH = video.clientHeight;
      drawW = drawH * videoRatio;
      offsetX = (video.clientWidth - drawW) / 2;
      offsetY = 0;
    } else {
      drawW = video.clientWidth;
      drawH = drawW / videoRatio;
      offsetX = 0;
      offsetY = (video.clientHeight - drawH) / 2;
    }

    canvas.width = video.clientWidth * scale;
    canvas.height = video.clientHeight * scale;
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, video.clientWidth, video.clientHeight);

    const timeMs = video.currentTime * 1000;
    const currentFrame = trackingData.find((f, i) => {
      const next = trackingData[i+1];
      return timeMs >= f.videoTimeMs && (!next || timeMs < next.videoTimeMs);
    });

    if (currentFrame && currentFrame.detections) {
      currentFrame.detections.forEach((det: any) => {
        if (selectedTrackId !== null && det.trackId !== selectedTrackId) return;
        const x = offsetX + (det.x - det.w / 2) * drawW;
        const y = offsetY + (det.y - det.h / 2) * drawH;
        const w = det.w * drawW;
        const h = det.h * drawH;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.fillText(`#${det.trackId}`, x, y - 6);
      });
    }

    if (!isDrawingMode) {
      events.forEach(event => {
        if (event.event_type !== 'drawing') return;
        
        const eventTime = event.video_time_ms;
        const shapes = event.details?.shapes || [];

        shapes.forEach((shape: any) => {
          if (shape.points.length === 0) return;

          const shapeDuration = shape.duration || 2000;
          const fadeTime = 300;
          const totalVisibleTime = shapeDuration + fadeTime;

          if (timeMs < eventTime || timeMs > eventTime + totalVisibleTime) {
            return;
          }

          let opacity = 1;
          const timeSinceEvent = timeMs - eventTime;

          if (timeSinceEvent < fadeTime) {
            opacity = timeSinceEvent / fadeTime;
          } else if (timeSinceEvent > shapeDuration) {
            opacity = 1 - ((timeSinceEvent - shapeDuration) / fadeTime);
          }
          
          opacity = Math.max(0, Math.min(1, opacity));

          const colorWithAlpha = hexToRgba(shape.color, opacity);

          const toAbsX = (px: number) => offsetX + px * drawW;
          const toAbsY = (py: number) => offsetY + py * drawH;
          
          ctx.strokeStyle = colorWithAlpha;
          ctx.fillStyle = colorWithAlpha;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          
          if (shape.type === 'pen') {
            const first = shape.points[0];
            ctx.moveTo(toAbsX(first.x), toAbsY(first.y));
            for (let i = 1; i < shape.points.length; i++) {
              ctx.lineTo(toAbsX(shape.points[i].x), toAbsY(shape.points[i].y));
            }
            ctx.stroke();
          } else if (shape.type === 'line' || shape.type === 'arrow') {
            const start = shape.points[0];
            const end = shape.points[shape.points.length - 1];
            const startX = toAbsX(start.x);
            const startY = toAbsY(start.y);
            const endX = toAbsX(end.x);
            const endY = toAbsY(end.y);
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            if (shape.type === 'arrow') {
              const headlen = 15;
              const dx = endX - startX;
              const dy = endY - startY;
              const angle = Math.atan2(dy, dx);
              ctx.beginPath();
              ctx.moveTo(endX, endY);
              ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
              ctx.moveTo(endX, endY);
              ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
              ctx.stroke();
            }
          } else if (shape.type === 'circle') {
            const start = shape.points[0];
            const end = shape.points[shape.points.length - 1];
            const startX = toAbsX(start.x);
            const startY = toAbsY(start.y);
            const endX = toAbsX(end.x);
            const endY = toAbsY(end.y);
            const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            ctx.beginPath();
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            ctx.stroke();
          } else if (shape.type === 'text' && shape.text) {
             const pos = shape.points[0];
             ctx.font = "bold 24px Inter, sans-serif";
             ctx.fillText(shape.text, toAbsX(pos.x), toAbsY(pos.y));
          }
        });
      });
    }

    if (isMounted.current) animationRef.current = requestAnimationFrame(renderCanvas);
  }, [trackingData, selectedTrackId, isDrawingMode, events]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(renderCanvas);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [renderCanvas]);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
  );
}

export default React.memo(TrackingOverlay);
