"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/services/api';

type UserRole = 'ADMIN' | 'TEAM_ADMIN' | 'TRAINER' | 'CO_TRAINER' | 'VIEWER' | 'admin' | 'team_admin' | 'trainer' | 'co_trainer' | 'viewer';

interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatar_path?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  teams?: Array<{ id: string; name: string; age_group?: string; can_edit?: boolean }>;
  module_permissions?: Record<string, boolean>;
}



interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') { // Ensure localStorage is only accessed in the browser
      const savedToken = localStorage.getItem('matchtracker_token');
      const savedUser = localStorage.getItem('matchtracker_user');

      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          // Set default axios header
          api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        } catch (e) {
          console.error("Failed to parse saved user", e);
          localStorage.removeItem('matchtracker_token');
          localStorage.removeItem('matchtracker_user');
        }
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    if (typeof window !== 'undefined') { // Ensure localStorage is only accessed in the browser
      localStorage.setItem('matchtracker_token', newToken);
      localStorage.setItem('matchtracker_user', JSON.stringify(newUser));
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') { // Ensure localStorage is only accessed in the browser
      localStorage.removeItem('matchtracker_token');
      localStorage.removeItem('matchtracker_user');
    }
    delete api.defaults.headers.common['Authorization'];
    window.location.href = '/login'; // Force redirect to login
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
