"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Play, Calendar, Bell, Edit2, Trash2, Tag, Star, Loader2, Flame, AlertCircle, Sparkles } from 'lucide-react';
import { getMediaUrl } from '@/services/api';

interface MatchCardProps {
  match: any;
  user: any;
  onToggleSubscription: (e: React.MouseEvent, match: any) => void;
  onEditRequest: (e: React.MouseEvent, match: any) => void;
  onDeleteRequest?: (e: React.MouseEvent, match: any) => void;
  allowDelete?: boolean;
}

export default function MatchCard({ match, user, onToggleSubscription, onEditRequest, onDeleteRequest, allowDelete = false }: MatchCardProps) {
  const roleUpper = user?.role?.toUpperCase() || '';
  const isTrainerOrAdmin = ['ADMIN', 'TEAM_ADMIN', 'TRAINER', 'CO_TRAINER'].includes(roleUpper);
  const isAdmin = ['ADMIN', 'TEAM_ADMIN'].includes(roleUpper);

  const isStitching = match.is_stitching || ['PENDING', 'SYNCING', 'STITCHING', 'TRACKING', 'REFRAMING'].includes(match.stitch_job?.status);
  const isStitchFailed = match.stitch_job?.status === 'FAILED';
  const isGeneratingHeatmap = match.is_generating_heatmap || ['QUEUED', 'PROCESSING'].includes(match.heatmap_status);
  const isDetectingHighlights = match.is_detecting_highlights || match.highlight_job?.status === 'PROCESSING';

  return (
    <Link href={`/matches?id=${match.id}`} className="group relative block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:border-primary hover:shadow-lg">
        
        {/* Thumbnail Hero Section */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-zinc-950">
          {match.thumbnail_path ? (
            <Image
              src={getMediaUrl(match.thumbnail_path)}
              alt={`Thumbnail for ${match.name}`}
              fill
              className="object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 to-zinc-800" />
          )}

          {/* Live Status Overlay Bar (Stitching / Heatmap / Highlights / Error) */}
          {isStitching && (
            <div className="absolute bottom-0 inset-x-0 bg-blue-950/95 border-t border-blue-500/40 px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-blue-200 backdrop-blur-sm z-30 animate-pulse shadow-md">
              <div className="flex items-center gap-1.5 truncate">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                <span className="truncate">{match.stitch_job?.current_step_text || 'Stitching läuft...'}</span>
              </div>
              <span className="font-mono text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-400/30 shrink-0 ml-1">
                {Math.round(match.stitch_job?.progress || 0)}%
              </span>
            </div>
          )}

          {!isStitching && isGeneratingHeatmap && (
            <div className="absolute bottom-0 inset-x-0 bg-amber-950/95 border-t border-amber-500/40 px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-amber-200 backdrop-blur-sm z-30 animate-pulse shadow-md">
              <div className="flex items-center gap-1.5 truncate">
                <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-bounce" />
                <span className="truncate">Heatmap wird generiert...</span>
              </div>
            </div>
          )}

          {!isStitching && !isGeneratingHeatmap && isDetectingHighlights && (
            <div className="absolute bottom-0 inset-x-0 bg-amber-950/95 border-t border-amber-500/40 px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-amber-200 backdrop-blur-sm z-30 animate-pulse shadow-md">
              <div className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                <span className="truncate">{match.highlight_job?.current_step_text || 'KI-Highlights werden erkannt...'}</span>
              </div>
              <span className="font-mono text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30 shrink-0 ml-1">
                {Math.round(match.highlight_job?.progress || 0)}%
              </span>
            </div>
          )}

          {!isStitching && !isGeneratingHeatmap && !isDetectingHighlights && isStitchFailed && (
            <div className="absolute bottom-0 inset-x-0 bg-red-950/95 border-t border-red-500/40 px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-red-200 backdrop-blur-sm z-30 shadow-md">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="truncate">Stitching fehlgeschlagen</span>
              </div>
            </div>
          )}

          {/* Top Actions Overlay */}
          <div className="absolute left-3 top-3 z-30">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSubscription(e, match);
              }}
              className={`rounded-md p-1.5 transition-colors ${
                match.is_subscribed 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
              title={match.is_subscribed ? "Abonnement kündigen" : "Match abonnieren"}
            >
              <Bell className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100">
            {isTrainerOrAdmin && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEditRequest(e, match);
                }}
                className="rounded-md bg-zinc-900/60 p-1.5 text-zinc-300 hover:bg-primary hover:text-white transition-colors"
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
                className="rounded-md bg-zinc-900/60 p-1.5 text-zinc-300 hover:bg-red-600 hover:text-white transition-colors"
                title="Spiel löschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Centered Play Button */}
          <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg">
              <Play className="h-5 w-5 ml-1" />
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-1 flex-col justify-between p-4">
          <div>
            {/* Category / Card Type Badge directly above Title */}
            {match.category && (
              <div className="mb-1.5">
                <span className="inline-block rounded border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-300">
                  {match.category}
                </span>
              </div>
            )}

            <h3 className="font-bold text-emerald-400 transition-colors group-hover:text-emerald-300 line-clamp-2 text-base">
              {match.name || `Match ${match.id}`}
            </h3>
            
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
                <time>
                  {match.recording_date
                    ? `${new Date(match.recording_date).toLocaleDateString('de-DE')} • ${new Date(match.recording_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                    : `${new Date(match.created_at).toLocaleDateString('de-DE')} • ${new Date(match.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                  }
                </time>
              </div>

              {(match.video_quality || match.file_size_mb) && (
                <span className="rounded bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-400 border border-zinc-700/50">
                  {match.file_size_mb ? `${match.file_size_mb}MB` : match.video_quality}
                </span>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="mt-4 space-y-2">
            {/* Team Pill */}
            {(() => {
              const userTeams = user?.teams || [];
              // Check if team is editable by user
              const isEditableTeam = userTeams.some((ut: any) => match.team_id && ut.id === match.team_id && Boolean(ut.can_edit));
              return (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/90 border border-zinc-700/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-200">
                    <span>{match.team_name || 'Kein Team'}</span>
                    {isEditableTeam && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0 ml-0.5" />}
                  </span>
                </div>
              );
            })()}

            {/* Event Count Pill */}
            <div className="flex items-center">
              <span className="flex items-center gap-1.5 rounded-md bg-zinc-800/80 border border-zinc-700/40 px-2 py-1 text-[11px] font-bold text-zinc-300">
                <Tag className="h-3.5 w-3.5 text-emerald-400" />
                <span>{match.events_count || 0}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
