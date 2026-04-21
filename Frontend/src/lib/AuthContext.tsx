import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '@/api/backend';
import { store } from '@/store';

interface User {
  id: string;
  full_name: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('hr_token');
    if (!token) {
      setUser(null);
      setIsLoadingAuth(false);
      return;
    }
    try {
      const me = await auth.me();
      setUser(me);
    } catch {
      localStorage.removeItem('hr_token');
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refreshUser();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await auth.login(email, password);
    localStorage.setItem('hr_token', data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('hr_token');
    setUser(null);
    store.dispatch({ type: "RESET_ALL" }); // clear all Redux state
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      login,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
