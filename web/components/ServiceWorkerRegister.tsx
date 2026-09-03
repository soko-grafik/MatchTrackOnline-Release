"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
          console.log("[PWA] Service Worker registered with scope:", registration.scope);

          // Register Background Sync if supported
          if ("sync" in registration) {
            try {
              await (registration as any).sync.register("background-sync");
            } catch (syncErr) {
              console.debug("[PWA] Background sync registration:", syncErr);
            }
          }

          // Register Periodic Background Sync if supported
          if ("periodicSync" in registration) {
            try {
              const status = await (navigator as any).permissions?.query({
                name: "periodic-background-sync",
              });
              if (status?.state === "granted" || !status) {
                await (registration as any).periodicSync.register("update-matches", {
                  minInterval: 24 * 60 * 60 * 1000, // 24 hours
                });
                console.log("[PWA] Periodic sync registered");
              }
            } catch (periodicErr) {
              console.debug("[PWA] Periodic sync registration:", periodicErr);
            }
          }
        } catch (error) {
          console.warn("[PWA] Service Worker registration failed:", error);
        }
      };

      if (document.readyState === "complete") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
        return () => window.removeEventListener("load", registerSW);
      }
    }
  }, []);

  return null;
}
