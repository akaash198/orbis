import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, Search, User, LogOut, ChevronRight, Settings, Command } from 'lucide-react';

function getInitials(user) {
  const source = user?.user_name || user?.company_name || user?.email || 'U';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function Header({ onMenuClick, onLogout, user, title = 'Dashboard', subtitle, breadcrumbs = [] }) {
  const initials = getInitials(user);
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1E2638] px-4 lg:px-6"
      style={{
        height: '60px',
        background: 'rgba(17,22,32,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Left: Hamburger + Breadcrumb/Title */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-controls="app-sidebar"
          aria-label="Open navigation menu"
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[#273047] bg-[#161D2C] text-[#8B97AE] hover:text-[#E2E8F5] hover:border-[#344060] transition-colors"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="min-w-0">
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-[#4A5A72] mb-0.5">
              <span className="text-[#4A5A72]">Orbisporté</span>
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={`${crumb.label}-${i}`}>
                  <ChevronRight className="h-3 w-3 text-[#273047]" aria-hidden="true" />
                  <span className={crumb.current ? 'text-[#8B97AE]' : 'text-[#4A5A72]'}>
                    {crumb.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
          <h1 className="truncate text-[15px] font-semibold text-[#E2E8F5] leading-none">
            {title}
          </h1>
        </div>
      </div>

      {/* Center: Search */}
      <div className="mx-4 hidden flex-1 max-w-md md:block">
        <form role="search" className="relative">
          <label className="sr-only" htmlFor="global-search">
            Search documents, HS codes, shipments
          </label>
          <div
            className={[
              'flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-150',
              searchFocused
                ? 'border-[#C9A520] bg-[rgba(201,165,32,0.05)] shadow-[0_0_0_3px_rgba(201,165,32,0.15)]'
                : 'border-[#273047] bg-[#0D1020]',
            ].join(' ')}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-[#4A5A72]" aria-hidden="true" />
            <input
              id="global-search"
              type="text"
              placeholder="Search documents, HS codes..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full border-0 bg-transparent text-[13px] text-[#E2E8F5] placeholder:text-[#4A5A72] focus:outline-none focus:ring-0"
            />
            <kbd className="hidden items-center gap-0.5 rounded border border-[#273047] bg-[#111620] px-1.5 py-0.5 text-[10px] font-medium text-[#4A5A72] lg:inline-flex">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </form>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#273047] bg-[#161D2C] text-[#8B97AE] hover:border-[#344060] hover:text-[#E2E8F5] transition-colors"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#E05656]" aria-hidden="true" />
        </button>

        {/* User Menu */}
        {user ? (
          <div className="relative ml-1" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-lg border border-[#273047] bg-[#161D2C] px-3 py-1.5 text-left hover:border-[#344060] transition-colors"
              aria-label="User menu"
              aria-expanded={userMenuOpen}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(201,165,32,0.15)] border border-[rgba(201,165,32,0.28)] text-[11px] font-bold text-[#E8C84A]">
                {initials || <User className="h-3.5 w-3.5" />}
              </div>
              <div className="hidden flex-col sm:flex">
                <span className="text-[12px] font-semibold text-[#E2E8F5] leading-none">
                  {user.user_name || 'User'}
                </span>
                <span className="text-[10px] text-[#4A5A72] leading-none mt-0.5">
                  {user.company_name || user.email || 'Orbisporté'}
                </span>
              </div>
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[#273047] bg-[#1C2438] shadow-[0_8px_24px_rgba(0,0,0,0.20)] z-50 overflow-hidden animate-fade-in">
                <div className="border-b border-[#1E2638] px-4 py-3">
                  <p className="text-[13px] font-semibold text-[#E2E8F5]">{user.user_name || 'User'}</p>
                  <p className="text-[11px] text-[#4A5A72] mt-0.5">{user.email || user.company_name || ''}</p>
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-[#8B97AE] transition-colors hover:bg-white/[0.04] hover:text-[#E2E8F5]"
                  >
                    <Settings className="h-3.5 w-3.5 text-[#4A5A72]" aria-hidden="true" />
                    Settings
                  </button>
                  <div className="mx-3 my-1 h-px bg-[#1E2638]" />
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); onLogout?.(); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-[#F07070] transition-colors hover:bg-[rgba(224,86,86,0.08)]"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-9 items-center rounded-full border border-[rgba(201,165,32,0.28)] bg-[rgba(201,165,32,0.10)] px-3 text-[11px] font-semibold text-[#E8C84A]">
            Guest
          </div>
        )}
      </div>
    </header>
  );
}
