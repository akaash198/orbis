import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

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

type PageMeta = {
  title: string;
  subtitle: string;
  breadcrumbs: Array<{ label: string; current: boolean }>;
};

const pageMeta: Record<string, PageMeta> = {
  dashboard: {
    title: 'Control Tower',
    subtitle: 'Operational overview and live trade intelligence',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'Dashboard', current: true }],
  },
  documents: {
    title: 'Documents',
    subtitle: 'Upload, process, and manage trade documents',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'Documents', current: true }],
  },
  'documents-upload': {
    title: 'Document Upload',
    subtitle: 'Ingest and process new files',
    breadcrumbs: [
      { label: 'Home', current: false },
      { label: 'Documents', current: false },
      { label: 'Upload & Process', current: true },
    ],
  },
  'hs-codes': {
    title: 'HS Code Lookup',
    subtitle: 'Classify goods with faster search and guidance',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'Duties', current: false }, { label: 'HS Codes', current: true }],
  },
  'duty-calculator': {
    title: 'Duty Calculator',
    subtitle: 'Estimate taxes, duties, and landed cost',
    breadcrumbs: [
      { label: 'Home', current: false },
      { label: 'Duties', current: false },
      { label: 'Duty Calculator', current: true },
    ],
  },
  'boe-filing': {
    title: 'BoE Filing',
    subtitle: 'Prepare and submit bill of entry workflows',
    breadcrumbs: [
      { label: 'Home', current: false },
      { label: 'Duties', current: false },
      { label: 'BoE Filing', current: true },
    ],
  },
  'shipment-tracking': {
    title: 'Shipment Tracking',
    subtitle: 'Monitor shipments and status updates in real time',
    breadcrumbs: [
      { label: 'Home', current: false },
      { label: 'Operations', current: false },
      { label: 'Shipment Tracking', current: true },
    ],
  },
  'fraud-detection': {
    title: 'Fraud Detection',
    subtitle: 'Surface anomalies and suspicious patterns',
    breadcrumbs: [
      { label: 'Home', current: false },
      { label: 'Compliance', current: false },
      { label: 'Fraud Detection', current: true },
    ],
  },
  'risk-scoring': {
    title: 'Risk Scoring',
    subtitle: 'Assess trade and shipment risk signals',
    breadcrumbs: [
      { label: 'Home', current: false },
      { label: 'Compliance', current: false },
      { label: 'Risk Scoring', current: true },
    ],
  },
  compliance: {
    title: 'Compliance',
    subtitle: 'Regulatory checks and policy alignment',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'Compliance', current: true }],
  },
  'ai-governance': {
    title: 'AI Governance',
    subtitle: 'Control and audit AI usage across the platform',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'Admin', current: false }, { label: 'AI Governance', current: true }],
  },
  alerts: {
    title: 'Alerts',
    subtitle: 'Track critical updates and exceptions',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'Monitoring', current: false }, { label: 'Alerts', current: true }],
  },
  notifications: {
    title: 'Notification Tracking',
    subtitle: 'CBIC notices and trade updates',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'Monitoring', current: false }, { label: 'Notifications', current: true }],
  },
  qa: {
    title: 'Q&A Assistant',
    subtitle: 'Ask questions about documents and filings',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'AI', current: false }, { label: 'Q&A Assistant', current: true }],
  },
  settings: {
    title: 'Settings',
    subtitle: 'Account, preferences, and system configuration',
    breadcrumbs: [{ label: 'Home', current: false }, { label: 'Admin', current: false }, { label: 'Settings', current: true }],
  },
};

function getPageMeta(activeItem: string): PageMeta {
  return pageMeta[activeItem] || pageMeta.dashboard;
}

export function Layout({ children, activeItem, onNavigate, user, onLogout }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const meta = getPageMeta(activeItem);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar
        activeItem={activeItem}
        onNavigate={(id) => {
          onNavigate(id);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="relative z-10 lg:ml-72">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          user={user}
          title={meta.title}
          subtitle={meta.subtitle}
          breadcrumbs={meta.breadcrumbs}
        />

        <main id="main-content" tabIndex={-1} className="px-3 pb-5 pt-4 sm:px-4 sm:pt-4 lg:px-6">
          <div className="mx-auto max-w-7xl animate-fade-in space-y-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
