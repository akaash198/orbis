/**
 * Data Intake & Management Page
 * SOP DM-001 → DM-007: universal document gateway
 *
 * Channels: Web Upload · SFTP · Email · Barcode/QR · Voice/ASR
 * Pipeline:  Validate → Register → Preprocess → Classify → Tag → Store (Data Lake)
 * Features:  Semantic dedup (MiniLM + FAISS), 3-tier lake, Kafka events, registry browser
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Database, Server, Mail, Cpu, Mic, FileText, CheckCircle2,
  AlertTriangle, Clock3, RefreshCw, Search, Trash2, ExternalLink,
  X, ChevronRight, HardDrive, Activity, Filter, Play, Zap,
  BarChart2, Globe, ArrowRight, Copy, Eye, WifiOff, File,
} from 'lucide-react';
import { intakeService } from '../../services/api';

// ── Design tokens (match site palette) ───────────────────────────────────────
const C = {
  gold:    '#C9A520',
  goldHi:  '#E8C84A',
  navy:    '#0D1020',
  panel:   '#161D2C',
  card:    '#111620',
  border:  '#1E2638',
  border2: '#273047',
  text:    '#E2E8F5',
  sub:     '#8B97AE',
  muted:   '#4A5A72',
  green:   '#3DBE7E',
  greenHi: '#5AD49A',
  orange:  '#E8934A',
  red:     '#E05656',
  blue:    '#6BBCD4',
};

// ── Pipeline stages ───────────────────────────────────────────────────────────
const STAGES = ['registered', 'preprocessed', 'classified', 'stored'];
const TERMINAL = new Set(['stored', 'validation_failed', 'failed']);

// ── Channel definitions ───────────────────────────────────────────────────────
const CHANNELS = [
  {
    id: 'upload',
    label: 'Web Upload',
    icon: Upload,
    desc: 'Drag & drop PDF, JPEG, PNG, TIFF, XML, JSON — up to 50 MB',
    color: C.gold,
    accept: '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.xml,.json',
  },
  {
    id: 'barcode',
    label: 'Barcode / QR',
    icon: BarChart2,
    desc: 'Scan GS1 barcodes or QR codes from an image, or paste raw string',
    color: C.blue,
    accept: '.jpg,.jpeg,.png',
  },
  {
    id: 'voice',
    label: 'Voice / ASR',
    icon: Mic,
    desc: 'Upload audio — OpenAI Whisper transcribes and extracts fields',
    color: C.green,
    accept: '.wav,.mp3,.m4a,.ogg,.flac',
  },
  {
    id: 'sftp',
    label: 'SFTP Batch',
    icon: Server,
    desc: 'Trigger SFTP drop-folder poll (EDI, XML, JSON, CSV)',
    color: C.orange,
    adminOnly: true,
  },
  {
    id: 'email',
    label: 'Email / IMAP',
    icon: Mail,
    desc: 'Poll configured IMAP inbox and ingest attachments',
    color: '#9A8CE8',
    adminOnly: true,
  },
];

// ── Status badge config ───────────────────────────────────────────────────────
const STATUS_STYLES = {
  registered:       { bg: 'rgba(107,188,212,0.12)', text: C.blue,    label: 'Registered'  },
  preprocessed:     { bg: 'rgba(232,147,74,0.12)',  text: C.orange,  label: 'Preprocessed' },
  classified:       { bg: 'rgba(201,165,32,0.12)',  text: C.goldHi,  label: 'Classified'  },
  stored:           { bg: 'rgba(61,190,126,0.12)',  text: C.greenHi, label: 'Stored'      },
  validation_failed:{ bg: 'rgba(224,86,86,0.12)',   text: C.red,     label: 'Invalid'     },
  failed:           { bg: 'rgba(224,86,86,0.12)',   text: C.red,     label: 'Failed'      },
  pending:          { bg: 'rgba(74,90,114,0.18)',   text: C.sub,     label: 'Pending'     },
};

const CHANNEL_LABELS = {
  api: 'API', portal: 'Portal', sftp: 'SFTP', email: 'Email',
  barcode: 'Barcode', voice: 'Voice',
};

const DOC_TYPE_LABELS = {
  commercial_invoice: 'Commercial Invoice',
  packing_list:       'Packing List',
  bill_of_lading:     'Bill of Lading',
  air_waybill:        'Air Waybill',
  certificate_of_origin: 'Certificate of Origin',
  purchase_order:     'Purchase Order',
  proforma_invoice:   'Proforma Invoice',
  customs_declaration:'Customs Declaration',
  arrival_notice:     'Arrival Notice',
  unknown:            'Unknown',
};

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function ChannelBadge({ channel }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#273047] bg-[#0D1020] px-2 py-0.5 text-[10px] font-semibold text-[#8B97AE]">
      {CHANNEL_LABELS[channel] || channel}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, color = C.gold, sub }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-5 transition-all hover:-translate-y-0.5"
      style={{
        borderColor: C.border,
        background: C.panel,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: C.muted }}>{label}</p>
          <p className="mt-1.5 text-[26px] font-bold font-mono leading-none" style={{ color: C.text }}>{value}</p>
          {sub && <p className="mt-1 text-[11px]" style={{ color: C.sub }}>{sub}</p>}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${color}18`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document View Modal
// ─────────────────────────────────────────────────────────────────────────────
function DocumentViewModal({ item, onClose, onNavigate }) {
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const loadPreview = useCallback(async () => {
    if (!item?.document_id) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await intakeService.getDocumentPreview(item.document_id);
      setPreviewData(data);
    } catch (err) {
      setPreviewError(err?.response?.data?.detail || 'Failed to load document preview.');
    } finally {
      setPreviewLoading(false);
    }
  }, [item?.document_id]);

  useEffect(() => {
    if (item?.document_id) {
      loadPreview();
    }
  }, [item?.document_id, loadPreview]);

  if (!item) return null;

  const isImage = previewData?.content_type?.startsWith('image/');
  const isPdf = previewData?.content_type === 'application/pdf';
  const isAudio = previewData?.content_type?.startsWith('audio/');
  const canPreview = previewData?.data_url && (isImage || isPdf || isAudio);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl rounded-2xl border overflow-hidden"
        style={{ borderColor: C.border, background: C.card, boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: C.border, background: C.panel }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${C.gold}18`, color: C.gold }}>
              <File className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: C.text }}>Document Details</h3>
              <p className="text-[11px]" style={{ color: C.muted }}>{item.document_id?.slice(0, 18)}…</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: C.sub }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
          {/* Document Preview */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Document Preview</h4>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border2, background: C.navy }}>
              {previewLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="flex items-center gap-2" style={{ color: C.muted }}>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-[12px]">Loading document...</span>
                  </div>
                </div>
              ) : previewError ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-[13px] font-semibold" style={{ color: C.red }}>{previewError}</p>
                    <button
                      onClick={loadPreview}
                      className="mt-2 text-[12px] underline"
                      style={{ color: C.blue }}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : canPreview ? (
                <div className="relative">
                  {isImage && (
                    <img
                      src={previewData.data_url}
                      alt={item.original_filename}
                      className="max-w-full mx-auto"
                      style={{ maxHeight: '400px', display: 'block' }}
                    />
                  )}
                  {isPdf && (
                    <iframe
                      src={previewData.data_url}
                      className="w-full"
                      style={{ height: '500px', border: 'none' }}
                      title={item.original_filename}
                    />
                  )}
                  {isAudio && (
                    <div className="flex items-center justify-center h-24">
                      <audio controls src={previewData.data_url} className="w-full max-w-md">
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24">
                  <div className="text-center" style={{ color: C.sub }}>
                    <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: C.muted }} />
                    <p className="text-[12px]">Preview not available for this file type</p>
                    <p className="text-[11px] mt-1" style={{ color: C.muted }}>
                      {formatFileSize(previewData?.size_bytes || item.file_size_bytes)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* File Info */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>File Information</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Filename', item.original_filename || 'Unnamed'],
                ['Type', (item.file_type || '—').toUpperCase()],
                ['Size', formatFileSize(previewData?.size_bytes || item.file_size_bytes)],
                ['Channel', CHANNEL_LABELS[item.source_channel] || item.source_channel],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg px-3 py-2" style={{ background: C.panel }}>
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
                  <p className="mt-1 text-[13px] font-semibold" style={{ color: C.text }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Classification</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Document Type', DOC_TYPE_LABELS[item.document_type] || item.document_type || 'Unknown'],
                ['Language', (item.language || '—').toUpperCase()],
                ['Confidence', item.classification_confidence ? `${(item.classification_confidence * 100).toFixed(1)}%` : '—'],
                ['Status', item.ingestion_status],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg px-3 py-2" style={{ background: C.panel }}>
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
                  <p className="mt-1 text-[13px] font-semibold" style={{ color: C.text }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Data Lake */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Data Lake</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Current Tier', item.current_tier?.toUpperCase() || '—'],
                ['Duplicate', item.is_duplicate ? `Yes (ref: ${item.duplicate_of?.slice(0, 8)}…)` : 'No'],
                ['Created', item.created_at ? new Date(item.created_at).toLocaleString() : '—'],
                ['Processed', item.processed_at ? new Date(item.processed_at).toLocaleString() : '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg px-3 py-2" style={{ background: C.panel }}>
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
                  <p className="mt-1 text-[13px] font-semibold" style={{ color: C.text }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Lake Paths */}
          {(item.raw_lake_path || item.processed_lake_path) && (
            <div className="space-y-3">
              <h4 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Storage Paths</h4>
              <div className="space-y-2">
                {item.raw_lake_path && (
                  <div className="rounded-lg px-3 py-2" style={{ background: C.panel }}>
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>Raw</p>
                    <p className="mt-1 text-[11px] font-mono break-all" style={{ color: C.sub }}>{item.raw_lake_path}</p>
                  </div>
                )}
                {item.processed_lake_path && (
                  <div className="rounded-lg px-3 py-2" style={{ background: C.panel }}>
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>Processed</p>
                    <p className="mt-1 text-[11px] font-mono break-all" style={{ color: C.sub }}>{item.processed_lake_path}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: C.border, background: C.panel }}>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{ borderColor: C.border2, color: C.sub }}
          >
            Close
          </button>
          {item.ingestion_status === 'stored' && (
            <button
              onClick={() => {
                handleAdoptFromModal(item.document_id, onNavigate);
                onClose();
              }}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[13px] font-semibold transition-all hover:opacity-90"
              style={{ borderColor: C.gold, background: `${C.gold}14`, color: C.goldHi }}
            >
              <ExternalLink className="h-4 w-4" /> Open in Document Management
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper for modal adopt
async function handleAdoptFromModal(documentId, onNavigate) {
  try {
    const r = await intakeService.adoptIntoDocManagement(documentId);
    onNavigate?.('documents', { documentId: r.document_id });
  } catch {
    alert('Could not open in Document Management.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Progress (real-time polling)
// ─────────────────────────────────────────────────────────────────────────────
function PipelineProgress({ documentId, onDone, onNavigate }) {
  const [status, setStatus] = useState(null);
  const timerRef  = useRef(null);
  const pollCount = useRef(0);

  const poll = useCallback(async () => {
    try {
      const data = await intakeService.getStatus(documentId);
      setStatus(data);
      pollCount.current += 1;
      if (!TERMINAL.has(data.ingestion_status)) {
        // Adaptive back-off: poll aggressively at first (pipeline is fast),
        // then settle to a comfortable 2 s cadence.
        const delay = pollCount.current <= 4 ? 600 : 2000;
        timerRef.current = setTimeout(poll, delay);
      } else {
        onDone?.(data);
      }
    } catch {
      timerRef.current = setTimeout(poll, 4000);
    }
  }, [documentId, onDone]);

  useEffect(() => {
    pollCount.current = 0;
    poll();
    return () => clearTimeout(timerRef.current);
  }, [poll]);

  const currentStage = status?.ingestion_status || 'registered';
  const isError = currentStage === 'validation_failed' || currentStage === 'failed';
  const isDone  = currentStage === 'stored';

  return (
    <div
      className="mt-4 rounded-xl border p-5"
      style={{ borderColor: C.border2, background: C.navy }}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: C.gold }} />
          <span className="text-[13px] font-bold" style={{ color: C.text }}>Pipeline Progress</span>
        </div>
        <StatusBadge status={currentStage} />
      </div>

      {/* Stage dots */}
      <div className="flex items-center">
        {STAGES.map((stage, i) => {
          const stageIdx = STAGES.indexOf(currentStage);
          const done = stageIdx >= i;
          const active = stageIdx === i && !isError && !isDone;
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all"
                  style={{
                    borderColor: done ? C.green : C.border2,
                    background:  done ? (isDone && i === STAGES.length - 1 ? C.green : `${C.green}20`) : C.navy,
                  }}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: C.green }} />
                  ) : (
                    <div
                      className={active ? 'h-2 w-2 rounded-full animate-pulse' : 'h-2 w-2 rounded-full'}
                      style={{ background: active ? C.gold : C.muted }}
                    />
                  )}
                </div>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: done ? C.greenHi : C.muted }}
                >
                  {stage}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className="flex-1 h-[2px] mx-1 mb-4 rounded-full transition-all"
                  style={{ background: STAGES.indexOf(currentStage) > i ? C.green : C.border2 }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Error message */}
      {isError && (
        <div className="mt-3 rounded-lg border border-[rgba(224,86,86,0.25)] bg-[rgba(224,86,86,0.08)] p-3">
          <p className="text-[12px] font-semibold" style={{ color: C.red }}>
            {currentStage === 'validation_failed' ? 'Validation Failed' : 'Processing Error'}
          </p>
          {status?.validation_errors && (
            <ul className="mt-1 space-y-0.5">
              {(Array.isArray(status.validation_errors)
                ? status.validation_errors
                : Object.values(status.validation_errors)
              ).map((e, i) => (
                <li key={i} className="text-[11px]" style={{ color: C.sub }}>{String(e)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Success result */}
      {isDone && (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              ['Type',     DOC_TYPE_LABELS[status?.document_type] || status?.document_type],
              ['Language', (status?.language || '').toUpperCase() || '—'],
              ['Duplicate', status?.is_duplicate ? `Yes (≈ ${status?.duplicate_of?.slice(0,8)}…)` : 'No'],
              ['Lake Tier', status?.current_tier || 'raw'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: `${C.green}08` }}>
                <span style={{ color: C.muted }}>{k}</span>
                <span className="font-semibold" style={{ color: C.text }}>{v || '—'}</span>
              </div>
            ))}
          </div>
          <button
            onClick={async () => {
              try {
                const r = await intakeService.adoptIntoDocManagement(documentId);
                onNavigate?.('documents', { documentId: r.document_id });
              } catch {
                alert('Could not open in Document Management — file may still be processing.');
              }
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] font-semibold transition-all hover:opacity-90"
            style={{ borderColor: C.gold, background: `${C.gold}14`, color: C.goldHi }}
          >
            <ExternalLink className="h-4 w-4" /> Open in Document Management
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Card (file drop zone for any file-based channel)
// ─────────────────────────────────────────────────────────────────────────────
function FileUploadCard({ channel, onNavigate }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);   // 0–100 during file transfer
  const [result, setResult] = useState(null); // { documentId, initialData }
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);
    setUploadPct(0);
    try {
      let data;
      if (channel.id === 'barcode') {
        data = await intakeService.scanBarcodeImage(file);
        const first = data.ingested?.[0];
        if (first) setResult({ documentId: first.document_id, initial: data });
        else throw new Error('No barcodes detected in the image.');
      } else if (channel.id === 'voice') {
        data = await intakeService.uploadVoice(file);
        setResult({ documentId: data.document_id, initial: data });
      } else {
        data = await intakeService.uploadFile(file, 'portal', (evt) => {
          if (evt.total) setUploadPct(Math.round((evt.loaded / evt.total) * 100));
        });
        setResult({ documentId: data.document_id, initial: data });
      }
    } catch (err) {
      const msg = err?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : (msg ? JSON.stringify(msg) : err.message));
    } finally {
      setUploading(false);
      setUploadPct(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [channel.id]);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <label
        htmlFor={`file-input-${channel.id}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all"
        style={{
          borderColor: dragging ? channel.color : C.border2,
          background:  dragging ? `${channel.color}08` : C.navy,
        }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{ background: `${channel.color}14`, borderColor: `${channel.color}30`, color: channel.color }}
        >
          {uploading ? (
            <RefreshCw className="h-6 w-6 animate-spin" />
          ) : (
            <channel.icon className="h-6 w-6" />
          )}
        </div>
        <div className="text-center w-full">
          <p className="text-[13px] font-semibold" style={{ color: C.text }}>
            {uploading
              ? (uploadPct > 0 ? `Uploading… ${uploadPct}%` : 'Uploading…')
              : `Drop ${channel.label === 'Voice / ASR' ? 'audio' : channel.label === 'Barcode / QR' ? 'image' : 'file'} here`}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>{channel.desc}</p>
          {uploading && uploadPct > 0 && (
            <div className="mt-2 mx-auto w-40 h-1.5 rounded-full overflow-hidden" style={{ background: C.border2 }}>
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${uploadPct}%`, background: C.gold }}
              />
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          id={`file-input-${channel.id}`}
          type="file"
          accept={channel.accept}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
          disabled={uploading}
        />
      </label>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[rgba(224,86,86,0.25)] bg-[rgba(224,86,86,0.08)] p-3 text-[12px]" style={{ color: C.red }}>
          {error}
        </div>
      )}

      {/* Barcode: also allow raw string input */}
      {channel.id === 'barcode' && !result && (
        <RawBarcodeInput onResult={setResult} onError={setError} />
      )}

      {/* Pipeline progress */}
      {result?.documentId && (
        <PipelineProgress
          documentId={result.documentId}
          onDone={() => {}}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

function RawBarcodeInput({ onResult, onError }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const data = await intakeService.submitRawBarcode(value.trim());
      onResult({ documentId: data.document_id, initial: data });
    } catch (err) {
      const msg = err?.response?.data?.detail;
      onError(typeof msg === 'string' ? msg : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Or paste raw barcode string…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="flex-1 rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1"
        style={{ borderColor: C.border2, background: C.navy, color: C.text, '--tw-ring-color': C.gold }}
      />
      <button
        onClick={submit}
        disabled={loading || !value.trim()}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-opacity disabled:opacity-40"
        style={{ borderColor: C.gold, background: `${C.gold}14`, color: C.goldHi }}
      >
        {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Decode
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger Card (SFTP / Email — admin only)
// ─────────────────────────────────────────────────────────────────────────────
function TriggerCard({ channel }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const trigger = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = channel.id === 'sftp'
        ? await intakeService.triggerSFTP()
        : await intakeService.triggerEmail();
      setResult(data.message || 'Triggered successfully.');
    } catch (err) {
      setError(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 text-center"
      style={{ borderColor: C.border2, background: C.navy }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl border"
        style={{ background: `${channel.color}14`, borderColor: `${channel.color}30`, color: channel.color }}
      >
        <channel.icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: C.text }}>{channel.label}</p>
        <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>{channel.desc}</p>
      </div>
      <button
        onClick={trigger}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border px-5 py-2 text-[12px] font-semibold transition-all disabled:opacity-40 hover:opacity-90"
        style={{ borderColor: channel.color, background: `${channel.color}14`, color: channel.color }}
      >
        {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Trigger Poll
      </button>
      {result && <p className="text-[11px]" style={{ color: C.greenHi }}>{result}</p>}
      {error  && <p className="text-[11px]" style={{ color: C.red }}>{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Table
// ─────────────────────────────────────────────────────────────────────────────
function RegistryTable({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await intakeService.getRegistry({
        page,
        pageSize: 15,
        ingestionStatus: statusFilter || undefined,
        sourceChannel: channelFilter || undefined,
      });
      const all = data.items || [];
      const q = search.trim().toLowerCase();
      setItems(q ? all.filter(i =>
        (i.original_filename || '').toLowerCase().includes(q) ||
        (i.document_type || '').toLowerCase().includes(q) ||
        (i.document_id || '').toLowerCase().includes(q)
      ) : all);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, channelFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (docId) => {
    if (!window.confirm('Permanently delete this document from registry and data lake?')) return;
    setDeleting(docId);
    try {
      await intakeService.deleteDocument(docId);
      load();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  };

  const handleAdopt = async (docId) => {
    try {
      const r = await intakeService.adoptIntoDocManagement(docId);
      // Navigate to M02 Document Manager with the new document ID
      // The document already has extraction results from auto-trigger
      onNavigate?.('m02-extraction', { documentId: r.document_id, autoExtract: true });
    } catch {
      alert('Could not open in Document Management.');
    }
  };

  const handleView = async (item) => {
    try {
      const status = await intakeService.getStatus(item.document_id);
      setViewingItem({ ...item, ...status });
    } catch {
      setViewingItem(item);
    }
  };

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: C.border, background: C.card, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: C.border }}
        >
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: C.text }}>Document Registry</h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              {total} document{total !== 1 ? 's' : ''} in the data lake
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.muted }} />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 rounded-lg border pl-8 pr-3 text-[12px] outline-none focus:ring-1 w-40"
                style={{ borderColor: C.border2, background: C.navy, color: C.text }}
              />
            </div>
            {/* Channel filter */}
            <select
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border px-2 text-[12px] outline-none"
              style={{ borderColor: C.border2, background: C.navy, color: C.sub }}
            >
              <option value="">All Channels</option>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border px-2 text-[12px] outline-none"
              style={{ borderColor: C.border2, background: C.navy, color: C.sub }}
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button
              onClick={load}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: C.border2, background: C.navy, color: C.sub }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ background: C.navy }}>
                {['Filename', 'Type', 'Channel', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-[13px]" style={{ color: C.muted }}>Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Database className="mx-auto mb-2 h-8 w-8" style={{ color: C.muted }} />
                    <p className="text-[13px]" style={{ color: C.muted }}>No documents yet — upload your first file above</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.document_id}
                    className="group border-t transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: C.border }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                          style={{ background: C.navy, borderColor: C.border2, color: C.gold }}
                        >
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold max-w-[180px]" style={{ color: C.text }}>
                            {item.original_filename || 'Unnamed'}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px]" style={{ color: C.muted }}>
                            {item.document_id?.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px]" style={{ color: C.sub }}>
                        {DOC_TYPE_LABELS[item.document_type] || item.document_type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ChannelBadge channel={item.source_channel} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={item.ingestion_status} />
                        {item.is_duplicate && (
                          <span className="rounded-full bg-[rgba(232,147,74,0.12)] px-2 py-0.5 text-[10px] font-bold" style={{ color: C.orange }}>DUP</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: C.muted }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* View button */}
                        <button
                          title="View Details"
                          onClick={() => handleView(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#4A5A72] transition-colors hover:border-[rgba(107,188,212,0.28)] hover:bg-[rgba(107,188,212,0.08)] hover:text-[#6BBCD4]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {/* Open in Document Management button */}
                        {item.ingestion_status === 'stored' && (
                          <button
                            title="Open in Document Management"
                            onClick={() => handleAdopt(item.document_id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#4A5A72] transition-colors hover:border-[rgba(201,165,32,0.28)] hover:bg-[rgba(201,165,32,0.08)] hover:text-[#C9A520]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Delete button */}
                        <button
                          title="Delete"
                          onClick={() => handleDelete(item.document_id)}
                          disabled={deleting === item.document_id}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#4A5A72] transition-colors hover:border-[rgba(224,86,86,0.25)] hover:bg-[rgba(224,86,86,0.08)] hover:text-[#E05656] disabled:opacity-40"
                        >
                          {deleting === item.document_id
                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: C.border }}>
            <span className="text-[11px]" style={{ color: C.muted }}>
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 rounded-md border px-2.5 text-[11px] font-medium disabled:opacity-30"
                style={{ borderColor: C.border2, color: C.sub, background: C.navy }}
              >← Prev</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-7 rounded-md border px-2.5 text-[11px] font-medium disabled:opacity-30"
                style={{ borderColor: C.border2, color: C.sub, background: C.navy }}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewingItem && (
        <DocumentViewModal item={viewingItem} onClose={() => setViewingItem(null)} onNavigate={onNavigate} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Architecture Layer visualizer (Kafka → Lake flow)
// ─────────────────────────────────────────────────────────────────────────────
function ArchitectureStrip() {
  const nodes = [
    { icon: Globe,     label: 'Channels',    sub: 'API · SFTP · Email · Barcode · Voice', color: C.gold   },
    { icon: CheckCircle2, label: 'Validate', sub: 'Format · Size · Structure', color: C.blue   },
    { icon: Cpu,       label: 'Classify',    sub: 'Type · Language · Dedup', color: C.green  },
    { icon: Activity,  label: 'Kafka Queue', sub: 'Async event streaming',  color: C.orange },
    { icon: HardDrive, label: 'Data Lake',   sub: 'Raw → Processed → Curated', color: '#9A8CE8' },
  ];
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: C.border, background: C.panel }}
    >
      <p className="mb-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
        Pipeline Architecture · DM-001 → DM-007
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {nodes.map((n, i) => (
          <React.Fragment key={n.label}>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: `${n.color}30`, background: `${n.color}0A` }}>
              <n.icon className="h-4 w-4 shrink-0" style={{ color: n.color }} />
              <div>
                <p className="text-[12px] font-semibold" style={{ color: C.text }}>{n.label}</p>
                <p className="text-[10px]" style={{ color: C.muted }}>{n.sub}</p>
              </div>
            </div>
            {i < nodes.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.muted }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function DataIntakePage({ onNavigate }) {
  const [activeChannel, setActiveChannel] = useState('upload');
  const [kpis, setKpis] = useState({ total: '—', stored: '—', duplicates: '—', channels: '—' });
  const [health, setHealth] = useState(null);

  // Fetch registry stats for KPI cards
  const refreshKpis = useCallback(async () => {
    try {
      const data = await intakeService.getRegistry({ pageSize: 1 });
      const stored = await intakeService.getRegistry({ pageSize: 1, ingestionStatus: 'stored' });
      const dups   = await intakeService.getRegistry({ pageSize: 1, isDuplicate: true });
      setKpis({
        total:      data.total ?? 0,
        stored:     stored.total ?? 0,
        duplicates: dups.total ?? 0,
        channels:   '5',
      });
    } catch { /* ignore */ }
    try {
      const h = await intakeService.health();
      setHealth(h);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshKpis(); }, [refreshKpis]);

  const channel = CHANNELS.find(c => c.id === activeChannel) || CHANNELS[0];

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <section
        className="relative overflow-hidden rounded-xl border p-6 sm:p-8"
        style={{ borderColor: C.border, background: C.panel, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-5" style={{ background: C.gold, filter: 'blur(40px)' }} />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ borderColor: `${C.gold}40`, background: `${C.gold}10`, color: C.goldHi }}>
              <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.gold }} />
              Data Intake & Management
            </div>
            <h1 className="text-[28px] font-bold tracking-tight" style={{ color: C.text }}>
              Universal <span style={{ color: C.gold }}>Document Gateway</span>
            </h1>
            <p className="mt-2 max-w-xl text-[14px]" style={{ color: C.sub }}>
              Ingest from any source — web, SFTP, email, barcode, or voice. Every document is validated, deduplicated,
              classified, and stored in the three-tier data lake before AI processing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {health && (
              <div className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5" style={{ borderColor: `${C.green}30`, background: `${C.green}0A` }}>
                <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.green }} />
                <span className="text-[11px] font-semibold" style={{ color: C.greenHi }}>Lake Online</span>
              </div>
            )}
            <button
              onClick={refreshKpis}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[12px] font-semibold transition-colors hover:opacity-80"
              style={{ borderColor: C.border2, background: C.navy, color: C.sub }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Database}     label="Total Ingested"  value={kpis.total}      color={C.gold}   sub="All documents in registry" />
        <KpiCard icon={HardDrive}    label="Stored in Lake"  value={kpis.stored}     color={C.green}  sub="Fully processed" />
        <KpiCard icon={Copy}         label="Duplicates"      value={kpis.duplicates} color={C.orange} sub="Detected by MiniLM + FAISS" />
        <KpiCard icon={WifiOff}      label="Active Channels" value={kpis.channels}   color={C.blue}   sub="API · SFTP · Email · Barcode · Voice" />
      </section>

      {/* ── Architecture Strip ── */}
      <ArchitectureStrip />

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">

        {/* Left: Ingestion Panel */}
        <div className="xl:col-span-5 space-y-4">
          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: C.border, background: C.card, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
          >
            {/* Channel tabs */}
            <div className="flex flex-wrap gap-1.5 border-b p-3" style={{ borderColor: C.border, background: C.panel }}>
              {CHANNELS.map((ch) => {
                const active = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all"
                    style={{
                      background:  active ? `${ch.color}18` : 'transparent',
                      borderColor: active ? `${ch.color}40` : 'transparent',
                      color:       active ? ch.color : C.muted,
                      border: '1px solid',
                    }}
                  >
                    <ch.icon className="h-3.5 w-3.5" />
                    {ch.label}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {/* Channel description */}
              <div className="mb-4 flex items-start gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: `${channel.color}30`, background: `${channel.color}0A` }}>
                <channel.icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: channel.color }} />
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: C.text }}>{channel.label}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>{channel.desc}</p>
                </div>
              </div>

              {/* Channel content */}
              {channel.adminOnly ? (
                <TriggerCard channel={channel} />
              ) : (
                <FileUploadCard key={activeChannel} channel={channel} onNavigate={onNavigate} />
              )}
            </div>
          </div>

          {/* Dedup info card */}
          <div className="rounded-xl border p-4" style={{ borderColor: C.border, background: C.card }}>
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="h-4 w-4" style={{ color: C.blue }} />
              <span className="text-[13px] font-semibold" style={{ color: C.text }}>Semantic Deduplication</span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: C.sub }}>
              Every document is embedded with <strong style={{ color: C.text }}>all-MiniLM-L6-v2</strong> and compared
              against the FAISS index. Documents with cosine similarity ≥ <strong style={{ color: C.text }}>0.92</strong> are
              flagged as duplicates — preventing redundant AI processing and storage.
            </p>
            <div className="mt-3 flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5" style={{ color: C.greenHi }}>
                <CheckCircle2 className="h-3.5 w-3.5" /> MiniLM active
              </div>
              <div className="flex items-center gap-1.5" style={{ color: C.blue }}>
                <Activity className="h-3.5 w-3.5" /> FAISS indexed
              </div>
              <div className="flex items-center gap-1.5" style={{ color: C.gold }}>
                <Zap className="h-3.5 w-3.5" /> Threshold 0.92
              </div>
            </div>
          </div>
        </div>

        {/* Right: Registry Table */}
        <div className="xl:col-span-7">
          <RegistryTable onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

export default DataIntakePage;
