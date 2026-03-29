/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application with JWT token support.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token and validate it
    const token = authService.getToken();
    if (token) {
      // Token exists, try to validate it by making a request
      validateToken();
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async () => {
    try {
      // Try to get user documents to validate token
      const response = await authService.getUsers();
      // If successful, token is valid, but we need to get current user info
      // For now, we'll assume the token is valid and let the app handle auth errors
      setIsLoading(false);
    } catch (error) {
      // Token is invalid, clear it
      authService.clearToken();
      setUser(null);
      setIsLoading(false);
    }
  };

  const login = async (userData) => {
    try {
      const response = await authService.login(userData.email, userData.password);
      if (response.success && response.user) {
        setUser(response.user);
        return response;
      }
      throw new Error('Login failed');
    } catch (error) {
      // Normalize axios network errors into a user-readable message
      if (error.code === 'ERR_NETWORK' || (!error.response && error.request)) {
        throw new Error('Cannot reach server. Please ensure the backend is running.');
      }
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const updateUser = (updatedUserData) => {
    const newUser = { ...user, ...updatedUserData };
    setUser(newUser);
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
