import axios from 'axios';

const API_BASE_URL = '/api';

export const getMediaUrl = (path?: string | null) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  let normalized = path.replace(/^(\/)?backend\//, '').replace(/^\/+/, '');
  if (!normalized.startsWith('uploads/')) {
    normalized = `uploads/${normalized}`;
  }
  return `/api/${normalized}`;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add a request interceptor to include the token and match password in all requests
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('matchtracker_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      let matchId = new URLSearchParams(window.location.search).get('id');
      if (!matchId && config.url) {
        const matchUrlMatch = config.url.match(/\/(?:matches|analytics|videos)\/([a-zA-Z0-9_-]+)/);
        if (matchUrlMatch) {
          matchId = matchUrlMatch[1];
        }
      }
      if (matchId) {
        const storedPass = sessionStorage.getItem(`match_password_${matchId}`);
        if (storedPass) {
          config.headers['X-Match-Password'] = storedPass;
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error || new Error('Request Error'));
  }
);

// Add a response interceptor to handle 401 Unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if the error is a 401 Unauthorized
    if (error.response && error.response.status === 401) {
      const originalRequestUrl = error.config?.url || '';

      // Define URLs or pages that should NOT trigger a redirect on 401
      if (typeof window !== 'undefined') {
        const currentPath = (window.location.pathname || '').replace(/\/$/, '') || '/';
        const isMatchesPage = currentPath.startsWith('/matches');

        const isMatchDetailOrAnalyticsRequest =
          originalRequestUrl &&
          (originalRequestUrl.match(/^\/matches\/[^/]+/) || originalRequestUrl.match(/^\/analytics\/[^/]+\/heatmap/));

        if (isMatchesPage || isMatchDetailOrAnalyticsRequest) {
          return Promise.reject(error);
        }

        const isPublicPage =
          currentPath === '/login' ||
          currentPath === '/register' ||
          currentPath === '/reset-password' ||
          currentPath.startsWith('/install');

        localStorage.removeItem('matchtracker_token');
        localStorage.removeItem('matchtracker_user');
        delete api.defaults.headers.common['Authorization'];

        // Only redirect if not already on a public page to prevent infinite loops
        if (!isPublicPage) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);


// Helper to handle potential non-JSON responses
const safeJsonParse = (data: any) => {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      console.error("Server returned HTML instead of JSON. Check the network tab for CGI or Proxy errors.");
      return { error: "Server Error", details: "HTML response" };
    }

    try {
      // First try standard JSON.parse
      return JSON.parse(trimmed);
    } catch (e: any) {
      // If it fails with "Expected property name", it might be using single quotes
      // We don't want to use eval() or a complex regex, but we can log the error more clearly
      console.error("JSON Parse Error:", e.message);
      console.error("Invalid data sample:", trimmed.substring(0, 100));

      // Fallback: if it's not JSON, maybe it's just a string message from the server
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return trimmed;
      }

      return { error: "Invalid JSON response", details: trimmed, parseError: e.message };
    }
  }
  return data;
};

// Auth
export const registerUser = async (
  username: string, 
  email: string, 
  password: string, 
  firstName: string, 
  lastName: string, 
  teamId?: string, 
  role: string = 'TRAINER'
) => {
  const response = await api.post('/auth/register', { 
    username, 
    email, 
    password, 
    first_name: firstName, 
    last_name: lastName, 
    team_id: teamId || null, 
    role: role.toUpperCase() 
  });
  return safeJsonParse(response.data);
};

export const adminCreateUser = async (userData: {
  username: string;
  email: string;
  password: string;
  role: string;
  first_name: string;
  last_name: string;
  team_ids: string[];
}) => {
  const response = await api.post('/admin/users', userData);
  return safeJsonParse(response.data);
};

export const forgotPassword = async (email: string) => {
  const response = await api.post('/auth/forgot-password', { email });
  return safeJsonParse(response.data);
};

export const resetPassword = async (token: string, newPassword: string) => {
  const response = await api.post('/auth/reset-password', { token, new_password: newPassword });
  return safeJsonParse(response.data);
};

export const loginUser = async (username: string, password: string) => {

  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);

  const response = await api.post('/auth/login', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return safeJsonParse(response.data);
};

// Admin
export const getAllUsers = async () => {
  const response = await api.get('/admin/users');
  return safeJsonParse(response.data);
};

export const getOnlineStats = async () => {
  const response = await api.get('/admin/online-stats');
  return safeJsonParse(response.data);
};

export const updateUserRole = async (userId: string, role: string) => {
  const response = await api.put(`/admin/users/${userId}/role`, { role });
  return safeJsonParse(response.data);
};

export const deleteUser = async (userId: string) => {
  const response = await api.delete(`/admin/users/${userId}`);
  return safeJsonParse(response.data);
};

// System Settings
export const getSystemSettings = async () => {
  const response = await api.get('/admin/settings');
  return safeJsonParse(response.data);
};

export const updateSystemSettings = async (settings: any) => {
  const response = await api.put('/admin/settings', settings);
  return safeJsonParse(response.data);
};

export const testSmtpEmail = async (smtpConfig?: any) => {
  const response = await api.post('/admin/test-email', smtpConfig || {});
  return safeJsonParse(response.data);
};

export const approveUser = async (userId: string, isApproved: boolean) => {
  const response = await api.put(`/admin/users/${userId}/approve`, { is_approved: isApproved });
  return safeJsonParse(response.data);
};

export const deleteMatch = async (matchId: string) => {
  const response = await api.delete(`/admin/matches/${matchId}`);
  return safeJsonParse(response.data);
};

export const uploadFullMatch = async (formData: FormData, onUploadProgress: (progressEvent: any) => void) => {
  const response = await api.post('/admin/matches', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
  return safeJsonParse(response.data);
};

export const replaceMatchVideo = async (matchId: string, formData: FormData, onUploadProgress?: (progressEvent: any) => void) => {
  const response = await api.post(`/admin/matches/${matchId}/replace-video`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
  return safeJsonParse(response.data);
};

export const deleteMatchStream = async (matchId: string, streamId: string) => {
  const response = await api.delete(`/admin/matches/${matchId}/streams/${streamId}`);
  return safeJsonParse(response.data);
};



// Matches
export const getMatches = async (params?: { category?: string; team_id?: string }) => {
  try {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'ALL') query.append('category', params.category);
    if (params?.team_id && params.team_id !== 'ALL') query.append('team_id', params.team_id);
    const url = `/matches${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await api.get(url);
    return safeJsonParse(response.data);
  } catch (error: any) {
    console.error("API Error in getMatches:", error);
    if (error.response && error.response.data) {
        return { 
            error: "Backend Fehler", 
            details: typeof error.response.data === 'string' ? error.response.data : (error.response.data.detail || JSON.stringify(error.response.data)) 
        };
    }
    return { error: "Verbindung zum Server fehlgeschlagen", details: error.message };
  }
};

export const getMatchDetails = async (id: string) => {
  const response = await api.get(`/matches/${id}`);
  return safeJsonParse(response.data);
};

export const updateMatchDetails = async (id: string, details: any) => {
  const response = await api.put(`/matches/${id}`, details);
  return safeJsonParse(response.data);
};

export const updateMatchPasswordProtection = async (id: string, isProtected: boolean, password?: string, expiresAt?: string | null) => {
  const response = await api.put(`/matches/${id}/password-protection`, {
    is_protected: isProtected,
    password: password,
    expires_at: expiresAt || null
  });
  return safeJsonParse(response.data);
};

export const verifyMatchPassword = async (id: string, password: string) => {
  const response = await api.post(`/matches/${id}/verify-password`, { password });
  const data = safeJsonParse(response.data);

  if (data && (data.status === 'success' || data.token)) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`match_password_${id}`, password);
    }
    if (data.token) {
      localStorage.setItem('matchtracker_token', data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    }
  }
  return data;
};

export const getMatchAnalytics = async (id: string) => {
  const response = await api.get(`/analytics/${id}/heatmap`);
  return safeJsonParse(response.data);
};

export const addMatchEvent = async (matchId: string, eventType: string, videoTimeMs: number, details: any = {}) => {
  const response = await api.post(`/matches/${matchId}/events`, {
    event_type: eventType,
    video_time_ms: videoTimeMs,
    details: details
  });
  return safeJsonParse(response.data);
};

export const updateMatchEvent = async (matchId: string, eventId: string, details: any) => {
  const response = await api.put(`/matches/${matchId}/events/${eventId}`, { details });
  return safeJsonParse(response.data);
};

export const deleteMatchEvent = async (match_id: string, event_id: string) => {
  const response = await api.delete(`/matches/${match_id}/events/${event_id}`);
  return safeJsonParse(response.data);
};

// Subscriptions
export const subscribeToMatch = async (match_id: string) => {
  const response = await api.post(`/matches/${match_id}/subscribe`);
  return safeJsonParse(response.data);
};

export const unsubscribeFromMatch = async (match_id: string) => {
  const response = await api.post(`/matches/${match_id}/unsubscribe`);
  return safeJsonParse(response.data);
};

export const generateHeatmap = async (matchId: string) => {
    const response = await api.post(`/matches/${matchId}/generate-heatmap`);
    return safeJsonParse(response.data);
};

export const deleteHeatmap = async (matchId: string) => {
    const response = await api.delete(`/matches/${matchId}/heatmap`);
    return safeJsonParse(response.data);
};


// Video Correction
export const getMatchPreview = async (matchId: string) => {
    const response = await api.get(`/videos/${matchId}/preview`);
    return safeJsonParse(response.data);
};

export const correctFisheye = async (matchId: string, params: any) => {
    const response = await api.post(`/videos/${matchId}/correct-fisheye`, params);
    return safeJsonParse(response.data);
};

export const updateVideoAdjustments = async (matchId: string, adjustments: { brightness: number, contrast: number, saturation: number, hue: number }) => {
    const response = await api.post(`/videos/${matchId}/adjustments`, adjustments);
    return safeJsonParse(response.data);
};

// Teams API
export const getTeams = async () => {
  const response = await api.get('/teams');
  return safeJsonParse(response.data);
};

export const getMyTeams = async () => {
  const response = await api.get('/teams/my');
  return safeJsonParse(response.data);
};

export const createTeam = async (name: string, age_group?: string) => {
  const response = await api.post('/teams', { name, age_group });
  return safeJsonParse(response.data);
};

export const updateTeam = async (teamId: string, data: { name?: string, age_group?: string }) => {
  const response = await api.put(`/teams/${teamId}`, data);
  return safeJsonParse(response.data);
};

export const deleteTeam = async (teamId: string) => {
  const response = await api.delete(`/teams/${teamId}`);
  return safeJsonParse(response.data);
};

// User Profile API
export const getMyProfile = async () => {
  const response = await api.get('/users/me');
  return safeJsonParse(response.data);
};

export const updateMyProfile = async (data: { 
  username?: string; 
  email?: string;
  first_name?: string;
  last_name?: string;
  ai_provider?: string;
  ai_api_key?: string;
  ai_model_name?: string;
}) => {
  const response = await api.put('/users/me', data);
  return safeJsonParse(response.data);
};

export const updateMyPassword = async (data: { current_password: string; new_password: string }) => {
  const response = await api.put('/users/me/password', data);
  return safeJsonParse(response.data);
};

export const updateMyPreferences = async (data: { notify_on_new_video?: boolean; notify_on_analysis?: boolean }) => {
  const response = await api.put('/users/me/preferences', data);
  return safeJsonParse(response.data);
};

export const uploadMyAvatar = async (formData: FormData) => {
  const response = await api.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return safeJsonParse(response.data);
};


export const updateUserTeams = async (userId: string, teamsData: Array<string | { team_id: string; can_edit: boolean }>) => {
  let payload: any = {};
  if (teamsData.length > 0 && typeof teamsData[0] === 'object') {
    payload = { teams: teamsData };
  } else {
    payload = { team_ids: teamsData };
  }
  const response = await api.put(`/admin/users/${userId}/teams`, payload);
  return safeJsonParse(response.data);
};

export const sendTeamRequest = async (teamId: string, message?: string) => {
  const response = await api.post('/users/me/team-request', { team_id: teamId, message });
  return safeJsonParse(response.data);
};

// Training API
export const getExercises = async (params?: { age_group?: string; focus_area?: string; min_players?: number; search?: string }) => {
  const query = new URLSearchParams();
  if (params?.age_group) query.append('age_group', params.age_group);
  if (params?.focus_area) query.append('focus_area', params.focus_area);
  if (params?.min_players) query.append('min_players', params.min_players.toString());
  if (params?.search) query.append('search', params.search);
  const response = await api.get(`/training/exercises${query.toString() ? `?${query.toString()}` : ''}`);
  return safeJsonParse(response.data);
};

export const createExercise = async (data: any) => {
  const response = await api.post('/training/exercises', data);
  return safeJsonParse(response.data);
};

export const getExercise = async (id: number) => {
  const response = await api.get(`/training/exercises/${id}`);
  return safeJsonParse(response.data);
};

export const updateExercise = async (id: number, data: any) => {
  const response = await api.put(`/training/exercises/${id}`, data);
  return safeJsonParse(response.data);
};

export const deleteExercise = async (id: number) => {
  const response = await api.delete(`/training/exercises/${id}`);
  return safeJsonParse(response.data);
};

export const getTrainingSessions = async (team_id?: string) => {
  const url = team_id ? `/training/sessions?team_id=${team_id}` : '/training/sessions';
  const response = await api.get(url);
  return safeJsonParse(response.data);
};

export const createTrainingSession = async (data: any) => {
  const response = await api.post('/training/sessions', data);
  return safeJsonParse(response.data);
};

export const getTrainingSession = async (id: number) => {
  const response = await api.get(`/training/sessions/${id}`);
  return safeJsonParse(response.data);
};

export const updateTrainingSession = async (id: number, data: any) => {
  const response = await api.put(`/training/sessions/${id}`, data);
  return safeJsonParse(response.data);
};

export const deleteTrainingSession = async (id: number) => {
  const response = await api.delete(`/training/sessions/${id}`);
  return safeJsonParse(response.data);
};

export const toggleShareTrainingSession = async (id: number) => {
  const response = await api.post(`/training/sessions/${id}/toggle-share`);
  return safeJsonParse(response.data);
};

// Organizer API
export const getCalendarEvents = async (params?: { team_id?: string; event_type?: string }) => {
  const query = new URLSearchParams();
  if (params?.team_id) query.append('team_id', params.team_id);
  if (params?.event_type) query.append('event_type', params.event_type);
  const response = await api.get(`/organizer/events${query.toString() ? `?${query.toString()}` : ''}`);
  return safeJsonParse(response.data);
};

export const createCalendarEvent = async (data: any) => {
  const response = await api.post('/organizer/events', data);
  return safeJsonParse(response.data);
};

export const updateCalendarEvent = async (id: number, data: any) => {
  const response = await api.put(`/organizer/events/${id}`, data);
  return safeJsonParse(response.data);
};

export const deleteCalendarEvent = async (id: number, deleteFollowing: boolean = false) => {
  const response = await api.delete(`/organizer/events/${id}?delete_following=${deleteFollowing}`);
  return safeJsonParse(response.data);
};

export const importFussballDeMatches = async (urlOrTeamId: string, teamId: string) => {
  const response = await api.post('/organizer/import/fussball-de', {
    url_or_team_id: urlOrTeamId,
    team_id: teamId
  });
  return safeJsonParse(response.data);
};

export const subscribePushNotifications = async (subscription: { endpoint: string; p256dh: string; auth: string }) => {
  const response = await api.post('/organizer/push/subscribe', subscription);
  return safeJsonParse(response.data);
};

export const unsubscribePushNotifications = async (endpoint: string) => {
  const response = await api.post('/organizer/push/unsubscribe', { endpoint });
  return safeJsonParse(response.data);
};

export const sendTestPushNotification = async () => {
  const response = await api.post('/organizer/push/test');
  return safeJsonParse(response.data);
};

export const cleanupOrganizerMatches = async (teamId?: string | null, onlyFussballDe: boolean = false) => {
  const response = await api.post('/organizer/events-cleanup/matches', {
    team_id: teamId || null,
    only_fussball_de: onlyFussballDe
  });
  return safeJsonParse(response.data);
};

// --- Player Management API ---

export const getPlayers = async (params?: { team_id?: string; search?: string }) => {
  const query = new URLSearchParams();
  if (params?.team_id) query.append('team_id', params.team_id);
  if (params?.search) query.append('search', params.search);
  const response = await api.get(`/players${query.toString() ? `?${query.toString()}` : ''}`);
  return safeJsonParse(response.data);
};

export const getPlayer = async (id: string) => {
  const response = await api.get(`/players/${id}`);
  return safeJsonParse(response.data);
};

export const createPlayer = async (data: any) => {
  const response = await api.post('/players', data);
  return safeJsonParse(response.data);
};

export const updatePlayer = async (id: string, data: any) => {
  const response = await api.put(`/players/${id}`, data);
  return safeJsonParse(response.data);
};

export const transferPlayerTeam = async (id: string, team_id: string) => {
  const response = await api.put(`/players/${id}/transfer`, { team_id });
  return safeJsonParse(response.data);
};

export const deletePlayer = async (id: string) => {
  const response = await api.delete(`/players/${id}`);
  return safeJsonParse(response.data);
};

export const importDfbCsv = async (team_id: string, file: File) => {
  const formData = new FormData();
  formData.append('team_id', team_id);
  formData.append('file', file);
  const response = await api.post('/players/import-dfb-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return safeJsonParse(response.data);
};

export const getPlayerAttendance = async (player_id: string) => {
  const response = await api.get(`/players/${player_id}/attendance`);
  return safeJsonParse(response.data);
};

export const recordAttendance = async (data: any) => {
  const response = await api.post('/players/attendance', data);
  return safeJsonParse(response.data);
};

export const toggleTodayAttendance = async (player_id: string, event_type: string = 'TRAINING') => {
  const response = await api.post(`/players/${player_id}/toggle-today-attendance?event_type=${event_type}`);
  return safeJsonParse(response.data);
};

export const getPlayerEvaluations = async (player_id: string) => {
  const response = await api.get(`/players/${player_id}/evaluations`);
  return safeJsonParse(response.data);
};

export const createPlayerEvaluation = async (player_id: string, data: any) => {
  const response = await api.post(`/players/${player_id}/evaluations`, data);
  return safeJsonParse(response.data);
};

export const updatePlayerEvaluation = async (eval_id: number, data: any) => {
  const response = await api.put(`/players/evaluations/${eval_id}`, data);
  return safeJsonParse(response.data);
};

export const syncBirthdaysToOrganizer = async () => {
  const response = await api.post('/players/sync-birthdays-to-organizer');
  return safeJsonParse(response.data);
};

export const approvePlayerEvaluation = async (eval_id: number) => {
  const response = await api.post(`/players/evaluations/${eval_id}/approve`);
  return safeJsonParse(response.data);
};

export const deletePlayerEvaluation = async (eval_id: number) => {
  const response = await api.delete(`/players/evaluations/${eval_id}`);
  return safeJsonParse(response.data);
};

export const getPlayerTaggedEvents = async (playerId: string) => {
  const response = await api.get(`/players/${playerId}/tagged_events`);
  return safeJsonParse(response.data);
};

export const updateUserModulePermissions = async (userId: string, modulePermissions: Record<string, boolean>) => {
  const response = await api.put(`/admin/users/${userId}/permissions`, { module_permissions: modulePermissions });
  return safeJsonParse(response.data);
};

export const triggerFtpBackup = async () => {
  const response = await api.post('/admin/backup/trigger-ftp');
  return safeJsonParse(response.data);
};

export const testFtpConnection = async (data: { host: string; port?: number; user: string; password?: string; path?: string }) => {
  const response = await api.post('/admin/backup/test-ftp', data);
  return safeJsonParse(response.data);
};

export const processVoiceOrText = async (formData: FormData) => {
  const response = await api.post('/ai/voice-process', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return safeJsonParse(response.data);
};

export const checkSystemUpdates = async () => {
  const response = await api.get('/admin/updates/check');
  return safeJsonParse(response.data);
};

export const applySystemUpdates = async () => {
  const response = await api.post('/admin/updates/apply');
  return safeJsonParse(response.data);
};

export const getSystemUpdateStatus = async () => {
  const response = await api.get('/admin/updates/status');
  return safeJsonParse(response.data);
};

export const getSystemChangelog = async () => {
  const response = await api.get('/admin/system/changelog');
  return safeJsonParse(response.data);
};

export const scanExerciseCard = async (formData: FormData) => {
  const response = await api.post('/ai/scan-exercise', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return safeJsonParse(response.data);
};

// --- Tactics Board API ---

export const getTacticsPreferences = async () => {
  const response = await api.get('/tactics/preferences');
  return safeJsonParse(response.data);
};

export const saveTacticsPreferences = async (data: any) => {
  const response = await api.put('/tactics/preferences', data);
  return safeJsonParse(response.data);
};

export const getTacticsBoards = async (params?: { category?: string; team_id?: string }) => {
  const query = new URLSearchParams();
  if (params?.category) query.append('category', params.category);
  if (params?.team_id) query.append('team_id', params.team_id);
  const response = await api.get(`/tactics/boards${query.toString() ? `?${query.toString()}` : ''}`);
  return safeJsonParse(response.data);
};

export const getTacticsBoard = async (id: string) => {
  const response = await api.get(`/tactics/boards/${id}`);
  return safeJsonParse(response.data);
};

export const createTacticsBoard = async (data: any) => {
  const response = await api.post('/tactics/boards', data);
  return safeJsonParse(response.data);
};

export const updateTacticsBoard = async (id: string, data: any) => {
  const response = await api.put(`/tactics/boards/${id}`, data);
  return safeJsonParse(response.data);
};

export const deleteTacticsBoard = async (id: string) => {
  const response = await api.delete(`/tactics/boards/${id}`);
  return safeJsonParse(response.data);
};

export const duplicateTacticsBoard = async (id: string) => {
  const response = await api.post(`/tactics/boards/${id}/duplicate`);
  return safeJsonParse(response.data);
};

export const getTacticsFormations = async () => {
  const response = await api.get('/tactics/formations');
  return safeJsonParse(response.data);
};

export const createTacticsFormation = async (data: any) => {
  const response = await api.post('/tactics/formations', data);
  return safeJsonParse(response.data);
};

export const deleteTacticsFormation = async (id: string) => {
  const response = await api.delete(`/tactics/formations/${id}`);
  return safeJsonParse(response.data);
};

// --- 2-Kamera Video-Stitching & Dynamic Reframing API ---

export const createStitchJob = async (formData: FormData, onUploadProgress?: (progressEvent: any) => void) => {
  const response = await api.post('/videos/stitch-job', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress
  });
  return safeJsonParse(response.data);
};

export const detectMatchHighlights = async (matchId: string, speed: 'fast' | 'normal' | 'slow' = 'normal') => {
  const response = await api.post(`/videos/matches/${matchId}/detect-highlights`, null, { params: { speed } });
  return safeJsonParse(response.data);
};

export const getMatchHighlightStatus = async (matchId: string) => {
  const response = await api.get(`/videos/matches/${matchId}/highlight-status`);
  return safeJsonParse(response.data);
};

export const getUserStatisticsOverview = async () => {
  const response = await api.get('/admin/users/stats/overview');
  return safeJsonParse(response.data);
};

export const getSingleUserStatistics = async (userId: string) => {
  const response = await api.get(`/admin/users/${userId}/stats`);
  return safeJsonParse(response.data);
};

export const getUserActivityLogs = async (userId: string, page: number = 1, limit: number = 25, activityType?: string) => {
  const response = await api.get(`/admin/users/${userId}/activity-logs`, {
    params: { page, limit, activity_type: activityType }
  });
  return safeJsonParse(response.data);
};

export const trackUserPing = async (matchId?: string, durationSeconds: number = 30, module: string = 'match_video') => {
  try {
    const response = await api.post('/analytics/track-ping', {
      match_id: matchId,
      duration_seconds: durationSeconds,
      module
    });
    return safeJsonParse(response.data);
  } catch (err) {
    return null;
  }
};

// Legal / DSGVO / Impressum Pages
export const getPublicLegalPages = async () => {
  const response = await api.get('/public/legal-pages');
  return safeJsonParse(response.data);
};

export const getLegalTemplates = async () => {
  const response = await api.get('/public/legal-templates');
  return safeJsonParse(response.data);
};

