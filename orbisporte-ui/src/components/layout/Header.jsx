import React from 'react';
import { cn } from '../../lib/utils';
import { Menu, Bell, Search, User, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Badge } from '../ui/Badge';

export function Header({ onMenuClick, onLogout, user }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-background-secondary/80 backdrop-blur-xl border-b border-border z-30">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Menu className="w-5 h-5 text-text-secondary" />
          </button>
          
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-surface-glass rounded-lg border border-border w-80">
            <Search className="w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search documents, HS codes, shipments..."
              className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted flex-1"
            />
            <kbd className="hidden lg:inline-flex items-center px-2 py-0.5 text-xs text-text-muted bg-surface-hover rounded">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-text-secondary" />
            ) : (
              <Moon className="w-5 h-5 text-text-secondary" />
            )}
          </button>

          <button className="relative p-2 rounded-lg hover:bg-surface-hover transition-colors">
            <Bell className="w-5 h-5 text-text-secondary" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
          </button>

          {user ? (
            <div className="flex items-center gap-3 pl-2 ml-2 border-l border-border">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-text-primary">
                  {user.user_name || 'User'}
                </span>
                <span className="text-xs text-text-muted">
                  {user.company_name || 'Company'}
                </span>
              </div>
              <button className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={onLogout}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          ) : (
            <Badge variant="info">Guest</Badge>
          )}
        </div>
      </div>
    </header>
  );
}