import React from 'react';
import { cn } from '../../lib/utils';
import { Menu, Bell, Search, User, LogOut, Sun, Moon, ChevronRight, Mail } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Badge } from '../ui/Badge';

interface UserData {
  user_name?: string;
  email?: string;
  company_name?: string;
}

interface BreadcrumbItem {
  label: string;
  current?: boolean;
}

interface HeaderProps {
  onMenuClick?: () => void;
  onLogout?: () => void;
  user?: UserData | null;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
}

function getInitials(user?: UserData | null) {
  const source = user?.user_name || user?.company_name || user?.email || 'User';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Header({
  onMenuClick,
  onLogout,
  user,
  title = 'Dashboard',
  subtitle = 'Overview',
  breadcrumbs = [],
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const initials = getInitials(user);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent/50 to-transparent" aria-hidden="true" />
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-controls="app-sidebar"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition-colors hover:bg-slate-50 hover:text-text-primary lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1 text-tiny text-text-tertiary">
              <span className="truncate">Orbisport&eacute;</span>
              {breadcrumbs.length > 0 && (
                <>
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={`${crumb.label}-${index}`}>
                      <span className={cn('truncate', crumb.current ? 'text-text-secondary' : 'text-text-tertiary')}>
                        {crumb.label}
                      </span>
                      {index < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-h4 font-semibold text-text-primary sm:text-h3">{title}</h1>
              <p className="truncate text-body-sm text-text-secondary">{subtitle}</p>
            </div>
          </div>
        </div>

        <form className="hidden min-w-[18rem] max-w-xl flex-1 md:block" role="search">
          <label className="sr-only" htmlFor="global-search">
            Search documents, HS codes, shipments, and alerts
          </label>
          <div className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
            <input
              id="global-search"
              type="text"
              placeholder="Search documents, HS codes, shipments..."
              className="w-full border-0 bg-transparent p-0 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-0"
            />
            <kbd className="hidden items-center rounded-md border border-border bg-background-secondary px-2 py-0.5 text-tiny text-text-tertiary lg:inline-flex">
              Ctrl K
            </kbd>
          </div>
        </form>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition-colors hover:bg-slate-50 hover:text-text-primary"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition-colors hover:bg-slate-50 hover:text-text-primary"
            aria-label="View notifications"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" aria-hidden="true" />
          </button>

          {user ? (
            <div className="ml-1 flex items-center gap-3 border-l border-border pl-3 sm:pl-4">
              <div className="hidden flex-col items-end sm:flex">
                <span className="text-sm font-semibold text-text-primary">
                  {user.user_name || 'User'}
                </span>
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {user.company_name || 'Company'}
                </span>
              </div>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-brand"
                aria-label={user.user_name ? `Signed in as ${user.user_name}` : 'User profile'}
              >
                {initials || <User className="h-4 w-4" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition-colors hover:bg-slate-50 hover:text-text-primary"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
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
