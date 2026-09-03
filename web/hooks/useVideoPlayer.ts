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

    // Buffering & Seeking event handlers
    const onWaiting = () => setIsBuffering(true);
    const onSeeking = () => setIsBuffering(true);
    const onSeeked = () => setIsBuffering(false);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);

    videoElement.addEventListener('waiting', onWaiting);
    videoElement.addEventListener('seeking', onSeeking);
    videoElement.addEventListener('seeked', onSeeked);
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('canplay', onCanPlay);

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
