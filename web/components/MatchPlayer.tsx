"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Tool, colors } from './DrawingToolbar';
import DrawingToolbar from './DrawingToolbar';
import DrawingCanvas, { DrawingShape } from './DrawingCanvas';
import PlayerControls from './PlayerControls';
import TrackingOverlay from './TrackingOverlay';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useTrackingData } from '@/hooks/useTrackingData';
import { useVideoRenderDims } from '@/hooks/useVideoRenderDims';

interface MatchPlayerProps {
  videoUrl: string;
  hlsPlaylistUrl?: string;
  trackingUrl: string;
  events?: any[];
  onTimeUpdate?: (ms: number) => void;
  seekTo?: number | null;
  isDrawingMode?: boolean;
  initialDrawingShapes?: DrawingShape[];
  onCancelDrawing?: () => void;
  onSaveDrawing?: (shapes: any[], comment?: string) => void;
  adjustments?: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
  };
}

const MatchPlayer = ({
  videoUrl,
  hlsPlaylistUrl,
  trackingUrl,
  events = [],
  onTimeUpdate,
  seekTo,
  isDrawingMode = false,
  initialDrawingShapes = [],
  onCancelDrawing,
  onSaveDrawing,
  adjustments
}: MatchPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Drawing state
  const [activeTool, setActiveTool] = useState<Tool>('arrow');
  const [activeColor, setActiveColor] = useState<string>(colors[0]);
  const [currentDrawingShapes, setCurrentDrawingShapes] = useState<DrawingShape[]>([]);
  const [shapeDuration, setShapeDuration] = useState(2000);

  // Custom hooks
  const {
    isMuted,
    setIsMuted,
    isBuffering,
    showControls,
    setShowControls,
    qualities,
    currentQuality,
    showQualityMenu,
    setShowQualityMenu,
    handleQualityChange,
    toggleFullscreen,
    handlePlayPause,
    handleMouseMove,
  } = useVideoPlayer({
    videoRef,
    containerRef,
    hlsPlaylistUrl,
    videoUrl,
    isDrawingMode,
    isPlaying,
  });

  const { trackingData, selectedTrackId } = useTrackingData({ trackingUrl });
  const videoRenderDims = useVideoRenderDims({ videoRef });

  useEffect(() => {
    if (isDrawingMode && videoRef.current && isPlaying) {
      videoRef.current.pause();
    }
    if (isDrawingMode) {
       if (initialDrawingShapes && initialDrawingShapes.length > 0) {
           setCurrentDrawingShapes(initialDrawingShapes);
           setActiveTool('select');
       } else {
           setCurrentDrawingShapes([]);
           setActiveTool('arrow');
       }
    }
  }, [isDrawingMode, initialDrawingShapes]);

  const [pendingSeek, setPendingSeek] = useState<number | null>(null);

  useEffect(() => {
    if (seekTo !== undefined && seekTo !== null) {
      setPendingSeek(seekTo);
    }
  }, [seekTo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      if (pendingSeek !== null) {
        video.currentTime = pendingSeek / 1000;
        setPendingSeek(null);
        if (!isDrawingMode && (video.src || video.currentSrc)) {
          const p = video.play();
          if (p !== undefined) {
            p.catch(e => console.warn("Auto-play prevented on seek:", e));
          }
        }
      }
    };

    // If already ready, apply immediately
    if (pendingSeek !== null && video.readyState >= 1) {
      handleCanPlay();
    } else {
      video.addEventListener('loadedmetadata', handleCanPlay);
      video.addEventListener('canplay', handleCanPlay);
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleCanPlay);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [pendingSeek, isDrawingMode]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#09090b] flex flex-col overflow-hidden group/player"
      onMouseMove={handleMouseMove}
      onTouchStart={() => setShowControls(true)}
    >
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black group">
        <video
          ref={videoRef}
          preload="metadata"
          muted={isMuted}
          playsInline
          crossOrigin="anonymous"
          className="w-full h-full object-contain cursor-pointer"
          style={{
            filter: adjustments ? `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) hue-rotate(${adjustments.hue}deg)` : 'none'
          }}
          onTimeUpdate={() => {
            const time = videoRef.current?.currentTime || 0;
            setCurrentTime(time);
            if (onTimeUpdate) onTimeUpdate(time * 1000);
          }}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onClick={handlePlayPause}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Buffering / Seeking Feedback Spinner Overlay */}
        {isBuffering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none z-25 animate-in fade-in duration-200">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
            </div>
            <span className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-white bg-black/70 px-3.5 py-1 rounded-full border border-white/10 shadow-2xl">
              Lade Position...
            </span>
          </div>
        )}

        <TrackingOverlay
          videoRef={videoRef}
          trackingData={trackingData}
          selectedTrackId={selectedTrackId}
          isDrawingMode={isDrawingMode}
          events={events}
        />

        {!isDrawingMode && (
          <PlayerControls
            videoRef={videoRef}
            isPlaying={isPlaying}
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            isBuffering={isBuffering}
            showControls={showControls}
            currentTime={currentTime}
            duration={duration}
            events={events}
            qualities={qualities}
            currentQuality={currentQuality}
            showQualityMenu={showQualityMenu}
            setShowQualityMenu={setShowQualityMenu}
            handleQualityChange={handleQualityChange}
            handlePlayPause={handlePlayPause}
            toggleFullscreen={toggleFullscreen}
          />
        )}

        {isDrawingMode && (
           <>
              <DrawingToolbar
                 activeTool={activeTool}
                 setActiveTool={setActiveTool}
                 activeColor={activeColor}
                 setActiveColor={setActiveColor}
                 shapeDuration={shapeDuration}
                 setShapeDuration={setShapeDuration}
                 onClear={() => setCurrentDrawingShapes([])}
                 onCancel={() => {
                    setCurrentDrawingShapes([]);
                    if (onCancelDrawing) onCancelDrawing();
                 }}
                 onSave={() => {
                    if (onSaveDrawing) onSaveDrawing(currentDrawingShapes);
                 }}
              />
              {videoRenderDims.width > 0 && (
                 <div style={{
                    position: 'absolute',
                    left: videoRenderDims.offsetX,
                    top: videoRenderDims.offsetY,
                    width: videoRenderDims.width,
                    height: videoRenderDims.height,
                    zIndex: 20
                 }}>
                   <DrawingCanvas
                      activeTool={activeTool}
                      activeColor={activeColor}
                      shapes={currentDrawingShapes}
                      setShapes={setCurrentDrawingShapes}
                      isDrawingMode={isDrawingMode}
                      videoWidth={videoRenderDims.width}
                      videoHeight={videoRenderDims.height}
                      shapeDuration={shapeDuration}
                      setShapeDuration={setShapeDuration}
                   />
                 </div>
              )}
           </>
        )}

        <div className="absolute bottom-12 right-12 select-none pointer-events-none opacity-0 group-hover/player:opacity-10 transition-opacity duration-700 flex items-baseline z-0 hidden md:flex">
          <span className="text-white font-black italic text-4xl uppercase tracking-tighter">match</span>
          <span className="text-white font-black italic text-6xl uppercase tracking-tighter -ml-1">track</span>
        </div>
      </div>
    </div>
  );
}

export default MatchPlayer;
