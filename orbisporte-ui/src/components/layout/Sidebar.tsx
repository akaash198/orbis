import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  FileText,
  Calculator,
  Truck,
  Bell,
  ShieldCheck,
  Settings,
  ChevronRight,
  ChevronDown,
  Globe,
  X,
} from 'lucide-react';

interface NavChild {
  id: string;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: number;
  children?: NavChild[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Primary Navigation',
    items: [
      {
        id: 'dashboard',
        label: 'Control Tower',
        description: 'Overview and KPIs',
        icon: <LayoutDashboard className="h-5 w-5" />,
      },
      {
        id: 'documents',
        label: 'Documents',
        description: 'Upload and processing',
        icon: <FileText className="h-5 w-5" />,
        children: [
          { id: 'documents-upload', label: 'Upload & Process' },
          { id: 'documents-repo', label: 'Repository' },
          { id: 'documents-extraction', label: 'Extraction' },
        ],
      },
    ],
  },
  {
    label: 'Trade Operations',
    items: [
      {
        id: 'hs-codes',
        label: 'HS Code Lookup',
        description: 'Classify products faster',
        icon: <Calculator className="h-5 w-5" />,
      },
      {
        id: 'duty-calculator',
        label: 'Duty Calculator',
        description: 'Estimate taxes and landed cost',
        icon: <Calculator className="h-5 w-5" />,
      },
      {
        id: 'boe-filing',
        label: 'BoE Filing',
        description: 'Prepare bill of entry workflows',
        icon: <FileText className="h-5 w-5" />,
      },
    ],
  },
  {
    label: 'Compliance & Risk',
    items: [
      {
        id: 'fraud-detection',
        label: 'Fraud Detection',
        description: 'Surface anomalies and patterns',
        icon: <ShieldCheck className="h-5 w-5" />,
      },
      {
        id: 'risk-scoring',
        label: 'Risk Scoring',
        description: 'Assess shipment risk',
        icon: <ShieldCheck className="h-5 w-5" />,
      },
      {
        id: 'compliance',
        label: 'Compliance',
        description: 'Regulatory checks and policies',
        icon: <ShieldCheck className="h-5 w-5" />,
      },
      {
        id: 'ai-governance',
        label: 'AI Governance',
        description: 'Audit and control AI usage',
        icon: <ShieldCheck className="h-5 w-5" />,
      },
    ],
  },
  {
    label: 'Monitoring & Alerts',
    items: [
      {
        id: 'shipment-tracking',
        label: 'Shipment Tracking',
        description: 'Monitor live shipment status',
        icon: <Truck className="h-5 w-5" />,
      },
      {
        id: 'alerts',
        label: 'Alerts',
        description: 'Track critical exceptions',
        icon: <Bell className="h-5 w-5" />,
      },
      {
        id: 'notifications',
        label: 'Notification Tracking',
        description: 'CBIC notices and updates',
        icon: <Bell className="h-5 w-5" />,
        badge: 3,
      },
    ],
  },
  {
    label: 'AI & Analytics',
    items: [
      {
        id: 'qa',
        label: 'AI Assistant',
        description: 'Ask questions about filings',
        icon: <Bell className="h-5 w-5" />,
      },
    ],
  },
  {
    label: 'Admin & Settings',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        description: 'Account and preferences',
        icon: <Settings className="h-5 w-5" />,
      },
    ],
  },
];

function findParentSection(itemId: string) {
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.id === itemId) return item.id;
      if (item.children?.some((child) => child.id === itemId)) return item.id;
    }
  }
  return null;
}

interface SidebarProps {
  activeItem: string;
  onNavigate: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ activeItem, onNavigate, isOpen, onClose }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  useEffect(() => {
    const parentId = findParentSection(activeItem);
    if (parentId) {
      setExpandedItems((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]));
    }
  }, [activeItem]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isActive = (id: string) => activeItem === id;
  const isExpanded = (id: string) => expandedItems.includes(id);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="app-sidebar"
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-[min(18rem,calc(100vw-1.5rem))] -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-out lg:w-72 lg:translate-x-0',
          isOpen && 'translate-x-0'
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent/40 to-transparent" aria-hidden="true" />
        <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <img 
                src="/images/logo.png" 
                alt="Orbisporté" 
                className="h-8 w-auto object-contain"
              />
              <span className="text-lg font-black tracking-wider uppercase text-slate-900">
                ORBISPORTÉ
              </span>
            </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition-colors hover:bg-slate-50 hover:text-text-primary lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <div className="mb-2 px-3 text-tiny font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                {section.label}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.id) || item.children?.some((child) => isActive(child.id));
                  const expanded = isExpanded(item.id);

                  return (
                    <div key={item.id}>
                      <button
                        onClick={() => {
                          if (item.children) {
                            toggleExpand(item.id);
                          } else {
                            onNavigate(item.id);
                            onClose?.();
                          }
                        }}
                        className={cn(
                          'group flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200',
                          active
                            ? 'border-slate-200 bg-slate-50 text-text-primary'
                            : 'border-transparent bg-transparent text-text-secondary hover:border-slate-200 hover:bg-slate-50 hover:text-text-primary'
                        )}
                        aria-expanded={item.children ? expanded : undefined}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className={cn('shrink-0 transition-colors', active ? 'text-brand' : 'text-text-tertiary')}>
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          <span className="block truncate text-xs text-text-tertiary">{item.description}</span>
                        </span>
                        {item.badge ? (
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-tiny font-semibold text-brand">
                            {item.badge}
                          </span>
                        ) : null}
                        {item.children ? (
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 shrink-0 text-text-tertiary transition-transform',
                              expanded && 'rotate-180'
                            )}
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>

                      {item.children && expanded && (
                        <div className="mt-1 space-y-1 pl-4">
                          {item.children.map((child) => {
                            const childActive = isActive(child.id);
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  onNavigate(child.id);
                                  onClose?.();
                                }}
                                className={cn(
                                  'flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all duration-200',
                                  childActive
                                    ? 'border-slate-200 bg-slate-50 text-text-primary'
                                    : 'border-transparent text-text-secondary hover:border-slate-200 hover:bg-slate-50 hover:text-text-primary'
                                )}
                                aria-current={childActive ? 'page' : undefined}
                              >
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                                <span className="truncate">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">Profile & Preferences</div>
                <div className="text-xs text-text-tertiary">Account, logout, and settings</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
