"use client";

import { useEffect, useState, RefObject } from 'react';

export interface VideoRenderDims {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

interface UseVideoRenderDimsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function useVideoRenderDims({ videoRef }: UseVideoRenderDimsProps): VideoRenderDims {
  const [videoRenderDims, setVideoRenderDims] = useState<VideoRenderDims>({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
     const updateDims = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        if (video.videoWidth === 0) return;
        const videoRatio = video.videoWidth / video.videoHeight;
        const containerRatio = video.clientWidth / video.clientHeight;
        let drawW, drawH, oX, oY;
        if (containerRatio > videoRatio) {
          drawH = video.clientHeight;
          drawW = drawH * videoRatio;
          oX = (video.clientWidth - drawW) / 2;
          oY = 0;
        } else {
          drawW = video.clientWidth;
          drawH = drawW / videoRatio;
          oX = 0;
          oY = (video.clientHeight - drawH) / 2;
        }
        setVideoRenderDims({ width: drawW, height: drawH, offsetX: oX, offsetY: oY });
     };
     window.addEventListener('resize', updateDims);
     videoRef.current?.addEventListener('loadedmetadata', updateDims);
     const interval = setInterval(updateDims, 500);
     return () => {
        window.removeEventListener('resize', updateDims);
        videoRef.current?.removeEventListener('loadedmetadata', updateDims);
        clearInterval(interval);
     }
  }, []);

  return videoRenderDims;
}
