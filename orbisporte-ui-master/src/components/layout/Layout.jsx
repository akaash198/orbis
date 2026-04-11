import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const pageMeta = {
  dashboard:            { title: 'Control Tower',       subtitle: 'Operational overview and live trade intelligence', breadcrumbs: [{ label: 'Dashboard', current: true }] },
  documents:            { title: 'Documents',           subtitle: 'Upload, process, and manage trade documents', breadcrumbs: [{ label: 'Documents', current: true }] },
  'documents-upload':   { title: 'Document Upload',     subtitle: 'Ingest and process new files', breadcrumbs: [{ label: 'Documents', current: false }, { label: 'Upload', current: true }] },
  'hs-codes':           { title: 'HS Code Lookup',      subtitle: 'Classify goods with AI-powered search', breadcrumbs: [{ label: 'Trade Ops', current: false }, { label: 'HS Codes', current: true }] },
  'duty-calculator':    { title: 'Duty Calculator',     subtitle: 'Estimate taxes, duties, and landed cost', breadcrumbs: [{ label: 'Trade Ops', current: false }, { label: 'Duty Calc', current: true }] },
  'boe-filing':         { title: 'BoE Filing',          subtitle: 'Prepare and submit bill of entry workflows', breadcrumbs: [{ label: 'Trade Ops', current: false }, { label: 'BoE Filing', current: true }] },
  'shipment-tracking':  { title: 'Shipment Tracking',   subtitle: 'Monitor shipments in real time', breadcrumbs: [{ label: 'Monitoring', current: false }, { label: 'Tracking', current: true }] },
  'fraud-detection':    { title: 'Fraud Detection',     subtitle: 'Surface anomalies and suspicious patterns', breadcrumbs: [{ label: 'Compliance', current: false }, { label: 'Fraud', current: true }] },
  'risk-scoring':       { title: 'Risk Scoring',        subtitle: 'Assess trade and shipment risk signals', breadcrumbs: [{ label: 'Compliance', current: false }, { label: 'Risk', current: true }] },
  compliance:           { title: 'Compliance',          subtitle: 'Regulatory checks and policy alignment', breadcrumbs: [{ label: 'Compliance', current: true }] },
  'ai-governance':      { title: 'AI Governance',        subtitle: 'Control and audit AI usage across the platform', breadcrumbs: [{ label: 'Admin', current: false }, { label: 'AI Gov', current: true }] },
  alerts:               { title: 'Alerts',              subtitle: 'Track critical updates and exceptions', breadcrumbs: [{ label: 'Intelligence', current: false }, { label: 'Alerts', current: true }] },
  notifications:        { title: 'Notifications',       subtitle: 'CBIC notices and trade updates', breadcrumbs: [{ label: 'Intelligence', current: false }, { label: 'Notifications', current: true }] },
  qa:                   { title: 'AI Assistant',        subtitle: 'Ask questions about documents and filings', breadcrumbs: [{ label: 'Intelligence', current: false }, { label: 'AI Assistant', current: true }] },
  settings:             { title: 'Settings',            subtitle: 'Account, preferences, and system configuration', breadcrumbs: [{ label: 'Admin', current: false }, { label: 'Settings', current: true }] },
};

function getPageMeta(activeItem) {
  return pageMeta[activeItem] || pageMeta.dashboard;
}

export function Layout({ children, activeItem, onNavigate, user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const meta = getPageMeta(activeItem);

  return (
    <div className="relative min-h-screen bg-[#0A0D14]">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,165,32,0.06),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(107,188,212,0.04),transparent_28%),linear-gradient(180deg,#0A0D14_0%,#111620_100%)]" />
      </div>

      {/* Skip link */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Sidebar */}
      <Sidebar
        activeItem={activeItem}
        onNavigate={(id) => {
          onNavigate(id);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={onLogout}
      />

      {/* Main area (offset by sidebar on desktop) */}
      <div className="relative z-10 lg:ml-[220px]">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          user={user}
          title={meta.title}
          subtitle={meta.subtitle}
          breadcrumbs={meta.breadcrumbs}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-[calc(100vh-60px)] px-4 py-5 sm:px-6 lg:px-8 lg:py-6"
        >
          <div className="mx-auto max-w-[1200px] animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
