/**
 * DutyCalculatorPanel — Module M04 Duty Computation Engine
 * OrbisPorté - The AI-Driven Global Trade Automation & Customs Platform
 * A product of SPECTRA AI PTE. LTD., Singapore
 *
 * SOP DUTY-001 to DUTY-008:
 *   Step 1: CIF = Cost + Insurance + Freight
 *   Step 2: AV  = CIF × Exchange Rate (INR)
 *   Step 3: BCD = AV × BCD Rate%
 *   Step 4: SWS = 10% of BCD
 *   Step 5: IGST = (AV + BCD + SWS) × GST Rate%
 *   Step 6: ADD  = per active DGTR notification
 *   Step 7: CVD / SGD per MoF notification
 *   Step 8: FTA exemption (Rules of Origin via GPT-4o-mini)
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import {
  m04Service,
  documentService,
  invoiceDutyService,
  hsCodeService,
} from '../../services/api';
import { useDocumentContext } from '../../contexts/DocumentContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ── Styled Components ─────────────────────────────────────────────────────────

const PanelContainer = styled.div`
  padding: ${theme.spacing.xxl}px;
  min-height: 100vh;
  display: flex;
  overflow-y: auto;
  flex-direction: column;
  gap: ${theme.spacing.xxl}px;
  background: ${theme.colors.ui.background};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.lg}px;
`;

const Title = styled.h1`
  font-weight: ${theme.typography.fontWeight.extrabold};
  font-size: ${theme.typography.fontSize['4xl']};
  color: ${theme.colors.text.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  text-shadow: ${theme.typography.textShadow.sm};
  letter-spacing: -0.02em;
  &:before { content: '⚙️'; font-size: ${theme.typography.fontSize['5xl']}; }
`;

const Subtitle = styled.p`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.medium};
  margin: ${theme.spacing.sm}px 0 0 0;
  line-height: 1.6;
`;

const Badge = styled.span`
  display: inline-block;
  background: ${props => props.$color || theme.colors.primary.gradient};
  color: #fff;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
`;

const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 480px 1fr;
  gap: ${theme.spacing.lg}px;
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg}px;
`;

const Card = styled.div`
  background: ${theme.colors.ui.cardElevated};
  border-radius: ${theme.radius.xxl}px;
  padding: ${theme.spacing.xxl}px;
  box-shadow: ${theme.shadows.card};
  border: 1px solid ${theme.colors.ui.borderLight};
  transition: all ${theme.transitions.normal} ${theme.transitions.easing.default};
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, rgba(201,165,32,0.3), transparent);
    pointer-events: none;
  }
  &:hover { box-shadow: ${theme.shadows.cardHover}; transform: translateY(-4px); }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.md}px;
  padding-bottom: ${theme.spacing.sm}px;
  border-bottom: 2px solid var(--t-border);
`;

const CardTitle = styled.h2`
  font-weight: ${theme.typography.fontWeight.semibold};
  font-size: ${theme.typography.fontSize.lg}px;
  color: ${theme.colors.text.primary};
  margin: 0;
  display: flex; align-items: center; gap: ${theme.spacing.sm}px;
`;

const FormGroup = styled.div`
  margin-bottom: ${theme.spacing.md}px;
`;

const Label = styled.label`
  display: block;
  font-size: ${theme.typography.fontSize.sm}px;
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.sm}px;
`;

const Input = styled.input`
  width: 100%;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  background: ${theme.colors.ui.background};
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm}px;
  transition: all ${theme.transitions.fast};
  box-sizing: border-box;
  &:focus { outline: none; border-color: ${theme.colors.primary.main}; box-shadow: 0 0 0 3px rgba(135,110,18,0.12); }
  &::placeholder { color: ${theme.colors.text.tertiary}; }
`;

const Select = styled.select`
  width: 100%;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  background: ${theme.colors.ui.background};
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm}px;
  transition: all ${theme.transitions.fast};
  &:focus { outline: none; border-color: ${theme.colors.primary.main}; box-shadow: 0 0 0 3px rgba(135,110,18,0.12); }

  option {
    background: #1a2035;
    color: #ffffff;
  }
  [data-theme="light"] & option {
    background: #ffffff;
    color: #0f172a;
  }
`;

const Button = styled.button`
  width: 100%;
  background: ${props => props.$secondary ? theme.colors.ui.border : theme.colors.primary.gradient};
  color: ${props => props.$secondary ? theme.colors.text.secondary : '#fff'};
  border: none;
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  font-size: ${theme.typography.fontSize.sm}px;
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  &:hover { transform: translateY(-2px); box-shadow: ${theme.shadows.md}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const SmallButton = styled.button`
  background: ${props => props.$variant === 'success' ? 'rgba(16,185,129,0.2)' : theme.colors.ui.border};
  color: ${props => props.$variant === 'success' ? '#34d399' : theme.colors.text.primary};
  border: 1px solid ${props => props.$variant === 'success' ? 'rgba(16,185,129,0.4)' : theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  font-size: ${theme.typography.fontSize.xs}px;
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  white-space: nowrap;
  transition: all ${theme.transitions.fast};
  &:hover:not(:disabled) { transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  [data-theme="light"] & {
    color: ${props => props.$variant === 'success' ? '#065f46' : theme.colors.text.primary};
  }
`;

const InputGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.sm}px;
  align-items: flex-end;
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.sm}px;
`;

const ThreeCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: ${theme.spacing.sm}px;
`;

const ErrorMessage = styled.div`
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  color: ${theme.colors.status.error};
  font-size: ${theme.typography.fontSize.sm}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const SuccessMessage = styled.div`
  background: rgba(16,185,129,0.1);
  border: 1px solid rgba(16,185,129,0.3);
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  color: #34d399;
  font-size: ${theme.typography.fontSize.sm}px;
  margin-bottom: ${theme.spacing.md}px;
  display: flex; align-items: center; gap: ${theme.spacing.sm}px;

  [data-theme="light"] & { color: #065f46; font-weight: 600; }
`;

const InfoBox = styled.div`
  background: rgba(201,165,32,0.1);
  border: 1px solid rgba(201,165,32,0.3);
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  color: #93c5fd;
  font-size: ${theme.typography.fontSize.sm}px;
  margin-bottom: ${theme.spacing.md}px;

  [data-theme="light"] & { color: #1d4ed8; }
`;

const UploadSection = styled.div`
  background: rgba(16,185,129,0.05);
  border: 2px dashed rgba(16,185,129,0.3);
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.lg}px;
  margin-bottom: ${theme.spacing.lg}px;
  text-align: center;
  color: ${theme.colors.text.primary};
`;

const UploadButton = styled.label`
  display: inline-flex; align-items: center; gap: ${theme.spacing.sm}px;
  background: ${theme.colors.primary.gradient};
  color: #fff; border: none; border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  font-size: ${theme.typography.fontSize.sm}px;
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  &:hover { transform: translateY(-2px); box-shadow: ${theme.shadows.md}; }
  input[type="file"] { display: none; }
`;

const RateTag = styled.span`
  display: inline-block;
  background: var(--t-badge-bg);
  color: var(--t-badge-color);
  border: 1px solid var(--t-badge-border);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 6px;
`;

const ResultCard = styled(Card)`
  background: linear-gradient(135deg, rgba(201,165,32,0.10) 0%, rgba(99,102,241,0.10) 100%);
  border: 1px solid rgba(201,165,32,0.25);
`;

const StepRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${theme.spacing.sm}px 0;
  border-bottom: 1px solid var(--t-border);
  &:last-child { border-bottom: none; }
`;

const StepLabel = styled.span`
  font-size: ${theme.typography.fontSize.sm}px;
  color: ${theme.colors.text.secondary};
  font-weight: ${theme.typography.fontWeight.medium};
  display: flex; align-items: center; gap: 6px;
`;

const StepValue = styled.span`
  font-size: ${props => props.$highlight ? theme.typography.fontSize.lg : theme.typography.fontSize.sm}px;
  color: ${props => props.$highlight ? theme.colors.primary.main : theme.colors.text.primary};
  font-weight: ${props => props.$highlight ? theme.typography.fontWeight.bold : theme.typography.fontWeight.semibold};
`;

const TotalRow = styled(StepRow)`
  margin-top: ${theme.spacing.md}px;
  padding-top: ${theme.spacing.md}px;
  border-top: 2px solid ${theme.colors.primary.main};
  border-bottom: none;
`;

const FTABadge = styled.div`
  background: rgba(16,185,129,0.15);
  border: 1px solid rgba(16,185,129,0.4);
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  color: #34d399;
  font-size: 12px;
  display: flex; align-items: center; gap: 8px;
  margin-top: ${theme.spacing.sm}px;

  [data-theme="light"] & { color: #065f46; font-weight: 600; }
`;

const ADDBadge = styled.div`
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  color: #fca5a5;
  font-size: 12px;
  display: flex; align-items: center; gap: 8px;
  margin-top: ${theme.spacing.sm}px;

  [data-theme="light"] & { color: #b91c1c; font-weight: 600; }
`;

const SopSection = styled.div`
  border-left: 3px solid ${props => props.$color || theme.colors.primary.main};
  padding-left: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const SopTitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${props => props.$color || theme.colors.primary.main};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
`;

const FormulaBox = styled.pre`
  background: ${theme.colors.ui.background};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  font-size: 11px;
  color: ${theme.colors.text.secondary};
  overflow-x: auto;
  white-space: pre-wrap;
  font-family: 'Monaco', 'Courier New', monospace;
  line-height: 1.7;
  max-height: 500px;
  overflow-y: auto;
`;

const Divider = styled.div`
  border-top: 1px solid var(--t-border);
  margin: ${theme.spacing.md}px 0;
`;

// ── Country list ─────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'CHN', name: 'China', flag: '🇨🇳' },
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  { code: 'DEU', name: 'Germany', flag: '🇩🇪' },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵' },
  { code: 'KOR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'SGP', name: 'Singapore', flag: '🇸🇬' },
  { code: 'VNM', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'THA', name: 'Thailand', flag: '🇹🇭' },
  { code: 'MYS', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'IDN', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'BGD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'LKA', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'ARE', name: 'UAE', flag: '🇦🇪' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺' },
  { code: 'GBR', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'FRA', name: 'France', flag: '🇫🇷' },
  { code: 'ITA', name: 'Italy', flag: '🇮🇹' },
];

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'JPY', name: 'Japanese Yen (¥)' },
  { code: 'CNY', name: 'Chinese Yuan (¥)' },
  { code: 'AED', name: 'UAE Dirham (د.إ)' },
  { code: 'SGD', name: 'Singapore Dollar (S$)' },
  { code: 'AUD', name: 'Australian Dollar (A$)' },
  { code: 'KRW', name: 'Korean Won (₩)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'INR', name: 'Indian Rupee (₹)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v);

const fmtFx = (v, ccy) => {
  if (ccy === 'INR') return fmt(v);
  return `${ccy} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};


// ── Component ─────────────────────────────────────────────────────────────────

const HSN_KEYS = ['hsn_code', 'hs_code', 'hscode', 'HS Code/HSN Code', 'HSN Code', 'hs_tariff_code', 'tariff_code', 'commodity_code'];

/**
 * Scan an extracted-fields object for an HSN code.
 * Checks top-level keys first, then line_items.
 */
function extractHsnFromFields(ef = {}) {
  for (const k of HSN_KEYS) { if (ef[k]) return String(ef[k]).trim(); }
  if (Array.isArray(ef.line_items)) {
    for (const item of ef.line_items) {
      for (const k of HSN_KEYS) { if (item?.[k]) return String(item[k]).trim(); }
    }
  }
  return null;
}

const DutyCalculatorPanel = ({ activeSubItem = 'duty' }) => {
  const computeRef = React.useRef(null);   // scroll-to after auto-fill
  const resultRef  = React.useRef(null);   // scroll-to after compute
  const subItemNames = {
    'duty': 'M04 Duty Engine',
    'duty-cif': 'CIF (Step 1)',
    'duty-av': 'Assessable Value (Step 2)',
    'duty-bcd': 'BCD (Step 3)',
    'duty-sws': 'SWS (Step 4)',
    'duty-add': 'ADD (Step 6)',
    'duty-safeguard': 'SGD (Step 7)',
    'duty-cvd': 'CVD (Step 7)',
    'duty-igst-base': 'IGST Base (Step 5)',
    'duty-integrated-gst': 'IGST (Step 5)',
    'duty-total': 'Total Duty',
  };

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    hsn_code: '',
    fob_cost: '',
    freight: '',
    insurance: '',
    input_currency: 'USD',
    exchange_rate_override: '',
    country_of_origin: '',
    port_code: '',
    quantity: '',
    unit: 'PCS',
    product_description: '',
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Exchange rate live fetch
  const [liveRate, setLiveRate] = useState(null);
  const [rateSource, setRateSource] = useState('');
  const [rateLoading, setRateLoading] = useState(false);

  // Upload helpers
  const [uploadLoading, setUploadLoading] = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('');

  // AI HSN lookup
  const [hsnLoading, setHsnLoading] = useState(false);
  const [hsnFromDocument, setHsnFromDocument] = useState(false); // true when HS code came from uploaded doc

  // ── DocumentContext — read extracted HSN from Document Management ──────────
  const { files: ctxFiles, m02States: ctxM02 } = useDocumentContext();

  // Auto-fill HSN (and other fields) from the most recent completed M02 extraction
  // in DocumentContext, so documents processed in Document Management flow directly
  // into the Duty Engine without re-uploading.
  useEffect(() => {
    if (!ctxFiles || !ctxM02) return;

    // Find the last file that has a completed M02 extraction with an HSN code
    let foundHsn = null;
    let foundFields = null;
    let foundFileName = null;

    for (let i = ctxFiles.length - 1; i >= 0; i--) {
      const m02 = ctxM02[i];
      if (m02?.status !== 'done' || !m02.result) continue;
      const ef = m02.result.normalised_fields || m02.result.extracted_fields || {};
      const hsn = extractHsnFromFields(ef);
      if (hsn) {
        foundHsn = hsn;
        foundFields = ef;
        foundFileName = ctxFiles[i]?.file?.name || ctxFiles[i]?.name || 'Document';
        break;
      }
    }

    if (!foundHsn || !foundFields) return;

    // Only auto-fill if no HSN is already in the form (avoid overwriting manual input)
    setForm(f => {
      if (f.hsn_code) return f; // already filled — don't overwrite
      const lineItems = Array.isArray(foundFields.line_items) ? foundFields.line_items : [];
      const item0 = lineItems[0] || {};
      return {
        ...f,
        hsn_code: foundHsn,
        product_description: f.product_description || item0.description || item0.goods_description || foundFields.goods_description || foundFields['Goods Description'] || '',
        country_of_origin: f.country_of_origin || foundFields.country_of_origin || foundFields['Country of Origin'] || '',
        quantity: f.quantity || String(item0.quantity || item0.qty || foundFields.quantity || ''),
        unit: f.unit || item0.unit || item0.uom || 'PCS',
        fob_cost: f.fob_cost || String(item0.unit_price || item0.total_value || item0.amount || ''),
        input_currency: f.input_currency !== 'USD' ? f.input_currency : (foundFields.currency || foundFields['Currency'] || 'USD'),
      };
    });
    setHsnFromDocument(true);
    setSuccess(`HSN auto-filled from "${foundFileName}" (Document Management) — ready to compute`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxFiles, ctxM02]);

  // ── On mount ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadDocs();
  }, []);

  // Auto-fetch exchange rate when currency changes
  useEffect(() => {
    if (form.input_currency && form.input_currency !== 'INR') {
      fetchLiveRate(form.input_currency);
    } else {
      setLiveRate(1.0);
      setRateSource('IDENTITY');
    }
  }, [form.input_currency]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const loadDocs = async () => {
    try {
      const docs = await documentService.getDocumentList(50);
      setRecentDocs(docs.slice(0, 10));
    } catch {}
  };

  const fetchLiveRate = async (currency) => {
    setRateLoading(true);
    try {
      const data = await m04Service.getExchangeRate(currency);
      setLiveRate(data.rate_inr);
      setRateSource(data.source);
    } catch {
      setLiveRate(null);
      setRateSource('UNAVAILABLE');
    } finally {
      setRateLoading(false);
    }
  };

  const handleHSNLookup = async () => {
    if (!form.product_description.trim()) {
      setError('Enter a product description first');
      return;
    }
    setHsnLoading(true);
    setError('');
    try {
      const res = await hsCodeService.lookupHSCode(form.product_description);
      const hsn = res.selected_hsn || res.top_result?.hsn_code || res.hs_code;
      const top1 = (res.top3_predictions || [])[0] || {};
      const desc = top1.reasoning || res.top_result?.description || res.hs_description || '';
      if (hsn) {
        setForm(f => ({ ...f, hsn_code: hsn }));
        setSuccess(`HSN found: ${hsn} — ${desc.slice(0, 120)}`);
      } else {
        setError('No HSN code found for this product description');
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'HSN lookup failed');
    } finally {
      setHsnLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadLoading(true);
    setError('');
    try {
      const uploaded = await documentService.uploadDocument(file);
      const extracted = await invoiceDutyService.processInvoiceComplete({
        file_path: uploaded.file_path,
        document_id: uploaded.id,
        auto_classify_hsn: true,
      });
      autoFillFromExtraction(extracted, file.name);
      loadDocs();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to process document');
    } finally {
      setUploadLoading(false);
      e.target.value = null;
    }
  };

  const handleDocSelect = async (e) => {
    const docId = e.target.value;
    setSelectedDoc(docId);
    if (!docId) return;
    setUploadLoading(true);
    setError('');
    try {
      const doc = recentDocs.find(d => d.id === parseInt(docId));
      if (!doc) { setError('Document not found'); return; }

      // ── Fast path: use already-stored duty_summary if available ──────────
      try {
        const docDetails = await documentService.getDocumentById(parseInt(docId));
        const stored = docDetails?.extracted_data?.duty_summary;
        if (stored?.success && stored?.items?.length > 0) {
          autoFillFromExtraction(stored, doc.original_filename || doc.filename);
          return;
        }
      } catch { /* fall through to reprocess */ }

      // ── Slow path: re-run extraction + classification ─────────────────────
      const filePath = doc.file_path || doc.filename;
      if (!filePath) { setError('Document missing file path'); return; }
      const extracted = await invoiceDutyService.processInvoiceComplete({
        file_path: filePath,
        document_id: parseInt(docId),
        auto_classify_hsn: true,
      });
      autoFillFromExtraction(extracted, doc.original_filename || doc.filename);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to process document');
    } finally {
      setUploadLoading(false);
    }
  };

  // Extract every form field from the processInvoiceComplete / duty_summary response
  const autoFillFromExtraction = (extracted, sourceName) => {
    // Normalise top-level structure
    const inv         = extracted.combined || extracted;
    const invoiceData = extracted.invoice_data || inv.invoice_data || {};
    const items       = extracted.items
      || inv.items || inv.line_items || inv.invoice_items
      || (invoiceData && invoiceData.items) || [];

    if (items.length === 0) {
      setError('No line items found in document');
      return;
    }

    const item = items[0];

    // ── Per-item fields ───────────────────────────────────────────────────
    const hsn         = item.hsn_code     || item.hs_code   || '';
    // FOB = unit price per item; fall back to total line value
    const fob         = item.unit_price   != null ? item.unit_price
                      : item.total_value  != null ? item.total_value
                      : item.cif_value    != null ? item.cif_value
                      : item.value        != null ? item.value : '';
    const qty         = item.quantity     != null ? item.quantity : item.qty ?? '';
    const unitVal     = item.unit         || item.uom        || 'PCS';
    const description = item.description  || item.item_name  || item.product || '';

    // ── Invoice-level fields ──────────────────────────────────────────────
    const freight    = invoiceData.freight    ?? inv.freight    ?? '';
    const insurance  = invoiceData.insurance  ?? inv.insurance  ?? '';
    // Currency: prefer explicit field, then invoice header, then 'USD'
    const currency   = invoiceData.currency   || inv.currency   || 'USD';
    const coo        = invoiceData.country_of_origin || inv.country_of_origin || '';
    // Use document exchange rate as override only if explicitly given
    const exRate     = invoiceData.exchange_rate || inv.exchange_rate || '';

    // ── HS code source ─────────────────────────────────────────────────────
    const docHasHsn = Boolean(hsn && item.hsn_from_document !== false);
    setHsnFromDocument(docHasHsn);

    setForm(f => ({
      ...f,
      hsn_code:              hsn         !== '' ? String(hsn)         : f.hsn_code,
      product_description:   description !== '' ? String(description) : f.product_description,
      fob_cost:              fob         !== '' ? String(fob)         : f.fob_cost,
      freight:               freight     !== '' ? String(freight)     : f.freight,
      insurance:             insurance   !== '' ? String(insurance)   : f.insurance,
      input_currency:        currency    || f.input_currency,
      country_of_origin:     coo         || f.country_of_origin,
      quantity:              qty         !== '' ? String(qty)         : f.quantity,
      unit:                  unitVal     || f.unit,
      exchange_rate_override: exRate     !== '' ? String(exRate)      : f.exchange_rate_override,
    }));

    setSuccess(
      docHasHsn
        ? `Auto-filled from "${sourceName}" — HS Code found in document, click Compute Duty`
        : `Auto-filled from "${sourceName}" — No HS Code found, use AI lookup below`
    );

    // Scroll to the compute button so the user sees the filled form immediately
    setTimeout(() => computeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  };

  const handleCompute = async () => {
    if (!form.hsn_code || !form.fob_cost) {
      setError('HSN Code and FOB Cost are required');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        fob_cost: parseFloat(form.fob_cost) || 0,
        freight: parseFloat(form.freight) || 0,
        insurance: parseFloat(form.insurance) || 0,
        input_currency: form.input_currency,
        hsn_code: form.hsn_code,
        country_of_origin: form.country_of_origin || null,
        port_code: form.port_code || null,
        quantity: form.quantity ? parseFloat(form.quantity) : null,
        unit: form.unit || null,
        product_description: form.product_description || null,
        exchange_rate_override: form.exchange_rate_override
          ? parseFloat(form.exchange_rate_override)
          : null,
      };
      const res = await m04Service.compute(payload);
      setResult(res);

      // Persist for BOE auto-fill — BillOfEntryPanel reads this on mount
      try {
        localStorage.setItem('lastDutyComputation', JSON.stringify({
          computation_uuid:     res.computation_uuid,
          document_id:          selectedDoc ? parseInt(selectedDoc) : null,
          saved_at:             new Date().toISOString(),
          assessable_value_inr: res.assessable_value_inr,
          total_duty_inr:       res.total_duty_inr,
          total_payable_inr:    res.total_payable_inr,
          igst_amount:          res.duties?.igst_amount,
          bcd_amount:           res.duties?.bcd_amount,
          hsn_code:             form.hsn_code,
          country_of_origin:    form.country_of_origin,
          port_code:            form.port_code,
        }));
      } catch (_) {}

      // Scroll to results panel after computation
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Duty computation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setForm({
      hsn_code: '', fob_cost: '', freight: '', insurance: '',
      input_currency: 'USD', exchange_rate_override: '',
      country_of_origin: '', port_code: '',
      quantity: '', unit: 'PCS', product_description: '',
    });
    setResult(null);
    setError('');
    setSuccess('');
    setSelectedDoc('');
    setHsnFromDocument(false);
  };

  // ── Chart data from result ────────────────────────────────────────────────

  const chartData = result ? [
    { name: 'AV (INR)', value: result.assessable_value_inr, fill: '#E8C84A' },
    { name: 'BCD', value: result.duties.bcd_amount, fill: '#C9A520' },
    { name: 'SWS', value: result.duties.sws_amount, fill: '#F59E0B' },
    { name: 'IGST', value: result.duties.igst_amount, fill: '#10B981' },
    result.duties.add_amount > 0
      ? { name: 'ADD', value: result.duties.add_amount, fill: '#EF4444' }
      : null,
    result.duties.cvd_amount > 0
      ? { name: 'CVD', value: result.duties.cvd_amount, fill: '#EC4899' }
      : null,
    result.duties.sgd_amount > 0
      ? { name: 'SGD', value: result.duties.sgd_amount, fill: '#F97316' }
      : null,
    { name: 'Total Duty', value: result.total_duty_inr, fill: '#A78BFA' },
    { name: 'Total Payable', value: result.total_payable_inr, fill: '#FB7185' },
  ].filter(Boolean) : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PanelContainer>
      <Header>
        <div>
          <Title>
            M04 Duty Engine
            {activeSubItem !== 'duty' && (
              <Badge>{subItemNames[activeSubItem]}</Badge>
            )}
          </Title>
          <Subtitle>
            CIF → AV → BCD → SWS → IGST → ADD → CVD/SGD → FTA  |  SOP DUTY-001 to DUTY-008
          </Subtitle>
        </div>
      </Header>

      <MainLayout>
        {/* ── LEFT: Input Form ─────────────────────────────────────────────── */}
        <Column>
          <Card>
            <CardHeader>
              <CardTitle>📝 Shipment Details</CardTitle>
            </CardHeader>

            {error && <ErrorMessage>{error}</ErrorMessage>}
            {success && <SuccessMessage>✅ {success}</SuccessMessage>}

            <InfoBox>
              💡 Enter FOB Cost, Freight & Insurance separately in foreign currency.
              The engine will fetch live INR exchange rates and apply all SOP steps automatically.
            </InfoBox>

            {/* Auto-fill from document */}
            <UploadSection>
              <div style={{ marginBottom: 12, fontWeight: 600 }}>📤 Auto-Fill from Invoice</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <UploadButton>
                    {uploadLoading ? '⏳ Processing...' : '📁 Upload Invoice PDF'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploadLoading} />
                  </UploadButton>
                </div>
                {recentDocs.length > 0 && (
                  <div>
                    <Label style={{ fontSize: 12, marginBottom: 4 }}>Or select recent:</Label>
                    <Select value={selectedDoc} onChange={handleDocSelect} disabled={uploadLoading}>
                      <option value="">-- Select recent document --</option>
                      {recentDocs.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.original_filename} ({new Date(d.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            </UploadSection>

            {/* AI HSN Lookup — shown only when document does not already contain an HS code */}
            {hsnFromDocument ? (
              <FormGroup>
                <Label>🤖 AI HSN Lookup</Label>
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.4)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'rgba(16,185,129,1)',
                }}>
                  ✅ HS Code extracted directly from document — lookup not required
                </div>
              </FormGroup>
            ) : (
              <FormGroup>
                <Label>🤖 AI HSN Lookup {!form.hsn_code && <span style={{ color: '#F59E0B', fontSize: 11 }}>(required — no HS Code in document)</span>}</Label>
                <InputGroup>
                  <Input
                    type="text"
                    name="product_description"
                    value={form.product_description}
                    onChange={handleChange}
                    placeholder="e.g., Power transformer 25 kVA"
                    style={{ flex: 1 }}
                  />
                  <SmallButton
                    type="button"
                    $variant="success"
                    onClick={handleHSNLookup}
                    disabled={hsnLoading || !form.product_description.trim()}
                  >
                    {hsnLoading ? 'Finding...' : '🔍 Find HSN'}
                  </SmallButton>
                </InputGroup>
              </FormGroup>
            )}

            <Divider />

            {/* HSN Code */}
            <FormGroup>
              <Label>
                HSN Code *
                {hsnFromDocument && form.hsn_code && (
                  <Badge $color="rgba(16,185,129,0.8)" style={{ marginLeft: 8, fontSize: 10 }}>
                    from document
                  </Badge>
                )}
              </Label>
              <Input
                type="text"
                name="hsn_code"
                value={form.hsn_code}
                onChange={handleChange}
                placeholder="e.g., 85044030"
                maxLength="10"
              />
            </FormGroup>

            {/* Currency + Exchange Rate */}
            <FormGroup>
              <Label>Invoice Currency</Label>
              <TwoCol>
                <Select name="input_currency" value={form.input_currency} onChange={handleChange}>
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </Select>
                <div style={{ position: 'relative' }}>
                  <Input
                    type="number"
                    name="exchange_rate_override"
                    value={form.exchange_rate_override}
                    onChange={handleChange}
                    placeholder={
                      rateLoading
                        ? 'Fetching...'
                        : liveRate
                        ? `Live: ₹${Number(liveRate).toFixed(2)}`
                        : 'Override rate'
                    }
                    step="0.0001"
                    min="0"
                  />
                  {liveRate && !rateLoading && (
                    <div style={{ fontSize: 10, color: 'rgba(16,185,129,0.8)', marginTop: 2 }}>
                      1 {form.input_currency} = ₹{Number(liveRate).toFixed(4)}
                      <RateTag>{rateSource}</RateTag>
                    </div>
                  )}
                </div>
              </TwoCol>
            </FormGroup>

            {/* CIF Components — Step 1 */}
            <SopSection $color="var(--t-btn-color)">
              <SopTitle $color="var(--t-btn-color)">Step 1 — CIF = FOB Cost + Insurance + Freight</SopTitle>
              <ThreeCol>
                <div>
                  <Label style={{ fontSize: 11 }}>FOB Cost *</Label>
                  <Input type="number" name="fob_cost" value={form.fob_cost} onChange={handleChange} placeholder="10000" step="0.01" min="0" />
                </div>
                <div>
                  <Label style={{ fontSize: 11 }}>Freight</Label>
                  <Input type="number" name="freight" value={form.freight} onChange={handleChange} placeholder="1200" step="0.01" min="0" />
                </div>
                <div>
                  <Label style={{ fontSize: 11 }}>Insurance</Label>
                  <Input type="number" name="insurance" value={form.insurance} onChange={handleChange} placeholder="200" step="0.01" min="0" />
                </div>
              </ThreeCol>
              {form.fob_cost && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(147,197,253,1)' }}>
                  CIF = {form.input_currency} {(
                    (parseFloat(form.fob_cost) || 0) +
                    (parseFloat(form.freight) || 0) +
                    (parseFloat(form.insurance) || 0)
                  ).toFixed(2)}
                  {liveRate && (
                    <span style={{ marginLeft: 8 }}>
                      → ₹{(
                        ((parseFloat(form.fob_cost) || 0) +
                          (parseFloat(form.freight) || 0) +
                          (parseFloat(form.insurance) || 0)) *
                        Number(liveRate)
                      ).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (AV)
                    </span>
                  )}
                </div>
              )}
            </SopSection>

            {/* Country of Origin — for BCD / FTA / ADD */}
            <FormGroup>
              <Label>Country of Origin</Label>
              <Select name="country_of_origin" value={form.country_of_origin} onChange={handleChange}>
                <option value="">Select Country (affects BCD, FTA, ADD)</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </FormGroup>

            {/* Port */}
            <FormGroup>
              <Label>Port of Import</Label>
              <Select name="port_code" value={form.port_code} onChange={handleChange}>
                <option value="">Select Port (Optional)</option>
                <option value="INMAA1">Mumbai (INMAA1)</option>
                <option value="INBLR4">Bangalore (INBLR4)</option>
                <option value="INDEL1">Delhi (INDEL1)</option>
                <option value="INCCU1">Chennai (INCCU1)</option>
                <option value="INCOK1">Kochi (INCOK1)</option>
                <option value="INNHV4">Nhava Sheva (INNHV4)</option>
              </Select>
            </FormGroup>

            {/* Quantity + Unit */}
            <TwoCol>
              <FormGroup>
                <Label>Quantity</Label>
                <Input type="number" name="quantity" value={form.quantity} onChange={handleChange} placeholder="e.g., 100" step="0.001" min="0" />
              </FormGroup>
              <FormGroup>
                <Label>Unit</Label>
                <Select name="unit" value={form.unit} onChange={handleChange}>
                  <option value="PCS">Pieces (PCS)</option>
                  <option value="KG">Kilograms (KG)</option>
                  <option value="MT">Metric Tons (MT)</option>
                  <option value="MTR">Meters (MTR)</option>
                  <option value="LTR">Liters (LTR)</option>
                  <option value="SET">Sets (SET)</option>
                  <option value="NOS">Numbers (NOS)</option>
                </Select>
              </FormGroup>
            </TwoCol>

            <TwoCol style={{ marginTop: 8 }} ref={computeRef}>
              <Button onClick={handleCompute} disabled={loading}>
                {loading ? '⏳ Computing...' : '🧮 Compute Duty'}
              </Button>
              <Button $secondary onClick={handleClear}>
                🔄 Clear
              </Button>
            </TwoCol>
          </Card>
        </Column>

        {/* ── RIGHT: Results ────────────────────────────────────────────────── */}
        <Column>
          {result && (
            <>
              {/* Step-by-step SOP breakdown */}
              <ResultCard ref={resultRef}>
                <CardHeader>
                  <CardTitle>📊 Duty Computation — SOP Breakdown</CardTitle>
                  <Badge $color="#876E12" style={{ fontSize: 10 }}>
                    {result.computation_uuid?.slice(0, 8)}
                  </Badge>
                </CardHeader>

                {/* Step 1 */}
                <SopSection $color="var(--t-btn-color)">
                  <SopTitle $color="var(--t-btn-color)">Step 1 — CIF Value</SopTitle>
                  <StepRow>
                    <StepLabel>FOB Cost</StepLabel>
                    <StepValue>{fmtFx(result.fob_cost, result.input_currency)}</StepValue>
                  </StepRow>
                  <StepRow>
                    <StepLabel>+ Freight
                      {result.anomaly_flags?.freight_pct_of_fob != null && (
                        <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>
                          ({result.anomaly_flags.freight_pct_of_fob}% of FOB)
                        </span>
                      )}
                    </StepLabel>
                    <StepValue>{fmtFx(result.freight, result.input_currency)}</StepValue>
                  </StepRow>
                  <StepRow>
                    <StepLabel>+ Insurance</StepLabel>
                    <StepValue>{fmtFx(result.insurance, result.input_currency)}</StepValue>
                  </StepRow>
                  <StepRow>
                    <StepLabel style={{ fontWeight: 700 }}>= CIF</StepLabel>
                    <StepValue style={{ fontWeight: 700 }}>{fmtFx(result.cif_foreign, result.input_currency)}</StepValue>
                  </StepRow>
                  {/* Anomaly flags from ML lane-benchmark validation */}
                  {result.anomaly_flags?.has_anomalies && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {result.anomaly_flags.anomalies.map((a, i) => (
                        <div key={i} style={{
                          padding: '5px 10px',
                          background: 'rgba(245,158,11,0.12)',
                          border: '1px solid rgba(245,158,11,0.4)',
                          borderRadius: 6,
                          fontSize: 11,
                          color: 'rgba(251,191,36,1)',
                        }}>
                          ⚠ <strong>{a.code}</strong> — {a.message}
                        </div>
                      ))}
                    </div>
                  )}
                </SopSection>

                {/* Step 2 */}
                <SopSection $color="#A78BFA">
                  <SopTitle $color="#A78BFA">Step 2 — Assessable Value (AV)</SopTitle>
                  <StepRow>
                    <StepLabel>Exchange Rate
                      <RateTag>{result.exchange_rate_source}</RateTag>
                    </StepLabel>
                    <StepValue>1 {result.input_currency} = ₹{Number(result.exchange_rate).toFixed(4)}</StepValue>
                  </StepRow>
                  <StepRow>
                    <StepLabel style={{ fontWeight: 700 }}>AV (INR) = CIF × Rate</StepLabel>
                    <StepValue $highlight>{fmt(result.assessable_value_inr)}</StepValue>
                  </StepRow>
                </SopSection>

                {/* Step 3 */}
                <SopSection $color="#C9A520">
                  <SopTitle $color="#C9A520">Step 3 — Basic Customs Duty (BCD)</SopTitle>
                  <StepRow>
                    <StepLabel>BCD Rate
                      {result.fta?.eligible && result.fta?.agreement_code && (
                        <Badge $color="rgba(16,185,129,0.8)" style={{ fontSize: 9 }}>
                          FTA: {result.fta.agreement_code}
                        </Badge>
                      )}
                    </StepLabel>
                    <StepValue>{result.duties.bcd_rate}%</StepValue>
                  </StepRow>
                  <StepRow>
                    <StepLabel>BCD = AV × {result.duties.bcd_rate}%</StepLabel>
                    <StepValue>{fmt(result.duties.bcd_amount)}</StepValue>
                  </StepRow>
                </SopSection>

                {/* Step 4 */}
                <SopSection $color="#F59E0B">
                  <SopTitle $color="#F59E0B">Step 4 — Social Welfare Surcharge (SWS)</SopTitle>
                  <StepRow>
                    <StepLabel>SWS = 10% × BCD  [deterministic]</StepLabel>
                    <StepValue>{fmt(result.duties.sws_amount)}</StepValue>
                  </StepRow>
                </SopSection>

                {/* Step 5 */}
                <SopSection $color="#10B981">
                  <SopTitle $color="#10B981">Step 5 — Integrated GST (IGST)</SopTitle>
                  <StepRow>
                    <StepLabel>IGST Base = AV + BCD + SWS</StepLabel>
                    <StepValue>{fmt(result.duties.igst_base)}</StepValue>
                  </StepRow>
                  <StepRow>
                    <StepLabel>IGST Rate</StepLabel>
                    <StepValue>{result.duties.igst_rate}%</StepValue>
                  </StepRow>
                  <StepRow>
                    <StepLabel>IGST = Base × {result.duties.igst_rate}%</StepLabel>
                    <StepValue>{fmt(result.duties.igst_amount)}</StepValue>
                  </StepRow>
                </SopSection>

                {/* Step 6 — ADD */}
                <SopSection $color="#EF4444">
                  <SopTitle $color="#EF4444">Step 6 — Anti-Dumping Duty (ADD)</SopTitle>
                  {result.duties.add_amount > 0 ? (
                    <>
                      <StepRow>
                        <StepLabel>ADD Rate  [{result.duties.add_notification}]</StepLabel>
                        <StepValue>{result.duties.add_rate}%</StepValue>
                      </StepRow>
                      <StepRow>
                        <StepLabel>ADD Amount</StepLabel>
                        <StepValue style={{ color: '#FCA5A5' }}>{fmt(result.duties.add_amount)}</StepValue>
                      </StepRow>
                    </>
                  ) : (
                    <StepRow>
                      <StepLabel>ADD</StepLabel>
                      <StepValue style={{ color: 'rgba(156,163,175,1)' }}>NIL</StepValue>
                    </StepRow>
                  )}
                </SopSection>

                {/* Step 7 — CVD / SGD */}
                <SopSection $color="#EC4899">
                  <SopTitle $color="#EC4899">Step 7 — CVD / Safeguard Duty</SopTitle>
                  <StepRow>
                    <StepLabel>CVD ({result.duties.cvd_rate}%)</StepLabel>
                    <StepValue style={{ color: result.duties.cvd_amount > 0 ? '#F9A8D4' : 'rgba(156,163,175,1)' }}>
                      {result.duties.cvd_amount > 0 ? fmt(result.duties.cvd_amount) : 'NIL'}
                    </StepValue>
                  </StepRow>
                  <StepRow>
                    <StepLabel>SGD ({result.duties.sgd_rate}%)</StepLabel>
                    <StepValue style={{ color: result.duties.sgd_amount > 0 ? '#F9A8D4' : 'rgba(156,163,175,1)' }}>
                      {result.duties.sgd_amount > 0 ? fmt(result.duties.sgd_amount) : 'NIL'}
                    </StepValue>
                  </StepRow>
                </SopSection>

                {/* Step 8 — FTA */}
                <SopSection $color="rgba(16,185,129,1)">
                  <SopTitle $color="rgba(16,185,129,1)">Step 8 — FTA / Rules of Origin</SopTitle>
                  {result.fta?.eligible ? (
                    <FTABadge>
                      <span>✅</span>
                      <div>
                        <div><strong>{result.fta.agreement_code}</strong> — {result.fta.agreement_name}</div>
                        <div style={{ fontSize: 11, opacity: 0.8 }}>
                          Preferential BCD: {result.fta.preferential_bcd}%
                          {result.fta.savings_vs_mfn > 0 && ` | Saving: ${fmt(result.fta.savings_vs_mfn)}`}
                          {result.fta.roo_eligible === true && ' | RoO: Eligible'}
                          {result.fta.roo_eligible === false && ' | RoO: Not eligible'}
                          {result.fta.roo_eligible === null && ' | RoO: Unverified'}
                        </div>
                      </div>
                    </FTABadge>
                  ) : (
                    <StepRow>
                      <StepLabel>FTA</StepLabel>
                      <StepValue style={{ color: 'rgba(156,163,175,1)' }}>Not applicable</StepValue>
                    </StepRow>
                  )}
                </SopSection>

                <Divider />

                {/* Totals */}
                <StepRow>
                  <StepLabel>BCD</StepLabel><StepValue>{fmt(result.duties.bcd_amount)}</StepValue>
                </StepRow>
                <StepRow>
                  <StepLabel>+ SWS</StepLabel><StepValue>{fmt(result.duties.sws_amount)}</StepValue>
                </StepRow>
                <StepRow>
                  <StepLabel>+ IGST</StepLabel><StepValue>{fmt(result.duties.igst_amount)}</StepValue>
                </StepRow>
                {result.duties.add_amount > 0 && (
                  <StepRow>
                    <StepLabel>+ ADD</StepLabel>
                    <StepValue style={{ color: '#FCA5A5' }}>{fmt(result.duties.add_amount)}</StepValue>
                  </StepRow>
                )}
                {result.duties.cvd_amount > 0 && (
                  <StepRow>
                    <StepLabel>+ CVD</StepLabel>
                    <StepValue>{fmt(result.duties.cvd_amount)}</StepValue>
                  </StepRow>
                )}

                <TotalRow>
                  <StepLabel style={{ fontSize: 15, fontWeight: 700 }}>TOTAL DUTY</StepLabel>
                  <StepValue $highlight>{fmt(result.total_duty_inr)}</StepValue>
                </TotalRow>

                <StepRow style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--t-border)' }}>
                  <StepLabel>Total Payable (AV + Duty)</StepLabel>
                  <StepValue $highlight>{fmt(result.total_payable_inr)}</StepValue>
                </StepRow>

                {/* Alerts */}
                {result.duties.add_amount > 0 && (
                  <ADDBadge>
                    <span>⚠️</span>
                    <div>
                      <strong>Anti-Dumping Duty Active</strong>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>
                        Notification: {result.duties.add_notification}
                      </div>
                    </div>
                  </ADDBadge>
                )}
              </ResultCard>

              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 Duty Component Breakdown</CardTitle>
                </CardHeader>
                <div style={{ width: '100%', height: 420, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 60, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" />
                      <XAxis
                        dataKey="name"
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 11 }}
                        angle={-40}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 11 }}
                        tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--t-card-elevated)', border: '1px solid var(--t-border)', borderRadius: 8, color: 'var(--t-text)' }}
                        formatter={v => [`₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, '']}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Formula audit trail */}
              <Card>
                <CardHeader>
                  <CardTitle>📋 Full Formula Audit Trail</CardTitle>
                </CardHeader>
                <FormulaBox>{result.formula_text}</FormulaBox>
                <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(107,114,128,1)' }}>
                  Computed in {result.calculation_time_ms}ms · UUID: {result.computation_uuid}
                </div>
              </Card>

              {/* ── File BOE CTA ──────────────────────────────────────────────── */}
              <Card style={{
                border: '1px solid rgba(16,185,129,0.45)',
                background: 'rgba(16,185,129,0.04)',
              }}>
                <CardHeader>
                  <CardTitle style={{ color: '#34d399' }}>📄 Ready to File Bill of Entry</CardTitle>
                </CardHeader>
                <div style={{ fontSize: 13, color: 'var(--t-text-sub)', marginBottom: 14, lineHeight: 1.7 }}>
                  These duty figures have been saved automatically. Open the
                  <strong style={{ color: 'var(--t-text)' }}> Bill of Entry Filing</strong> module
                  and select your document — the calculations below will be injected directly:
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 10, marginBottom: 16,
                }}>
                  {[
                    ['Assessable Value', `₹${Number(result.assessable_value_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                    ['Custom Duty',      `₹${Number(result.total_duty_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                    ['IGST',             `₹${Number(result.duties?.igst_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                    ['Total Payable',    `₹${Number(result.total_payable_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
                  ].map(([label, val]) => (
                    <div key={label} style={{
                      background: 'var(--t-bg-dark)', borderRadius: 8,
                      padding: '10px 14px', border: '1px solid var(--t-border)',
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--t-text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#34d399' }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11, color: 'rgba(107,114,128,1)', marginBottom: 14 }}>
                  Computation UUID:&nbsp;
                  <code style={{ color: '#E8C84A', background: 'rgba(201,165,32,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                    {result.computation_uuid}
                  </code>
                  &nbsp;— saved to session storage
                </div>

                <SmallButton
                  type="button"
                  $variant="success"
                  style={{ fontSize: 13, padding: '10px 20px' }}
                  onClick={() => {
                    // Signal the BOE panel via a custom event so the app can navigate
                    window.dispatchEvent(new CustomEvent('orbis:openBOE', {
                      detail: { computation_uuid: result.computation_uuid }
                    }));
                  }}
                >
                  Open Bill of Entry Filing →
                </SmallButton>
              </Card>
            </>
          )}

          {!result && (
            <Card>
              <div style={{ textAlign: 'center', padding: 48, color: theme.colors.text.tertiary }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>⚙️</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>M04 Duty Computation Engine</div>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Enter shipment details on the left.<br />
                  The engine follows SOP DUTY-001 to DUTY-008 exactly:<br />
                  CIF → AV → BCD → SWS → IGST → ADD → CVD → FTA
                </p>
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {['Step 1: CIF', 'Step 2: AV', 'Step 3: BCD', 'Step 4: SWS', 'Step 5: IGST', 'Step 6: ADD', 'Step 7: CVD', 'Step 8: FTA'].map(s => (
                    <span key={s} style={{ background: 'var(--t-badge-bg)', border: '1px solid var(--t-badge-border)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: 'var(--t-badge-color)' }}>{s}</span>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </Column>
      </MainLayout>
    </PanelContainer>
  );
};

export default DutyCalculatorPanel;
