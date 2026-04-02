/**
 * History & Reports Panel
 *
 * Full document registry table — shows every uploaded document with its
 * complete processing pipeline status.  Supports view, update (rescan),
 * and delete operations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import theme from '../../styles/theme';
import { documentService } from '../../services/api';

// ─── Animations ────────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
`;

// ─── Layout ────────────────────────────────────────────────────────────────────

const PanelContainer = styled.div`
  padding: ${theme.spacing.xl}px;
  max-width: 1500px;
  margin: 0 auto;
  min-height: 100vh;
  animation: ${fadeIn} 0.3s ease;
`;

const PanelHeader = styled.div`
  margin-bottom: ${theme.spacing.xl}px;

  h1 {
    font-size: ${theme.typography.fontSize.xxl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    margin: 0 0 ${theme.spacing.sm}px 0;
  }

  p {
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.fontSize.md};
    margin: 0;
  }
`;

// ─── Stats ─────────────────────────────────────────────────────────────────────

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.xl}px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const StatCard = styled.div`
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.lg}px ${theme.spacing.xl}px;
  box-shadow: ${theme.shadows.sm};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
`;

const StatIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: ${theme.radius.md}px;
  background: ${({ $color }) => $color || theme.colors.primary.gradient};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
`;

const StatInfo = styled.div`
  .value {
    font-size: ${theme.typography.fontSize.xxl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    line-height: 1;
  }
  .label {
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.secondary};
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;

// ─── Toolbar ───────────────────────────────────────────────────────────────────

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.lg}px;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 220px;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm};
  outline: none;
  transition: border-color ${theme.transitions.fast};

  &::placeholder { color: ${theme.colors.text.hint}; }

  &:focus {
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
  }
`;

const FilterSelect = styled.select`
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm};
  outline: none;
  cursor: pointer;

  option {
    background: #1a2035;
    color: #ffffff;
  }

  [data-theme="light"] & option {
    background: #ffffff;
    color: #0f172a;
  }
`;

const RefreshBtn = styled.button`
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all ${theme.transitions.fast};

  &:hover {
    border-color: ${theme.colors.primary.main};
    color: ${theme.colors.primary.light};
  }

  .icon { ${({ $spinning }) => $spinning && css`animation: ${spin} 0.8s linear infinite;`} }
`;

// ─── Table ─────────────────────────────────────────────────────────────────────

const TableWrapper = styled.div`
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  box-shadow: ${theme.shadows.sm};
  overflow-x: auto;
  overflow-y: visible;
`;

const TableScroll = styled.div`
  min-width: 900px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${theme.typography.fontSize.sm};
`;

const THead = styled.thead`
  background: rgba(59,130,246,0.07);
  border-bottom: 1px solid ${theme.colors.ui.border};

  [data-theme="light"] & {
    background: rgba(59,130,246,0.08);
  }
`;

const Th = styled.th`
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  text-align: left;
  color: ${theme.colors.text.primary};
  font-weight: ${theme.typography.fontWeight.semibold};
  font-size: ${theme.typography.fontSize.xs};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  cursor: ${({ $sortable }) => $sortable ? 'pointer' : 'default'};
  user-select: none;

  &:hover {
    ${({ $sortable }) => $sortable && `color: ${theme.colors.primary.main};`}
  }
`;

const Tr = styled.tr`
  border-bottom: 1px solid ${theme.colors.ui.border};
  transition: background ${theme.transitions.fast};

  &:last-child { border-bottom: none; }

  &:hover { background: ${theme.colors.ui.hover}; }
`;

const Td = styled.td`
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  color: ${theme.colors.text.primary};
  vertical-align: middle;
`;

const DocName = styled.div`
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.primary};
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${theme.typography.fontSize.sm};
`;

const DocSub = styled.div`
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.text.secondary};
  margin-top: 2px;
`;

// ─── Pipeline Stage Pills ──────────────────────────────────────────────────────

const PipelineRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StagePill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill}px;
  font-size: 10px;
  font-weight: ${theme.typography.fontWeight.semibold};
  white-space: nowrap;
  background: ${({ $done }) =>
    $done ? 'rgba(16,185,129,0.15)' : theme.colors.ui.backgroundLight};
  color: ${({ $done }) =>
    $done ? theme.colors.status.success : theme.colors.text.secondary};
  border: 1px solid ${({ $done }) =>
    $done ? 'rgba(16,185,129,0.3)' : theme.colors.ui.border};

  &::before {
    content: '${({ $done }) => ($done ? '✓' : '○')}';
    font-size: 9px;
  }
`;

const StageDivider = styled.span`
  width: 14px;
  height: 1px;
  background: ${theme.colors.ui.border};
  flex-shrink: 0;
`;

// ─── Status Badge ──────────────────────────────────────────────────────────────

const statusConfig = {
  uploaded:   { bg: 'rgba(59,130,246,0.15)',  color: '#60A5FA',  colorLight: '#1d4ed8', label: 'Uploaded'   },
  classified: { bg: 'rgba(124,58,237,0.15)',  color: '#a78bfa',  colorLight: '#6d28d9', label: 'Classified' },
  extracted:  { bg: 'rgba(6,182,212,0.15)',   color: '#22d3ee',  colorLight: '#0e7490', label: 'Extracted'  },
  processed:  { bg: 'rgba(16,185,129,0.15)',  color: '#34d399',  colorLight: '#065f46', label: 'Processed'  },
  failed:     { bg: 'rgba(239,68,68,0.15)',   color: '#f87171',  colorLight: '#b91c1c', label: 'Failed'     },
  pending:    { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24',  colorLight: '#92400e', label: 'Pending'    },
};

const StatusBadge = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border-radius: ${theme.radius.pill}px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  background: ${({ $status }) => statusConfig[$status]?.bg || statusConfig.pending.bg};
  color: ${({ $status }) => statusConfig[$status]?.color || statusConfig.pending.color};

  [data-theme="light"] & {
    color: ${({ $status }) => statusConfig[$status]?.colorLight || statusConfig.pending.colorLight};
    background: ${({ $status }) => statusConfig[$status]?.bg || statusConfig.pending.bg};
    font-weight: ${theme.typography.fontWeight.bold};
  }
`;

// ─── Action Buttons ────────────────────────────────────────────────────────────

const ActionGroup = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const ActionBtn = styled.button`
  padding: 7px 14px;
  border-radius: ${theme.radius.sm}px;
  border: 1px solid ${({ $variant }) =>
    $variant === 'danger'  ? 'rgba(239,68,68,0.4)'  :
    $variant === 'warning' ? 'rgba(245,158,11,0.4)' :
    'rgba(59,130,246,0.4)'};
  background: ${({ $variant }) =>
    $variant === 'danger'  ? 'rgba(239,68,68,0.12)'  :
    $variant === 'warning' ? 'rgba(245,158,11,0.12)' :
    'rgba(59,130,246,0.12)'};
  color: ${({ $variant }) =>
    $variant === 'danger'  ? '#f87171' :
    $variant === 'warning' ? '#fbbf24' :
    '#60A5FA'};
  font-size: 12px;
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  white-space: nowrap;

  &:hover {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  [data-theme="light"] & {
    color: ${({ $variant }) =>
      $variant === 'danger'  ? '#b91c1c' :
      $variant === 'warning' ? '#92400e' :
      '#1d4ed8'};
    border-color: ${({ $variant }) =>
      $variant === 'danger'  ? 'rgba(185,28,28,0.4)'  :
      $variant === 'warning' ? 'rgba(146,64,14,0.4)'  :
      'rgba(29,78,216,0.4)'};
    background: ${({ $variant }) =>
      $variant === 'danger'  ? 'rgba(185,28,28,0.08)'  :
      $variant === 'warning' ? 'rgba(146,64,14,0.08)'  :
      'rgba(29,78,216,0.08)'};
  }
`;

// ─── Empty / Loading States ────────────────────────────────────────────────────

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.spacing.xxl}px;

  .icon  { font-size: 3rem; margin-bottom: ${theme.spacing.md}px; }
  .title { font-size: ${theme.typography.fontSize.lg}; color: ${theme.colors.text.primary}; font-weight: ${theme.typography.fontWeight.semibold}; margin-bottom: 8px; }
  .sub   { font-size: ${theme.typography.fontSize.sm}; color: ${theme.colors.text.secondary}; }
`;

const SpinnerWrap = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${theme.spacing.xxl}px;
`;

const Spinner = styled.div`
  width: 36px;
  height: 36px;
  border: 3px solid rgba(59,130,246,0.2);
  border-top-color: ${theme.colors.primary.main};
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

// ─── Modals ────────────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  z-index: ${theme.zIndex.modalBackdrop};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.lg}px;
  animation: ${fadeIn} 0.2s ease;
`;

const Modal = styled.div`
  background: #111827;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: ${theme.radius.xl}px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5);
  width: 100%;
  max-width: ${({ $wide }) => $wide ? '820px' : '480px'};
  max-height: 88vh;
  overflow-y: auto;
  animation: ${fadeIn} 0.2s ease;

  /* Light mode — solid white */
  [data-theme="light"] & {
    background: #ffffff;
    border-color: rgba(0,0,0,0.12);
    box-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1);
  }
`;

const ModalHeader = styled.div`
  padding: ${theme.spacing.xl}px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${theme.spacing.md}px;

  .title {
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: #ffffff;
  }
  .sub {
    font-size: ${theme.typography.fontSize.sm};
    color: rgba(255,255,255,0.7);
    margin-top: 4px;
  }

  [data-theme="light"] & .title { color: #0f172a; }
  [data-theme="light"] & .sub   { color: #475569; }
  [data-theme="light"] & { border-bottom-color: rgba(0,0,0,0.1); }
`;

const ModalBody = styled.div`
  padding: ${theme.spacing.xl}px;
`;

const ModalText = styled.p`
  color: rgba(255,255,255,0.8);
  margin: ${({ $mb }) => $mb || 0};
  font-size: ${theme.typography.fontSize.sm};
  line-height: 1.6;

  strong {
    color: #ffffff;
    font-weight: ${theme.typography.fontWeight.semibold};
  }

  [data-theme="light"] & {
    color: #334155;
  }
  [data-theme="light"] & strong {
    color: #0f172a;
  }
`;

const ModalFooter = styled.div`
  padding: ${theme.spacing.lg}px ${theme.spacing.xl}px;
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  justify-content: flex-end;
  gap: ${theme.spacing.md}px;

  [data-theme="light"] & { border-top-color: rgba(0,0,0,0.1); }
`;

const CloseBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.sm}px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all ${theme.transitions.fast};

  &:hover { background: rgba(255,255,255,0.15); color: #ffffff; }

  [data-theme="light"] & {
    border-color: rgba(0,0,0,0.15);
    background: rgba(0,0,0,0.04);
    color: #475569;
  }
  [data-theme="light"] &:hover { background: rgba(0,0,0,0.08); color: #0f172a; }
`;

const PrimaryBtn = styled.button`
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  background: ${theme.colors.primary.gradient};
  color: #fff;
  border: none;
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover   { filter: brightness(1.1); transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const DangerBtn = styled(PrimaryBtn)`
  background: linear-gradient(135deg,#ef4444 0%,#dc2626 100%);
`;

const SecondaryBtn = styled.button`
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  background: transparent;
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};

  &:hover { background: ${theme.colors.ui.hover}; color: ${theme.colors.text.primary}; }
`;

// ─── Detail View helpers ───────────────────────────────────────────────────────

const Section = styled.div`
  margin-bottom: ${theme.spacing.xl}px;

  &:last-child { margin-bottom: 0; }
`;

const SectionTitle = styled.h4`
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  color: #60a5fa;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 ${theme.spacing.md}px 0;

  [data-theme="light"] & { color: #2563eb; }
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.md}px;

  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const Field = styled.div`
  .label {
    font-size: ${theme.typography.fontSize.xs};
    color: rgba(255,255,255,0.5);
    margin-bottom: 4px;
  }
  .value {
    font-size: ${theme.typography.fontSize.sm};
    color: #ffffff;
    word-break: break-all;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: ${theme.radius.sm}px;
    padding: 6px 10px;
    min-height: 32px;
  }

  [data-theme="light"] & .label { color: #64748b; }
  [data-theme="light"] & .value {
    color: #0f172a;
    background: #f1f5f9;
    border-color: #cbd5e1;
  }
`;

const JsonBlock = styled.pre`
  background: #0d1117;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  font-size: 11px;
  color: #e6edf3;
  overflow-x: auto;
  max-height: 360px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ${theme.typography.fontFamily.mono};
`;

const Alert = styled.div`
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  background: ${({ $type }) =>
    $type === 'error'   ? 'rgba(239,68,68,0.12)'   :
    $type === 'success' ? 'rgba(16,185,129,0.12)'  :
    'rgba(245,158,11,0.12)'};
  border: 1px solid ${({ $type }) =>
    $type === 'error'   ? 'rgba(239,68,68,0.35)'    :
    $type === 'success' ? 'rgba(16,185,129,0.35)'   :
    'rgba(245,158,11,0.35)'};
  border-radius: ${theme.radius.md}px;
  color: ${({ $type }) =>
    $type === 'error'   ? '#f87171' :
    $type === 'success' ? '#34d399' :
    '#fbbf24'};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  margin-bottom: ${theme.spacing.md}px;
  animation: ${pulse} 0.3s ease;

  [data-theme="light"] & {
    color: ${({ $type }) =>
      $type === 'error'   ? '#b91c1c' :
      $type === 'success' ? '#065f46' :
      '#92400e'};
  }
`;

// ─── Pagination ────────────────────────────────────────────────────────────────

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  border-top: 1px solid ${theme.colors.ui.border};
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.text.secondary};
`;

const PageBtns = styled.div`
  display: flex;
  gap: 4px;
`;

const PageBtn = styled.button`
  padding: 4px 10px;
  border-radius: ${theme.radius.sm}px;
  border: 1px solid ${({ $active }) => $active ? theme.colors.primary.main : theme.colors.ui.border};
  background: ${({ $active }) => $active ? 'rgba(59,130,246,0.2)' : 'transparent'};
  color: ${({ $active }) => $active ? theme.colors.primary.main : theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${({ $active }) => $active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.regular};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.4 : 1};
  transition: all ${theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${theme.colors.ui.hover};
    color: ${theme.colors.text.primary};
  }
`;

// ─── Utility helpers ───────────────────────────────────────────────────────────

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/** Derive pipeline stages from document data */
const getPipelineStages = (doc) => ({
  uploaded:   !!doc.file_path,
  classified: !!(doc.doc_type || doc.classification_confidence),
  extracted:  !!(doc.extracted_data && Object.keys(doc.extracted_data).length > 0),
  processed:  doc.processing_status === 'processed' || doc.processing_status === 'completed',
});

/** Map processing_status → our badge key */
const resolveStatus = (doc) => {
  const s = (doc.processing_status || '').toLowerCase();
  if (s === 'processed' || s === 'completed') return 'processed';
  if (s === 'failed' || s === 'error')        return 'failed';
  if (doc.extracted_data)                      return 'extracted';
  if (doc.doc_type)                            return 'classified';
  if (doc.file_path)                           return 'uploaded';
  return 'pending';
};

const PAGE_SIZE = 15;

// ─── Main Component ────────────────────────────────────────────────────────────

const HistoryReportsPanel = () => {
  const [documents, setDocuments]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);

  // table state
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType]     = useState('all');
  const [sortField, setSortField]       = useState('created_at');
  const [sortDir, setSortDir]           = useState('desc');
  const [page, setPage]                 = useState(1);

  // modals
  const [viewDoc, setViewDoc]           = useState(null);
  const [deleteDoc, setDeleteDoc]       = useState(null);
  const [updateDoc, setUpdateDoc]       = useState(null);

  // per-row operation state
  const [opLoading, setOpLoading]       = useState({});
  const [opMsg, setOpMsg]               = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);
    setError(null);
    try {
      const data = await documentService.getAllDocuments();
      const list = Array.isArray(data) ? data : (data.documents || []);
      setDocuments(list);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Could not load documents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const stats = {
    total:     documents.length,
    processed: documents.filter(d => resolveStatus(d) === 'processed').length,
    extracted: documents.filter(d => ['extracted','processed'].includes(resolveStatus(d))).length,
    failed:    documents.filter(d => resolveStatus(d) === 'failed').length,
  };

  // ── Sort + Filter ──────────────────────────────────────────────────────────

  const docTypes = [...new Set(documents.map(d => d.doc_type).filter(Boolean))];

  const filtered = documents
    .filter(d => {
      const q = search.toLowerCase();
      if (q && !((d.filename || '').toLowerCase().includes(q) ||
                 (d.original_filename || '').toLowerCase().includes(q) ||
                 (d.doc_type || '').toLowerCase().includes(q) ||
                 (d.hs_code || '').toLowerCase().includes(q))) return false;
      if (filterStatus !== 'all' && resolveStatus(d) !== filterStatus) return false;
      if (filterType   !== 'all' && (d.doc_type || '—') !== filterType)  return false;
      return true;
    })
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'created_at') { va = new Date(va); vb = new Date(vb); }
      if (va < vb) return sortDir === 'asc' ? -1 :  1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortArrow = (field) =>
    sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    const doc = deleteDoc;
    setDeleteDoc(null);
    setOpLoading(p => ({ ...p, [doc.id]: 'deleting' }));
    try {
      await documentService.deleteDocument(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setOpMsg({ type: 'success', text: `"${doc.filename}" permanently deleted from the database.` });
    } catch (err) {
      setOpMsg({
        type: 'error',
        text: err?.response?.data?.detail || `Failed to delete "${doc.filename}". Please try again.`,
      });
    } finally {
      setOpLoading(p => { const n = { ...p }; delete n[doc.id]; return n; });
    }
  };

  // ── Rescan / Update ────────────────────────────────────────────────────────

  const confirmRescan = async () => {
    const doc = updateDoc;
    setUpdateDoc(null);
    setOpLoading(p => ({ ...p, [doc.id]: 'rescanning' }));
    try {
      await documentService.rescanDocument(
        doc.content_hash || '',
        doc.file_path,
        doc.filename
      );
      setOpMsg({ type: 'success', text: `"${doc.filename}" re-extraction queued. Refreshing…` });
      setTimeout(() => fetchDocuments(true), 3000);
    } catch (err) {
      setOpMsg({ type: 'error', text: err?.response?.data?.detail || 'Re-scan failed.' });
    } finally {
      setOpLoading(p => { const n = { ...p }; delete n[doc.id]; return n; });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PanelContainer>
      {/* Header */}
      <PanelHeader>
        <h1>History &amp; Reports</h1>
        <p>Complete registry of all uploaded documents and their processing pipeline status.</p>
      </PanelHeader>

      {/* Stats */}
      <StatsRow>
        <StatCard>
          <StatIcon $color="linear-gradient(135deg,#3B82F6 0%,#06B6D4 100%)">📄</StatIcon>
          <StatInfo>
            <div className="value">{stats.total}</div>
            <div className="label">Total Documents</div>
          </StatInfo>
        </StatCard>
        <StatCard>
          <StatIcon $color="linear-gradient(135deg,#06B6D4 0%,#22d3ee 100%)">🔬</StatIcon>
          <StatInfo>
            <div className="value">{stats.extracted}</div>
            <div className="label">Data Extracted</div>
          </StatInfo>
        </StatCard>
        <StatCard>
          <StatIcon $color="linear-gradient(135deg,#10b981 0%,#059669 100%)">✅</StatIcon>
          <StatInfo>
            <div className="value">{stats.processed}</div>
            <div className="label">Fully Processed</div>
          </StatInfo>
        </StatCard>
        <StatCard>
          <StatIcon $color="linear-gradient(135deg,#ef4444 0%,#dc2626 100%)">⚠️</StatIcon>
          <StatInfo>
            <div className="value">{stats.failed}</div>
            <div className="label">Failed</div>
          </StatInfo>
        </StatCard>
      </StatsRow>

      {/* Alert bar */}
      {opMsg && (
        <Alert $type={opMsg.type} onClick={() => setOpMsg(null)} style={{ cursor: 'pointer' }}>
          {opMsg.text} &nbsp;✕
        </Alert>
      )}

      {/* Toolbar */}
      <Toolbar>
        <SearchInput
          placeholder="Search by name, type, HS code…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <FilterSelect value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="all">All Statuses</option>
          {Object.entries(statusConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </FilterSelect>
        <FilterSelect value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option value="all">All Types</option>
          {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </FilterSelect>
        <RefreshBtn onClick={() => fetchDocuments(true)} $spinning={refreshing}>
          <span className="icon">↻</span> Refresh
        </RefreshBtn>
      </Toolbar>

      {/* Table */}
      <TableWrapper>
        {loading ? (
          <SpinnerWrap><Spinner /></SpinnerWrap>
        ) : error ? (
          <EmptyState>
            <div className="icon">⚠️</div>
            <div className="title">Unable to load documents</div>
            <div className="sub">{error}</div>
          </EmptyState>
        ) : pageData.length === 0 ? (
          <EmptyState>
            <div className="icon">📂</div>
            <div className="title">
              {search || filterStatus !== 'all' || filterType !== 'all'
                ? 'No documents match your filters'
                : 'No documents uploaded yet'}
            </div>
            <div className="sub">
              {search || filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Upload documents via the Data Intake panel — they will appear here automatically.'}
            </div>
          </EmptyState>
        ) : (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <tr>
                    <Th $sortable onClick={() => handleSort('filename')}>
                      Document{sortArrow('filename')}
                    </Th>
                    <Th $sortable onClick={() => handleSort('doc_type')}>
                      Type{sortArrow('doc_type')}
                    </Th>
                    <Th>Pipeline</Th>
                    <Th $sortable onClick={() => handleSort('processing_status')}>
                      Status{sortArrow('processing_status')}
                    </Th>
                    <Th $sortable onClick={() => handleSort('created_at')}>
                      Uploaded{sortArrow('created_at')}
                    </Th>
                    <Th style={{ textAlign: 'center', minWidth: 160 }}>Actions</Th>
                  </tr>
                </THead>
                <tbody>
                  {pageData.map(doc => {
                    const stages = getPipelineStages(doc);
                    const status = resolveStatus(doc);
                    const busy   = opLoading[doc.id];
                    return (
                      <Tr key={doc.id}>
                        {/* Name */}
                        <Td>
                          <DocName title={doc.filename}>{doc.filename || '—'}</DocName>
                          <DocSub>ID #{doc.id} · {doc.file_type || 'pdf'}</DocSub>
                        </Td>

                        {/* Doc type */}
                        <Td>
                          <span style={{ color: theme.colors.text.primary }}>
                            {doc.doc_type || '—'}
                          </span>
                          {doc.classification_confidence && (
                            <DocSub>{(parseFloat(doc.classification_confidence) * 100).toFixed(0)}% conf.</DocSub>
                          )}
                        </Td>

                        {/* Pipeline */}
                        <Td>
                          <PipelineRow>
                            <StagePill $done={stages.uploaded}>Upload</StagePill>
                            <StageDivider />
                            <StagePill $done={stages.classified}>Classify</StagePill>
                            <StageDivider />
                            <StagePill $done={stages.extracted}>Extract</StagePill>
                            <StageDivider />
                            <StagePill $done={stages.processed}>Process</StagePill>
                          </PipelineRow>
                        </Td>

                        {/* Status */}
                        <Td>
                          <StatusBadge $status={status}>
                            {statusConfig[status]?.label || status}
                          </StatusBadge>
                        </Td>

                        {/* Date */}
                        <Td style={{ whiteSpace: 'nowrap', color: theme.colors.text.secondary }}>
                          {formatDate(doc.created_at)}
                        </Td>

                        {/* Actions — always visible */}
                        <Td style={{ textAlign: 'center' }}>
                          <ActionGroup style={{ justifyContent: 'center' }}>
                            <ActionBtn
                              onClick={() => setViewDoc(doc)}
                              disabled={!!busy}
                              style={{ padding: '7px 16px', fontWeight: 600 }}
                            >
                              👁 View
                            </ActionBtn>
                            <ActionBtn
                              $variant="danger"
                              onClick={() => setDeleteDoc(doc)}
                              disabled={!!busy}
                              style={{ padding: '7px 16px', fontWeight: 600 }}
                            >
                              {busy === 'deleting' ? '…' : '🗑 Delete'}
                            </ActionBtn>
                          </ActionGroup>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableScroll>

            {/* Pagination */}
            <Pagination>
              <span>
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} document
                {filtered.length !== 1 ? 's' : ''}
              </span>
              <PageBtns>
                <PageBtn disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</PageBtn>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 7) {
                    if (page <= 4) p = i + 1;
                    else if (page >= totalPages - 3) p = totalPages - 6 + i;
                    else p = page - 3 + i;
                  }
                  return (
                    <PageBtn key={p} $active={p === page} onClick={() => setPage(p)}>
                      {p}
                    </PageBtn>
                  );
                })}
                <PageBtn disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</PageBtn>
              </PageBtns>
            </Pagination>
          </>
        )}
      </TableWrapper>

      {/* ── View Modal ─────────────────────────────────────────────────────────── */}
      {viewDoc && (
        <Overlay onClick={() => setViewDoc(null)}>
          <Modal $wide onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <div>
                <div className="title">{viewDoc.filename}</div>
                <div className="sub">Document ID #{viewDoc.id} · Uploaded {formatDate(viewDoc.created_at)}</div>
              </div>
              <CloseBtn onClick={() => setViewDoc(null)}>✕</CloseBtn>
            </ModalHeader>
            <ModalBody>
              {/* Pipeline visual */}
              <Section>
                <SectionTitle>Processing Pipeline</SectionTitle>
                {(() => {
                  const stages = getPipelineStages(viewDoc);
                  return (
                    <PipelineRow style={{ gap: 8 }}>
                      {[
                        { key: 'uploaded',   label: 'Uploaded',   icon: '📤' },
                        { key: 'classified', label: 'Classified',  icon: '🏷️' },
                        { key: 'extracted',  label: 'Extracted',   icon: '🔬' },
                        { key: 'processed',  label: 'Processed',   icon: '✅' },
                      ].map((s, i) => (
                        <React.Fragment key={s.key}>
                          {i > 0 && <StageDivider style={{ width: 24 }} />}
                          <StagePill $done={stages[s.key]} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
                            {s.icon} {s.label}
                          </StagePill>
                        </React.Fragment>
                      ))}
                    </PipelineRow>
                  );
                })()}
              </Section>

              {/* Core metadata */}
              <Section>
                <SectionTitle>Document Details</SectionTitle>
                <Grid2>
                  <Field>
                    <div className="label">Document ID</div>
                    <div className="value" style={{ fontFamily: theme.typography.fontFamily.mono, fontWeight: 700 }}>
                      #{viewDoc.id}
                    </div>
                  </Field>
                  <Field>
                    <div className="label">Upload Date</div>
                    <div className="value">{formatDate(viewDoc.created_at)}</div>
                  </Field>
                  <Field>
                    <div className="label">Filename</div>
                    <div className="value">{viewDoc.filename || '—'}</div>
                  </Field>
                  <Field>
                    <div className="label">Original Filename</div>
                    <div className="value">{viewDoc.original_filename || '—'}</div>
                  </Field>
                  <Field>
                    <div className="label">Document Type</div>
                    <div className="value">{viewDoc.doc_type || '—'}</div>
                  </Field>
                  <Field>
                    <div className="label">Classification Confidence</div>
                    <div className="value">
                      {viewDoc.classification_confidence
                        ? `${(parseFloat(viewDoc.classification_confidence) * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </Field>
                  <Field>
                    <div className="label">Processing Status</div>
                    <div className="value">
                      <StatusBadge $status={resolveStatus(viewDoc)}>
                        {statusConfig[resolveStatus(viewDoc)]?.label || viewDoc.processing_status}
                      </StatusBadge>
                    </div>
                  </Field>
                  <Field>
                    <div className="label">File Type</div>
                    <div className="value">{viewDoc.file_type || '—'}</div>
                  </Field>
                </Grid2>
              </Section>

              {/* Trade data */}
              {(viewDoc.hs_code || viewDoc.gst_number || viewDoc.iec_number) && (
                <Section>
                  <SectionTitle>Trade & Tax Data</SectionTitle>
                  <Grid2>
                    {viewDoc.hs_code && (
                      <Field>
                        <div className="label">HS Code</div>
                        <div className="value" style={{ fontFamily: theme.typography.fontFamily.mono }}>
                          {viewDoc.hs_code}
                        </div>
                      </Field>
                    )}
                    {viewDoc.hs_code_description && (
                      <Field>
                        <div className="label">HS Description</div>
                        <div className="value">{viewDoc.hs_code_description}</div>
                      </Field>
                    )}
                    {viewDoc.gst_number && (
                      <Field>
                        <div className="label">GST Number</div>
                        <div className="value">{viewDoc.gst_number}</div>
                      </Field>
                    )}
                    {viewDoc.iec_number && (
                      <Field>
                        <div className="label">IEC Number</div>
                        <div className="value">{viewDoc.iec_number}</div>
                      </Field>
                    )}
                  </Grid2>
                </Section>
              )}

              {/* File path */}
              <Section>
                <SectionTitle>Storage</SectionTitle>
                <Field>
                  <div className="label">Server File Path</div>
                  <div className="value" style={{ fontFamily: theme.typography.fontFamily.mono, fontSize: '0.75rem' }}>
                    {viewDoc.file_path || '—'}
                  </div>
                </Field>
              </Section>

              {/* Extracted data */}
              {viewDoc.extracted_data && Object.keys(viewDoc.extracted_data).length > 0 && (
                <Section>
                  <SectionTitle>Extracted Data</SectionTitle>
                  <JsonBlock>
                    {JSON.stringify(viewDoc.extracted_data, null, 2)}
                  </JsonBlock>
                </Section>
              )}
            </ModalBody>
            <ModalFooter>
              <SecondaryBtn onClick={() => setViewDoc(null)}>Close</SecondaryBtn>
              <PrimaryBtn
                onClick={() => { setViewDoc(null); setUpdateDoc(viewDoc); }}
                disabled={!viewDoc.file_path}
              >
                Rescan Document
              </PrimaryBtn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────────────────────── */}
      {deleteDoc && (
        <Overlay onClick={() => setDeleteDoc(null)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <div>
                <div className="title">Delete Document</div>
                <div className="sub">This action cannot be undone.</div>
              </div>
              <CloseBtn onClick={() => setDeleteDoc(null)}>✕</CloseBtn>
            </ModalHeader>
            <ModalBody>
              <ModalText>
                Are you sure you want to permanently delete{' '}
                <strong>"{deleteDoc.filename}"</strong>?
              </ModalText>
              <ModalText $mb="12px 0 0 0">
                This will permanently remove the file, all extracted data, classification results,
                and processing history from the database. <strong>This cannot be undone.</strong>
              </ModalText>
            </ModalBody>
            <ModalFooter>
              <SecondaryBtn onClick={() => setDeleteDoc(null)}>Cancel</SecondaryBtn>
              <DangerBtn onClick={confirmDelete}>Delete Permanently</DangerBtn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}

      {/* ── Rescan Confirm Modal ────────────────────────────────────────────────── */}
      {updateDoc && (
        <Overlay onClick={() => setUpdateDoc(null)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <div>
                <div className="title">Re-scan Document</div>
                <div className="sub">Re-extract all data from this document.</div>
              </div>
              <CloseBtn onClick={() => setUpdateDoc(null)}>✕</CloseBtn>
            </ModalHeader>
            <ModalBody>
              <ModalText $mb="0 0 12px 0">
                Re-scanning{' '}
                <strong>"{updateDoc.filename}"</strong>{' '}
                will re-run classification and data extraction, overwriting the current extracted data.
              </ModalText>
              <ModalText>
                Current status:{' '}
                <StatusBadge $status={resolveStatus(updateDoc)}>
                  {statusConfig[resolveStatus(updateDoc)]?.label}
                </StatusBadge>
              </ModalText>
            </ModalBody>
            <ModalFooter>
              <SecondaryBtn onClick={() => setUpdateDoc(null)}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={confirmRescan}>Rescan Now</PrimaryBtn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
    </PanelContainer>
  );
};

export default HistoryReportsPanel;
