import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Calculator,
  Truck,
  Bell,
  ShieldCheck,
  Settings,
  ChevronDown,
  Globe,
  X,
  Upload,
  Database,
  Cpu,
  MessageSquare,
  AlertTriangle,
  LogOut,
  ChevronRight,
  Zap,
} from 'lucide-react';

const navSections = [
  {
    label: 'Main',
    items: [
      {
        id: 'dashboard',
        label: 'Control Tower',
        icon: LayoutDashboard,
        description: 'Overview & KPIs',
      },
    ],
  },
  {
    label: 'Documents',
    items: [
      {
        id: 'documents',
        label: 'Documents',
        icon: FileText,
        description: 'Manage trade documents',
        children: [
          { id: 'documents-upload', label: 'Upload & Process', icon: Upload },
          { id: 'documents-repo', label: 'Repository', icon: Database },
        ],
      },
    ],
  },
  {
    label: 'Trade Operations',
    items: [
      { id: 'hs-codes', label: 'HS Code Lookup', icon: Search2, description: 'Classify products' },
      { id: 'duty-calculator', label: 'Duty Calculator', icon: Calculator, description: 'Estimate taxes' },
      { id: 'boe-filing', label: 'BoE Filing', icon: FileText, description: 'Bill of entry' },
      { id: 'shipment-tracking', label: 'Shipment Tracking', icon: Truck, description: 'Live status' },
    ],
  },
  {
    label: 'Compliance & Risk',
    items: [
      { id: 'fraud-detection', label: 'Fraud Detection', icon: AlertTriangle, description: 'Anomaly surface' },
      { id: 'risk-scoring', label: 'Risk Scoring', icon: ShieldCheck, description: 'Assess risk' },
      { id: 'compliance', label: 'Compliance', icon: ShieldCheck, description: 'Regulatory checks' },
      { id: 'ai-governance', label: 'AI Governance', icon: Cpu, description: 'Audit AI usage' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'alerts', label: 'Alerts', icon: Bell, description: 'Critical events', badge: 2 },
      { id: 'notifications', label: 'Notifications', icon: Bell, description: 'CBIC notices', badge: 3 },
      { id: 'qa', label: 'AI Assistant', icon: MessageSquare, description: 'Ask questions' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings, description: 'Account & prefs' },
    ],
  },
];

// Fallback icon for items that use Search which is in lucide
function Search2(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function findParentSection(itemId) {
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.id === itemId) return item.id;
      if (item.children?.some((c) => c.id === itemId)) return item.id;
    }
  }
  return null;
}

export function Sidebar({ activeItem, onNavigate, isOpen, onClose, user, onLogout }) {
  const [expandedItems, setExpandedItems] = useState(['documents']);

  useEffect(() => {
    const parentId = findParentSection(activeItem);
    if (parentId) {
      setExpandedItems((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]));
    }
  }, [activeItem]);

  const toggleExpand = (id) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isActive = (id) => activeItem === id;
  const isExpanded = (id) => expandedItems.includes(id);
  const isParentActive = (item) =>
    isActive(item.id) || item.children?.some((c) => isActive(c.id));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="app-sidebar"
        style={{
          width: '220px',
          transform: isOpen ? 'translateX(0)' : undefined,
        }}
        className={[
          'fixed left-0 top-0 z-50 flex h-full flex-col',
          'border-r border-[#1E2638] bg-[#111620]',
          'transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex h-[60px] items-center justify-between border-b border-[#1E2638] px-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A520]">
              <Globe className="h-4 w-4 text-[#0A0D14]" aria-hidden="true" />
            </div>
            <span className="text-[15px] font-700 text-[#E2E8F5] tracking-tight font-bold">
              ORBISPORT<span className="text-[#C9A520]">É</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#8B97AE] hover:text-[#E2E8F5] hover:bg-white/5 transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* AI Status Banner */}
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-[rgba(61,190,126,0.28)] bg-[rgba(61,190,126,0.08)] px-3 py-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#3DBE7E] animate-pulse" />
          <span className="text-[11px] font-600 font-semibold text-[#5AD49A]">AI Engine Active</span>
          <Zap className="ml-auto h-3 w-3 text-[#5AD49A]" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
          {navSections.map((section) => (
            <div key={section.label} className="mb-1">
              <p className="mb-1 mt-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A5A72]">
                {section.label}
              </p>

              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isParentActive(item);
                const expanded = isExpanded(item.id);

                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.children) {
                          toggleExpand(item.id);
                        } else {
                          onNavigate(item.id);
                          onClose?.();
                        }
                      }}
                      className={[
                        'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-150',
                        'border-l-[3px]',
                        active
                          ? 'border-[#C9A520] bg-[rgba(201,165,32,0.10)] text-[#E8C84A]'
                          : 'border-transparent text-[#8B97AE] hover:bg-white/[0.04] hover:text-[#E2E8F5]',
                      ].join(' ')}
                      aria-current={isActive(item.id) ? 'page' : undefined}
                    >
                      <Icon
                        className={['h-4 w-4 shrink-0 transition-colors', active ? 'text-[#C9A520]' : 'text-[#4A5A72] group-hover:text-[#8B97AE]'].join(' ')}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate text-[13px] font-medium">{item.label}</span>
                      {item.badge ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C9A520] px-1.5 text-[10px] font-bold text-[#0A0D14]">
                          {item.badge}
                        </span>
                      ) : null}
                      {item.children ? (
                        <ChevronDown
                          className={['h-3.5 w-3.5 shrink-0 text-[#4A5A72] transition-transform duration-200', expanded ? 'rotate-180' : ''].join(' ')}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>

                    {item.children && expanded && (
                      <div className="ml-4 mt-0.5 mb-1 space-y-0.5 border-l border-[#1E2638] pl-3">
                        {item.children.map((child) => {
                          const childActive = isActive(child.id);
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => {
                                onNavigate(child.id);
                                onClose?.();
                              }}
                              className={[
                                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-all duration-150',
                                childActive
                                  ? 'font-semibold text-[#E8C84A] bg-[rgba(201,165,32,0.08)]'
                                  : 'text-[#4A5A72] hover:text-[#8B97AE] hover:bg-white/[0.03]',
                              ].join(' ')}
                              aria-current={childActive ? 'page' : undefined}
                            >
                              <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        {user && (
          <div className="border-t border-[#1E2638] p-3 flex-shrink-0">
            <div className="flex items-center gap-2.5 rounded-lg bg-[#161D2C] border border-[#1E2638] p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(201,165,32,0.15)] border border-[rgba(201,165,32,0.28)] text-[12px] font-bold text-[#E8C84A]">
                {(user.user_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[#E2E8F5]">
                  {user.user_name || 'User'}
                </p>
                <p className="truncate text-[10px] text-[#4A5A72]">
                  {user.company_name || 'Orbisporté'}
                </p>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#4A5A72] hover:text-[#F07070] hover:bg-[rgba(224,86,86,0.08)] transition-colors"
                  aria-label="Logout"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
