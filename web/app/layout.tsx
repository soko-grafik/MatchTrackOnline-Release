import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // DIESER IMPORT IST ENTSCHEIDEND
import { AuthProvider } from "@/contexts/AuthContext";
import { UploadProvider } from "@/contexts/UploadContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import InstallPrompt from "@/components/InstallPrompt";
import AIVoiceAssistant from "@/components/AIVoiceAssistant";
import { Suspense } from "react"; // NEU: Suspense importieren

import WindowControlsToggle from "@/components/WindowControlsToggle";

import { ToastProvider } from "@/contexts/ToastContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MatchTrack - Analytics",
  description: "Professional Soccer Analysis Platform",
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MatchTrack",
  },
  icons: {
    icon: '/icon.png',
    apple: '/app-icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: "#39b068",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="serviceworker" href="/sw.js" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ServiceWorkerRegister />
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <SettingsProvider>
                <UploadProvider>
                  <Suspense fallback={<div>Loading...</div>}>
                    <ProtectedRoute>
                        <div className="flex flex-col min-h-screen">
                          <main className="flex-1">
                            {children}
                          </main>
                          <AIVoiceAssistant />
                        </div>
                    </ProtectedRoute>
                  </Suspense>
                </UploadProvider>
              </SettingsProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
        <InstallPrompt />
      </body>
    </html>
  );
}
