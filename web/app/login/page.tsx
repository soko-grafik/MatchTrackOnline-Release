"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { loginUser, forgotPassword, getMyProfile, api } from '@/services/api';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  // Forgot password states
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginUser(username, password);
      if (data.error) {
         setError(data.error || "Login fehlgeschlagen");
      } else {
         const base64Url = data.access_token.split('.')[1];
         const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
         const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
             return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
         }).join(''));
         
         let payload: any;
         try {
           payload = JSON.parse(jsonPayload);
         } catch (e) {
           console.error("Failed to parse JWT payload", e);
           setError("Login-Token ist ungültig.");
           return;
         }
         
         // Set auth header temporarily to fetch profile details
         api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
         let fullUser: any = {
             id: "0",
             username: payload.sub,
             email: "",
             role: payload.role
         };
         try {
            const profileData = await getMyProfile();
            fullUser = {
                id: profileData.id || "0",
                username: profileData.username,
                email: profileData.email,
                role: profileData.role,
                avatar_path: profileData.avatar_path,
                first_name: profileData.first_name,
                last_name: profileData.last_name
            };
         } catch (profileErr) {
            console.error("Failed to load profile details on login", profileErr);
         }
         
         login(data.access_token, fullUser);
         
         router.push('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotMessage(null);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setForgotMessage({
        type: 'success',
        text: res.message || "Wenn die E-Mail-Adresse registriert ist, wurde ein Link zum Zurücksetzen des Passworts versendet."
      });
      setForgotEmail('');
    } catch (err: any) {
      setForgotMessage({
        type: 'error',
        text: err.response?.data?.detail || "Fehler beim Anfordern des Links."
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo_light_wide.png"
            alt="MatchTracker Logo"
            width={200}
            height={50}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>

        <h2 className="mb-2 text-center text-2xl font-bold">Willkommen zurück</h2>
        <p className="mb-8 text-center text-sm text-zinc-400">
          Bitte melde dich an, um auf das Match Dashboard zuzugreifen.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="sr-only">Benutzername</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Benutzername"
              required
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Passwort</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              required
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setForgotMessage(null);
                setIsForgotModalOpen(true);
              }}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Passwort vergessen?
            </button>
          </div>

          {error && <p className="text-center text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Lädt..." : "Anmelden"}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-zinc-400">
           Noch kein Konto? <a href="/register" className="font-medium text-primary hover:underline">Hier registrieren</a>
        </div>
      </div>

      {/* Modal: Passwort vergessen */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-white">
              Passwort zurücksetzen
            </h3>
            <p className="mb-6 text-xs text-zinc-400">
              Gib deine E-Mail-Adresse ein. Wir senden dir einen sicheren Link, um dein Passwort neu zu vergeben.
            </p>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">E-Mail Adresse</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white focus:border-primary focus:ring-primary focus:outline-none"
                  placeholder="name@beispiel.de"
                />
              </div>

              {forgotMessage && (
                <p className={`rounded-lg border p-3 text-center text-xs font-medium ${
                  forgotMessage.type === 'success' 
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' 
                    : 'border-red-500/20 bg-red-500/10 text-red-400'
                }`}>
                  {forgotMessage.text}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-white transition-all hover:bg-primary-hover disabled:bg-zinc-700"
                >
                  {forgotLoading ? 'Sende...' : 'Link anfordern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
