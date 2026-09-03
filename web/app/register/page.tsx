"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { registerUser, getTeams } from '@/services/api';
import Image from 'next/image';
import Link from 'next/link';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('matchtracker_token');
      localStorage.removeItem('matchtracker_user');
    }
    const fetchTeams = async () => {
      try {
        const list = await getTeams();
        if (Array.isArray(list)) {
          setTeams(list);
        }
      } catch (err) {
        console.error("Failed to load teams:", err);
      }
    };
    fetchTeams();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await registerUser(
        username,
        email,
        password,
        firstName,
        lastName,
        selectedTeamId || undefined,
        'TRAINER'
      );
      if (typeof data === 'string') {
        setError(data);
      } else if (data && data.error) {
        setError(data.error || data.details || "Registrierung fehlgeschlagen.");
      } else {
        router.push('/login?registered=true');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Ein Fehler ist bei der Registrierung aufgetreten.";
      if (Array.isArray(msg)) {
        setError(msg.map((item: any) => item.msg || JSON.stringify(item)).join(', '));
      } else {
        setError(typeof msg === 'object' ? JSON.stringify(msg) : String(msg));
      }
    } finally {
      setLoading(false);
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

        <h2 className="mb-2 text-center text-2xl font-bold">Konto erstellen</h2>
        <p className="mb-8 text-center text-sm text-zinc-400">
          Registriere dich für den MatchTracker.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="sr-only">Vorname</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Vorname"
                required
                className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="sr-only">Nachname</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nachname"
                required
                className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>
          </div>
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
            <label htmlFor="email" className="sr-only">E-Mail Adresse</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail Adresse"
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
              minLength={6}
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="team" className="sr-only">Mannschaft (optional)</label>
            <select
              id="team"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400 shadow-sm focus:border-primary focus:ring-primary"
            >
              <option value="">Mannschaft auswählen (optional)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} className="text-white">
                  {t.name} {t.age_group ? `(${t.age_group})` : ''}
                </option>
              ))}
            </select>
          </div>
          
          {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Lädt..." : "Registrieren"}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-zinc-400">
           Bereits ein Konto? <Link href="/login" className="font-medium text-primary hover:underline">Hier anmelden</Link>
        </div>
      </div>
    </div>
  );
}
