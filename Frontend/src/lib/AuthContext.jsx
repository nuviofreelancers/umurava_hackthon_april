import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '@/api/backend';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("hr_token");
    if (token) {
      auth.me()
        .then(u => { setUser(u); setIsAuthenticated(true); })
        .catch(() => { localStorage.removeItem("hr_token"); })
        .finally(() => setIsLoadingAuth(false));
    } else {
      setIsLoadingAuth(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await auth.login(email, password);
    localStorage.setItem("hr_token", data.token);
    setUser(data.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("hr_token");
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
