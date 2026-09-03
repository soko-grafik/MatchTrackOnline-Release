"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPassword } from '@/services/api';
import Image from 'next/image';
import Link from 'next/link';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError("Ungültiges oder fehlendes Token. Bitte fordere einen neuen Link an.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError("Kein Token vorhanden.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    if (password.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }

    setLoading(true);

    try {
      const res = await resetPassword(token, password);
      if (res.error) {
        setError(res.error || "Fehler beim Zurücksetzen des Passworts.");
      } else {
        setSuccess("Dein Passwort wurde erfolgreich geändert. Du wirst in Kürze zum Login weitergeleitet...");
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Zurücksetzen des Passworts.");
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

        <h2 className="mb-2 text-center text-2xl font-bold">Neues Passwort festlegen</h2>
        <p className="mb-8 text-center text-sm text-zinc-400">
          Gib dein neues Passwort ein, um wieder Zugriff zu erhalten.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-sm text-emerald-400">
            {success}
          </div>
        )}

        {!success && token && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">Neues Passwort</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Neues Passwort"
                required
                minLength={6}
                className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">Passwort bestätigen</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort bestätigen"
                required
                minLength={6}
                className="w-full rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? "Wird geändert..." : "Passwort speichern"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-zinc-400">
          <Link href="/login" className="font-medium text-primary hover:underline">Zurück zum Login</Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white font-sans">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
