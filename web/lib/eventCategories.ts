// Gemeinsame Kategorien für manuell erstellte Spielkommentare/Marker.
// Werden im Kommentar-Modal zur Auswahl angeboten und in der Timeline-Tooltip
// sowie der Event-Liste zur Darstellung (Icon/Farbe) genutzt.

export interface EventCategory {
  id: string;
  label: string;
  icon: string;
  /** Tailwind-Klassen für den Marker-Punkt auf der Timeline (Hintergrund + Ring/Glow) */
  dotClass: string;
  /** Tailwind-Klassen für die Auswahl-Chips/Badges */
  badgeClass: string;
}

export const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'tor', label: 'Tor', icon: '⚽', dotClass: 'bg-emerald-400 ring-2 ring-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.8)]', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'torschuss', label: 'Torschuss', icon: '👟', dotClass: 'bg-blue-400 ring-2 ring-blue-500/50', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'flanke', label: 'Flanke', icon: '↗️', dotClass: 'bg-sky-400 ring-2 ring-sky-500/50', badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  { id: 'konter', label: 'Konter', icon: '⚡', dotClass: 'bg-amber-400 ring-2 ring-amber-500/50 shadow-[0_0_8px_rgba(251,191,36,0.8)]', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'umschaltspiel', label: 'Umschaltspiel', icon: '🔄', dotClass: 'bg-indigo-400 ring-2 ring-indigo-500/50', badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { id: 'ecke', label: 'Ecke', icon: '🚩', dotClass: 'bg-cyan-400 ring-2 ring-cyan-500/50', badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { id: 'elfmeter', label: 'Elfmeter', icon: '🎯', dotClass: 'bg-purple-400 ring-2 ring-purple-500/50', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'chance', label: 'Chance', icon: '🔥', dotClass: 'bg-orange-400 ring-2 ring-orange-500/50', badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  { id: 'foul', label: 'Foul / Karte', icon: '🟨', dotClass: 'bg-red-400 ring-2 ring-red-500/50', badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30' },
];

export function getEventCategory(id?: string | null): EventCategory | undefined {
  if (!id) return undefined;
  return EVENT_CATEGORIES.find((c) => c.id === id);
}

// Beim Bearbeiten eines noch nicht kategorisierten KI-erkannten Events (event_type
// goal/corner/penalty/highlight) wird diese Kategorie vorausgewählt, damit KI-Highlights
// und manuelle Markierungen im Editor identisch behandelt werden.
export const EVENT_TYPE_CATEGORY_FALLBACK: Record<string, string> = {
  goal: 'tor',
  corner: 'ecke',
  penalty: 'elfmeter',
  highlight: 'konter',
};
