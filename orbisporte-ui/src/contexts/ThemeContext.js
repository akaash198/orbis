/**
 * ThemeContext — Dark / Light mode
 * Persists preference to localStorage and applies `data-theme` to <html>.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ isDark: true, toggleTheme: () => {} });

export function ThemeContextProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('orbis-theme') !== 'light'; }
    catch { return true; }
  });

  // Apply data-theme to <html> whenever mode changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try { localStorage.setItem('orbis-theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
