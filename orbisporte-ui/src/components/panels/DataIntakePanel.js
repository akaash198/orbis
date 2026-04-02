import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// ── Animations ────────────────────────────────────────────────────────────────
const fadeIn = keyframes`from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); }`;
const pulse  = keyframes`0%,100% { opacity: 1; } 50% { opacity: 0.5; }`;
const spin   = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;

// ── Styled components ────────────────────────────────────────────────────────
const Panel = styled.div`
  padding: 28px;
  animation: ${fadeIn} 0.3s ease;
  color: var(--t-text);
  font-family: 'Inter', sans-serif;
  max-width: 1100px;
  margin: 0 auto;
  background: var(--t-panel-bg);
  min-height: 100%;
  transition: background 0.3s ease, color 0.3s ease;
`;

const Title = styled.h2`
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 6px;
`;

const Subtitle = styled.p`
  color: var(--t-text-sub);
  font-size: 0.9rem;
  margin: 0 0 28px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const Card = styled.div`
  background: var(--t-card);
  border: 1px solid var(--t-border);
  border-radius: 14px;
  padding: 22px;
  box-shadow: var(--t-card-shadow);
  backdrop-filter: blur(20px);
  transition: border-color 0.2s, box-shadow 0.2s, background 0.3s;

  &:hover {
    border-color: rgba(59, 130, 246, 0.4);
    box-shadow: var(--t-card-shadow-hov);
  }
`;

const ChannelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const ChannelIcon = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: ${p => p.gradient || 'linear-gradient(135deg, #3B82F6, #06B6D4)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
`;

const ChannelName = styled.div`
  font-weight: 600;
  font-size: 1rem;
  color: var(--t-text);
`;

const ChannelDesc = styled.div`
  font-size: 0.78rem;
  color: var(--t-text-sub);
`;

const DropZone = styled.div`
  border: 2px dashed ${p => p.dragging ? '#3B82F6' : 'rgba(59,130,246,0.3)'};
  border-radius: 10px;
  padding: 22px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.dragging ? 'rgba(59,130,246,0.06)' : 'transparent'};
  color: var(--t-text-sub);
  font-size: 0.85rem;

  &:hover {
    border-color: rgba(59, 130, 246, 0.5);
    color: var(--t-text);
  }
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--t-input-border);
  border-radius: 8px;
  background: var(--t-input-bg);
  color: var(--t-text);
  font-size: 0.9rem;
  outline: none;
  margin-bottom: 10px;

  &:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.2); background: var(--t-input-bg-focus); }
  &::placeholder { color: var(--t-text-hint); }
`;

const Textarea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--t-input-border);
  border-radius: 8px;
  background: var(--t-input-bg);
  color: var(--t-text);
  font-size: 0.9rem;
  outline: none;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;

  &:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.2); background: var(--t-input-bg-focus); }
  &::placeholder { color: var(--t-text-hint); }
`;

const Btn = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: all 0.2s;
  background: ${p => p.variant === 'secondary'
    ? 'rgba(59,130,246,0.1)'
    : 'linear-gradient(135deg, #3B82F6, #2563EB)'};
  color: ${p => p.variant === 'secondary' ? 'var(--t-btn-color)' : '#fff'};
  width: ${p => p.fullWidth ? '100%' : 'auto'};

  &:hover:not(:disabled) {
    opacity: 0.88;
    transform: translateY(-1px);
  }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${p => ({
    registered:        'rgba(59,130,246,0.15)',
    stored:            'rgba(16,185,129,0.15)',
    validation_failed: 'rgba(239,68,68,0.15)',
    preprocessed:      'rgba(245,158,11,0.15)',
    classified:        'rgba(124,58,237,0.15)',
  }[p.status] || 'var(--t-glass)')};
  color: ${p => ({
    registered:        '#60a5fa',
    stored:            '#34d399',
    validation_failed: '#f87171',
    preprocessed:      '#fbbf24',
    classified:        '#a78bfa',
  }[p.status] || 'var(--t-text-sub)')};
`;

const Spinner = styled.div`
  width: 20px; height: 20px;
  border: 2px solid rgba(59,130,246,0.2);
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
  display: inline-block;
  vertical-align: middle;
  margin-right: 8px;
`;

const ResultBox = styled.div`
  margin-top: 14px;
  padding: 14px;
  border-radius: 10px;
  background: var(--t-bg-dark);
  border: 1px solid var(--t-border-light);
  font-size: 0.82rem;
  line-height: 1.6;
  word-break: break-all;
  color: var(--t-text);
`;

const Field = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid rgba(148,163,184,0.06);
  &:last-child { border-bottom: none; }
`;
const Label  = styled.span`color: var(--t-text-sub); flex-shrink: 0; margin-right: 12px;`;
const Value  = styled.span`color: var(--t-text); text-align: right; word-break: break-word;`;

const RegistryTable = styled.div`
  background: var(--t-card);
  border: 1px solid var(--t-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--t-card-shadow);
  backdrop-filter: blur(20px);
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.2fr 1fr 1fr 1.4fr;
  padding: 12px 18px;
  background: rgba(59,130,246,0.12);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--t-btn-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.2fr 1fr 1fr 1.4fr;
  padding: 12px 18px;
  font-size: 0.82rem;
  border-top: 1px solid var(--t-border-light);
  color: var(--t-text);
  transition: background 0.15s;
  &:hover { background: var(--t-hover); }
`;

const ViewBtn = styled.button`
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(59,130,246,0.3);
  background: rgba(59,130,246,0.1);
  color: var(--t-btn-color);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: rgba(37,99,235,0.15); border-color: rgba(37,99,235,0.5); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const DeleteBtn = styled.button`
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(239,68,68,0.3);
  background: rgba(239,68,68,0.08);
  color: #F87171;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.5); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const SectionTitle = styled.h3`
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--t-text);
  margin: 28px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--t-border);
`;

// ── Document type display names ───────────────────────────────────────────────
const DOC_TYPE_DISPLAY = {
  // ── Commercial documents ────────────────────────────────────────────────
  commercial_invoice:    'Commercial Invoice',
  invoice:               'Commercial Invoice',
  proforma_invoice:      'Proforma Invoice',
  purchase_order:        'Purchase Order',
  // ── Shipping / transport documents ─────────────────────────────────────
  packing_list:          'Packaging List',
  air_waybill:           'Airway Bill (AWB)',
  airway_bill:           'Airway Bill (AWB)',
  airwaybill:            'Airway Bill (AWB)',
  bill_of_lading:        'Bill of Lading',
  arrival_notice:        'Arrival Notice',
  // ── Compliance / customs documents ─────────────────────────────────────
  certificate_of_origin: 'Certificate of Origin',
  letter_of_credit:      'Letter of Credit',
  customs_declaration:   'Customs Declaration',
  bill_of_entry:         'Bill of Entry',
  shipping_bill:         'Shipping Bill',
  // ── Other ──────────────────────────────────────────────────────────────
  edi_transaction:       'EDI Transaction',
  barcode_payload:       'Barcode Payload',
  audio_transcript:      'Audio Transcript',
  voice_input:           'Voice Input',
  unknown:               'Unknown Document',
};

const formatDocType = (raw) => {
  if (!raw) return '—';
  return DOC_TYPE_DISPLAY[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// ── Helper ────────────────────────────────────────────────────────────────────
// Reads from the same key the existing api.js service uses: localStorage.authToken
const authHeader = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Pipeline stages in order ──────────────────────────────────────────────────
const STAGES = [
  { key: 'registered',    label: 'Registered',    step: 1 },
  { key: 'preprocessed',  label: 'Preprocessed',  step: 2 },
  { key: 'classified',    label: 'Classified',     step: 3 },
  { key: 'stored',        label: 'Stored',         step: 4 },
];
const TERMINAL = ['stored', 'validation_failed', 'failed'];

// ── Progress bar styled components ───────────────────────────────────────────
const ProgressWrap = styled.div`
  margin-top: 14px;
`;

const StepRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 10px;
`;

const StepDot = styled.div`
  width: 22px; height: 22px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700; flex-shrink: 0;
  background: ${p => p.done ? 'linear-gradient(135deg,#10B981,#059669)'
               : p.active ? 'linear-gradient(135deg,#3B82F6,#06B6D4)'
               : 'rgba(100,116,139,0.2)'};
  color: ${p => (p.done || p.active) ? '#fff' : 'var(--t-text-sub)'};
  transition: background 0.4s;
`;

const StepLine = styled.div`
  flex: 1; height: 2px;
  background: ${p => p.done ? 'rgba(16,185,129,0.5)' : 'rgba(100,116,139,0.15)'};
  transition: background 0.4s;
`;

const StepLabel = styled.div`
  font-size: 0.72rem;
  color: ${p => p.done ? '#34D399' : p.active ? 'var(--t-btn-color)' : 'var(--t-text-sub)'};
  margin-top: 4px;
  text-align: center;
  width: 22px;
  position: relative;
  left: 0;
  white-space: nowrap;
  transform: translateX(-50%) translateX(11px);
`;

const PulsingDot = styled.div`
  width: 8px; height: 8px; border-radius: 50%;
  background: #3B82F6;
  animation: ${pulse} 1.2s ease-in-out infinite;
  display: inline-block; margin-right: 6px; vertical-align: middle;
`;

// ── Status polling hook ───────────────────────────────────────────────────────
function useStatusPoller(documentId) {
  const [status, setStatus] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!documentId) return;

    const poll = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/intake/status/${documentId}`,
          { headers: authHeader() });
        setStatus(data);
        if (TERMINAL.includes(data.ingestion_status)) {
          clearInterval(timerRef.current);
        }
      } catch {
        clearInterval(timerRef.current);
      }
    };

    poll();
    timerRef.current = setInterval(poll, 1500);  // poll every 1.5 s
    return () => clearInterval(timerRef.current);
  }, [documentId]);

  return status;
}

// ── "Open in Document Management" button with adopt call ──────────────────────
function OpenInDocMgmt({ data, onPageChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const authHeader = () => {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.post(
        `${API_BASE}/react/adopt-intake/${data.document_id}`,
        {},
        { headers: authHeader() }
      );
      const { document_id, filename, file_path } = resp.data;
      onPageChange('document', { documentId: document_id, filename, filePath: file_path });
    } catch (err) {
      setError('Could not link document. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <Btn
        fullWidth
        onClick={handleClick}
        disabled={loading}
        style={{ marginTop: 12, background: loading ? '#4B5563' : 'linear-gradient(135deg,#8B5CF6,#6D28D9)', cursor: loading ? 'wait' : 'pointer' }}
      >
        {loading ? 'Preparing…' : 'Open in Document Management →'}
      </Btn>
      {error && <div style={{ color: '#F87171', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </>
  );
}

// ── Pipeline progress display ─────────────────────────────────────────────────
function PipelineProgress({ documentId, initialData, onPageChange }) {
  const polled = useStatusPoller(documentId);
  const data   = polled || initialData;
  if (!data) return null;

  const currentStep = STAGES.find(s => s.key === data.ingestion_status)?.step || 0;
  const failed = data.ingestion_status === 'failed' || data.ingestion_status === 'validation_failed';
  const done   = data.ingestion_status === 'stored';
  const active = !done && !failed;

  return (
    <ProgressWrap>
      {/* Step dots */}
      <StepRow>
        {STAGES.map((s, i) => {
          const isDone   = currentStep > s.step || done;
          const isActive = currentStep === s.step && active;
          return (
            <React.Fragment key={s.key}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <StepDot done={isDone ? 1 : 0} active={isActive ? 1 : 0}>
                  {isDone ? '✓' : s.step}
                </StepDot>
                <StepLabel done={isDone ? 1 : 0} active={isActive ? 1 : 0}>{s.label}</StepLabel>
              </div>
              {i < STAGES.length - 1 && <StepLine done={currentStep > s.step || done ? 1 : 0} />}
            </React.Fragment>
          );
        })}
      </StepRow>

      {/* Live status line */}
      <div style={{ fontSize: '0.8rem', color: 'var(--t-text-sub)', marginTop: 6 }}>
        {active && <><PulsingDot />Processing in background…</>}
        {done   && <span style={{ color: '#34D399' }}>✓ Complete — stored in data lake ({data.current_tier} tier)</span>}
        {failed && <span style={{ color: '#F87171' }}>✗ {data.validation_errors?.pipeline_error || 'Processing failed'}</span>}
      </div>

      {/* Result details once done */}
      {(done || failed) && (
        <ResultBox style={{ marginTop: 10 }}>
          {[
            ['document id',   <code key="id" style={{ fontSize: '0.76rem', color: 'var(--t-btn-color)' }}>{data.document_id}</code>],
            ['document type', formatDocType(data.document_type)],
            ['language',      data.language || '—'],
            ['tier',          <span key="tier" style={{ color: '#34D399' }}>{data.current_tier}</span>],
            ['duplicate',     data.is_duplicate ? `yes (of ${data.duplicate_of})` : 'no'],
          ].map(([k, v]) => (
            <Field key={k}>
              <Label>{k}</Label>
              <Value>{v}</Value>
            </Field>
          ))}
        </ResultBox>
      )}

      {/* Navigate to Document Management once stored */}
      {done && onPageChange && (
        <OpenInDocMgmt data={data} onPageChange={onPageChange} />
      )}
    </ProgressWrap>
  );
}

// ── Channel definitions ───────────────────────────────────────────────────────
const CHANNELS = [
  {
    id: 'portal',
    name: 'Web Portal Upload',
    icon: '📂',
    gradient: 'linear-gradient(135deg,#3B82F6,#06B6D4)',
    desc: 'Drag & drop or click — PDF, JPEG, PNG, TIFF, XML, JSON · max 50 MB',
    type: 'file',
    accept: '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.xml,.json',
  },
  {
    id: 'api',
    name: 'REST API Upload',
    icon: '🔌',
    gradient: 'linear-gradient(135deg,#8B5CF6,#6D28D9)',
    desc: 'Programmatic upload — same formats as Portal channel',
    type: 'file',
    accept: '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.xml,.json',
  },
  {
    id: 'barcode',
    name: 'Barcode / QR Scan',
    icon: '📷',
    gradient: 'linear-gradient(135deg,#F59E0B,#D97706)',
    desc: 'Upload a barcode image or paste a scanner string (GS1, QR codes)',
    type: 'barcode',
    accept: '.jpg,.jpeg,.png',
  },
  {
    id: 'voice',
    name: 'Voice / Audio Input',
    icon: '🎤',
    gradient: 'linear-gradient(135deg,#10B981,#059669)',
    desc: 'Upload WAV, MP3, M4A, OGG, FLAC — spoken trade details via Whisper ASR',
    type: 'audio',
    accept: '.wav,.mp3,.m4a,.ogg,.flac',
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function FileUploadCard({ channel, onPageChange }) {
  const [dragging,    setDragging]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [documentId,  setDocumentId]  = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [error,       setError]       = useState(null);
  const inputRef = useRef();

  const upload = useCallback(async (file) => {
    if (!file) return;
    setUploading(true); setDocumentId(null); setInitialData(null); setError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('source_channel', channel.id);
    try {
      const endpoint = channel.type === 'audio'
        ? `${API_BASE}/intake/voice`
        : `${API_BASE}/intake/upload`;
      const { data } = await axios.post(endpoint, form, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      setInitialData(data);
      setDocumentId(data.document_id);   // triggers poller
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setUploading(false);
    }
  }, [channel]);

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    upload(e.dataTransfer.files[0]);
  };

  return (
    <Card>
      <ChannelHeader>
        <ChannelIcon gradient={channel.gradient}>{channel.icon}</ChannelIcon>
        <div>
          <ChannelName>{channel.name}</ChannelName>
          <ChannelDesc>{channel.desc}</ChannelDesc>
        </div>
      </ChannelHeader>

      <DropZone
        dragging={dragging}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {uploading
          ? <><Spinner />Uploading…</>
          : <>Drop file here or click to select</>}
        <input ref={inputRef} type="file" accept={channel.accept}
               style={{ display: 'none' }}
               onChange={(e) => upload(e.target.files[0])} />
      </DropZone>

      {error && (
        <ResultBox style={{ borderColor: 'rgba(239,68,68,0.25)', color: '#F87171', marginTop: 12 }}>
          {typeof error === 'object' ? JSON.stringify(error, null, 2) : error}
        </ResultBox>
      )}

      {documentId && <PipelineProgress documentId={documentId} initialData={initialData} onPageChange={onPageChange} />}
    </Card>
  );
}

function BarcodeCard({ onPageChange }) {
  const [mode,       setMode]       = useState('image');
  const [rawText,    setRawText]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [documentId, setDocumentId] = useState(null);
  const [initialData,setInitialData]= useState(null);
  const [error,      setError]      = useState(null);
  const inputRef = useRef();

  const handleResponse = (data) => {
    // barcode/image returns {ingested:[{document_id,...}]}
    const docId = data.document_id || data.ingested?.[0]?.document_id;
    setInitialData(data);
    setDocumentId(docId || null);
  };

  const submitImage = useCallback(async (file) => {
    setLoading(true); setDocumentId(null); setInitialData(null); setError(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await axios.post(`${API_BASE}/intake/barcode/image`, form, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      handleResponse(data);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  }, []);

  const submitRaw = useCallback(async () => {
    if (!rawText.trim()) return;
    setLoading(true); setDocumentId(null); setInitialData(null); setError(null);
    const form = new FormData();
    form.append('payload', rawText.trim());
    try {
      const { data } = await axios.post(`${API_BASE}/intake/barcode/raw`, form, {
        headers: authHeader(),
      });
      handleResponse(data);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  }, [rawText]);

  return (
    <Card>
      <ChannelHeader>
        <ChannelIcon gradient="linear-gradient(135deg,#F59E0B,#D97706)">📷</ChannelIcon>
        <div>
          <ChannelName>Barcode / QR Code</ChannelName>
          <ChannelDesc>GS1 barcodes · QR codes · shipment metadata</ChannelDesc>
        </div>
      </ChannelHeader>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['image', 'raw'].map(m => (
          <Btn key={m} variant={mode === m ? 'primary' : 'secondary'}
               onClick={() => setMode(m)} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
            {m === 'image' ? '🖼 Scan Image' : '⌨ Raw String'}
          </Btn>
        ))}
      </div>

      {mode === 'image' ? (
        <DropZone onClick={() => !loading && inputRef.current?.click()}>
          {loading ? <><Spinner />Scanning…</> : 'Upload barcode / QR image (JPEG, PNG)'}
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png"
                 style={{ display: 'none' }}
                 onChange={(e) => submitImage(e.target.files[0])} />
        </DropZone>
      ) : (
        <>
          <Textarea placeholder="Paste raw barcode string from hardware scanner…"
                    value={rawText} onChange={(e) => setRawText(e.target.value)} />
          <Btn onClick={submitRaw} disabled={loading || !rawText.trim()} fullWidth>
            {loading ? <><Spinner />Submitting…</> : 'Submit Barcode'}
          </Btn>
        </>
      )}

      {error && <ResultBox style={{ borderColor: 'rgba(239,68,68,0.25)', color: '#F87171' }}>{String(error)}</ResultBox>}
      {documentId && <PipelineProgress documentId={documentId} initialData={initialData} onPageChange={onPageChange} />}
    </Card>
  );
}

function AdminTriggerCard() {
  const [loading, setLoading] = useState({});
  const [msgs,    setMsgs]    = useState({});

  const trigger = async (channel) => {
    setLoading(p => ({ ...p, [channel]: true }));
    setMsgs(p => ({ ...p, [channel]: null }));
    try {
      const { data } = await axios.post(
        `${API_BASE}/intake/${channel}/trigger`, {},
        { headers: authHeader() }
      );
      setMsgs(p => ({ ...p, [channel]: data.message || 'Triggered.' }));
    } catch (e) {
      setMsgs(p => ({ ...p, [channel]: e.response?.data?.detail || e.message }));
    } finally {
      setLoading(p => ({ ...p, [channel]: false }));
    }
  };

  return (
    <Card>
      <ChannelHeader>
        <ChannelIcon gradient="linear-gradient(135deg,#64748B,#475569)">⚙️</ChannelIcon>
        <div>
          <ChannelName>Batch Channel Triggers</ChannelName>
          <ChannelDesc>Admin-only — manually poll SFTP and Email inboxes</ChannelDesc>
        </div>
      </ChannelHeader>

      {['sftp', 'email'].map(ch => (
        <div key={ch} style={{ marginBottom: 10 }}>
          <Btn variant="secondary" fullWidth onClick={() => trigger(ch)}
               disabled={loading[ch]}>
            {loading[ch] ? <><Spinner />Polling…</> : `Poll ${ch.toUpperCase()} inbox`}
          </Btn>
          {msgs[ch] && (
            <div style={{ fontSize: '0.8rem', color: 'var(--t-text-sub)', marginTop: 6, textAlign: 'center' }}>
              {msgs[ch]}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}


// ── Document view modal ───────────────────────────────────────────────────────
const ViewModalBox = styled.div`
  background: var(--t-card);
  border: 1px solid rgba(59,130,246,0.3);
  border-radius: 14px;
  padding: 28px 32px;
  max-width: 560px; width: 95%;
  max-height: 85vh; overflow-y: auto;
  animation: ${fadeIn} 0.2s ease;
`;

function DocumentViewModal({ doc, data, loading, onClose }) {
  return (
    <ModalOverlay onClick={onClose}>
      <ViewModalBox onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--t-text)' }}>Document Details</div>
          <button onClick={onClose}
                  style={{ background: 'none', border: 'none', color: 'var(--t-text-sub)', cursor: 'pointer', fontSize: '1.2rem' }}>
            ✕
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t-text-sub)' }}>
            <Spinner style={{ display: 'inline-block', marginRight: 8 }} />Loading…
          </div>
        )}

        {!loading && data && !data.error && (
          <ResultBox>
            {[
              ['Document ID',    <code style={{ fontSize: '0.75rem', color: 'var(--t-btn-color)', wordBreak: 'break-all' }}>{data.document_id}</code>],
              ['Status',         <StatusBadge status={data.ingestion_status}>{data.ingestion_status}</StatusBadge>],
              ['Source Channel', data.source_channel || '—'],
              ['File Type',      data.file_type || '—'],
              ['Document Type',  formatDocType(data.document_type)],
              ['Language',       data.language || '—'],
              ['Current Tier',   <span style={{ color: '#34D399' }}>{data.current_tier || '—'}</span>],
              ['Duplicate',      data.is_duplicate
                ? <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                    ⚠ YES{data.duplicate_confidence != null ? ` (${(data.duplicate_confidence * 100).toFixed(1)}% match)` : ''}
                    {data.duplicate_of && <><br/><code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{data.duplicate_of}</code></>}
                  </span>
                : <span style={{ color: '#34D399' }}>No</span>],
              ['Raw Lake Path',  data.raw_lake_path
                ? <code style={{ fontSize: '0.72rem', color: '#2563eb', wordBreak: 'break-all' }}>{data.raw_lake_path}</code>
                : '—'],
              ['Processed Path', data.processed_lake_path
                ? <code style={{ fontSize: '0.72rem', color: '#2563eb', wordBreak: 'break-all' }}>{data.processed_lake_path}</code>
                : '—'],
              ['Registered At',  data.created_at ? new Date(data.created_at).toLocaleString() : '—'],
              ['Processed At',   data.processed_at ? new Date(data.processed_at).toLocaleString() : '—'],
            ].map(([label, value]) => (
              <Field key={label}>
                <Label>{label}</Label>
                <Value>{value}</Value>
              </Field>
            ))}

            {data.validation_errors && Object.keys(data.validation_errors).length > 0 && (
              <Field>
                <Label style={{ color: '#F87171' }}>Validation Errors</Label>
                <Value style={{ color: '#F87171', fontSize: '0.78rem' }}>
                  {JSON.stringify(data.validation_errors)}
                </Value>
              </Field>
            )}

            {data.metadata_tags && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--t-text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Metadata Tags
                </div>
                <pre style={{ fontSize: '0.72rem', color: 'var(--t-text-sub)', background: 'rgba(0,0,0,0.25)',
                              borderRadius: 8, padding: '10px 12px', overflowX: 'auto', margin: 0 }}>
                  {JSON.stringify(data.metadata_tags, null, 2)}
                </pre>
              </div>
            )}
          </ResultBox>
        )}

        {!loading && data?.error && (
          <div style={{ color: '#F87171', fontSize: '0.85rem' }}>{data.error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </ViewModalBox>
    </ModalOverlay>
  );
}

// ── Confirm delete modal ──────────────────────────────────────────────────────
const ModalOverlay = styled.div`
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
`;
const ModalBox = styled.div`
  background: var(--t-card);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 14px;
  padding: 28px 32px;
  max-width: 420px; width: 90%;
  animation: ${fadeIn} 0.2s ease;
`;

function DeleteConfirmModal({ doc, onConfirm, onCancel, deleting, error }) {
  return (
    <ModalOverlay onClick={deleting ? undefined : onCancel}>
      <ModalBox onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>🗑️</div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--t-text)', marginBottom: 8 }}>
          {doc.is_duplicate ? 'Delete Duplicate Document?' : 'Delete Document?'}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--t-text-sub)', marginBottom: 6 }}>
          {doc.is_duplicate
            ? 'This will permanently remove the duplicate and all its data from the registry, data lake, and dedup index. The original document is not affected.'
            : 'This will permanently remove the document and all its data lake objects.'
          }{' '}
          This action cannot be undone.
        </div>
        <ResultBox style={{ margin: '14px 0' }}>
          <Field>
            <Label>document id</Label>
            <Value><code style={{ fontSize: '0.75rem', color: 'var(--t-btn-color)' }}>{doc.document_id?.slice(0,20)}…</code></Value>
          </Field>
          <Field>
            <Label>filename</Label>
            <Value>{doc.original_filename || '—'}</Value>
          </Field>
          {doc.is_duplicate && (
            <>
              <Field>
                <Label>duplicate of</Label>
                <Value style={{ color: '#F59E0B', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  <code>{doc.duplicate_of || '—'}</code>
                </Value>
              </Field>
              {doc.duplicate_confidence != null && (
                <Field>
                  <Label>match confidence</Label>
                  <Value style={{ color: '#F59E0B' }}>
                    {(doc.duplicate_confidence * 100).toFixed(1)}%
                  </Value>
                </Field>
              )}
            </>
          )}
        </ResultBox>
        {error && (
          <div style={{
            margin: '0 0 14px 0', padding: '10px 14px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 8, color: '#F87171', fontSize: '0.82rem', lineHeight: 1.4,
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onCancel} disabled={deleting}>Cancel</Btn>
          <Btn onClick={onConfirm} disabled={deleting}
               style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', minWidth: 140 }}>
            {deleting ? <><Spinner />Deleting…</> : 'Delete permanently'}
          </Btn>
        </div>
      </ModalBox>
    </ModalOverlay>
  );
}

// ── Registry viewer ───────────────────────────────────────────────────────────
function RegistryViewer() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [filter,     setFilter]     = useState({ channel: '', status: '' });
  const [toDelete,     setToDelete]     = useState(null);   // row selected for deletion
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState(null);
  const [deleteSuccess,setDeleteSuccess] = useState(null); // success message
  const [toView,       setToView]       = useState(null);   // row selected for viewing
  const [viewData,   setViewData]   = useState(null);
  const [viewLoading,setViewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: 1, page_size: 25 });
      if (filter.channel)    params.append('source_channel', filter.channel);
      if (filter.status)     params.append('ingestion_status', filter.status);
      if (filter.duplicates === 'duplicates') params.append('is_duplicate', 'true');
      const { data: d } = await axios.get(`${API_BASE}/intake/registry?${params}`,
        { headers: authHeader() });
      setData(d);
    } catch (e) {
      setData({ error: e.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  }, [filter]);

  const openView = async (row) => {
    setToView(row);
    setViewData(null);
    setViewLoading(true);
    try {
      const { data: d } = await axios.get(
        `${API_BASE}/intake/status/${row.document_id}`,
        { headers: authHeader() }
      );
      setViewData(d);
    } catch (e) {
      setViewData({ error: e.response?.data?.detail || e.message });
    } finally {
      setViewLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true); setDeleteError(null);
    const docName = toDelete.original_filename || toDelete.document_id?.slice(0, 16) + '…';
    const wasDuplicate = toDelete.is_duplicate;
    try {
      await axios.delete(`${API_BASE}/intake/document/${toDelete.document_id}`,
        { headers: authHeader() });
      setToDelete(null);
      setDeleteSuccess(
        wasDuplicate
          ? `Duplicate "${docName}" deleted — removed from registry, data lake and dedup index.`
          : `Document "${docName}" permanently deleted.`
      );
      setTimeout(() => setDeleteSuccess(null), 5000);
      await load();   // refresh registry
    } catch (e) {
      const detail = e.response?.data?.detail;
      setDeleteError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {toView && (
        <DocumentViewModal
          doc={toView}
          data={viewData}
          loading={viewLoading}
          onClose={() => { setToView(null); setViewData(null); }}
        />
      )}

      {toDelete && (
        <DeleteConfirmModal
          doc={toDelete}
          onConfirm={confirmDelete}
          onCancel={() => { setToDelete(null); setDeleteError(null); }}
          deleting={deleting}
          error={deleteError}
        />
      )}

      <SectionTitle>Document Registry</SectionTitle>

      {deleteSuccess && (
        <div style={{
          color: '#34D399', fontSize: '0.85rem', marginBottom: 12,
          padding: '10px 14px', background: 'rgba(52,211,153,0.08)',
          borderRadius: 8, border: '1px solid rgba(52,211,153,0.25)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: '1rem' }}>✓</span> {deleteSuccess}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filter.channel}
                onChange={e => setFilter(f => ({ ...f, channel: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--t-input-bg)',
                         border: '1px solid var(--t-input-border)', color: 'var(--t-text)', fontSize: '0.85rem' }}>
          <option value="">All channels</option>
          {['api','portal','sftp','email','barcode','voice'].map(c =>
            <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filter.status}
                onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--t-input-bg)',
                         border: '1px solid var(--t-input-border)', color: 'var(--t-text)', fontSize: '0.85rem' }}>
          <option value="">All statuses</option>
          {['registered','preprocessed','classified','stored','validation_failed'].map(s =>
            <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.duplicates || ''}
                onChange={e => setFilter(f => ({ ...f, duplicates: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--t-input-bg)',
                         border: '1px solid var(--t-input-border)', color: 'var(--t-text)', fontSize: '0.85rem' }}>
          <option value="">All documents</option>
          <option value="duplicates">Duplicates only</option>
        </select>
        <Btn onClick={load} disabled={loading}>
          {loading ? <><Spinner />Loading…</> : 'Refresh Registry'}
        </Btn>
      </div>

      {data?.error && (
        <div style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12 }}>{data.error}</div>
      )}

      {data && !data.error && (
        <RegistryTable>
          <TableHeader>
            <div>Document ID</div>
            <div>Channel</div>
            <div>File Type</div>
            <div>Doc Type</div>
            <div>Status</div>
            <div>Tier</div>
            <div>Action</div>
          </TableHeader>
          {data.items?.length === 0 && (
            <div style={{ padding: '20px 18px', color: 'var(--t-text-sub)', fontSize: '0.85rem' }}>
              No documents found.
            </div>
          )}
          {data.items?.map(row => (
            <TableRow key={row.document_id}
                      style={row.is_duplicate ? {
                        background: 'rgba(245,158,11,0.05)',
                        borderLeft: '3px solid rgba(245,158,11,0.5)',
                      } : { borderLeft: '3px solid transparent' }}>
              <div title={row.document_id}>
                <code style={{ fontSize: '0.75rem', color: 'var(--t-btn-color)' }}>
                  {row.document_id?.slice(0, 16)}…
                </code>
                {row.is_duplicate && (
                  <span
                    title={[
                      'DUPLICATE DOCUMENT',
                      row.duplicate_of ? `Original: ${row.duplicate_of}` : '',
                      row.duplicate_confidence ? `Match confidence: ${(row.duplicate_confidence * 100).toFixed(1)}%` : '',
                      'This file is semantically identical to an existing document.',
                    ].filter(Boolean).join('\n')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      marginLeft: 6, fontSize: '0.68rem', fontWeight: 700,
                      color: '#F59E0B',
                      background: 'rgba(245,158,11,0.15)',
                      padding: '2px 7px', borderRadius: 4,
                      border: '1px solid rgba(245,158,11,0.4)',
                      cursor: 'default', letterSpacing: '0.03em',
                    }}>
                    ⚠ DUPLICATE
                  </span>
                )}
              </div>
              <div style={{ color: '#2563eb' }}>{row.source_channel}</div>
              <div>{row.file_type || '—'}</div>
              <div style={{ color: 'var(--t-text-sub)', fontSize: '0.78rem' }}>
                {formatDocType(row.document_type)}
              </div>
              <div><StatusBadge status={row.ingestion_status}>{row.ingestion_status}</StatusBadge></div>
              <div style={{ color: '#34D399', fontSize: '0.8rem' }}>{row.current_tier}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <ViewBtn onClick={() => openView(row)}>View</ViewBtn>
                <DeleteBtn
                  onClick={() => { setDeleteError(null); setToDelete(row); }}
                  style={row.is_duplicate ? {
                    background: 'rgba(239,68,68,0.18)',
                    borderColor: 'rgba(239,68,68,0.55)',
                    fontWeight: 700,
                  } : {}}
                  title={row.is_duplicate ? 'Delete this duplicate — removes it permanently from the registry and data lake' : 'Delete document permanently'}
                >
                  {row.is_duplicate ? 'Delete Duplicate' : 'Delete'}
                </DeleteBtn>
              </div>
            </TableRow>
          ))}
          {data.total > 0 && (
            <div style={{ padding: '10px 18px', color: 'var(--t-text-sub)', fontSize: '0.8rem',
                          borderTop: '1px solid var(--t-border)' }}>
              Showing {data.items?.length} of {data.total} documents
              {data.items?.filter(r => r.is_duplicate).length > 0 && (
                <span style={{ marginLeft: 12, color: '#FCD34D' }}>
                  · {data.items.filter(r => r.is_duplicate).length} duplicate(s)
                </span>
              )}
            </div>
          )}
        </RegistryTable>
      )}
    </>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function DataIntakePanel({ onPageChange }) {
  return (
    <Panel>
      <Title>Data Intake Engine</Title>
      <Subtitle>
        Multi-channel document ingestion · SOP DM-001 to DM-007 ·
        Three-tier data lake (Raw → Processed → Curated)
      </Subtitle>

      <SectionTitle>Input Channels</SectionTitle>
      <Grid>
        {CHANNELS.filter(c => c.type !== 'barcode').map(ch => (
          <FileUploadCard key={ch.id} channel={ch} onPageChange={onPageChange} />
        ))}
        <BarcodeCard onPageChange={onPageChange} />
        <AdminTriggerCard />
      </Grid>

      <RegistryViewer />
    </Panel>
  );
}
