import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  FileText,
  Calculator,
  FileCheck,
  Truck,
  Bell,
  ShieldCheck,
  Settings,
  ChevronRight,
  ChevronDown,
  Globe,
  X,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  children?: { id: string; label: string }[];
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Control Tower',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: <FileText className="w-5 h-5" />,
    children: [
      { id: 'documents-upload', label: 'Upload & Process' },
      { id: 'documents-repo', label: 'Repository' },
      { id: 'documents-extraction', label: 'Extraction' },
    ],
  },
  {
    id: 'duties',
    label: 'Duties & Filing',
    icon: <Calculator className="w-5 h-5" />,
    children: [
      { id: 'hs-codes', label: 'HS Codes' },
      { id: 'duty-calculator', label: 'Duty Calculator' },
      { id: 'boe-filing', label: 'BoE Filing' },
      { id: 'filing-status', label: 'Filing Status' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: <Truck className="w-5 h-5" />,
    children: [
      { id: 'shipment-tracking', label: 'Shipment Tracking' },
      { id: 'customs-estimates', label: 'Customs Estimates' },
      { id: 'alerts', label: 'Alerts' },
    ],
  },
  {
    id: 'compliance',
    label: 'Risk & Compliance',
    icon: <ShieldCheck className="w-5 h-5" />,
    children: [
      { id: 'fraud-detection', label: 'Fraud Detection' },
      { id: 'risk-scoring', label: 'Risk Scoring' },
      { id: 'compliance-check', label: 'Compliance' },
      { id: 'ai-governance', label: 'AI Governance' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell className="w-5 h-5" />,
    badge: 3,
  },
];

interface SidebarProps {
  activeItem: string;
  onNavigate: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ activeItem, onNavigate, isOpen, onClose }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isActive = (id: string) => activeItem === id;
  const isExpanded = (id: string) => expandedItems.includes(id);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-72 bg-background-secondary border-r border-border z-50',
          'flex flex-col transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center px-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-glow">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">ORBISPORTÉ</h1>
              <p className="text-xs text-text-muted">Customs Platform</p>
            </div>
          </div>
        </div>

        {/* Close Button (Mobile) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-hover lg:hidden"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto px-3">
          {navItems.map((item) => (
            <div key={item.id} className="mb-1">
              {/* Main Item */}
              <button
                onClick={() => {
                  if (item.children) {
                    toggleExpand(item.id);
                  } else {
                    onNavigate(item.id);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200',
                  isActive(item.id)
                    ? 'bg-primary-500/15 text-primary-400 border-l-2 border-primary-500'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <span
                  className={cn(
                    'transition-colors',
                    isActive(item.id) ? 'text-primary-400' : 'text-text-muted'
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 font-medium text-sm">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary-500/20 text-primary-400 rounded-full">
                    {item.badge}
                  </span>
                )}
                {item.children && (
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-text-muted transition-transform',
                      isExpanded(item.id) && 'rotate-180'
                    )}
                  />
                )}
              </button>

              {/* Children */}
              {item.children && isExpanded(item.id) && (
                <div className="ml-6 mt-1 space-y-0.5 animate-fade-in">
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => onNavigate(child.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                        activeItem === child.id
                          ? 'text-primary-400 bg-primary-500/10'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                      )}
                    >
                      <ChevronRight className="w-3 h-3 text-text-muted" />
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Settings at Bottom */}
        <div className="p-3 border-t border-border">
          <button
            onClick={() => onNavigate('settings')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
              activeItem === 'settings'
                ? 'bg-primary-500/15 text-primary-400'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            )}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium text-sm">Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}