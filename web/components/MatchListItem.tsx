import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Calendar, Bell, Edit2, Trash2, ChevronRight, Tag, Loader2, Flame, AlertCircle, Sparkles, Video } from 'lucide-react';
import { getMediaUrl } from '@/services/api';
import { getMatchVideoTypeLabel } from '@/components/MatchCard';

interface MatchListItemProps {
  match: any;
  user: any;
  onToggleSubscription: (e: React.MouseEvent, match: any) => void;
  onEditRequest: (e: React.MouseEvent, match: any) => void;
  onDeleteRequest?: (e: React.MouseEvent, match: any) => void;
  allowDelete?: boolean;
}

export default function MatchListItem({
  match,
  user,
  onToggleSubscription,
  onEditRequest,
  onDeleteRequest,
  allowDelete = false,
}: MatchListItemProps) {
  const roleUpper = user?.role?.toUpperCase() || '';
  const isTrainerOrAdmin = ['ADMIN', 'TEAM_ADMIN', 'TRAINER', 'CO_TRAINER'].includes(roleUpper);
  const isAdmin = ['ADMIN', 'TEAM_ADMIN'].includes(roleUpper);

  const isStitching = match.is_stitching || ['PENDING', 'SYNCING', 'STITCHING', 'TRACKING', 'REFRAMING'].includes(match.stitch_job?.status);
  const isStitchFailed = match.stitch_job?.status === 'FAILED';
  const isGeneratingHeatmap = match.is_generating_heatmap || ['QUEUED', 'PROCESSING'].includes(match.heatmap_status);
  const isDetectingHighlights = match.is_detecting_highlights || match.highlight_job?.status === 'PROCESSING';
  const videoType = getMatchVideoTypeLabel(match);

  return (
    <Link href={`/matches?id=${match.id}`} className="group block w-full">
      <article className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500">
        {/* Left: Thumbnail & Title & Metadata */}
        <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto flex-1">
          {/* Thumbnail */}
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800">
            {match.thumbnail_path ? (
              <Image
                src={getMediaUrl(match.thumbnail_path)}
                alt={`Thumbnail for ${match.name}`}
                fill
                className="object-cover opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-gray-200 to-gray-100 dark:from-zinc-900 dark:to-zinc-800" />
            )}

            {/* Thumbnail Live Status Badge */}
            {isStitching && (
              <div className="absolute bottom-0 inset-x-0 bg-blue-950/95 border-t border-blue-500/40 px-1.5 py-0.5 flex items-center justify-between text-[9px] font-bold text-blue-200 backdrop-blur-xs z-30 animate-pulse">
                <div className="flex items-center gap-1 truncate">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
                  <span className="truncate">Stitching</span>
                </div>
                <span className="font-mono text-[9px] text-blue-300">
                  {Math.round(match.stitch_job?.progress || 0)}%
                </span>
              </div>
            )}

            {!isStitching && isGeneratingHeatmap && (
              <div className="absolute bottom-0 inset-x-0 bg-orange-950/95 border-t border-orange-500/40 px-1.5 py-0.5 flex items-center justify-between text-[9px] font-bold text-orange-200 backdrop-blur-xs z-30 animate-pulse">
                <div className="flex items-center gap-1 truncate">
                  <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                  <span className="truncate">Heatmap</span>
                </div>
                <span className="font-mono text-[9px] text-orange-300">
                  {Math.round(match.heatmap_job?.progress ?? match.heatmap_progress ?? 0)}%
                </span>
              </div>
            )}

            {!isStitching && !isGeneratingHeatmap && isDetectingHighlights && (
              <div className="absolute bottom-0 inset-x-0 bg-amber-950/95 border-t border-amber-500/40 px-1.5 py-0.5 flex items-center justify-between text-[9px] font-bold text-amber-200 backdrop-blur-xs z-30 animate-pulse">
                <div className="flex items-center gap-1 truncate">
                  <Sparkles className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                  <span className="truncate">Highlights</span>
                </div>
                <span className="font-mono text-[9px] text-amber-300">
                  {Math.round(match.highlight_job?.progress || 0)}%
                </span>
              </div>
            )}

            {!isStitching && !isGeneratingHeatmap && !isDetectingHighlights && isStitchFailed && (
              <div className="absolute bottom-0 inset-x-0 bg-red-950/95 border-t border-red-500/40 px-1.5 py-0.5 flex items-center justify-center text-[9px] font-bold text-red-200 backdrop-blur-xs z-30">
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                  <span>Fehler</span>
                </div>
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                <Play className="h-4 w-4 ml-0.5" />
              </div>
            </div>
          </div>

          {/* Title & Metadata */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-gray-900 transition-colors group-hover:text-emerald-600 dark:text-zinc-100 dark:group-hover:text-emerald-400">
              {match.name || `Match ${match.id}`}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <time>
                  {match.recording_date
                    ? `${new Date(match.recording_date).toLocaleDateString('de-DE')} • ${new Date(match.recording_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : `${new Date(match.created_at).toLocaleDateString('de-DE')} • ${new Date(match.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </time>
              </span>

              {(match.video_quality || match.file_size_mb) && (
                <span className="font-mono text-[10px]">
                  • {match.file_size_mb ? `${match.file_size_mb}MB` : match.video_quality}
                </span>
              )}
            </div>

            {/* Badges */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-medium">
              {isStitching && (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 animate-pulse font-mono text-[10px] dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  Stitching: {Math.round(match.stitch_job?.progress || 0)}%
                </span>
              )}

              {isGeneratingHeatmap && (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 animate-pulse text-[10px] dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                  <Flame className="w-3 h-3 text-amber-500" />
                  Heatmap aktiv
                </span>
              )}

              {videoType && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <Video className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{videoType}</span>
                </span>
              )}

              {!match.team_id && (!match.team_name || match.team_name.toLowerCase() === 'kein team') ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-amber-800 font-semibold dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Kein Team</span>
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-gray-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                  {match.team_name || 'Kein Team'}
                </span>
              )}

              {match.category && (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                  {match.category}
                </span>
              )}

              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-gray-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                <Tag className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                {match.events_count || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Arrow */}
        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSubscription(e, match);
            }}
            className={`rounded-lg p-2 transition-all cursor-pointer ${
              match.is_subscribed
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-2xs'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
            }`}
            title={match.is_subscribed ? 'Abonnement kündigen' : 'Match abonnieren'}
          >
            <Bell className="h-4 w-4" />
          </button>

          {isTrainerOrAdmin && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEditRequest(e, match);
              }}
              className="rounded-lg p-2 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-emerald-400 transition-all cursor-pointer"
              title="Match bearbeiten"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}

          {isAdmin && allowDelete && onDeleteRequest && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteRequest(e, match);
              }}
              className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-all cursor-pointer"
              title="Spiel löschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <div className="ml-1 rounded-lg p-1.5 text-gray-400 transition-colors group-hover:text-emerald-600 dark:text-zinc-500 dark:group-hover:text-emerald-400">
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </article>
    </Link>
  );
}
