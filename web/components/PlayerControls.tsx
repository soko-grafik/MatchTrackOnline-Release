"use client";

import React, { RefObject } from 'react';
import { Play, Pause, Maximize2, Volume2, VolumeX, Settings, RotateCcw, RotateCw } from 'lucide-react';
import { getEventCategory } from '@/lib/eventCategories';

interface PlayerControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isBuffering?: boolean;
  showControls: boolean;
  currentTime: number;
  duration: number;
  events: any[];
  qualities: string[];
  currentQuality: string;
  showQualityMenu: boolean;
  setShowQualityMenu: (show: boolean) => void;
  handleQualityChange: (index: number) => void;
  handlePlayPause: () => void;
  toggleFullscreen: () => void;
}

function formatTime(seconds: number) {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

const PlayerControls = ({
  videoRef,
  isPlaying,
  isMuted,
  setIsMuted,
  isBuffering = false,
  showControls,
  currentTime,
  duration,
  events,
  qualities,
  currentQuality,
  showQualityMenu,
  setShowQualityMenu,
  handleQualityChange,
  handlePlayPause,
  toggleFullscreen,
}: PlayerControlsProps) => {
  const [hoverPosition, setHoverPosition] = React.useState<{ x: number; time: number; percent: number } | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = React.useState<string | number | null>(null);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [scrubbingTime, setScrubbingTime] = React.useState<number | null>(null);
  const seekbarRef = React.useRef<HTMLDivElement>(null);

  const getTooltipTranslate = (percent: number) => {
    if (percent < 8) return 'translate-x-0';
    if (percent > 92) return '-translate-x-full';
    return '-translate-x-1/2';
  };

  const calculateTimeFromEvent = (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!seekbarRef.current || duration === 0) return 0;
    const rect = seekbarRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pos * duration;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration === 0) return;
    setIsScrubbing(true);
    const targetTime = calculateTimeFromEvent(e);
    setScrubbingTime(targetTime);
    if ('fastSeek' in videoRef.current && typeof (videoRef.current as any).fastSeek === 'function') {
      (videoRef.current as any).fastSeek(targetTime);
    } else {
      videoRef.current.currentTime = targetTime;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    const rect = seekbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pos * duration;

    setHoverPosition({
      x: e.clientX - rect.left,
      time,
      percent: pos * 100
    });

    if (isScrubbing && videoRef.current) {
      setScrubbingTime(time);
      if ('fastSeek' in videoRef.current && typeof (videoRef.current as any).fastSeek === 'function') {
        (videoRef.current as any).fastSeek(time);
      } else {
        videoRef.current.currentTime = time;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing && videoRef.current) {
      const targetTime = calculateTimeFromEvent(e);
      videoRef.current.currentTime = targetTime;
      setIsScrubbing(false);
      setScrubbingTime(null);
    }
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  };

  // Determine current display progress (optimistic during scrubbing)
  const displayTime = isScrubbing && scrubbingTime !== null ? scrubbingTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div className={`absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8 pb-12 md:pb-6 bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-all duration-300 z-30 ${showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
       {/* Seekbar Container */}
       <div
        ref={seekbarRef}
        className="relative h-2 hover:h-3.5 bg-white/20 hover:bg-white/30 rounded-full mb-6 cursor-pointer group/seek transition-all select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setHoverPosition(null);
          setHoveredMarkerId(null);
        }}
      >
        {/* Hover Time Tooltip (Only shown when not hovering an event marker) */}
        {hoverPosition && hoveredMarkerId === null && (
          <div
            className={`absolute bottom-6 bg-zinc-950/95 border border-zinc-700 text-white font-mono text-[11px] font-black px-2 py-0.5 rounded shadow-2xl pointer-events-none z-40 whitespace-nowrap ${getTooltipTranslate(hoverPosition.percent)}`}
            style={{ left: `${hoverPosition.percent}%` }}
          >
            {formatTime(hoverPosition.time)}
          </div>
        )}

        {/* Played Progress Bar */}
        <div
          className={`h-full bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-[width] ${isScrubbing ? 'duration-0' : 'duration-100'}`}
          style={{ width: `${progressPercent}%` }}
        />

        {/* Seekbar Thumb (Draggable handle with glowing pulse when buffering) */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-blue-500 transition-transform ${
            isScrubbing || isBuffering ? 'scale-125' : 'scale-0 group-hover/seek:scale-100'
          } ${isBuffering ? 'animate-pulse ring-4 ring-blue-500/40' : ''}`}
          style={{ left: `${progressPercent}%` }}
        />

        {/* Match Event Markers */}
        <div className="absolute inset-0 pointer-events-none">
          {(events || []).filter(Boolean).map((event, idx) => {
             if (duration === 0) return null;
             const timeSec = (event.video_time_ms || 0) / 1000;
             const leftPercent = Math.min(100, Math.max(0, (timeSec / duration) * 100));
             
             let dotColor = 'bg-yellow-400 ring-2 ring-yellow-500/40';
             let icon: string | null = null;
             let label = event.details?.title || event.event_type || 'Event';
             const eventType = (event.event_type || '').toLowerCase();
             // Die Kategorie (egal ob manuell vergeben oder nachträglich einem KI-Highlight
             // zugewiesen) bestimmt Icon/Farbe immer zuerst - KI-Highlights und manuelle
             // Markierungen sehen dadurch nach dem Bearbeiten identisch aus. Nur solange ein
             // KI-Event noch nicht bearbeitet wurde, greift die alte event_type-basierte Optik.
             const category = getEventCategory(event.details?.category);

             if (category) {
               dotColor = category.dotClass;
               icon = category.icon;
               label = event.details?.text ? `${category.label}: ${event.details.text}` : category.label;
             } else if (eventType === 'goal') {
               dotColor = 'bg-emerald-400 ring-2 ring-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
               icon = '⚽';
             } else if (eventType === 'corner') {
               dotColor = 'bg-cyan-400 ring-2 ring-cyan-500/50';
               icon = '🚩';
             } else if (eventType === 'penalty') {
               dotColor = 'bg-purple-400 ring-2 ring-purple-500/50';
               icon = '🎯';
             } else if (eventType === 'highlight') {
               dotColor = 'bg-amber-400 ring-2 ring-amber-500/50 shadow-[0_0_8px_rgba(251,191,36,0.8)]';
               icon = '⚡';
             } else if (eventType === 'drawing') {
               dotColor = 'bg-blue-400 ring-2 ring-blue-500/40';
             } else if (eventType === 'marker') {
               label = event.details?.text || 'Kommentar';
             }

             // Manche automatisch erkannten Events (z.B. KI-Highlights) haben das Icon
             // bereits als Emoji im Titel eingebettet - ohne diesen Abgleich würde das
             // separat gerenderte Icon-Badge daneben es im Tooltip doppelt anzeigen.
             if (icon && label.trim().startsWith(icon)) {
               label = label.replace(icon, '').trim();
             }

             const markerId = event.id || idx;
             const isHovered = hoveredMarkerId === markerId;

             return (
               <div
                 key={markerId}
                 className={`absolute -top-1.5 flex flex-col items-center group/marker pointer-events-auto cursor-pointer ${isHovered ? 'z-50' : 'z-20'}`}
                 style={{ left: `${leftPercent}%` }}
                 onMouseEnter={() => setHoveredMarkerId(markerId)}
                 onMouseLeave={() => setHoveredMarkerId(null)}
                 onClick={(e) => {
                   e.stopPropagation();
                   if (videoRef.current) {
                     videoRef.current.currentTime = Math.max(0, timeSec - 4);
                   }
                 }}
               >
                 <div className={`w-3.5 h-3.5 ${dotColor} rounded-full flex items-center justify-center text-[8px] font-black text-black border border-white/40 transition-transform group-hover/marker:scale-150`}>
                   {icon || ''}
                 </div>

                 {/* Elevated Marker Tooltip with Badge, Time and Caret */}
                 <div
                   className={`opacity-0 group-hover/marker:opacity-100 transition-all duration-150 absolute bottom-7 bg-zinc-950/95 border border-zinc-700/80 backdrop-blur-md text-[11px] text-white font-bold px-2.5 py-1.5 rounded-lg shadow-2xl whitespace-nowrap pointer-events-none z-50 flex items-center gap-2 ${getTooltipTranslate(leftPercent)}`}
                 >
                   {icon && <span className="text-xs">{icon}</span>}
                   <span className="text-zinc-100 font-semibold">{label}</span>
                   <span className="font-mono text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                     {formatTime(timeSec)}
                   </span>
                 </div>
               </div>
             );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          <button 
            onClick={() => handleSkip(-10)} 
            className="active:scale-90 text-zinc-300 hover:text-white md:p-2 rounded-full transition-all flex items-center justify-center relative group/btn"
            title="10 Sekunden zurück"
          >
            <RotateCcw className="w-6 h-6 md:w-5 md:h-5" />
            <span className="absolute -bottom-1 text-[9px] font-bold">10</span>
          </button>

          <button onClick={handlePlayPause} className="active:scale-90 md:hover:bg-white/10 md:p-2 rounded-full transition-all">
            {isPlaying ? <Pause className="w-8 h-8 md:w-7 md:h-7 fill-white text-white" /> : <Play className="w-8 h-8 md:w-7 md:h-7 fill-white text-white" />}
          </button>

          <button 
            onClick={() => handleSkip(10)} 
            className="active:scale-90 text-zinc-300 hover:text-white md:p-2 rounded-full transition-all flex items-center justify-center relative group/btn"
            title="10 Sekunden vor"
          >
            <RotateCw className="w-6 h-6 md:w-5 md:h-5" />
            <span className="absolute -bottom-1 text-[9px] font-bold">10</span>
          </button>

          <div className="text-[13px] font-bold tracking-wider tabular-nums flex items-center gap-2 ml-2">
            <span className="text-white">{formatTime(currentTime)}</span>
            <span className="opacity-20">/</span>
            <span className="text-zinc-400">{formatTime(duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-6 lg:gap-8">
          {qualities.length > 0 && (
            <button 
              onClick={() => setShowQualityMenu(!showQualityMenu)} 
              className={`active:scale-90 md:p-2 rounded-full transition-all relative ${showQualityMenu ? 'text-blue-400 bg-blue-400/10' : 'text-white md:text-zinc-400 md:hover:text-white md:hover:bg-white/5'}`}
              title="Qualität ändern"
            >
              <Settings className="w-7 h-7 md:w-6 md:h-6" />
            </button>
          )}
          <button onClick={() => setIsMuted(!isMuted)} className={`active:scale-90 md:p-2 rounded-full transition-all ${isMuted ? 'text-red-400 bg-red-400/10' : 'text-white md:text-zinc-400 md:hover:text-white md:hover:bg-white/5'}`}>
            {isMuted ? <VolumeX className="w-7 h-7 md:w-6 md:h-6" /> : <Volume2 className="w-7 h-7 md:w-6 md:h-6" />}
          </button>
          <button onClick={toggleFullscreen} className="active:scale-90 md:text-zinc-400 md:hover:text-white md:p-2 md:hover:bg-white/5 rounded-full transition-all">
            <Maximize2 className="w-7 h-7 md:w-6 md:h-6" />
          </button>
        </div>
      </div>

      {/* Quality Settings Dropdown Menu */}
      {showQualityMenu && qualities.length > 0 && (
        <div className="absolute bottom-20 right-4 md:right-8 bg-[#18181b]/95 border border-zinc-800 rounded-lg p-2 flex flex-col gap-1 min-w-[120px] shadow-lg backdrop-blur-sm z-40">
          <div className="text-[11px] font-bold text-zinc-500 px-2 py-1 uppercase tracking-wider">Qualität</div>
          <button
            onClick={() => handleQualityChange(-1)}
            className={`text-left text-xs font-semibold px-2 py-1.5 rounded transition-colors ${
              currentQuality === 'Auto' ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Auto
          </button>
          {qualities.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleQualityChange(idx)}
              className={`text-left text-xs font-semibold px-2 py-1.5 rounded transition-colors ${
                currentQuality === q ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(PlayerControls);
