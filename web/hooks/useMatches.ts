import { useState, useEffect } from 'react';
import { getMatches, deleteMatch, updateMatchDetails, subscribeToMatch, unsubscribeFromMatch } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export function useMatches() {
  const [matches, setMatches] = useState<any[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Filter and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubscribed, setFilterSubscribed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState('newest');

  const fetchMatches = (silent: boolean = false) => {
    if (user) {
      if (!silent) setLoading(true);
      getMatches()
        .then(data => {
          if (Array.isArray(data)) {
            const sorted = [...data].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            setMatches(sorted);
          } else if (data && data.error) {
            setError(`${data.error}${data.details ? ': ' + data.details : ''}`);
          } else {
            setError("Datenformat-Fehler oder Zugriff verweigert.");
          }
        })
        .catch((err) => {
          console.error("Home fetch error:", err);
          if (!silent) setError("Verbindung zum Server fehlgeschlagen");
        })
        .finally(() => {
          if (!silent) setLoading(false);
        });
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [user]);

  // Auto-polling when background jobs (stitching, heatmap or highlight detection) are active
  useEffect(() => {
    const hasActiveJob = matches.some(m => m.is_stitching || m.is_generating_heatmap || m.is_detecting_highlights || m.highlight_job?.status === 'PROCESSING');
    if (!hasActiveJob) return;

    const interval = setInterval(() => {
      fetchMatches(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [matches]);

  useEffect(() => {
    let result = [...matches];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        (m.name?.toLowerCase().includes(q)) ||
        (m.team_name?.toLowerCase().includes(q)) ||
        (m.category?.toLowerCase().includes(q))
      );
    }

    if (selectedCategory && selectedCategory !== 'ALL') {
      result = result.filter(m => m.category === selectedCategory);
    }

    if (filterSubscribed) {
      result = result.filter(m => m.is_subscribed);
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

    setFilteredMatches(result);
  }, [matches, searchQuery, filterSubscribed, selectedCategory, sortBy]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMatch(id);
      fetchMatches();
    } catch (err) {
      console.error("Delete error:", err);
      throw err;
    }
  };

  const handleEdit = async (id: string, updatedData: any) => {
    try {
      await updateMatchDetails(id, updatedData);
      fetchMatches();
    } catch (err) {
      console.error("Edit error:", err);
      throw err;
    }
  };

  const handleToggleSubscription = async (match: any) => {
    try {
      if (match.is_subscribed) {
        await unsubscribeFromMatch(match.id);
      } else {
        await subscribeToMatch(match.id);
      }
      setMatches(prev => prev.map(m =>
        m.id === match.id ? { ...m, is_subscribed: !m.is_subscribed } : m
      ));
    } catch (err) {
      console.error("Subscription toggle error:", err);
      throw err;
    }
  };

  return {
    matches,
    filteredMatches,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filterSubscribed,
    setFilterSubscribed,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    handleDelete,
    handleEdit,
    handleToggleSubscription,
  };
}
