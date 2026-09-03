"use client";

import React from 'react';
import { AlertCircle, PlayCircle, Flag, PenTool, Trash2, Edit2, X } from 'lucide-react';
import { getEventCategory } from '@/lib/eventCategories';

interface EventListProps {
  events: any[];
  onEventClick: (timeMs: number) => void;
  onDeleteEvent?: (eventId: string) => void;
  onEditEvent?: (event: any) => void;
  currentTimeMs: number;
  onCloseMobile?: () => void;
}

const EventList = ({ events = [], onEventClick, onDeleteEvent, onEditEvent, currentTimeMs, onCloseMobile }: EventListProps) => {
  const sortedEvents = React.useMemo(() => {
    const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
    return [...safeEvents].sort((a, b) => (a?.video_time_ms || 0) - (b?.video_time_ms || 0));
  }, [events]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor((ms || 0) / 1000);
    const min = Math.floor(totalSeconds / 60);
    const sec = Math.floor(totalSeconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const getIcon = (event: any) => {
    const type = (event?.event_type || '').toLowerCase();
    // Kategorie gewinnt immer - egal ob es ein manueller Marker oder ein (ggf. nachtraeglich
    // kategorisiertes) KI-Highlight ist, damit beide identisch aussehen.
    const category = getEventCategory(event?.details?.category);
    if (category) return <span className="text-sm leading-none">{category.icon}</span>;

    switch (type) {
      case 'goal': return <span className="text-sm leading-none">⚽</span>;
      case 'corner': return <span className="text-sm leading-none">🚩</span>;
      case 'penalty': return <span className="text-sm leading-none">🎯</span>;
      case 'highlight': return <span className="text-sm leading-none">⚡</span>;
      case 'shot': return <PlayCircle className="w-4 h-4 text-blue-500" />;
      case 'marker': return <Flag className="w-4 h-4 text-yellow-400" />;
      case 'drawing': return <PenTool className="w-4 h-4 text-blue-400" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getEventTitle = (event: any) => {
    if (!event) return '';
    const eventType = (event.event_type || '').toLowerCase();
    const category = getEventCategory(event.details?.category);

    if (eventType === 'drawing') {
      const count = event.details?.shapes?.length || 0;
      const base = `Zeichnung (${count} ${count === 1 ? 'Objekt' : 'Objekte'})`;
      return category ? `${category.label} - ${base}` : base;
    }
    if (category) {
      return event.details?.text ? `${category.label}: ${event.details.text}` : category.label;
    }
    if (eventType === 'marker' && event.details?.text) {
      return event.details.text;
    }
    if (event.details?.title) {
      return event.details.title;
    }
    return (event.event_type || 'Event').toUpperCase();
  };

  const getEventSubtext = (event: any) => {
    const eventType = (event?.event_type || '').toLowerCase();
    if (eventType === 'drawing') return event?.details?.text || null;
    const category = getEventCategory(event?.details?.category);
    if (!category && event?.details?.title && event?.details?.note) return event.details.note;
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Match Events</h2>
        {onCloseMobile && (
          <button 
            onClick={onCloseMobile}
            className="md:hidden p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {sortedEvents.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-sm">
            Keine Events gefunden
          </div>
        ) : (
          sortedEvents.map((event, idx) => {
            const videoTime = event?.video_time_ms || 0;
            const isActive = Math.abs(currentTimeMs - videoTime) < 2000;
            return (
              <div 
                key={event.id || idx}
                className={`group relative w-full flex items-stretch border-b border-white/5 transition-colors ${isActive ? 'bg-white/5 border-l-2 border-l-blue-500' : 'hover:bg-white/5'}`}
              >
                <button
                  onClick={() => onEventClick(videoTime)}
                  className="flex-1 p-4 flex items-start gap-3 md:gap-4 text-left w-full min-w-0"
                >
                  <div className="mt-1 shrink-0">{getIcon(event)}</div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0 overflow-hidden">
                    <span className="text-xs font-bold text-zinc-400">{formatTime(videoTime)}</span>
                    <span className="text-sm font-medium text-white/90 truncate pr-16">{getEventTitle(event)}</span>
                    {getEventSubtext(event) && (
                      <span className="text-xs text-zinc-400 line-clamp-2 break-words break-all">
                        {getEventSubtext(event)}
                      </span>
                    )}
                  </div>
                </button>
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEditEvent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent(event);
                      }}
                      className="p-2 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                      title="Event bearbeiten"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDeleteEvent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEvent(event.id);
                      }}
                      className="p-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                      title="Event löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default React.memo(EventList, (prevProps, nextProps) => {
  return (
    prevProps.events === nextProps.events &&
    prevProps.currentTimeMs === nextProps.currentTimeMs
  );
});
