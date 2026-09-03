"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import TacticsBoard from '@/components/tactics/TacticsBoard';

function TacticsPageContent() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get('id') || undefined;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white font-sans overflow-hidden">
      <Navbar />
      <main className="flex-1 w-full flex flex-col overflow-hidden">
        <TacticsBoard initialBoardId={boardId} />
      </main>
    </div>
  );
}

export default function TacticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TacticsPageContent />
    </Suspense>
  );
}
