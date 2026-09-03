"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function PasswordProtection({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // Das Passwort - in einer echten App würde das idealerweise über eine API oder Environment Variables geprüft werden.
  const CORRECT_PASSWORD = "admin"; // <--- Hier kannst du dein gewünschtes Passwort eintragen

  useEffect(() => {
    setIsMounted(true);
    // Use sessionStorage instead of localStorage so it clears when browser closes,
    // but persists across reloads of the same tab.
    const authStatus = sessionStorage.getItem("matchtracker_auth");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem("matchtracker_auth", "true");
      setIsAuthenticated(true);
      setError("");

      // Crucial fix: Force a hard reload of the current URL
      // This ensures Next.js router correctly hydrates the page based on the URL
      // rather than retaining the state of whatever component was previously rendered.
      window.location.reload();

    } else {
      setError("Falsches Passwort. Bitte versuche es erneut.");
    }
  };

  // Avoid Hydration-Errors by only rendering on the client
  if (!isMounted) return null;

  // If authenticated, render the app normally
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // If not authenticated, render the login screen
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans text-white">
      <div className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 p-8 rounded-2xl backdrop-blur-md shadow-2xl">
        <div className="flex justify-center mb-8">
          <Image
            src="/logo_light_wide.png"
            alt="MatchTracker Logo"
            width={200}
            height={50}
            className="object-contain h-10 w-auto"
            priority
          />
        </div>

        <h2 className="text-2xl font-bold text-center mb-2">Zugriff beschränkt</h2>
        <p className="text-zinc-400 text-center mb-8 text-sm">
          Bitte gib das Passwort ein, um auf das Match Dashboard zuzugreifen.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Entsperren
          </button>
        </form>
      </div>
    </div>
  );
}
