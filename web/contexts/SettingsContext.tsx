"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSystemSettings } from '@/services/api';
import { useAuth } from './AuthContext';

interface SystemSettings {
  module_stitching_enabled: boolean;
  module_heatmap_enabled: boolean;
  module_video_color_enabled: boolean;
  module_hls_enabled: boolean;
  module_fisheye_enabled: boolean;
  module_ai_assistant_enabled?: boolean;
  default_resolution: string;
  default_video_quality: string;
  default_storage_path: string;
  auto_hls_conversion: boolean;
  auto_stitching: boolean;
  show_push_test_button?: boolean;
  show_match_cleanup_button?: boolean;
}

interface SettingsContextType {
  settings: SystemSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSystemSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to fetch system settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if user is logged in
    if (user) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [user]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
