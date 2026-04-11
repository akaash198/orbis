/**
 * M02ExtractionPage.jsx
 *
 * AI document extraction page — select a document, run the M02 pipeline,
 * watch live progress, view the 12 key customs fields with confidence badges,
 * and download the result as JSON.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileJson,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { m02Service } from '../../services/api';

const ESSENTIAL_FIELDS_META = {
  invoice_number:    { label: 'Invoice Number',    icon: '🧾' },
  invoice_date:      { label: 'Invoice Date',       icon: '📅' },
  exporter_name:     { label: 'Exporter Name',      icon: '🏭' },
  importer_name:     { label: 'Importer Name',      icon: '🏢' },
  gst_number:        { label: 'GST Number',         icon: '🔢' },
  shipment_address:  { label: 'Shipment Address',   icon: '📍' },
  hsn_code:          { label: 'HSN Code',           icon: '🏷️' },
  quantity:          { label: 'Quantity',            icon: '⚖️' },
  unit_price:        { label: 'Unit Price',         icon: '💰' },
  currency:          { label: 'Currency',            icon: '💱' },
  total_value:       { label: 'Total Value',        icon: '💵' },
  country_of_origin: { label: 'Country of Origin', icon: '🌐' },
  freight:           { label: 'Freight',            icon: '🚢' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const KEY_FIELD_META = {
  invoice_number:    { label: 'Invoice Number',      icon: '🧾', group: 'Identity' },
  invoice_date:      { label: 'Invoice Date',         icon: '📅', group: 'Identity' },
  exporter_name:     { label: 'Exporter Name',        icon: '🏭', group: 'Parties' },
  importer_name:     { label: 'Importer Name',        icon: '🏢', group: 'Parties' },
  gst_number:        { label: 'GST Number',           icon: '🔢', group: 'Compliance' },
  shipment_address:  { label: 'Shipment Address',     icon: '📍', group: 'Logistics' },
  hsn_code:          { label: 'HSN Code',             icon: '📦', group: 'Goods' },
  quantity:          { label: 'Quantity',              icon: '⚖️',  group: 'Goods' },
  unit_price:        { label: 'Unit Price',           icon: '💰', group: 'Financials' },
  total_value:       { label: 'Total Value',          icon: '💵', group: 'Financials' },
  country_of_origin: { label: 'Country of Origin',   icon: '🌐', group: 'Logistics' },
  freight:           { label: 'Freight',              icon: '🚢', group: 'Financials' },
  insurance:         { label: 'Insurance',            icon: '🛡️', group: 'Financials' },
};

const FIELD_GROUPS = ['Identity', 'Parties', 'Compliance', 'Logistics', 'Goods', 'Financials'];

const STATUS_META = {
  processing: { label: 'Processing', color: '#C9A520', icon: Loader2, spin: true },
  pending:    { label: 'Pending Review', color: '#60A5FA', icon: Clock, spin: false },
  in_review:  { label: 'In Review', color: '#A78BFA', icon: Eye, spin: false },
  approved:   { label: 'Approved', color: '#3DBE7E', icon: CheckCircle2, spin: false },
  error:      { label: 'Error', color: '#F07070', icon: AlertCircle, spin: false },
};

const QUEUE_COLOR = {
  auto:          '#3DBE7E',
  soft_review:   '#C9A520',
  hard_review:   '#F07070',
  quality_alert: '#F07070',
  pending:       '#60A5FA',
};

const POLL_INTERVAL_MS = 2500;

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

function confBadge(score) {
  return { label: '—', bg: 'rgba(255,255,255,0.04)', color: '#4A5A72' };
}

function fmtVal(val) {
  if (val == null || val === '') return <span style={{ color: '#4A5A72', fontStyle: 'italic' }}>—</span>;
  if (typeof val === 'object') return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{JSON.stringify(val)}</span>;
  return String(val);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5A72', margin: 0 }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

function ConfidenceBar({ value }) {
  return null;
}

function FieldCard({ fieldKey, value }) {
  const meta = KEY_FIELD_META[fieldKey] || { label: fieldKey, icon: '📄' };
  return (
    <div style={{
      background: '#161D2C',
      border: '1px solid #1E2638',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#8B97AE', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span>{meta.icon}</span>
        {meta.label}
      </span>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F5', wordBreak: 'break-word' }}>
        {fmtVal(value)}
      </div>
    </div>
  );
}

function PipelineSteps({ status, queue }) {
  const steps = [
    { key: 'ocr',       label: 'OCR' },
    { key: 'layout',    label: 'Layout' },
    { key: 'extract',   label: 'Extract' },
    { key: 'gliner',    label: 'GLiNER' },
    { key: 'normalise', label: 'Normalise' },
    { key: 'score',     label: 'Score' },
    { key: 'route',     label: 'Route' },
  ];

  const done = status !== 'processing' && status !== 'error';
  const error = status === 'error';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', rowGap: 8 }}>
      {steps.map((step, i) => {
        const isActive = status === 'processing';
        const stepDone = done;
        const stepError = error;
        const color = stepError ? '#F07070' : stepDone ? '#3DBE7E' : isActive ? '#C9A520' : '#2A3448';
        return (
          <React.Fragment key={step.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: stepDone ? 'rgba(61,190,126,0.15)' : stepError ? 'rgba(240,112,112,0.15)' : isActive ? 'rgba(201,165,32,0.15)' : 'rgba(255,255,255,0.03)',
                border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {stepDone && !stepError && <CheckCircle2 size={13} color="#3DBE7E" />}
                {stepError && <X size={13} color="#F07070" />}
                {isActive && !stepDone && !stepError && (
                  <Loader2 size={13} color="#C9A520" style={{ animation: 'spin 1s linear infinite' }} />
                )}
                {!isActive && !stepDone && !stepError && (
                  <span style={{ fontSize: 9, color: '#4A5A72', fontWeight: 700 }}>{i + 1}</span>
                )}
              </div>
              <span style={{ fontSize: 9, color: stepDone ? '#5AD49A' : stepError ? '#F07070' : isActive ? '#E8C84A' : '#4A5A72', fontWeight: 600 }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 18, height: 1, background: stepDone ? '#3DBE7E' : '#2A3448', margin: '0 0 16px 0', flexShrink: 0 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DocumentSelector({ documents, selected, onSelect, loading }) {
  const [search, setSearch] = useState('');
  const filtered = documents.filter(d =>
    (d.filename || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      background: '#111620',
      border: '1px solid #1E2638',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1E2638', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={14} color="#4A5A72" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search documents…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#E2E8F5', fontSize: 13,
          }}
        />
        {loading && <Loader2 size={14} color="#4A5A72" style={{ animation: 'spin 1s linear infinite' }} />}
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#4A5A72', fontSize: 13 }}>
            {loading ? 'Loading documents…' : 'No documents found'}
          </div>
        )}
        {filtered.map(doc => {
          const isSelected = selected?.document_id === doc.document_id;
          const m02 = doc.m02 || {};
          return (
            <button
              key={doc.document_id}
              type="button"
              onClick={() => onSelect(doc)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 16px',
                background: isSelected ? 'rgba(201,165,32,0.08)' : 'transparent',
                borderLeft: `3px solid ${isSelected ? '#C9A520' : 'transparent'}`,
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              <FileText size={16} color={isSelected ? '#C9A520' : '#4A5A72'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#E8C84A' : '#E2E8F5', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.filename}
                </p>
                <p style={{ fontSize: 11, color: '#4A5A72', margin: 0 }}>
                  {doc.file_type || 'document'} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}
                </p>
              </div>
              {m02.has_result && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                  background: 'rgba(61,190,126,0.12)', color: '#3DBE7E',
                }}>
                  M02 ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AllFieldsTable({ fields }) {
  const [open, setOpen] = useState(false);
  if (!fields || Object.keys(fields).length === 0) return null;
  const entries = Object.entries(fields).filter(([k]) => !k.startsWith('_'));
  return (
    <div style={{ border: '1px solid #1E2638', borderRadius: 12, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: '#111620', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#8B97AE' }}>
          All Extracted Fields ({entries.length})
        </span>
        {open ? <ChevronUp size={14} color="#4A5A72" /> : <ChevronDown size={14} color="#4A5A72" />}
      </button>
      {open && (
        <div style={{ background: '#0A0D14', maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E2638' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#4A5A72', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em' }}>Field</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#4A5A72', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([k, v], i) => (
                <tr key={k} style={{ borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '8px 16px', color: '#8B97AE', fontFamily: 'monospace', fontSize: 11 }}>{k}</td>
                  <td style={{ padding: '8px 16px', color: '#E2E8F5', wordBreak: 'break-all' }}>{fmtVal(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function M02ExtractionPage({ onNavigate, initialDocumentId, autoExtract }) {
  // Document list
  const [documents, setDocuments]         = useState([]);
  const [docsLoading, setDocsLoading]     = useState(true);
  const [docsError, setDocsError]         = useState(null);

  // Selected doc & result
  const [selected, setSelected]           = useState(null);
  const [result, setResult]               = useState(null);
  const [resultLoading, setResultLoading] = useState(false);

  // Pipeline trigger
  const [running, setRunning]             = useState(false);
  const [runError, setRunError]           = useState(null);

  // Download
  const [downloading, setDownloading]     = useState(false);

  // View toggle
  const [jsonView, setJsonView]           = useState(false);

  // HSN code handling
  const [hsnEditMode, setHsnEditMode]   = useState(false);
  const [hsnEditValue, setHsnEditValue] = useState('');

  // Toast notifications
  const [toast, setToast]                 = useState(null);

  const pollRef = useRef(null);
  const pollFailRef = useRef(0);
  const pollStartRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchDocuments = useCallback(() => {
    setDocsLoading(true);
    setDocsError(null);
    return m02Service.listDocuments(100)
      .then(data => {
        setDocuments(data.documents || []);
        return data.documents || [];
      })
      .catch((err) => {
        setDocuments([]);
        const msg = err?.response?.data?.detail || err?.message || 'Failed to load documents';
        setDocsError(msg);
        return [];
      })
      .finally(() => setDocsLoading(false));
  }, []);

  // ── Fetch document list on mount ────────────────────────────────────────────
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ── Handle incoming document ID from DataIntake ───────────────────────────
  useEffect(() => {
    const selectInitialDocument = async () => {
      if (initialDocumentId && documents.length > 0) {
        const doc = documents.find(d => d.document_id === initialDocumentId);
        if (doc) {
          setSelected(doc);
          
          // If already has extraction result, load it
          if (doc.m02?.has_result && doc.m02.result_id) {
            setResultLoading(true);
            try {
              const r = await m02Service.getResult(doc.document_id);
              setResult(r);
              if (r.review_status === 'processing') {
                setRunning(true);
                startPolling(doc.document_id);
              }
            } catch (err) {
              console.log('No existing result for this document');
            } finally {
              setResultLoading(false);
            }
          } else if (autoExtract) {
            // Auto-run extraction if requested
            setRunning(true);
            setRunError(null);
            try {
              await m02Service.process(doc.document_id);
              setResult({ review_status: 'processing', review_queue: 'pending' });
              startPolling(doc.document_id);
            } catch (err) {
              setRunning(false);
              const msg = err?.response?.data?.detail || err.message || 'Failed to start pipeline';
              setRunError(msg);
              showToast(msg, 'error');
            }
          }
        }
      }
    };
    
    if (documents.length > 0 && initialDocumentId) {
      selectInitialDocument();
    }
  }, [documents, initialDocumentId, autoExtract]);

  // ── Poll for result while processing ──────────────────────────────────────
  const startPolling = useCallback((docId) => {
    stopPolling();
    pollFailRef.current = 0;
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const r = await m02Service.getResult(docId);
        pollFailRef.current = 0;
        setResult(r);
        if (r.review_status !== 'processing') {
          stopPolling();
          setRunning(false);
          if (r.review_status === 'error') {
            showToast('Extraction failed. Check quality alert queue.', 'error');
          } else {
            showToast('M02 extraction complete!', 'success');
          }
        }
      } catch (err) {
        pollFailRef.current += 1;
        const elapsed = Date.now() - pollStartRef.current;
        const tooManyErrors = pollFailRef.current >= 5;
        const tooLong = elapsed > 120000;
        if (tooManyErrors || tooLong) {
          stopPolling();
          setRunning(false);
          const msg = err?.response?.data?.detail || err?.message || 'Polling failed';
          setRunError(`Could not fetch extraction status: ${msg}`);
          showToast('Polling stopped due to repeated errors. Please retry.', 'error');
        }
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  useEffect(() => () => { stopPolling(); }, [stopPolling]);

  // ── Select document ────────────────────────────────────────────────────────
  const handleSelect = async (doc) => {
    setSelected(doc);
    setResult(null);
    setRunError(null);
    if (doc.m02?.has_result && doc.m02.result_id) {
      setResultLoading(true);
      try {
        const r = await m02Service.getResult(doc.document_id);
        setResult(r);
        if (r.review_status === 'processing') {
          setRunning(true);
          startPolling(doc.document_id);
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status && status !== 404) {
          showToast(err?.response?.data?.detail || 'Failed to load extraction result', 'error');
        }
      } finally {
        setResultLoading(false);
      }
    }
  };

  // ── Run M02 pipeline ───────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!selected) return;
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      await m02Service.process(selected.document_id);
      // Set a placeholder while pipeline runs
      setResult({ review_status: 'processing', review_queue: 'pending' });
      startPolling(selected.document_id);
    } catch (err) {
      setRunning(false);
      const msg = err?.response?.data?.detail || err.message || 'Failed to start pipeline';
      setRunError(msg);
      showToast(msg, 'error');
    }
  };

  // ── Download JSON ──────────────────────────────────────────────────────────
  const handleDownload = async (keyOnly) => {
    if (!selected) return;
    setDownloading(true);
    try {
      const resp = await m02Service.exportJson(selected.document_id, keyOnly);
      const blob = new Blob([resp.data], { type: 'application/json' });
      triggerDownload(blob, `m02_extraction_${selected.document_id}${keyOnly ? '_key_fields' : ''}.json`);
      showToast('JSON downloaded!', 'success');
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (message, type = 'default') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── HSN Code Navigation ─────────────────────────────────────────────────
  const handleMoveToHSN = (hsnCode, goodsDesc) => {
    let description = goodsDesc;
    
    if (!description) {
      // Try line items first
      if (lineItems.length > 0) {
        const firstItem = lineItems[0];
        description = firstItem.description || firstItem.product_description || 
                     firstItem.goods_description || firstItem.name || 
                     firstItem.item_description || null;
      }
      
      // Try essential fields directly
      if (!description) {
        description = normalised.goods_description || 
                     normalised.product_description ||
                     normalised.description ||
                     normalised.item_description ||
                     normalised.product ||
                     normalised.name || null;
      }
    }
    
    // Fallback to document name
    description = description || selected?.filename || 'Document extraction';
    
    // Clean up the description - remove file extensions
    if (description) {
      description = description.replace(/\.(pdf|jpg|jpeg|png|tiff|tif)$/i, '').trim();
    }
    
    console.log('[M02Page HSN Navigation] Product description:', description, 'HSN:', hsnCode);
    onNavigate?.('hs-codes', { hsnCode, goodsDesc: description, navigationKey: Date.now() });
  };

  const handleSaveHsn = () => {
    if (hsnEditValue && hsnEditValue.trim()) {
      let description = normalised.goods_description || 
                       normalised.product_description ||
                       normalised.description ||
                       normalised.item_description ||
                       normalised.product || null;
      description = description || selected?.filename || 'Manual entry';
      
      if (description) {
        description = description.replace(/\.(pdf|jpg|jpeg|png|tiff|tif)$/i, '').trim();
      }
      
      handleMoveToHSN(hsnEditValue.trim(), description);
    }
    setHsnEditMode(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const statusMeta = result ? (STATUS_META[result.review_status] || STATUS_META.pending) : null;
  const isProcessing = result?.review_status === 'processing';
  const hasResult = result && result.review_status !== 'processing' && result.review_status !== 'error';
  const normalised = (
    result?.normalised_fields && typeof result.normalised_fields === 'object'
      ? result.normalised_fields
      : (result?.extracted_fields && typeof result.extracted_fields === 'object'
        ? result.extracted_fields
        : {})
  );
  const detectedHsn = normalised.hsn_code || null;
  const lineItems = Array.isArray(normalised.line_items) ? normalised.line_items : [];
  const jsonString = JSON.stringify(result, null, 2);

  // Group key fields by their group
  const groupedFields = FIELD_GROUPS.map(group => ({
    group,
    fields: Object.entries(KEY_FIELD_META)
      .filter(([, meta]) => meta.group === group)
      .map(([key, meta]) => ({ key, meta, value: normalised[key] })),
  })).filter(g => g.fields.length > 0);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0D14', color: '#E2E8F5', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E2638; border-radius: 10px; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, maxWidth: 340,
          background: toast.type === 'success' ? 'rgba(61,190,126,0.18)' : toast.type === 'error' ? 'rgba(240,112,112,0.18)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(61,190,126,0.35)' : toast.type === 'error' ? 'rgba(240,112,112,0.35)' : '#1E2638'}`,
          color: toast.type === 'success' ? '#3DBE7E' : toast.type === 'error' ? '#F07070' : '#E2E8F5',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : toast.type === 'error' ? <AlertCircle size={15} /> : null}
          {toast.message}
          <button type="button" onClick={() => setToast(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(201,165,32,0.25), rgba(201,165,32,0.08))',
              border: '1px solid rgba(201,165,32,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} color="#C9A520" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                M02 Extraction
              </h1>
              <p style={{ fontSize: 13, color: '#8B97AE', margin: 0 }}>
                AI-powered customs field extraction · OCR → GLiNER → Normalise → JSON
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left Panel: Document Selector ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 20 }}>
              <SectionTitle>Select Document</SectionTitle>
              <DocumentSelector
                documents={documents}
                selected={selected}
                onSelect={handleSelect}
                loading={docsLoading}
              />
              {docsError && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(240,112,112,0.08)', border: '1px solid rgba(240,112,112,0.2)', borderRadius: 8 }}>
                  <AlertCircle size={13} color="#F07070" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#F07070', flex: 1 }}>{docsError}</span>
                  <button
                    type="button"
                    onClick={fetchDocuments}
                    style={{ border: '1px solid rgba(240,112,112,0.35)', background: 'transparent', color: '#F07070', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Run button */}
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={!selected || running}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: selected && !running ? 'pointer' : 'not-allowed',
                    background: selected && !running
                      ? 'linear-gradient(135deg, #C9A520, #A07C10)'
                      : 'rgba(255,255,255,0.04)',
                    color: selected && !running ? '#0A0D14' : '#4A5A72',
                    fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  {running ? (
                    <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Running M02 Pipeline…</>
                  ) : (
                    <><Zap size={15} /> Run M02 Extraction</>
                  )}
                </button>

                {runError && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'rgba(240,112,112,0.08)', border: '1px solid rgba(240,112,112,0.2)', borderRadius: 8 }}>
                    <AlertCircle size={13} color="#F07070" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: '#F07070' }}>{runError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status card */}
            {result && (
              <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 20 }}>
                <SectionTitle>Pipeline Status</SectionTitle>

                {/* Status badge */}
                {statusMeta && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <statusMeta.icon
                      size={15}
                      color={statusMeta.color}
                      style={statusMeta.spin ? { animation: 'spin 1s linear infinite' } : {}}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: statusMeta.color }}>{statusMeta.label}</span>
                    {result.review_queue && result.review_queue !== 'pending' && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: `${QUEUE_COLOR[result.review_queue] || '#4A5A72'}22`,
                        color: QUEUE_COLOR[result.review_queue] || '#4A5A72',
                        textTransform: 'capitalize',
                      }}>
                        {result.review_queue?.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                )}

                <PipelineSteps status={result.review_status} queue={result.review_queue} />

                {/* Doc type */}
                {result.document_type && result.document_type !== 'unknown' && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{result.document_type_icon || '📄'}</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F5', margin: 0 }}>{result.document_type_display || result.document_type}</p>
                    </div>
                  </div>
                )}

                {result.quality_alert && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(240,112,112,0.08)', border: '1px solid rgba(240,112,112,0.2)', borderRadius: 8 }}>
                    <AlertTriangle size={13} color="#F07070" />
                    <span style={{ fontSize: 12, color: '#F07070', fontWeight: 600 }}>Quality alert flagged</span>
                  </div>
                )}
              </div>
            )}

            {/* Download card */}
            {hasResult && (
              <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 20 }}>
                <SectionTitle>Download JSON</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleDownload(false)}
                    disabled={downloading}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(61,190,126,0.3)',
                      background: 'rgba(61,190,126,0.08)', color: '#3DBE7E', cursor: downloading ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'all 0.2s',
                    }}
                  >
                    {downloading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
                    Download All Fields
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(true)}
                    disabled={downloading}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(201,165,32,0.3)',
                      background: 'rgba(201,165,32,0.08)', color: '#E8C84A', cursor: downloading ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'all 0.2s',
                    }}
                  >
                    {downloading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileJson size={14} />}
                    Download 12 Key Fields
                  </button>
                  <p style={{ fontSize: 11, color: '#4A5A72', margin: '4px 0 0', textAlign: 'center' }}>
                    Uses reviewed values when available
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Panel: Results ─────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Empty state */}
            {!selected && (
              <div style={{
                background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 60,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center',
              }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(201,165,32,0.08)', border: '1px solid rgba(201,165,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={24} color="#C9A520" />
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F5', margin: '0 0 6px' }}>Select a document</p>
                  <p style={{ fontSize: 13, color: '#4A5A72', margin: 0 }}>Choose a document from the left panel, then run the M02 pipeline to extract customs fields.</p>
                </div>
              </div>
            )}

            {/* Loading existing result */}
            {selected && resultLoading && (
              <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 40, textAlign: 'center' }}>
                <Loader2 size={28} color="#C9A520" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#8B97AE', marginTop: 12, fontSize: 13 }}>Loading extraction result…</p>
              </div>
            )}

            {/* Processing spinner */}
            {selected && !resultLoading && isProcessing && (
              <div style={{ background: '#111620', border: '1px solid rgba(201,165,32,0.2)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
                <div style={{ marginBottom: 20 }}>
                  <Loader2 size={36} color="#C9A520" style={{ animation: 'spin 1.2s linear infinite' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#E8C84A', margin: '0 0 6px' }}>M02 Pipeline Running</p>
                <p style={{ fontSize: 13, color: '#8B97AE', margin: '0 0 20px' }}>OCR → Layout → Extract → GLiNER → Normalise → Score → Route</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <PipelineSteps status="processing" />
                </div>
              </div>
            )}

            {/* No result yet (doc selected, not processing, no result) */}
            {selected && !resultLoading && !result && (
              <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 40, textAlign: 'center' }}>
                <Zap size={28} color="#C9A520" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 700, color: '#E2E8F5', margin: '0 0 6px' }}>Ready to extract</p>
                <p style={{ fontSize: 13, color: '#8B97AE', margin: 0 }}>Click <strong style={{ color: '#C9A520' }}>Run M02 Extraction</strong> to start the pipeline.</p>
              </div>
            )}

            {/* ── Result Display ────────────────────────────────────────── */}
            {hasResult && (
              <>
                {/* Multiple Document Types Banner */}
                {result.document_types && result.document_types.length > 1 && (
                  <div style={{ padding: '12px 16px', background: 'rgba(96,165,250,0.08)', borderRadius: 12, border: '1px solid rgba(96,165,250,0.25)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#60A5FA', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={12} />
                      Multiple Document Types Detected ({result.document_types.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {result.documents && result.documents.map((doc, idx) => (
                        <div key={idx} style={{ 
                          background: 'rgba(255,255,255,0.05)', 
                          borderRadius: 8, 
                          padding: '8px 12px',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 8,
                          border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                          <span style={{ fontSize: 16 }}>{doc.document_type_display || doc.document_type}</span>
                          <span style={{ fontSize: 10, color: '#4A5A72' }}>Page {doc.page_start}{doc.page_end !== doc.page_start ? `-${doc.page_end}` : ''}</span>
                          <span style={{ fontSize: 9, color: '#3DBE7E', background: 'rgba(61,190,126,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                            {Math.round((doc.confidence || 0.9) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single Document Type Banner */}
                {result.document_type && result.document_type !== 'unknown' && !result.document_types?.length > 1 && (
                  <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #1E2638' }}>
                    <span style={{ fontSize: 24 }}>{result.document_type_icon || '📄'}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#E2E8F5' }}>
                        {result.document_type_display || result.document_type}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#4A5A72' }}>
                        {result.pipeline_duration_ms ? `Pipeline: ${(result.pipeline_duration_ms / 1000).toFixed(1)}s` : 'Extraction complete'}
                      </p>
                    </div>
                  </div>
                )}

                {/* View Toggle */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setJsonView(false)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      border: `1px solid ${!jsonView ? 'rgba(201,165,32,0.4)' : '#1E2638'}`,
                      background: !jsonView ? 'rgba(201,165,32,0.1)' : 'transparent',
                      color: !jsonView ? '#C9A520' : '#4A5A72',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Sparkles size={14} /> Field View
                  </button>
                  <button
                    type="button"
                    onClick={() => setJsonView(true)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      border: `1px solid ${jsonView ? 'rgba(61,190,126,0.4)' : '#1E2638'}`,
                      background: jsonView ? 'rgba(61,190,126,0.1)' : 'transparent',
                      color: jsonView ? '#3DBE7E' : '#4A5A72',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <FileJson size={14} /> JSON View
                  </button>
                </div>

                {!jsonView ? (
                  <>
                    {/* Essential Fields Grid */}
                    <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 20 }}>
                      <SectionTitle>
                        Extracted Fields ({Object.keys(normalised).length})
                      </SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {Object.entries(ESSENTIAL_FIELDS_META).map(([k, m]) => {
                          const value = normalised[k];
                          if (value == null || value === '') return null;
                          const isHsn = k === 'hsn_code';
                          return (
                            <div 
                              key={k} 
                              style={{ 
                                background: isHsn ? 'rgba(201,165,32,0.08)' : '#161D2C', 
                                border: isHsn ? '1px solid rgba(201,165,32,0.4)' : '1px solid #1E2638', 
                                borderRadius: 10, 
                                padding: '12px 14px',
                                position: 'relative',
                              }}
                            >
                              {isHsn && detectedHsn && (
                                <div 
                                  style={{
                                    position: 'absolute',
                                    top: -8,
                                    right: 8,
                                    background: normalised.hsn_source === 'auto_lookup' ? '#60A5FA' : '#E8C84A',
                                    color: '#0A0D14',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                  }}
                                >
                                  {normalised.hsn_source === 'auto_lookup' ? 'Auto' : 'Found'}
                                </div>
                              )}
                              <div style={{ fontSize: 10, color: isHsn ? '#E8C84A' : '#8B97AE', fontWeight: 600, marginBottom: 4 }}>
                                {m.icon} {m.label}
                              </div>
                              <div style={{ fontSize: 13, color: isHsn ? '#E8C84A' : '#E2E8F5', wordBreak: 'break-word', fontFamily: isHsn ? 'monospace' : 'inherit' }}>
                                {fmtVal(value)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Line Items */}
                    {lineItems.length > 0 && (
                      <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 20 }}>
                        <SectionTitle>Line Items ({lineItems.length})</SectionTitle>
                        <div style={{ background: '#0A0D14', border: '1px solid #1E2638', borderRadius: 10, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#111620' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#4A5A72', fontWeight: 700 }}>#</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#4A5A72', fontWeight: 700 }}>Description</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#4A5A72', fontWeight: 700 }}>HSN</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#4A5A72', fontWeight: 700 }}>Qty</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#4A5A72', fontWeight: 700 }}>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map((item, idx) => (
                                <tr key={idx} style={{ borderTop: '1px solid #1E2638' }}>
                                  <td style={{ padding: '10px 14px', color: '#4A5A72' }}>{idx + 1}</td>
                                  <td style={{ padding: '10px 14px', color: '#E2E8F5' }}>{item.description || item.goods_description || item.product_description || '—'}</td>
                                  <td style={{ padding: '10px 14px', color: '#E8C84A', fontFamily: 'monospace' }}>{item.hsn_code || item.hs_code || '—'}</td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#E2E8F5' }}>{item.quantity || '—'}</td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#E2E8F5' }}>{item.unit_price || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Per-Document-Type Fields for Multi-Document Uploads */}
                    {result.documents && result.documents.length > 1 && (
                      <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 20 }}>
                        <SectionTitle>Fields by Document Type</SectionTitle>
                        {result.documents.map((doc, idx) => (
                          <div key={idx} style={{ marginBottom: 16, background: '#0A0D14', borderRadius: 12, padding: 16, border: '1px solid #1E2638' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #1E2638' }}>
                              <span style={{ fontSize: 18 }}>{doc.document_type_display || doc.document_type}</span>
                              <span style={{ fontSize: 10, color: '#4A5A72' }}>Pages {doc.page_start}{doc.page_end !== doc.page_start ? `-${doc.page_end}` : ''}</span>
                              <span style={{ fontSize: 9, color: '#3DBE7E', background: 'rgba(61,190,126,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                                {Math.round((doc.confidence || 0.9) * 100)}%
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {Object.entries(doc.fields || {}).filter(([k, v]) => v !== null && v !== '' && !['null', 'none', 'n/a'].includes(String(v).toLowerCase())).map(([key, val]) => (
                                <div key={key} style={{ background: '#161D2C', borderRadius: 8, padding: '8px 12px' }}>
                                  <div style={{ fontSize: 9, color: '#8B97AE', fontWeight: 600, marginBottom: 2, textTransform: 'capitalize' }}>
                                    {key.replace(/_/g, ' ')}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#E2E8F5', wordBreak: 'break-word' }}>
                                    {typeof val === 'object' ? JSON.stringify(val).slice(0, 100) : String(val).slice(0, 100)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* JSON View */
                  <div style={{ background: '#07090F', border: '1px solid #1E2638', borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #1E2638', background: '#0D1020', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#4A5A72', fontFamily: 'monospace' }}>
                        extraction_result.json
                      </span>
                      <span style={{ fontSize: 11, color: '#3DBE7E', fontWeight: 600 }}>
                        {Object.keys(normalised).length} fields extracted
                      </span>
                    </div>
                    <div style={{ maxHeight: 500, overflowY: 'auto', padding: '16px 18px' }}>
                      <pre style={{
                        margin: 0, fontSize: 12, lineHeight: 1.7,
                        fontFamily: '"Fira Code", "Cascadia Code", monospace',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#E2E8F5',
                      }}>
                        {jsonString}
                      </pre>
                    </div>
                  </div>
                )}

                {/* HSN Code Action Buttons */}
                <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 20 }}>
                  <SectionTitle>HS Code Lookup</SectionTitle>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {detectedHsn ? (
                        hsnEditMode ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="text"
                              value={hsnEditValue}
                              onChange={(e) => setHsnEditValue(e.target.value)}
                              placeholder="Enter HSN code"
                              style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid #1E2638',
                                background: '#0D1020',
                                color: '#E2E8F5',
                                fontSize: 13,
                                fontFamily: 'monospace',
                                width: 140,
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleSaveHsn}
                              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#3DBE7E', color: '#0A0D14', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => { setHsnEditMode(false); setHsnEditValue(detectedHsn); }}
                              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #1E2638', background: 'transparent', color: '#8B97AE', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              type="button"
                              onClick={() => handleMoveToHSN(detectedHsn, '')}
                              style={{
                                padding: '10px 16px', borderRadius: 10, 
                                border: `1px solid ${normalised.hsn_source === 'auto_lookup' ? 'rgba(96,165,250,0.4)' : 'rgba(201,165,32,0.4)'}`,
                                background: normalised.hsn_source === 'auto_lookup' ? 'rgba(96,165,250,0.1)' : 'rgba(201,165,32,0.1)', 
                                color: normalised.hsn_source === 'auto_lookup' ? '#60A5FA' : '#C9A520',
                                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 8,
                              }}
                            >
                              {normalised.hsn_source === 'auto_lookup' ? '🔍' : '🏷'} 
                              {normalised.hsn_source === 'auto_lookup' ? 'Auto HSN: ' : 'HSN Code: '}
                              {detectedHsn}
                              {normalised.hsn_confidence && (
                                <span style={{ fontSize: 11, opacity: 0.8 }}>
                                  ({Math.round(normalised.hsn_confidence * 100)}%)
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setHsnEditMode(true); setHsnEditValue(detectedHsn); }}
                              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #1E2638', background: 'transparent', color: '#8B97AE', fontSize: 13, cursor: 'pointer' }}
                            >
                              ✏️
                            </button>
                          </div>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMoveToHSN('', '')}
                          style={{
                            padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(96,165,250,0.4)',
                            background: 'rgba(96,165,250,0.1)', color: '#60A5FA',
                            fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}
                        >
                          🔍 Search HSN Code
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleDownload(false)}
                        disabled={downloading}
                        style={{
                          padding: '10px 14px', borderRadius: 10,
                          border: '1px solid rgba(61,190,126,0.3)',
                          background: 'rgba(61,190,126,0.08)', color: '#3DBE7E',
                          cursor: downloading ? 'not-allowed' : 'pointer',
                          fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {downloading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
                        Download
                      </button>
                    </div>
                  </div>
                </div>

                {/* Document type signals */}
                {result.document_type_signals?.length > 0 && (
                  <div style={{ background: '#111620', border: '1px solid #1E2638', borderRadius: 16, padding: 20 }}>
                    <SectionTitle>Classification Signals</SectionTitle>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {result.document_type_signals.map((sig, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 99, fontWeight: 600,
                          background: 'rgba(96,165,250,0.1)', color: '#60A5FA',
                          border: '1px solid rgba(96,165,250,0.2)',
                        }}>
                          {sig}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick re-run */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleRun}
                    disabled={running}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8,
                      border: '1px solid #1E2638', background: 'transparent', cursor: running ? 'not-allowed' : 'pointer',
                      color: '#4A5A72', fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                    }}
                  >
                    <RefreshCw size={13} /> Re-run extraction
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default M02ExtractionPage;
