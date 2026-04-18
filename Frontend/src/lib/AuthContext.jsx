import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

// Auth is bypassed — always authenticated with a default user.
// Re-enable login when MongoDB is connected.
const DEFAULT_USER = {
  full_name: "HR Admin",
  email: "admin@umurava.com",
};

export const AuthProvider = ({ children }) => {
  const login = async () => {};
  const logout = () => {};
  const refreshUser = async () => {};

  return (
    <AuthContext.Provider value={{
      user: DEFAULT_USER,
      isAuthenticated: true,
      isLoadingAuth: false,
      login,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
