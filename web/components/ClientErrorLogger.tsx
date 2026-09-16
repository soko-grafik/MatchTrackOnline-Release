"use client";

import { useEffect } from 'react';
import { sendClientLog } from '@/services/api';

const recentErrorMessages: Record<string, number> = {};

export default function ClientErrorLogger() {
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      try {
        const msg = event.message || 'Unbekannter JavaScript-Laufzeitfehler';
        const now = Date.now();
        // Throttle duplicate errors for 15 seconds
        if (recentErrorMessages[msg] && now - recentErrorMessages[msg] < 15000) {
          return;
        }
        recentErrorMessages[msg] = now;

        // Skip non-critical browser noise (like extension script errors or aborted fetch)
        if (msg.includes('ResizeObserver') || msg.includes('Extension') || msg.includes('aborted')) {
          return;
        }

        sendClientLog({
          level: 'ERROR',
          message: msg,
          module: 'client.runtime',
          details: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
            url: typeof window !== 'undefined' ? window.location.href : ''
          }
        });
      } catch (e) {
        // fail silently
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason;
        const msg = typeof reason === 'string' ? reason : (reason?.message || 'Unbehandelte Promise-Rejection');
        const now = Date.now();
        if (recentErrorMessages[msg] && now - recentErrorMessages[msg] < 15000) {
          return;
        }
        recentErrorMessages[msg] = now;

        if (msg.includes('aborted') || msg.includes('canceled')) {
          return;
        }

        sendClientLog({
          level: 'ERROR',
          message: `Unbehandelte Promise: ${msg}`,
          module: 'client.promise',
          details: {
            stack: reason?.stack,
            url: typeof window !== 'undefined' ? window.location.href : ''
          }
        });
      } catch (e) {
        // fail silently
      }
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
