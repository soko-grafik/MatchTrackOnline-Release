"use client";

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface UseTrackingDataProps {
  trackingUrl: string;
}

export function useTrackingData({ trackingUrl }: UseTrackingDataProps) {
  const isMounted = useRef(true);
  const [trackingData, setTrackingData] = useState<any[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

  useEffect(() => {
    isMounted.current = true;
    const fetchTracking = async () => {
      try {
        const response = await axios.get(trackingUrl, {
          responseType: 'text',
          transformResponse: [(data) => data]
        });
        const data = response.data;
        if (typeof data === 'string' && isMounted.current) {
          const lines = data.split('\n').filter((l: string) => l.trim());
          const parsed = lines.map((l: string) => {
             try { return JSON.parse(l); } catch (e) { return null; }
          }).filter((f: any) => f !== null);
          setTrackingData(parsed);
        }
      } catch (err) { console.error(err); }
    };
    if (trackingUrl) fetchTracking();

    return () => {
      isMounted.current = false;
    };
  }, [trackingUrl]);

  return { trackingData, selectedTrackId, setSelectedTrackId };
}
