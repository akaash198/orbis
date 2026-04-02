import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '../../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeItem: string;
  onNavigate: (id: string) => void;
  user?: {
    user_name?: string;
    email?: string;
    company_name?: string;
  } | null;
  onLogout?: () => void;
}

export function Layout({ children, activeItem, onNavigate, user, onLogout }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Sidebar */}
      <Sidebar
        activeItem={activeItem}
        onNavigate={(id) => {
          onNavigate(id);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:ml-72">
        {/* Header */}
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          user={user}
        />

        {/* Page Content */}
        <main className="pt-20 pb-8 px-6 min-h-screen">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}