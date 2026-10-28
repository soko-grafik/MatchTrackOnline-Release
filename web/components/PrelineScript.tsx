"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function PrelineScript() {
  const path = usePathname();

  useEffect(() => {
    const initPreline = async () => {
      try {
        await import("preline");
        if (typeof window !== "undefined" && (window as any).HSStaticMethods) {
          (window as any).HSStaticMethods.autoInit();
        }
      } catch (err) {
        console.error("Fehler beim Initialisieren von Preline UI:", err);
      }
    };

    initPreline();
  }, [path]);

  return null;
}
