/**
 * Auth Slice - Redux state management for authentication
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../services/api';
import { REHYDRATE } from 'redux-persist';

// Async thunks for authentication
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ user_name, password }, { rejectWithValue }) => {
    try {
      const response = await authService.login(user_name, password);
      if (response.success && response.user) {
        return {
          user: response.user,
          token: response.access_token
        };
      }
      throw new Error('Login failed');
    } catch (error) {
      // Normalize errors
      if (error.code === 'ERR_NETWORK' || (!error.response && error.request)) {
        return rejectWithValue('Cannot reach server. Please ensure the backend is running.');
      }

      let errorMessage = 'Invalid username or password. Please try again.';
      if (error.response?.data) {
        const errorData = error.response.data;
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => err.msg || err.message || String(err)).join(', ');
        } else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      return rejectWithValue(errorMessage);
    }
  }
);

export const signupUser = createAsyncThunk(
  'auth/signup',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.signup(userData);
      return response;
    } catch (error) {
      // Normalize errors
      if (error.code === 'ERR_NETWORK' || (!error.response && error.request)) {
        return rejectWithValue('Cannot reach server. Please ensure the backend is running.');
      }
      
      let errorMessage = 'Failed to create account. Please try again.';
      if (error.response?.data) {
        const errorData = error.response.data;
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => err.msg || err.message || String(err)).join(', ');
        } else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      return rejectWithValue(errorMessage);
    }
  }
);

export const validateToken = createAsyncThunk(
  'auth/validateToken',
  async (_, { rejectWithValue }) => {
    try {
      const result = await authService.validateToken();
      if (result.valid) {
        return { valid: true };
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue('Token validation failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      return null;
    } catch (error) {
      // Still logout locally even if API call fails
      return null;
    }
  }
);

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateUser: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle rehydration from localStorage
      .addCase(REHYDRATE, (state, action) => {
        // ALWAYS set isLoading to false after rehydration (CRITICAL FIX)
        state.isLoading = false;

        if (action.payload?.auth) {
          // Restore state from persisted data
          const { user, token, isAuthenticated } = action.payload.auth;
          if (token && user) {
            // Restore token in API service
            authService.setToken(token);
            state.user = user;
            state.token = token;
            state.isAuthenticated = true;
          } else {
            // No valid token, ensure logged out state
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
          }
        } else {
          // No auth data, ensure logged out state
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;
        }
      })
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
        // Token is already set by authService.login, but ensure it's set
        if (action.payload.token) {
          authService.setToken(action.payload.token);
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      // Signup
      .addCase(signupUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signupUser.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Token validation (should NOT show loading screen - happens silently in background)
      .addCase(validateToken.pending, (state) => {
        // Do NOT set isLoading = true for token validation
        // Token validation should be silent and not block the UI
      })
      .addCase(validateToken.fulfilled, (state) => {
        state.isLoading = false; // ALWAYS ensure loading is false
        state.error = null;
        // Token is valid, keep user authenticated
      })
      .addCase(validateToken.rejected, (state, action) => {
        state.isLoading = false; // ALWAYS ensure loading is false
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload;
        // Clear token from API service
        authService.clearToken();
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
        // Clear token from API service
        authService.clearToken();
      });
  }
});

export const { updateUser, clearError } = authSlice.actions;
export default authSlice.reducer;

