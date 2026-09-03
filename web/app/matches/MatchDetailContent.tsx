"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMatchDetails, getMatchAnalytics, addMatchEvent, deleteMatchEvent, updateMatchEvent, updateMatchPasswordProtection, verifyMatchPassword, generateHeatmap, deleteHeatmap, getMediaUrl, detectMatchHighlights, getMatchHighlightStatus, trackUserPing, getPlayers } from '@/services/api';
import MatchPlayer from '@/components/MatchPlayer';
import HeatmapOverlay from '@/components/HeatmapOverlay';
import EventList from '@/components/EventList';
import AddCommentModal from '@/components/AddCommentModal';
import HighlightSpeedModal, { HighlightSpeed } from '@/components/HighlightSpeedModal';
import { EVENT_TYPE_CATEGORY_FALLBACK } from '@/lib/eventCategories';
import ConfirmModal from '@/components/ConfirmModal';
import ShareModal from '@/components/ShareModal';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Share2, MoreHorizontal, LayoutGrid, Activity, Flag, PenTool, Bell, BellOff, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Download, Lock, Clock, Flame, Aperture, X, Sliders, Sparkles, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Video, Menu, Edit, Pencil } from 'lucide-react';
import EditMatchModal from '@/components/EditMatchModal';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { subscribeToMatch, unsubscribeFromMatch } from '@/services/api';
import ConversionStatus from '@/components/ConversionStatus';
import FisheyeCorrectionModal from '@/components/FisheyeCorrectionModal';
import VideoAdjustmentModal from '@/components/VideoAdjustmentModal';
import AlertDialog from '@/components/AlertDialog';

export default function MatchDetailContent() {

  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { user, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const { toast, confirm: confirmModal } = useToast();

  const [matchData, setMatchData] = useState<any>(null);

  const isExternalGuest = !user;
  const roleUpper = user?.role?.toUpperCase();
  const isTrainerOrAdmin = ['TRAINER', 'CO_TRAINER', 'TEAM_ADMIN', 'ADMIN'].includes(roleUpper || '');
  // A password guest is ONLY an external visitor without an account (user is null)
  const isPasswordGuest = isExternalGuest && matchData?.match?.is_password_protected;

  const canComment = !isExternalGuest && (isTrainerOrAdmin || !!user);
  const canEdit = !isExternalGuest && isTrainerOrAdmin;
  const canShare = !isExternalGuest && isTrainerOrAdmin;
  const isAdmin = !isExternalGuest && roleUpper === 'ADMIN';
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [heatmapStatus, setHeatmapStatus] = useState<string>('none');
  const [teamPlayers, setTeamPlayers] = useState<any[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  // NEU: States für Passwortschutz
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFisheyeModalOpen, setIsFisheyeModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isEventListOpen, setIsEventListOpen] = useState(false); // Default to closed on mobile
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [videoAdjustments, setVideoAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0
  });

  const [markerTimeMs, setMarkerTimeMs] = useState(0);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingShapesToSave, setDrawingShapesToSave] = useState<any[]>([]);

  // States for editing events
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingMarkerText, setEditingMarkerText] = useState("");
  const [editingMarkerCategory, setEditingMarkerCategory] = useState<string | undefined>(undefined);
  const [initialDrawingShapes, setInitialDrawingShapes] = useState<any[]>([]);

  // Das gerade bearbeitete Event (falls vorhanden) - wird beim Speichern gebraucht, um
  // bestehende details (z.B. note/auto_detected eines KI-Highlights) nicht zu verlieren.
  const editingEvent = editingEventId ? matchData?.events?.find((e: any) => e.id === editingEventId) : null;

  // State for confirmation modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const [isGeneratingHighlights, setIsGeneratingHighlights] = useState(false);
  const [highlightJob, setHighlightJob] = useState<any>(null);
  const [isHighlightSpeedModalOpen, setIsHighlightSpeedModalOpen] = useState(false);

  const hasAutoHighlights = (matchData?.events || []).some(
    (e: any) => e?.details?.auto_detected === true || ['goal', 'corner', 'penalty'].includes((e?.event_type || '').toLowerCase())
  );

  const handleGenerateHighlights = async (speed: HighlightSpeed = 'normal') => {
    if (!id) return;
    setIsHighlightSpeedModalOpen(false);
    setIsGeneratingHighlights(true);
    setHighlightJob({
      has_job: true,
      status: 'PROCESSING',
      progress: 2.0,
      current_step_text: `Initialisiere KI-Videoanalyse & YOLOv8 (${speed})...`,
      events_detected: 0
    });
    try {
      await detectMatchHighlights(id as string, speed);
      const speedLabel = speed === 'fast' ? 'Fast' : speed === 'slow' ? 'Slow (beste Qualität)' : 'Normal';
      toast.info(`KI-Highlight-Erkennung gestartet (${speedLabel}): YOLOv8 analysiert das Video im Hintergrund auf Tore, Ecken & Aktionen.`);
    } catch (err: any) {
      toast.error(err.message || 'Highlight-Erkennung konnte nicht gestartet werden.');
      setIsGeneratingHighlights(false);
      setHighlightJob(null);
    }
  };

  // Set initial state for event list based on screen size
  useEffect(() => {
    if (window.innerWidth >= 768) { // md breakpoint
      setIsEventListOpen(true);
    }
  }, []);

  const loadData = async () => {
     if (authLoading) return;
     if (id) {
        setLoading(true);
        setPasswordRequired(false); // Reset password requirement
        setPasswordError(null);
        try {
          const data = await getMatchDetails(id as string);
          if (data && data.password_protected) {
            if (user) {
              setPasswordRequired(false);
            } else {
              setPasswordRequired(true);
              setMatchData(data); // Retain password metadata (e.g. is_password_expired)
            }
          } else if (data) {
            setPasswordRequired(false);
            setPasswordError(null);
            setMatchData(data);
            setIsSubscribed(data.is_subscribed || false);
            const matchObj = data.match || data;
            setHeatmapStatus(matchObj?.heatmap_status || 'none');

            // Set video adjustments
            if (matchObj) {
              setVideoAdjustments({
                brightness: matchObj.video_brightness ?? 100,
                contrast: matchObj.video_contrast ?? 100,
                saturation: matchObj.video_saturation ?? 100,
                hue: matchObj.video_hue ?? 0
              });
            }

            // Fetch team players for mentions (only for authenticated users)
            if (user) {
              try {
                let playersToSet: any[] = [];
                if (matchObj?.team_id) {
                  const teamIds = matchObj.team_id.split(',').map((id: string) => id.trim()).filter(Boolean);
                  if (teamIds.length > 0) {
                    const allPlayersArrays = await Promise.all(teamIds.map((tid: string) => getPlayers({ team_id: tid })));
                    playersToSet = allPlayersArrays.flat();
                  } else {
                    playersToSet = await getPlayers({});
                  }
                } else {
                  playersToSet = await getPlayers({}); // Fallback if no team assigned
                }
                setTeamPlayers(playersToSet);
              } catch (e) {
                console.error("Failed to fetch players for mentions", e);
              }
            }
            
            // Handle URL seeking if t parameter is present
            const tParam = searchParams.get('t');
            if (tParam) {
              const timeMs = parseInt(tParam, 10);
              if (!isNaN(timeMs)) {
                setTimeout(() => setSeekTo(timeMs), 500); // Give player time to initialize
              }
            }
          }

          // Check for active highlight detection job
          try {
            const hlRes = await getMatchHighlightStatus(id as string);
            if (hlRes && hlRes.has_job) {
              setHighlightJob(hlRes);
              if (hlRes.status === 'PROCESSING') {
                setIsGeneratingHighlights(true);
              }
            }
          } catch (hlErr) {
            console.error("Failed to fetch highlight job status:", hlErr);
          }
        } catch (err: any) {
          console.error("Match details error:", err);
          if (err.response && err.response.status === 401 && !user) {
            setPasswordRequired(true);
          }
        } finally {
          setLoading(false);
        }

        // Only fetch analytics if not password required
        if (!passwordRequired && (!isPasswordGuest || !!user)) {
          console.debug(`[HeatmapDebug] Fetching analytics for match ${id}...`);
          getMatchAnalytics(id as string)
            .then(data => {
              console.debug("[HeatmapDebug] Received analytics data:", data);
              setAnalyticsData(data);
            })
            .catch(err => console.error("[HeatmapDebug] Analytics error:", err));
        }
      }
  };

  // Polling for active highlight detection job
  useEffect(() => {
    if (!id) return;
    const isProcessing = isGeneratingHighlights || highlightJob?.status === 'PROCESSING';
    if (!isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const res = await getMatchHighlightStatus(id as string);
        if (res && res.has_job) {
          setHighlightJob(res);
          if (res.status === 'COMPLETED') {
            setIsGeneratingHighlights(false);
            toast.success(res.current_step_text || 'KI-Highlights erfolgreich generiert!');
            loadData();
          } else if (res.status === 'FAILED') {
            setIsGeneratingHighlights(false);
            toast.error(res.error_message || 'Fehler bei der KI-Highlight-Erkennung');
          }
        }
      } catch (err) {
        console.error("Highlight job poll error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [id, isGeneratingHighlights, highlightJob?.status]);

  // Periodic Watch-Time Tracker (every 30s when user is logged in)
  useEffect(() => {
    if (!id || !user) return;

    // Ping initial watch time after 5s
    const initTimer = setTimeout(() => {
      trackUserPing(id as string, 10, 'match_video');
    }, 5000);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        trackUserPing(id as string, 30, 'match_video');
      }
    }, 30000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [id, user]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !enteredPassword) return;

    setLoading(true);
    setPasswordError(null);
    try {
      await verifyMatchPassword(id as string, enteredPassword);
      setPasswordRequired(false);
      setEnteredPassword('');
      await loadData();
    } catch (err: any) {
      console.error("Password verification failed:", err);
      const detail = err?.response?.data?.detail || "Falsches Passwort. Bitte versuchen Sie es erneut.";
      setPasswordError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscription = async () => {
    if (!id || !user) return;
    try {
      if (isSubscribed) {
        await unsubscribeFromMatch(id as string);
        setIsSubscribed(false);
      } else {
        await subscribeToMatch(id as string);
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error("Subscription toggle failed:", error);
    }
  };

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type?: 'info' | 'success' | 'warning' | 'error'; title?: string }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  const handleGenerateHeatmap = async () => {
    if (!id || !isAdmin) return;
    try {
      console.debug(`[HeatmapDebug] Requesting heatmap generation for match ${id}...`);
      await generateHeatmap(id as string);
      loadData(); // Reload to get updated status
      setAlertConfig({
        isOpen: true,
        message: "Heatmap-Generierung in die Warteschlange aufgenommen.",
        type: 'success',
        title: "Heatmap gestartet"
      });
    } catch (error) {
      console.error("[HeatmapDebug] Failed to generate heatmap:", error);
      setAlertConfig({
        isOpen: true,
        message: "Fehler beim Starten der Heatmap-Generierung.",
        type: 'error'
      });
    }
  };

  const handleDeleteHeatmap = async () => {
    if (!id || !isAdmin) return;
    const isConfirmed = await confirmModal({
      title: 'Heatmap löschen',
      message: 'Bist du sicher, dass du diese Heatmap löschen möchtest?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await deleteHeatmap(id as string);
      setShowHeatmap(false);
      setAnalyticsData(null);
      setHeatmapStatus('none');
      loadData();
      toast.success("Heatmap wurde gelöscht.");
    } catch (err) {
      console.error("Heatmap Delete Error:", err);
      toast.error("Fehler beim Löschen der Heatmap.");
    }
  };



  useEffect(() => {
    if (!authLoading) {
      loadData();
    }

    // Polling for heatmap status if it's processing or queued
    let interval: NodeJS.Timeout;
    if (heatmapStatus === 'processing' || heatmapStatus === 'queued') {
      interval = setInterval(() => {
        if (!authLoading) {
          loadData();
        }
      }, 10000); // Poll every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [id, heatmapStatus, authLoading, user?.id]);

  const handleOpenModal = () => {
    if (!canEdit && !canComment) return;
    setEditingEventId(null);
    setEditingMarkerText("");
    setEditingMarkerCategory(undefined);
    setMarkerTimeMs(currentTimeMs);
    setIsModalOpen(true);
  };

  const handleSaveMarker = async (comment: string, category?: string, taggedPlayerIds?: string[]) => {
    if (!id || (!canEdit && !canComment)) return;

    // If we have shapes to save, it's a drawing event
    if (drawingShapesToSave.length > 0) {
      // NOTE: handleSaveDrawing would need update if drawing could also tag players, but we skip that for now.
      await handleSaveDrawing(drawingShapesToSave, comment, category);
      setDrawingShapesToSave([]);
    } else {
      try {
        const details: any = { ...(editingEvent?.details || {}), text: comment };
        if (category) {
          details.category = category;
        } else {
          delete details.category;
        }
        if (taggedPlayerIds && taggedPlayerIds.length > 0) {
          details.tagged_player_ids = taggedPlayerIds;
        } else {
          delete details.tagged_player_ids;
        }
        
        if (editingEventId) {
          await updateMatchEvent(id as string, editingEventId, details);
        } else {
          await addMatchEvent(id as string, 'marker', markerTimeMs, details);
        }
        getMatchDetails(id as string).then(data => setMatchData(data));
      } catch (error) {
        console.error("Failed to save marker:", error);
        setAlertConfig({ isOpen: true, message: "Fehler beim Speichern der Markierung.", type: 'error' });
      }
    }

    setIsModalOpen(false);
    setEditingEventId(null);
  };

  const toggleDrawingMode = () => {
    if (!canEdit) return;
    if (!isDrawingMode) {
      setEditingEventId(null);
      setInitialDrawingShapes([]);
    }
    setIsDrawingMode(!isDrawingMode);
  };

  const handleSaveDrawing = async (shapes: any[], comment?: string, category?: string) => {
    if (!id || !canEdit) return;
    setIsDrawingMode(false);

    const eventData: { shapes: any[], text?: string, category?: string } = { shapes };
    if (comment && comment.trim() !== "") {
      eventData.text = comment;
    }
    if (category) {
      eventData.category = category;
    }

    try {
      if (editingEventId) {
        await updateMatchEvent(id as string, editingEventId, eventData);
      } else {
        await addMatchEvent(id as string, 'drawing', currentTimeMs, eventData);
      }
      getMatchDetails(id as string).then(data => setMatchData(data));
    } catch (error) {
      console.error("Failed to save drawing:", error);
      setAlertConfig({ isOpen: true, message: "Fehler beim Speichern der Zeichnung.", type: 'error' });
    }
    setEditingEventId(null);
  };

  const handleDrawingSaveRequest = (shapes: any[]) => {
    if (!canEdit) return;
    setDrawingShapesToSave(shapes);
    setMarkerTimeMs(currentTimeMs);
    const existingEvent = editingEventId ? matchData?.events.find((e:any) => e.id === editingEventId) : null;
    setEditingMarkerText(existingEvent?.details?.text || "");
    setEditingMarkerCategory(existingEvent?.details?.category);
    setIsModalOpen(true);
  };

  const handleCancelDrawing = () => {
    setIsDrawingMode(false);
    setEditingEventId(null);
  };

  const handleDeleteRequest = (eventId: string) => {
    if (!canEdit) return;
    setEventToDelete(eventId);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!id || !eventToDelete || !canEdit) return;

    try {
       await deleteMatchEvent(id as string, eventToDelete);
       getMatchDetails(id as string).then(data => setMatchData(data));
    } catch (error) {
       console.error("Failed to delete event:", error);
       setAlertConfig({ isOpen: true, message: "Fehler beim Löschen des Events.", type: 'error' });
    }


    setIsConfirmOpen(false);
    setEventToDelete(null);
  };

  const handleEditEvent = (event: any) => {
    if (!canEdit || !event) return;
    setEditingEventId(event.id);
    const eventType = (event.event_type || '').toLowerCase();
    if (eventType === 'drawing') {
      setSeekTo(event.video_time_ms || 0);
      setTimeout(() => setSeekTo(null), 100);

      setInitialDrawingShapes(event.details?.shapes || []);
      setEditingMarkerText(event.details?.text || "");
      setEditingMarkerCategory(event.details?.category);
      setIsDrawingMode(true);
    } else {
      // Manuelle Marker UND KI-Highlights (Tor/Eckball/Elfmeter/Highlight, ...) werden
      // identisch im selben Modal bearbeitet: Text + Kategorie. Ein noch nicht
      // kategorisiertes KI-Event bekommt die zu seinem event_type passende Kategorie
      // vorausgewaehlt, damit die Optik nach dem Speichern nahtlos gleich bleibt.
      setMarkerTimeMs(event.video_time_ms || 0);
      setEditingMarkerText(event.details?.text || event.details?.title || "");
      setEditingMarkerCategory(event.details?.category || EVENT_TYPE_CATEGORY_FALLBACK[eventType]);
      setIsModalOpen(true);
    }
  };

  const handleSavePasswordProtection = async (isProtected: boolean, password?: string, expiresAt?: string | null) => {
    if (!id || !canEdit) return;
    try {
      await updateMatchPasswordProtection(id as string, isProtected, password, expiresAt);
      loadData();
    } catch (error) {
      console.error("Failed to update password protection:", error);
      throw error;
    }
  };

  if (!id) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500">Match ID fehlt.</div>
      </div>
    );
  }

  if (loading && !matchData) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (passwordRequired) {
    const isExpired = matchData?.is_password_expired;
    return (
      <div className="h-screen w-screen bg-black text-white flex items-center justify-center p-4">
        <div className="bg-[#18181b] border border-zinc-800 rounded-3xl shadow-2xl w-full max-w-sm transform transition-all animate-in fade-in-0 zoom-in-95 overflow-hidden">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-black/20">
            <h2 className="text-xl font-bold text-white">Passwort erforderlich</h2>
            <Link href="/" className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 transition-all">
              Zurück
            </Link>
          </div>
          {isExpired ? (
            <div className="p-8 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-red-400">Zugriff abgelaufen</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Der Passwort-Zugriff für diesen Freigabelink ist abgelaufen. Bitte wende dich an die Trainer oder Administratoren.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="match-password-input" className="text-sm font-medium text-zinc-300">
                  Dieses Match ist passwortgeschützt. Bitte geben Sie das Passwort ein:
                </label>
                <input
                  type="password"
                  id="match-password-input"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder="Passwort"
                  className="w-full bg-black/40 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
                {passwordError && <p className="text-red-400 text-xs mt-1">{passwordError}</p>}
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
                ) : (
                  'Zugriff gewähren'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  const match = matchData?.match || matchData || {};
  const chunks = matchData?.chunks || matchData?.match?.chunks || [];
  const firstChunk = chunks[0];

  const availableStreams = match?.available_streams || [];
  const defaultStream = availableStreams.find((s: any) => s.id === '16x9') || availableStreams[0] || null;
  const activeStream = availableStreams.find((s: any) => s.id === selectedStreamId) || defaultStream;

  const handleSwitchStream = (streamId: string) => {
    if (streamId === activeStream?.id) return;
    const savedTime = currentTimeMs;
    setSelectedStreamId(streamId);
    setTimeout(() => {
      setSeekTo(savedTime);
    }, 100);
  };

  const currentVideoUrl = activeStream?.video_path
    ? getMediaUrl(activeStream.video_path)
    : (firstChunk?.video_path ? getMediaUrl(firstChunk.video_path) : '');

  const currentHlsUrl = activeStream?.hls_playlist_path
    ? getMediaUrl(activeStream.hls_playlist_path)
    : (firstChunk?.hls_playlist_path ? getMediaUrl(firstChunk.hls_playlist_path) : undefined);

  const matchDate = match.created_at || match.recording_date;
  const formattedDate = matchDate && !isNaN(new Date(matchDate).getTime())
    ? new Date(matchDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const formattedDateShort = matchDate && !isNaN(new Date(matchDate).getTime())
    ? new Date(matchDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    : '';

  const getRemainingTimeText = (expiresAtStr?: string | null) => {
    if (!expiresAtStr) return 'Freigabe: Unbegrenzt verfügbar';
    const expDate = new Date(expiresAtStr);
    if (isNaN(expDate.getTime())) return 'Freigabe aktiv';
    const diffMs = expDate.getTime() - Date.now();
    if (diffMs <= 0) return 'Zugriff abgelaufen';

    const diffSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(diffSecs / 86400);
    const hours = Math.floor((diffSecs % 86400) / 3600);
    const minutes = Math.floor((diffSecs % 3600) / 60);

    let timeStr = '';
    if (days > 0) {
      timeStr = `${days} Tag${days > 1 ? 'e' : ''}${hours > 0 ? `, ${hours} Std.` : ''}`;
    } else if (hours > 0) {
      timeStr = `${hours} Std.${minutes > 0 ? `, ${minutes} Min.` : ''}`;
    } else {
      timeStr = `${Math.max(1, minutes)} Min.`;
    }

    const formattedExpDate = expDate.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `Noch ${timeStr} verfügbar (bis ${formattedExpDate} Uhr)`;
  };

  const renderHeatmapStatus = () => {
    switch ((heatmapStatus || '').toUpperCase()) {
      case 'QUEUED':
        return <span className="text-yellow-500 text-xs ml-2">In Warteschlange...</span>;
      case 'PROCESSING':
        return <span className="text-blue-500 text-xs ml-2">Wird verarbeitet (ca. 12 Min)...</span>;
      case 'DONE':
        return null;
      case 'ERROR':
        return <span className="text-red-500 text-xs ml-2">Fehler</span>;
      default:
        return null;
    }
  };

  const mainButtons = [
    {
      key: 'detect-highlights',
      show: !isExternalGuest && isAdmin && !!firstChunk?.video_path,
      onClick: () => setIsHighlightSpeedModalOpen(true),
      disabled: isGeneratingHighlights || highlightJob?.status === 'PROCESSING',
      className: `flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border border-zinc-800 ${
        (isGeneratingHighlights || highlightJob?.status === 'PROCESSING')
          ? 'opacity-90 text-amber-400 bg-amber-500/10 border-amber-500/30'
          : 'hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30'
      }`,
      title: hasAutoHighlights
        ? "Erneut nach KI-Highlights suchen (bestehende Highlights bleiben unverändert erhalten)"
        : "Automatische KI-Highlights (Tore, Ecken, Elfmeter) via YOLOv8 erkennen",
      icon: <Sparkles className={`w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-400 ${(isGeneratingHighlights || highlightJob?.status === 'PROCESSING') ? 'animate-spin' : ''}`} />,
      label: (isGeneratingHighlights || highlightJob?.status === 'PROCESSING')
        ? `KI-Highlights (${Math.round(highlightJob?.progress || 0)}%)`
        : hasAutoHighlights ? "KI-Highlights erneut suchen" : "KI-Highlights",
    },
    {
      key: 'heatmap-gen',
      show: !isExternalGuest && isAdmin && heatmapStatus !== 'DONE' && settings?.module_heatmap_enabled,
      onClick: handleGenerateHeatmap,
      disabled: heatmapStatus === 'QUEUED' || heatmapStatus === 'PROCESSING',
      className: `flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border border-zinc-800 ${(heatmapStatus === 'QUEUED' || heatmapStatus === 'PROCESSING') ? 'opacity-50 cursor-not-allowed text-zinc-500' : 'hover:bg-white/5 text-zinc-400 hover:text-orange-500'}`,
      title: "Heatmap generieren",
      icon: <Flame className="w-3.5 h-3.5 lg:w-4 lg:h-4" />,
      label: "Heatmap generieren",
      extra: renderHeatmapStatus(),
    },
    {
      key: 'fisheye',
      show: !isExternalGuest && isAdmin && settings?.module_fisheye_enabled,
      onClick: () => setIsFisheyeModalOpen(true),
      className: "flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border border-zinc-800 hover:bg-white/5 text-zinc-400 hover:text-blue-500",
      title: "Fisheye korrigieren",
      icon: <Aperture className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-500" />,
      label: "Fisheye korrigieren",
    },
    {
      key: 'adjustments',
      show: !isExternalGuest && isAdmin && settings?.module_video_color_enabled,
      onClick: () => setIsAdjustmentModalOpen(true),
      className: "flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border border-zinc-800 hover:bg-white/5 text-zinc-400 hover:text-purple-500",
      title: "Farbanpassungen",
      icon: <Sliders className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-purple-500" />,
      label: "Farbe",
    },
    {
      key: 'download',
      show: !!(activeStream?.video_path || firstChunk?.video_path),
      href: getMediaUrl(activeStream?.video_path || firstChunk?.video_path),
      download: true,
      className: "flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border border-zinc-800 hover:bg-white/5 text-zinc-400 hover:text-white",
      title: "Video herunterladen",
      icon: <Download className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-400" />,
      label: "Download",
    },
    {
      key: 'edit',
      show: !isExternalGuest && isAdmin,
      onClick: () => setIsEditModalOpen(true),
      className: "flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border border-zinc-800 hover:bg-white/5 text-zinc-400 hover:text-blue-400",
      title: "Match bearbeiten / Video ersetzen",
      icon: <Pencil className="w-3.5 h-3.5 lg:w-4 lg:h-4" />,
      label: "Bearbeiten",
    },
    {
      key: 'subscribe',
      show: !isExternalGuest && !!user,
      onClick: handleSubscription,
      className: `flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border border-zinc-800 ${isSubscribed ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'hover:bg-white/5 text-zinc-400 hover:text-white'}`,
      title: isSubscribed ? "Abonnement beenden" : "Match abonnieren",
      icon: isSubscribed ? <BellOff className="w-3.5 h-3.5 lg:w-4 lg:h-4" /> : <Bell className="w-3.5 h-3.5 lg:w-4 lg:h-4" />,
      label: isSubscribed ? "Abonniert" : "Abonnieren",
    },
    {
      key: 'draw',
      show: !isExternalGuest && canEdit,
      onClick: toggleDrawingMode,
      className: `flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border border-zinc-800 ${isDrawingMode && !editingEventId ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-zinc-400 hover:text-blue-400'}`,
      title: "Zeichenmodus aktivieren",
      icon: <PenTool className="w-3.5 h-3.5 lg:w-4 lg:h-4" />,
      label: "Zeichnen",
    },
    {
      key: 'mark',
      show: !isExternalGuest && canComment,
      onClick: handleOpenModal,
      className: "flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 hover:bg-white/5 rounded-md text-[11px] font-bold text-zinc-400 hover:text-yellow-400 transition-all border border-zinc-800",
      title: "Aktuellen Moment markieren / kommentieren",
      icon: <Flag className="w-3.5 h-3.5 lg:w-4 lg:h-4" />,
      label: "Kommentieren",
    },
    {
      key: 'heatmap-toggle',
      show: !isExternalGuest && settings?.module_heatmap_enabled,
      onClick: () => setShowHeatmap(!showHeatmap),
      className: `flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${showHeatmap ? 'bg-blue-500 text-white' : 'hover:bg-white/5 text-zinc-400 hover:text-white'}`,
      title: "Heatmap umschalten",
      icon: <Activity className="w-3.5 h-3.5 lg:w-4 lg:h-4" />,
      label: "Heatmap",
    },
    {
      key: 'share',
      show: !isExternalGuest && canShare,
      onClick: () => setIsShareModalOpen(true),
      className: "flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 hover:bg-white/5 rounded-md text-[11px] font-bold text-zinc-400 hover:text-white transition-all border border-zinc-800",
      title: "Match teilen",
      icon: <Share2 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />,
      label: "Teilen",
    },
  ];

  return (
    <main className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden relative">
      {/* Feste Top Bar */}
      <nav className="h-14 px-3 sm:px-4 lg:px-6 flex items-center justify-between border-b border-white/10 bg-[#09090b] z-40 shrink-0 relative">
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 shrink-0 mr-2 sm:mr-4">
          <Link 
            href="/" 
            className="p-1.5 -ml-1 sm:ml-0 hover:bg-white/10 rounded-full transition-all text-zinc-400 hover:text-white flex items-center justify-center shrink-0"
            title="Zurück zur Übersicht"
          >
            <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
          </Link>

          <button 
            className={`md:hidden p-1.5 sm:p-2 rounded-md transition-all ${isToolbarOpen ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} 
            onClick={() => setIsToolbarOpen(!isToolbarOpen)}
            title="Werkzeuge umschalten"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 lg:gap-4 min-w-0">
             <div className="hidden sm:block shrink-0">
               <Image
                  src="/icon.png"
                  alt="MatchTracker Icon"
                  width={24}
                  height={24}
                  className="object-contain"
                />
             </div>
            <div className="flex flex-col">
              <h1 className="text-[12px] lg:text-[13px] font-bold tracking-tight text-white/90 leading-none mb-1 max-w-[120px] sm:max-w-xs lg:max-w-md truncate">
                {match.name || "Match Analyse"}
                {match.team_name && <span className="ml-1 lg:ml-2 text-blue-400 opacity-80">({match.team_name})</span>}
              </h1>
              <div className="text-[9px] lg:text-[10px] text-zinc-500 font-medium uppercase tracking-wider flex gap-1.5 lg:gap-2 items-center">
                {formattedDate && <span className="hidden sm:inline">{formattedDate}</span>}
                {formattedDateShort && <span className="sm:hidden">{formattedDateShort}</span>}
                {match.video_quality && (
                  <>
                    <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                    <span className="text-zinc-400">{match.video_quality}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right: Expiration Info for external users & conversion status */}
        <div className="flex items-center gap-3">
          {isExternalGuest ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-xl text-xs font-bold shadow-inner">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{getRemainingTimeText(match.password_expires_at)}</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0">
              <ConversionStatus />
            </div>
          )}

          {/* Panel Toggle Button (Only for authenticated users) */}
          {!isExternalGuest && (
            <div className="flex items-center">
              <div className="w-px h-6 bg-zinc-800 mx-2"></div>
              <button
                onClick={() => setIsEventListOpen(!isEventListOpen)}
                className={`p-2 rounded-md transition-all ${isEventListOpen ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                title={isEventListOpen ? "Event-Liste ausblenden" : "Event-Liste einblenden"}
              >
                {isEventListOpen ? <PanelRightClose className="w-4 h-4 lg:w-5 lg:h-5" /> : <PanelRightOpen className="w-4 h-4 lg:w-5 lg:h-5" />}
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isToolbarOpen && (
          <div 
            className="md:hidden absolute inset-0 bg-black/60 z-30 transition-opacity" 
            onClick={() => setIsToolbarOpen(false)} 
          />
        )}
        
        {/* Left Sidebar - Tools */}
        <div
          className={`h-full bg-[#09090b]/90 backdrop-blur-md border-r border-white/10 transition-all duration-300 ease-in-out z-40 flex flex-col overflow-hidden
            md:relative md:flex-shrink-0
            ${isToolbarOpen ? 'w-64 max-w-[80vw]' : 'w-0 md:w-16'}
            ${isToolbarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            absolute left-0 top-0
          `}
        >
          <div className="flex flex-col gap-2 h-full overflow-y-auto overflow-x-hidden p-2 md:p-3 w-full">
            <div className="flex items-center justify-between md:hidden mb-2 px-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Werkzeuge</span>
              <button onClick={() => setIsToolbarOpen(false)} className="p-2 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`hidden md:block mb-4 mt-2 transition-opacity duration-300 overflow-hidden ${isToolbarOpen ? 'opacity-100' : 'opacity-0 h-0 mb-0 mt-0'}`}>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 whitespace-nowrap block">Aktionen & Tools</span>
            </div>
            
            {mainButtons.filter(b => b.show).map(button => {
              const ButtonComponent = button.href ? 'a' : 'button';
              
              const baseClass = button.className.split(' ').filter(c => !c.includes('px-') && !c.includes('py-') && !c.includes('text-')).join(' ');
              
              const customClass = `${baseClass} w-full flex items-center mb-1.5 transition-all rounded-xl
                ${isToolbarOpen ? 'px-3 py-2.5 justify-start' : 'p-2 justify-center'}`;

              return (
                <ButtonComponent
                  key={button.key}
                  // @ts-ignore
                  onClick={button.onClick}
                  href={button.href}
                  download={button.download}
                  disabled={button.disabled}
                  title={button.title || button.label}
                  className={customClass}
                >
                  <div className="shrink-0 flex items-center justify-center">
                    {button.icon}
                  </div>
                  <div className={`flex flex-col items-start text-left truncate transition-all duration-300 overflow-hidden ml-3
                    ${isToolbarOpen ? 'opacity-100 w-auto max-w-[180px]' : 'opacity-0 w-0 md:hidden'}`}>
                     <span className="text-xs font-medium text-white/90 truncate">{button.label}</span>
                     {button.extra && <span className="text-[10px] text-zinc-500 mt-0.5 truncate">{button.extra}</span>}
                  </div>
                </ButtonComponent>
              );
            })}
            
            {/* Desktop Bottom Toggle */}
            <div className="mt-auto hidden md:flex items-center w-full pt-4 border-t border-white/5">
              <button 
                className={`w-full flex items-center transition-all p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-zinc-800 ${isToolbarOpen ? 'justify-end pr-4' : 'justify-center'}`} 
                onClick={() => setIsToolbarOpen(!isToolbarOpen)}
                title="Sidebar ein-/ausklappen"
              >
                {isToolbarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Player Area */}
        <div className="flex-1 relative bg-black h-full overflow-hidden min-w-0">
          {/* Live KI-Highlights Floating Progress Indicator */}
          {highlightJob?.status === 'PROCESSING' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-md w-11/12 bg-zinc-950/90 border border-amber-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  <span>KI-Highlight-Erkennung läuft</span>
                </div>
                <span className="font-mono text-xs font-black text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  {Math.round(highlightJob.progress || 0)}%
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800 mb-1.5 shadow-inner">
                <div
                  className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                  style={{ width: `${Math.max(5, highlightJob.progress || 0)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                <span className="truncate max-w-[280px]">
                  {highlightJob.current_step_text || 'YOLOv8 analysiert Video-Frames...'}
                </span>
                {highlightJob.events_detected > 0 && (
                  <span className="text-amber-300 font-bold shrink-0 ml-2">
                    {highlightJob.events_detected} {highlightJob.events_detected === 1 ? 'Aktion' : 'Aktionen'} erkannt
                  </span>
                )}
              </div>
            </div>
          )}

          {firstChunk ? (
            <>
              {availableStreams.length > 1 && (
                <div className="absolute top-4 left-4 z-40 flex items-center gap-1.5 p-1 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                  {availableStreams.map((stream: any) => {
                    const isActive = (activeStream?.id === stream.id);
                    return (
                      <button
                        key={stream.id}
                        type="button"
                        onClick={() => handleSwitchStream(stream.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {stream.label || (stream.id === '32x9' ? '🏟️ Panorama' : '📹 Standard')}
                      </button>
                    );
                  })}
                </div>
              )}

              <MatchPlayer
                videoUrl={currentVideoUrl}
                hlsPlaylistUrl={currentHlsUrl}
                trackingUrl={firstChunk.tracking_path ? getMediaUrl(firstChunk.tracking_path) : ''}
                events={matchData.events || []}
                onTimeUpdate={(ms) => setCurrentTimeMs(ms)}
                seekTo={seekTo}
                isDrawingMode={isDrawingMode}
                initialDrawingShapes={initialDrawingShapes}
                onCancelDrawing={handleCancelDrawing}
                onSaveDrawing={handleDrawingSaveRequest}
                adjustments={videoAdjustments}
              />
              {analyticsData && (
                <HeatmapOverlay
                  data={analyticsData.player_positions}
                  visible={showHeatmap}
                  onDeleteHeatmap={handleDeleteHeatmap}
                  isAdmin={isAdmin}
                />
              )}

            </>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              Kein Video verfügbar.
            </div>
          )}
        </div>

        {/* Sidebar - Match Events (Only for authenticated users) */}
        {!isExternalGuest && (
          <div
            className={`h-full bg-[#09090b]/80 backdrop-blur-md border-l border-white/10 transition-all duration-300 ease-in-out z-30
              md:relative md:flex-shrink-0
              ${isEventListOpen ? 'w-4/5 max-w-sm md:w-80' : 'w-0'}
              ${isEventListOpen ? 'translate-x-0' : 'translate-x-full'}
              absolute right-0 top-0 md:translate-x-0
            `}
          >
            {isEventListOpen && (
              <EventList
                events={matchData.events || []}
                onEventClick={(timeMs) => {
                  setSeekTo(timeMs);
                  setTimeout(() => setSeekTo(null), 100);
                  if (window.innerWidth < 768) {
                    setIsEventListOpen(false);
                  }
                }}
                onDeleteEvent={canEdit ? handleDeleteRequest : undefined}
                onEditEvent={canEdit ? handleEditEvent : undefined}
                currentTimeMs={currentTimeMs}
                onCloseMobile={() => setIsEventListOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <>
          <AddCommentModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingEventId(null);
              setDrawingShapesToSave([]);
            }}
            onSave={handleSaveMarker}
            timeMs={markerTimeMs}
            initialText={editingMarkerText}
            initialCategory={editingMarkerCategory}
            headingLabel={editingEventId ? "Event bearbeiten" : "Moment markieren"}
            players={teamPlayers}
          />

          <HighlightSpeedModal
            isOpen={isHighlightSpeedModalOpen}
            onClose={() => setIsHighlightSpeedModalOpen(false)}
            onSelect={handleGenerateHighlights}
          />

          <ConfirmModal
            isOpen={isConfirmOpen}
            title="Event löschen"
            message="Bist du sicher, dass du dieses Event endgültig löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden."
            onConfirm={confirmDelete}
            onCancel={() => setIsConfirmOpen(false)}
          />

          {canShare && (
             <ShareModal
               isOpen={isShareModalOpen}
               onClose={() => setIsShareModalOpen(false)}
               matchName={match.name || `Match ${match.id}`}
               matchId={match.id}
               isPasswordProtected={match.is_password_protected || false}
               currentPassword={match.password || ''}
               passwordExpiresAt={match.password_expires_at}
               onSavePasswordProtection={handleSavePasswordProtection}
             />
          )}

          {isFisheyeModalOpen && id && (
            <FisheyeCorrectionModal
              isOpen={isFisheyeModalOpen}
              onClose={() => setIsFisheyeModalOpen(false)}
              matchId={id as string}
            />
          )}

          {isAdjustmentModalOpen && id && (
            <VideoAdjustmentModal
              isOpen={isAdjustmentModalOpen}
              onClose={() => setIsAdjustmentModalOpen(false)}
              matchId={id as string}
              initialAdjustments={videoAdjustments}
              videoUrl={firstChunk?.video_path ? getMediaUrl(firstChunk.video_path) : ''}
              onSave={(newAdjustments) => setVideoAdjustments(newAdjustments)}
            />
          )}

          {isEditModalOpen && match && (
            <EditMatchModal
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              match={match}
              onSave={() => {
                setIsEditModalOpen(false);
                loadData();
              }}
            />
          )}
        </>
      )}

      <AlertDialog
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </main>
  );
}

