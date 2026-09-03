"use client";

import { useState, useEffect, useRef } from 'react';
import { X, Send, User as UserIcon } from 'lucide-react';
import { EVENT_CATEGORIES } from '@/lib/eventCategories';

interface AddCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (comment: string, category?: string, taggedPlayerIds?: string[]) => void;
  timeMs: number;
  initialText?: string;
  initialCategory?: string;
  showCategoryPicker?: boolean;
  headingLabel?: string;
  placeholder?: string;
  players?: any[];
}

export default function AddCommentModal({
  isOpen, onClose, onSave, timeMs, initialText = "", initialCategory,
  showCategoryPicker = true,
  headingLabel = "Moment markieren",
  placeholder = "Beschreibe, was hier passiert... (Tippe @ für Spieler)",
  players = [],
}: AddCommentModalProps) {
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorIdx, setMentionCursorIdx] = useState(-1);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setComment(initialText);
      setCategory(initialCategory);
      setMentionQuery(null);
    }
  }, [isOpen, initialText, initialCategory]);

  if (!isOpen) return null;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const min = Math.floor(totalSeconds / 60);
    const sec = Math.floor(totalSeconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const filteredPlayers = mentionQuery !== null
    ? players.filter(p => {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        return fullName.includes(mentionQuery.toLowerCase());
      })
    : [];

  const handleSave = () => {
    if (comment.trim()) {
      // Find all tagged players in the final text
      const taggedPlayerIds = players
        .filter(p => comment.includes(`@${p.first_name} ${p.last_name}`))
        .map(p => p.id);
        
      onSave(comment, category, taggedPlayerIds);
    }
  };
  
  const insertMention = (player: any) => {
    if (mentionQuery === null || mentionCursorIdx === -1) return;
    
    const textBeforeMention = comment.slice(0, mentionCursorIdx);
    const textAfterCursor = comment.slice(textareaRef.current?.selectionStart || comment.length);
    const mentionText = `@${player.first_name} ${player.last_name} `;
    
    const newText = textBeforeMention + mentionText + textAfterCursor;
    setComment(newText);
    setMentionQuery(null);
    
    // Focus back and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = textBeforeMention.length + mentionText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setComment(val);
    
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    // Match `@` only at the beginning or after a space, allowing up to one space inside the name
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-ZäöüÄÖÜß]*\s?[a-zA-ZäöüÄÖÜß]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      // match.index is the start of the entire match, which could include the leading space
      const atSymbolIndex = textBeforeCursor.lastIndexOf('@');
      setMentionCursorIdx(atSymbolIndex);
      setActiveMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredPlayers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIndex(prev => (prev + 1) % filteredPlayers.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex(prev => (prev - 1 + filteredPlayers.length) % filteredPlayers.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredPlayers[activeMentionIndex]);
        return;
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 shrink-0">
          <h2 className="text-lg font-bold text-white">{headingLabel} bei {formatTime(timeMs)}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto relative">
          {showCategoryPicker && (
            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Kategorie (optional)</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(isSelected ? undefined : cat.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected ? cat.badgeClass : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative">
            <label htmlFor="comment" className="sr-only">Kommentar</label>
            <textarea
              ref={textareaRef}
              id="comment"
              value={comment}
              onChange={handleCommentChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full resize-none rounded-lg border-zinc-800 bg-zinc-900 p-3 text-sm text-white shadow-sm focus:border-primary focus:ring-primary min-h-[120px]"
              autoFocus
            />
            
            {/* Mention Dropdown Inline */}
          </div>
          
          {mentionQuery !== null && filteredPlayers.length > 0 && (
            <div className="mt-3 w-full max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl"
                 style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="p-1.5 text-xs font-bold text-zinc-500 uppercase tracking-wider bg-zinc-800/50 border-b border-zinc-800">
                Spieler erwähnen
              </div>
              {filteredPlayers.map((player, idx) => (
                <button
                  key={player.id}
                  onClick={() => insertMention(player)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    idx === activeMentionIndex ? 'bg-primary/20 text-white border-l-2 border-primary' : 'text-zinc-300 hover:bg-zinc-800 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white shadow-sm">
                    {player.first_name[0]}{player.last_name[0]}
                  </div>
                  <span className="font-medium truncate">{player.first_name} {player.last_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-zinc-800 bg-zinc-900/50 p-4 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!comment.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
