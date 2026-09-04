"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import Image from 'next/image';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [checkingInstall, setCheckingInstall] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    api.get('/install/status')
      .then(response => {
        if (isMounted) {
          setIsInstalled(response.data.installed);
          setCheckingInstall(false);
        }
      })
      .catch(error => {
        console.error("Failed to check install status:", error);
        if (isMounted) {
          // If check fails (e.g. server down or locked), fallback to assuming installed to not block users
          setIsInstalled(true);
          setCheckingInstall(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (checkingInstall || loading) return;

    const isLoginPage = pathname === '/login' || pathname === '/login/';
    const isRegisterPage = pathname === '/register' || pathname === '/register/';
    const isResetPasswordPage = pathname === '/reset-password' || pathname === '/reset-password/';
    const isLegalPage = pathname?.startsWith('/impressum') || pathname?.startsWith('/datenschutz') || pathname?.startsWith('/terms') || pathname?.startsWith('/privacy');
    const isInstallPage = pathname?.startsWith('/install');
    const matchId = searchParams.get('id');
    const isMatchPageWithId = (pathname === '/matches' || pathname === '/matches/') && !!matchId;

    const isPublicRoute = isLoginPage || isRegisterPage || isResetPasswordPage || isLegalPage || isMatchPageWithId;

    if (isInstalled === false) {
      if (!isInstallPage) {
        console.log("Redirecting to /install because app is not installed.");
        router.push('/install');
      }
    } else {
      // Installed is true
      if (isInstallPage) {
        console.log("Redirecting to home because app is already installed.");
        router.push('/');
      } else if (!isAuthenticated && !isPublicRoute) {
        console.log("REDIRECTING to /login because not authenticated and not public route.");
        router.push('/login');
      } else if (isAuthenticated && isLoginPage) {
        console.log("REDIRECTING to / because authenticated and on login page.");
        router.push('/');
      }
    }
  }, [loading, checkingInstall, isAuthenticated, isInstalled, router, pathname, searchParams]);

  if (checkingInstall || loading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
         <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
         <p className="text-zinc-500 animate-pulse font-sans">Prüfe Status...</p>
      </div>
    );
  }

  const isLoginPage = pathname === '/login' || pathname === '/login/';
  const isRegisterPage = pathname === '/register' || pathname === '/register/';
  const isResetPasswordPage = pathname === '/reset-password' || pathname === '/reset-password/';
  const isLegalPage = pathname?.startsWith('/impressum') || pathname?.startsWith('/datenschutz') || pathname?.startsWith('/terms') || pathname?.startsWith('/privacy');
  const isInstallPage = pathname?.startsWith('/install');
  const matchId = searchParams.get('id');
  const isMatchPageWithId = (pathname === '/matches' || pathname === '/matches/') && !!matchId;

  const isPublicRoute = isLoginPage || isRegisterPage || isResetPasswordPage || isLegalPage || isMatchPageWithId;

  if (isInstalled === false) {
    if (isInstallPage) {
      return <>{children}</>;
    }
    return null;
  }

  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
