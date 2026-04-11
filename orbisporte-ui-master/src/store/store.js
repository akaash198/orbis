/**
 * Redux Store Configuration with Redux Persist
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // localStorage
import authReducer from './authSlice';

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer
});

// Persist configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'] // Only persist auth state
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/REGISTER']
      }
    })
});

export const persistor = persistStore(store);

