"use client";

import { useEffect, useRef, useState, RefObject } from 'react';
import Hls from 'hls.js';

interface UseVideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  hlsPlaylistUrl?: string;
  videoUrl: string;
  isDrawingMode: boolean;
  isPlaying: boolean;
}

export function useVideoPlayer({
  videoRef,
  containerRef,
  hlsPlaylistUrl,
  videoUrl,
  isDrawingMode,
  isPlaying,
}: UseVideoPlayerProps) {
  const isMounted = useRef(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const hlsRef = useRef<Hls | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // Adaptive Bitrate (ABR) States
  const [qualities, setQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string>('Auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const handleQualityChange = (index: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setCurrentQuality(index === -1 ? 'Auto' : qualities[index] || `Qualität ${index + 1}`);
    }
    setShowQualityMenu(false);
  };

  useEffect(() => {
    isMounted.current = true;
    const videoElement = videoRef.current;
    if (!videoElement) return;

    setIsBuffering(false); // Reset buffering on source change

    let fallbackAttempted = false;
    let mp4FallbackAttempted = false;

    const checkVideoTrackHealth = () => {
      if (!videoElement) return;
      // Wenn Metadaten geladen sind oder bereits Ton läuft (currentTime > 0.3s), aber videoWidth === 0 ist,
      // enthält die aktive Spur keinen dekodierbaren Videostream (z.B. HEVC in MPEG-TS bei älteren Uploads).
      if (videoElement.readyState >= 1 && videoElement.videoWidth === 0 && videoElement.videoHeight === 0) {
        const hls = hlsRef.current;
        if (hls && hls.levels && hls.levels.length > 1 && !fallbackAttempted) {
          fallbackAttempted = true;
          const safeLevel = Math.max(0, hls.levels.length - 2); // Wechsel von v2 (copy) auf v1 (720p libx264)
          console.warn(
            `[MatchPlayer] Kein Videobild auf HLS-Level ${hls.currentLevel} erkannt (videoWidth=0). ` +
            `Wechsle automatisch auf transkodiertes Level ${safeLevel} (${hls.levels[safeLevel]?.height || 720}p).`
          );
          const savedTime = videoElement.currentTime;
          hls.autoLevelCapping = safeLevel;
          hls.currentLevel = safeLevel;
          setCurrentQuality(
            hls.levels[safeLevel]?.height ? `${hls.levels[safeLevel].height}p` : `Qualität ${safeLevel + 1}`
          );
          if (savedTime > 0) {
            setTimeout(() => {
              if (videoRef.current) videoRef.current.currentTime = savedTime;
            }, 150);
          }
          return;
        }

        if (hls && videoUrl && !mp4FallbackAttempted && videoElement.currentTime > 0.5) {
          mp4FallbackAttempted = true;
          console.warn('[MatchPlayer] HLS liefert nur Ton ohne Bild (videoWidth=0). Wechsle auf direkten MP4-Stream und stoße Server-Reparatur an.');
          const savedTime = videoElement.currentTime;
          const wasPlaying = !videoElement.paused;
          hls.destroy();
          hlsRef.current = null;
          videoElement.src = videoUrl;
          videoElement.load();
          videoElement.currentTime = savedTime;
          if (wasPlaying) {
            videoElement.play().catch(() => {});
          }
          // Stoße im Hintergrund die automatische Stream-Reparatur auf dem Server an
          const matchUrlMatch = (videoUrl || hlsPlaylistUrl || '').match(/uploads\/([a-zA-Z0-9_-]+)\//);
          if (matchUrlMatch && matchUrlMatch[1]) {
            fetch(`/api/videos/matches/${matchUrlMatch[1]}/repair-stream`, { method: 'POST' }).catch(() => {});
          }
        }
      }
    };

    // Buffering & Seeking event handlers
    const onWaiting = () => setIsBuffering(true);
    const onSeeking = () => setIsBuffering(true);
    const onSeeked = () => setIsBuffering(false);
    const onPlaying = () => {
      setIsBuffering(false);
      setTimeout(checkVideoTrackHealth, 400);
    };
    const onCanPlay = () => {
      setIsBuffering(false);
      setTimeout(checkVideoTrackHealth, 300);
    };
    const onLoadedMetadata = () => {
      setTimeout(checkVideoTrackHealth, 250);
    };

    videoElement.addEventListener('waiting', onWaiting);
    videoElement.addEventListener('seeking', onSeeking);
    videoElement.addEventListener('seeked', onSeeked);
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('canplay', onCanPlay);
    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);

    // Reset ABR states on playlist change
    setQualities([]);
    setCurrentQuality('Auto');
    setShowQualityMenu(false);

    if (hlsPlaylistUrl) {
      if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = hlsPlaylistUrl;
      } else if (Hls.isSupported()) {
        if (!hlsRef.current) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferHole: 0.5,
            startFragPrefetch: true,
            capLevelToPlayerSize: true,
            abrBandWidthFactor: 0.85,
          });
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const levels = hls.levels.map((level, index) => {
              if (level.name) return level.name;
              return level.height ? `${level.height}p` : `Qualität ${index + 1}`;
            });
            setQualities(levels);
          });

          hls.on(Hls.Events.FRAG_BUFFERED, () => {
            setIsBuffering(false);
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.warn('HLS.js fatal error:', data.type, data.details);
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  hlsRef.current = null;
                  if (videoElement && videoUrl) {
                    videoElement.src = videoUrl;
                  }
                  break;
              }
            }
          });

          hls.loadSource(hlsPlaylistUrl);
          hls.attachMedia(videoElement);
        }
      } else if (videoUrl) {
        videoElement.src = videoUrl;
      }
    } else if (videoUrl) {
      videoElement.src = videoUrl;
    }

    return () => {
      isMounted.current = false;
      videoElement.removeEventListener('waiting', onWaiting);
      videoElement.removeEventListener('seeking', onSeeking);
      videoElement.removeEventListener('seeked', onSeeked);
      videoElement.removeEventListener('playing', onPlaying);
      videoElement.removeEventListener('canplay', onCanPlay);
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      videoElement.removeAttribute('src');
      videoElement.load();
    };
  }, [hlsPlaylistUrl, videoUrl]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current || isDrawingMode) return;
    if (isPlaying) {
      videoRef.current.pause();
      setShowControls(true);
    } else {
      videoRef.current.play().catch(e => console.warn("Play error:", e));
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

    if (isPlaying && !isDrawingMode) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  return {
    isMounted,
    isMuted,
    setIsMuted,
    isBuffering,
    showControls,
    setShowControls,
    isFullscreen,
    qualities,
    currentQuality,
    showQualityMenu,
    setShowQualityMenu,
    handleQualityChange,
    toggleFullscreen,
    handlePlayPause,
    handleMouseMove,
  };
}
