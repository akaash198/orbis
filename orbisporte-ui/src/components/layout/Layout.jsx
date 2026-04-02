import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '../../lib/utils';

export function Layout({ children, activeItem, onNavigate, user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-primary">
      <Sidebar
        activeItem={activeItem}
        onNavigate={(id) => {
          onNavigate(id);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:ml-72">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          user={user}
        />

        <main className="pt-20 pb-8 px-6 min-h-screen">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}