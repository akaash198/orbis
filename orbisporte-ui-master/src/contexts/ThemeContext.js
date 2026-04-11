import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
});

export function ThemeContextProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { 
      const saved = localStorage.getItem('orbis-theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch { 
      return 'dark'; 
    }
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { 
      localStorage.setItem('orbis-theme', theme); 
    } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;