/**
 * M05 — Bill of Entry Filing System
 * ===================================
 * Aggregates M01–M04 data → fills 22 BoE fields → risk prediction →
 * field validation → ICEGATE submission → response handling → PDF download.
 *
 * Author: OrbisPorté Development Team
 * Company: SPECTRA AI PTE. LTD., Singapore
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// ── Styled Components ────────────────────────────────────────────────────────

const fadeIn = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }`;

const Container = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  color: var(--t-text);
  font-family: 'Inter', sans-serif;
  animation: ${fadeIn} 0.3s ease;
  background: var(--t-panel-bg);
  min-height: 100%;
  transition: background 0.3s ease, color 0.3s ease;
`;

const PageHeader = styled.div`
  margin-bottom: 28px;
`;

const PageTitle = styled.h1`
  font-size: 22px;
  font-weight: 700;
  color: var(--t-btn-color);
  margin: 0 0 4px;
`;

const PageSubtitle = styled.p`
  color: var(--t-text-sub);
  font-size: 13px;
  margin: 0;
`;

const StepBar = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: 28px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--t-border);
`;

const Step = styled.div`
  flex: 1;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.active ? 'rgba(59,130,246,0.25)' : p.done ? 'rgba(16,185,129,0.1)' : 'var(--t-bg-dark)'};
  color: ${p => p.active ? 'var(--t-btn-color)' : p.done ? '#34d399' : 'var(--t-text-sub)'};
  border-right: 1px solid var(--t-border-light);
  &:last-child { border-right: none; }
`;

const Card = styled.div`
  background: var(--t-card);
  border: 1px solid var(--t-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
`;

const CardTitle = styled.h3`
  font-size: 13px;
  font-weight: 700;
  color: var(--t-btn-color);
  margin: 0 0 16px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FieldLabel = styled.label`
  font-size: 11px;
  font-weight: 600;
  color: var(--t-text-sub);
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const FieldInput = styled.input`
  background: ${p => p.autofilled ? 'rgba(16,185,129,0.05)' : 'var(--t-input-bg)'};
  border: 1px solid ${p =>
    p.error      ? 'rgba(239,68,68,0.5)'   :
    p.autofilled ? 'rgba(16,185,129,0.45)' :
    p.missing    ? 'rgba(245,158,11,0.5)'  :
    'var(--t-input-border)'};
  border-radius: 7px;
  padding: 8px 12px;
  color: var(--t-text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  &:focus { border-color: var(--t-btn-color); box-shadow: 0 0 0 3px rgba(59,130,246,0.25); }
  &:disabled { opacity: 0.5; cursor: not-allowed; background: var(--t-bg-dark); }
`;

const FieldSelect = styled.select`
  background: var(--t-input-bg);
  border: 1px solid var(--t-input-border);
  border-radius: 7px;
  padding: 8px 12px;
  color: var(--t-text);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  &:focus { border-color: var(--t-btn-color); box-shadow: 0 0 0 3px rgba(59,130,246,0.25); }
`;

const FieldTextarea = styled.textarea`
  background: ${p => p.autofilled ? 'rgba(16,185,129,0.05)' : 'var(--t-input-bg)'};
  border: 1px solid ${p =>
    p.error      ? 'rgba(239,68,68,0.5)'   :
    p.autofilled ? 'rgba(16,185,129,0.45)' :
    p.missing    ? 'rgba(245,158,11,0.5)'  :
    'var(--t-input-border)'};
  border-radius: 7px;
  padding: 8px 12px;
  color: var(--t-text);
  font-size: 13px;
  outline: none;
  resize: vertical;
  min-height: 64px;
  font-family: inherit;
  &:focus { border-color: var(--t-btn-color); box-shadow: 0 0 0 3px rgba(59,130,246,0.25); }
`;

const FieldLabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 0;
`;

const AutoBadge = styled.span`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 1px 6px;
  border-radius: 99px;
  background: rgba(16,185,129,0.15);
  color: #34d399;
  border: 1px solid rgba(16,185,129,0.3);
  text-transform: uppercase;
`;

const MissingBadge = styled.span`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 1px 6px;
  border-radius: 99px;
  background: rgba(245,158,11,0.15);
  color: #fbbf24;
  border: 1px solid rgba(245,158,11,0.3);
  text-transform: uppercase;
`;

const FieldLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--t-bg-dark);
  border: 1px solid var(--t-border);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--t-text-sub);
  flex-wrap: wrap;
`;

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: ${p => p.variant === 'danger' ? 'rgba(239,68,68,0.1)' :
               p.variant === 'success' ? 'rgba(16,185,129,0.1)' :
               p.variant === 'outline' ? 'transparent' :
               'rgba(59,130,246,0.15)'};
  color: ${p => p.variant === 'danger' ? '#f87171' :
           p.variant === 'success' ? '#34d399' :
           p.variant === 'outline' ? 'var(--t-text-sub)' : '#60a5fa'};
  border: 1px solid ${p => p.variant === 'danger' ? 'rgba(239,68,68,0.3)' :
                      p.variant === 'success' ? 'rgba(16,185,129,0.3)' :
                      p.variant === 'outline' ? 'var(--t-border)' :
                      'rgba(59,130,246,0.35)'};
  &:hover:not(:disabled) {
    background: ${p => p.variant === 'danger' ? 'rgba(239,68,68,0.2)' :
                 p.variant === 'success' ? 'rgba(16,185,129,0.2)' :
                 p.variant === 'outline' ? 'var(--t-hover)' :
                 'rgba(59,130,246,0.25)'};
  }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
`;

const Alert = styled.div`
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: ${p => p.type === 'error' ? 'rgba(239,68,68,0.15)' :
               p.type === 'warning' ? 'rgba(245,158,11,0.15)' :
               p.type === 'success' ? 'rgba(16,185,129,0.15)' :
               'rgba(59,130,246,0.12)'};
  border: 1px solid ${p => p.type === 'error' ? 'rgba(239,68,68,0.4)' :
                      p.type === 'warning' ? 'rgba(245,158,11,0.4)' :
                      p.type === 'success' ? 'rgba(16,185,129,0.4)' :
                      'rgba(59,130,246,0.35)'};
  color: ${p => p.type === 'error' ? '#f87171' :
           p.type === 'warning' ? '#fbbf24' :
           p.type === 'success' ? '#34d399' : '#60a5fa'};
`;

const RiskMeter = styled.div`
  background: var(--t-card);
  border: 1px solid var(--t-border);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
`;

const RiskTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: var(--t-text-sub);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
`;

const RiskScoreRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
`;

const RiskScore = styled.div`
  font-size: 36px;
  font-weight: 800;
  color: ${p => p.band === 'LOW' ? '#34d399' : p.band === 'MEDIUM' ? '#fbbf24' : '#f87171'};
`;

const RiskBand = styled.span`
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 99px;
  background: ${p => p.band === 'LOW' ? 'rgba(16,185,129,0.15)' : p.band === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'};
  color: ${p => p.band === 'LOW' ? '#34d399' : p.band === 'MEDIUM' ? '#fbbf24' : '#f87171'};
  border: 1px solid ${p => p.band === 'LOW' ? 'rgba(16,185,129,0.3)' : p.band === 'MEDIUM' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'};
`;

const RiskBar = styled.div`
  height: 6px;
  border-radius: 99px;
  background: var(--t-glass-light);
  overflow: hidden;
  margin-bottom: 8px;
  > div {
    height: 100%;
    border-radius: 99px;
    width: ${p => p.score}%;
    background: ${p => p.band === 'LOW' ? '#34d399' : p.band === 'MEDIUM' ? '#fbbf24' : '#f87171'};
    transition: width 0.6s ease;
  }
`;

const RiskReason = styled.div`
  font-size: 12px;
  color: #fbbf24;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 4px;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 99px;
  background: ${p =>
    p.status === 'ACCEPTED' ? 'rgba(16,185,129,0.15)' :
    p.status === 'REJECTED' ? 'rgba(239,68,68,0.15)' :
    p.status === 'QUERY'    ? 'rgba(245,158,11,0.15)' :
    p.status === 'PENDING'  ? 'rgba(59,130,246,0.15)' :
    'var(--t-hover)'};
  color: ${p =>
    p.status === 'ACCEPTED' ? '#34d399' :
    p.status === 'REJECTED' ? '#f87171' :
    p.status === 'QUERY'    ? '#fbbf24' :
    p.status === 'PENDING'  ? '#60a5fa' :
    'var(--t-text-sub)'};
  border: 1px solid ${p =>
    p.status === 'ACCEPTED' ? 'rgba(16,185,129,0.3)' :
    p.status === 'REJECTED' ? 'rgba(239,68,68,0.3)' :
    p.status === 'QUERY'    ? 'rgba(245,158,11,0.3)' :
    p.status === 'PENDING'  ? 'rgba(59,130,246,0.3)' :
    'var(--t-border)'};
`;

const LineItemsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  th {
    background: rgba(59,130,246,0.2);
    color: var(--t-btn-color);
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    white-space: nowrap;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--t-border-light);
    color: var(--t-text);
    vertical-align: top;
  }
  tr:hover td { background: var(--t-bg-dark); }
`;

const QueryBox = styled.div`
  background: rgba(245,158,11,0.06);
  border: 1px solid rgba(245,158,11,0.25);
  border-radius: 10px;
  padding: 16px;
  margin-top: 16px;
`;

const QueryDraft = styled.pre`
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12.5px;
  color: var(--t-text);
  font-family: 'Inter', sans-serif;
  line-height: 1.6;
  margin: 12px 0 0;
  background: var(--t-bg-dark);
  border: 1px solid var(--t-border);
  border-radius: 6px;
  padding: 12px;
`;

const Spinner = styled.div`
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(37,99,235,0.2);
  border-top-color: var(--t-btn-color);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const SectionDivider = styled.div`
  height: 1px;
  background: var(--t-glass-light);
  margin: 20px 0;
`;

// ── Ports ─────────────────────────────────────────────────────────────────────
const PORTS = [
  { code: 'INMAA1', name: 'Mumbai (Nhava Sheva)' },
  { code: 'INMAA4', name: 'Chennai' },
  { code: 'INCCU1', name: 'Kolkata' },
  { code: 'INBLR4', name: 'Bangalore Air Cargo' },
  { code: 'INDEL4', name: 'Delhi Air Cargo (IGI)' },
  { code: 'INHYDB4', name: 'Hyderabad (RGIA)' },
];

const BOE_TYPES = [
  { value: 'HOME_CONSUMPTION', label: 'Home Consumption (Into Bond)' },
  { value: 'WAREHOUSING', label: 'Warehousing (Ex-Bond)' },
  { value: 'TRANSIT', label: 'Transit' },
  { value: 'TRANSSHIPMENT', label: 'Transhipment' },
];

const STEPS = ['1. Select Document', '2. Review Fields', '3. Risk & Validate', '4. Submit', '5. Status'];

// ── Main Component ────────────────────────────────────────────────────────────
const BillOfEntryPanel = () => {
  const [step, setStep] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [portOfImport, setPortOfImport] = useState('INMAA1');
  const [m04Uuid, setM04Uuid] = useState('');
  const [m04FromEngine, setM04FromEngine] = useState(null); // banner data when auto-loaded from M04

  // BoE fields state — all 22 fields + extras
  const emptyFields = {
    boe_number: '',
    date_of_filing: new Date().toISOString().slice(0, 10),
    port_of_import: 'INMAA1',
    boe_type: 'HOME_CONSUMPTION',
    importer_name: '',
    importer_address: '',
    importer_iec: '',
    importer_gstin: '',
    description_of_goods: '',
    quantity: '',
    hsn_code: '',
    custom_value_inr: '',
    country_of_origin: '',
    country_of_shipment: '',
    custom_duty: '',
    gst: '',
    bill_of_lading_number: '',
    shipping_line: '',
    port_of_shipment: '',
    arrival_date: '',
    custom_officer: '',
    date_of_clearance: '',
    importer_signature: 'DIGITAL',
    custom_officer_signature: '',
    // extras
    currency: 'USD',
    exchange_rate: '',
    total_payable: '',
  };

  const [boeFields, setBoeFields] = useState(emptyFields);
  const [lineItems, setLineItems] = useState([]);
  // Track which fields were auto-filled vs still empty (need manual input)
  const [autoFilledFields, setAutoFilledFields] = useState({});

  const [filingId, setFilingId] = useState(null);
  const [risk, setRisk] = useState(null);
  const [validation, setValidation] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [history, setHistory] = useState([]);

  const [loadingPrepare, setLoadingPrepare] = useState(false);
  const [loadingValidate, setLoadingValidate] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingQuery, setLoadingQuery] = useState(false);

  const [queryContext, setQueryContext] = useState('');
  const [queryDraft, setQueryDraft] = useState(null);
  const [showAllFields, setShowAllFields] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const submitRef = useRef(null);
  const statusRef = useRef(null);

  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('authToken');
    return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  }, []);

  // ── Load documents & history on mount ───────────────────────────────────────
  useEffect(() => {
    loadDocuments();
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDocuments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/react/documents/processed-invoices`, authHeaders());
      setDocuments(res.data || []);
    } catch (err) {
      console.error('[M05] Failed to load documents:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/m05/history?limit=20`, authHeaders());
      setHistory(res.data?.filings || []);
    } catch (_) {}
  };

  // ── Auto-load M04 computation from DutyCalculatorPanel on mount ─────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lastDutyComputation');
      if (!stored) return;
      const saved = JSON.parse(stored);
      if (!saved?.computation_uuid) return;
      // Only use if saved within the last 24 hours
      const ageMs = Date.now() - new Date(saved.saved_at).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) return;

      setM04Uuid(saved.computation_uuid);
      setM04FromEngine(saved);

      // If the computation was tied to a specific document, auto-select and prepare
      if (saved.document_id) {
        setSelectedDocId(String(saved.document_id));
        // Slight delay so documents list has time to load
        setTimeout(() => handlePrepare(String(saved.document_id), portOfImport, saved.computation_uuid), 800);
      }
    } catch (_) {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1: Prepare ─────────────────────────────────────────────────────────
  const handlePrepare = async (docIdArg, portArg, uuidArg) => {
    const docId = docIdArg !== undefined ? docIdArg : selectedDocId;
    const port  = portArg  !== undefined ? portArg  : portOfImport;
    const uuid  = uuidArg  !== undefined ? uuidArg  : m04Uuid;
    if (!docId) {
      setError('Please select a document first');
      return;
    }
    setError(null);
    setSuccess(null);
    setShowAllFields(false);
    setLoadingPrepare(true);
    try {
      const res = await axios.post(`${API_BASE}/m05/prepare`, {
        document_id: parseInt(docId),
        port_of_import: port,
        m04_computation_uuid: uuid || null,
      }, authHeaders());

      const data = res.data;
      const newFields = { ...emptyFields, ...data.boe_fields, port_of_import: port };

      // ── Auto-fill country_of_origin and port_of_shipment from M04 duty engine ──
      // If the backend extraction left either field blank, fall back to the value
      // the user entered in the Duty Calculator (stored in lastDutyComputation).
      // Per user requirement: port_of_shipment is treated as the same as country_of_origin.
      const _isEmpty = v => !v || ['', 'null', 'N/A', 'n/a', 'None'].includes(String(v).trim());
      const m04ExtraFields = {}; // track which fields we fill from M04
      try {
        const m04Stored = JSON.parse(localStorage.getItem('lastDutyComputation') || '{}');
        const m04Coo = m04Stored?.country_of_origin;
        if (m04Coo) {
          if (_isEmpty(newFields.country_of_origin)) {
            newFields.country_of_origin = m04Coo;
            m04ExtraFields.country_of_origin = true;
          }
          if (_isEmpty(newFields.port_of_shipment)) {
            newFields.port_of_shipment = m04Coo;
            m04ExtraFields.port_of_shipment = true;
          }
        }
      } catch (_) {}

      setBoeFields(newFields);

      // Compute which fields were auto-populated (non-empty, non-default) by the backend
      const ALWAYS_DEFAULTS = new Set(['date_of_filing', 'port_of_import', 'boe_type', 'importer_signature', 'currency']);
      const filled = {};
      Object.entries(data.boe_fields || {}).forEach(([k, v]) => {
        if (ALWAYS_DEFAULTS.has(k)) return;
        const s = v !== null && v !== undefined ? String(v).trim() : '';
        if (s !== '' && s !== 'null' && s !== 'N/A' && s !== 'n/a' && s !== 'None') {
          filled[k] = true;
        }
      });
      // Mark M04-sourced fields as autofilled too
      Object.keys(m04ExtraFields).forEach(k => { filled[k] = true; });
      setAutoFilledFields(filled);

      setLineItems(data.line_items || []);
      setRisk(data.risk || null);
      setFilingId(data.filing_id || null);
      setStep(1);
      setTimeout(() => submitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoadingPrepare(false);
    }
  };

  // ── Step 3: Validate ────────────────────────────────────────────────────────
  const handleValidate = async () => {
    setError(null);
    setLoadingValidate(true);
    try {
      const res = await axios.post(`${API_BASE}/m05/validate`, {
        boe_fields: boeFields,
        line_items: lineItems,
      }, authHeaders());
      setValidation(res.data);
      if (res.data.valid) {
        setSuccess('All fields validated — ready to submit');
        setStep(3);
      } else {
        setError(`Validation failed: ${res.data.errors_count} error(s) found`);
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoadingValidate(false);
    }
  };

  // ── Step 4: Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!filingId) {
      setError('No filing prepared. Please use Prepare BoE first.');
      return;
    }
    if (risk?.block_submit) {
      setError('Submission blocked — risk score is HIGH (≥70). Fix the issues listed and re-prepare.');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoadingSubmit(true);
    try {
      const res = await axios.post(`${API_BASE}/m05/submit`, {
        filing_id: filingId,
        boe_fields: boeFields,
        line_items: lineItems,
      }, authHeaders());

      setSubmission(res.data);
      setStep(4);
      if (res.data.status === 'ACCEPTED') {
        setSuccess(`BoE ACCEPTED — Reference: ${res.data.icegate_boe_number} | Ack: ${res.data.ack_number}`);
        setBoeFields(prev => ({ ...prev, boe_number: res.data.icegate_boe_number }));
      } else if (res.data.status === 'QUERY') {
        setQueryDraft(res.data.query_draft);
      }
      loadHistory();
      setTimeout(() => statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoadingSubmit(false);
    }
  };

  // ── Delete filing ───────────────────────────────────────────────────────────
  const handleDeleteFiling = async (filingIdToDelete) => {
    if (!window.confirm(`Delete filing #${filingIdToDelete}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_BASE}/m05/filing/${filingIdToDelete}`, authHeaders());
      setHistory(prev => prev.filter(f => f.id !== filingIdToDelete));
      if (filingId === filingIdToDelete) {
        setFilingId(null);
        setStep(0);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete filing.');
    }
  };

  // ── PDF download ────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!filingId) return;
    setLoadingPdf(true);
    try {
      const res = await axios.get(`${API_BASE}/m05/pdf/${filingId}`, {
        ...authHeaders(),
        responseType: 'blob',
      });
      const contentType = res.headers['content-type'] || 'application/pdf';
      const ext = contentType.includes('pdf') ? 'pdf' : 'txt';
      const url = URL.createObjectURL(new Blob([res.data], { type: contentType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `BillOfEntry_${filingId}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.detail || 'PDF download failed');
    } finally {
      setLoadingPdf(false);
    }
  };

  // ── Query resolution ────────────────────────────────────────────────────────
  const handleResolveQuery = async () => {
    if (!filingId || !submission?.query_text) return;
    setLoadingQuery(true);
    try {
      const res = await axios.post(`${API_BASE}/m05/resolve-query`, {
        filing_id: filingId,
        query_text: submission.query_text,
        additional_context: queryContext || null,
      }, authHeaders());
      setQueryDraft(res.data.draft);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoadingQuery(false);
    }
  };

  // ── Field updater ────────────────────────────────────────────────────────────
  const updateField = (key, value) => setBoeFields(prev => ({ ...prev, [key]: value }));

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setBoeFields(emptyFields);
    setLineItems([]);
    setRisk(null);
    setValidation(null);
    setSubmission(null);
    setFilingId(null);
    setQueryDraft(null);
    setQueryContext('');
    setError(null);
    setSuccess(null);
    setSelectedDocId('');
    setM04Uuid('');
    setM04FromEngine(null);
    setAutoFilledFields({});
    setShowAllFields(false);
    setStep(0);
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const fmt = v => (v !== null && v !== undefined && v !== '') ? String(v) : '—';
  const fmtInr = v => {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fieldError = (key) => {
    if (!validation) return false;
    return validation.errors?.some(e => e.toLowerCase().includes(key.toLowerCase()));
  };

  // Required fields that MUST be filled before submission
  const REQUIRED_FIELDS = new Set([
    'importer_name', 'importer_iec', 'description_of_goods', 'quantity',
    'hsn_code', 'custom_value_inr', 'country_of_origin',
    'bill_of_lading_number', 'port_of_shipment', 'arrival_date',
  ]);

  // Returns field indicator state for a given boe field key
  const fieldState = (key) => {
    const val = boeFields[key];
    const isEmpty = val === null || val === undefined || String(val).trim() === '';
    if (autoFilledFields[key] && !isEmpty) return 'autofilled';
    if (isEmpty && REQUIRED_FIELDS.has(key)) return 'missing';
    return 'normal';
  };

  // Helper to render label row with optional badge
  const FieldLabelWithBadge = ({ label, fieldKey }) => {
    const state = fieldState(fieldKey);
    return (
      <FieldLabelRow>
        <FieldLabel>{label}</FieldLabel>
        {state === 'autofilled' && <AutoBadge>AUTO</AutoBadge>}
        {state === 'missing' && <MissingBadge>REQUIRED</MissingBadge>}
      </FieldLabelRow>
    );
  };

  // ── Missing-field helpers ─────────────────────────────────────────────────────
  const missingRequired = [...REQUIRED_FIELDS].filter(k => {
    if (autoFilledFields[k]) return false;
    const v = boeFields[k];
    return v === null || v === undefined || String(v).trim() === '';
  });

  // Returns null if the field was auto-filled or already has a value; otherwise renders the input
  const renderMissingField = (key, label, type, opts = {}) => {
    if (autoFilledFields[key]) return null;
    const v = boeFields[key];
    if (v !== null && v !== undefined && String(v).trim() !== '') return null;
    return (
      <FieldGroup key={key} style={opts.span ? { gridColumn: `span ${opts.span}` } : {}}>
        <FieldLabelWithBadge label={label} fieldKey={key} />
        {opts.multiline ? (
          <FieldTextarea
            missing={fieldState(key) === 'missing'}
            value={boeFields[key] || ''}
            onChange={e => updateField(key, e.target.value)} />
        ) : (
          <FieldInput
            type={type || 'text'}
            missing={fieldState(key) === 'missing'}
            value={boeFields[key] || ''}
            onChange={e => updateField(key, e.target.value)}
            placeholder={opts.placeholder}
            maxLength={opts.maxLength}
            min={opts.min} />
        )}
      </FieldGroup>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Container>
      <PageHeader>
        <PageTitle>Bill of Entry Filing System</PageTitle>
        <PageSubtitle>M05 — ICEGATE automated BoE generation, risk prediction, submission & PDF download</PageSubtitle>
      </PageHeader>

      <StepBar>
        {STEPS.map((s, i) => (
          <Step key={i} active={step === i} done={step > i} onClick={() => step > i && setStep(i)}>
            {step > i ? '✓ ' : ''}{s}
          </Step>
        ))}
      </StepBar>

      {error && <Alert type="error">⚠ {error}</Alert>}
      {success && <Alert type="success">✓ {success}</Alert>}

      {/* ── M04 Engine banner — shown when duty calc was auto-loaded ───────── */}
      {m04FromEngine && (
        <Alert type="success" style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Duty Engine calculations loaded automatically
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.6 }}>
              AV: ₹{Number(m04FromEngine.assessable_value_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              &nbsp;·&nbsp;
              Custom Duty: ₹{Number(m04FromEngine.total_duty_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              &nbsp;·&nbsp;
              IGST: ₹{Number(m04FromEngine.igst_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              &nbsp;·&nbsp;
              Total Payable: ₹{Number(m04FromEngine.total_payable_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
              UUID: <code style={{ opacity: 0.9 }}>{m04FromEngine.computation_uuid}</code>
            </div>
          </div>
          <button
            onClick={() => { setM04FromEngine(null); localStorage.removeItem('lastDutyComputation'); }}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, opacity: 0.7, alignSelf: 'flex-start' }}
            title="Dismiss"
          >✕</button>
        </Alert>
      )}

      {/* ── STEP 0: Select document ──────────────────────────────────────────── */}
      {(step === 0 || loadingPrepare) && (
        <Card>
          <CardTitle>Select Source Document</CardTitle>
          <FieldGrid>
            <FieldGroup>
              <FieldLabel>Processed Invoice / Document *</FieldLabel>
              <FieldSelect value={selectedDocId} onChange={e => {
                const v = e.target.value;
                setSelectedDocId(v);
                setBoeFields(emptyFields);
                setAutoFilledFields({});
                setStep(0);
                setShowAllFields(false);
                if (v) handlePrepare(v, portOfImport, m04Uuid || undefined);
              }}>
                <option value="">-- Select a document to auto-fill BoE --</option>
                {documents.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.original_filename} (ID: {doc.id})
                  </option>
                ))}
              </FieldSelect>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>Port of Import</FieldLabel>
              <FieldSelect value={portOfImport} onChange={e => {
                const v = e.target.value;
                setPortOfImport(v);
                if (selectedDocId) handlePrepare(selectedDocId, v);
              }}>
                {PORTS.map(p => (
                  <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                ))}
              </FieldSelect>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>M04 Computation UUID (optional)</FieldLabel>
              <FieldInput
                placeholder="Auto-detected from document if blank"
                value={m04Uuid}
                onChange={e => setM04Uuid(e.target.value)}
              />
            </FieldGroup>
          </FieldGrid>
          {loadingPrepare && (
            <Alert type="info" style={{ marginTop: 12 }}>
              <Spinner /> Extracting and auto-filling all BoE fields from document...
            </Alert>
          )}
          {!selectedDocId && !loadingPrepare && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--t-text-sub)' }}>
              Select a document above — all fields present in the document will be filled automatically.
            </p>
          )}
        </Card>
      )}

      {/* ── STEPS 1–3: BoE fields ────────────────────────────────────────────── */}
      {step >= 1 && (
        <div ref={submitRef}>

          {/* ── Missing fields — manual input required ───────────────────────── */}
          {missingRequired.length > 0 ? (
            <Card style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.03)' }}>
              <CardTitle>⚠ Manual Input Required — {missingRequired.length} field(s) not found in document</CardTitle>
              <Alert type="warning" style={{ marginBottom: 14 }}>
                The following fields could not be automatically extracted from the document. Please fill them in before submitting.
              </Alert>
              <FieldGrid>
                {renderMissingField('importer_name', 'Importer Name *', 'text', { span: 2 })}
                {renderMissingField('importer_address', 'Importer Address', 'text', { multiline: true, span: 2 })}
                {renderMissingField('importer_iec', 'IEC Number *', 'text', { placeholder: '10-digit IEC', maxLength: 10 })}
                {renderMissingField('importer_gstin', 'GSTIN (Optional)', 'text', { placeholder: '15-char GSTIN', maxLength: 15 })}
                {renderMissingField('bill_of_lading_number', 'Bill of Lading / AWB No. *')}
                {renderMissingField('shipping_line', 'Shipping Line / Carrier')}
                {renderMissingField('port_of_shipment', 'Port of Shipment *', 'text', { placeholder: 'e.g. CNSHA (Shanghai)' })}
                {renderMissingField('arrival_date', 'Arrival Date *', 'date')}
                {renderMissingField('country_of_origin', 'Country of Origin *', 'text', { placeholder: 'e.g. CHN', maxLength: 3 })}
                {renderMissingField('country_of_shipment', 'Country of Shipment', 'text', { placeholder: 'e.g. SGP', maxLength: 3 })}
                {renderMissingField('description_of_goods', 'Description of Goods *', 'text', { multiline: true, span: 2 })}
                {renderMissingField('hsn_code', 'HS Code *', 'text', { placeholder: '8-digit HSN code', maxLength: 10 })}
                {renderMissingField('quantity', 'Quantity *', 'number', { min: 0 })}
                {renderMissingField('custom_value_inr', 'Custom Value (INR) *', 'number', { min: 0 })}
                {renderMissingField('custom_duty', 'Custom Duty (INR)', 'number', { min: 0 })}
                {renderMissingField('gst', 'GST / IGST (INR)', 'number', { min: 0 })}
                {renderMissingField('exchange_rate', 'Exchange Rate (INR per unit)', 'number', { min: 0 })}
              </FieldGrid>
            </Card>
          ) : (
            <Alert type="success">
              ✓ All required fields were automatically extracted from the document. Review the auto-filled data below and submit.
            </Alert>
          )}

          {/* ── Collapsible: review / edit all auto-filled fields ──────────── */}
          <Card style={{ marginBottom: 20 }}>
            <div
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => setShowAllFields(p => !p)}
            >
              <CardTitle style={{ margin: 0 }}>
                {Object.keys(autoFilledFields).length > 0
                  ? `✓ ${Object.keys(autoFilledFields).length} Fields Auto-filled from Document`
                  : 'All BoE Fields'}
              </CardTitle>
              <span style={{ fontSize: 12, color: 'var(--t-text-sub)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                {showAllFields ? '▲ Collapse' : '▼ Expand to review or edit'}
              </span>
            </div>
            {showAllFields && (
              <>
                <FieldLegend style={{ marginTop: 16 }}>
                  <span style={{ fontWeight: 600, color: 'var(--t-text)' }}>Field Status:</span>
                  <span><AutoBadge>AUTO</AutoBadge> &nbsp;Extracted from document</span>
                  <span><MissingBadge>REQUIRED</MissingBadge> &nbsp;Must be entered manually</span>
                </FieldLegend>

          {/* ── Filing Details ─────────────────────────────────── */}
          <Card>
            <CardTitle>Filing Details</CardTitle>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>BoE Number</FieldLabel>
                {boeFields.boe_number ? (
                  <div style={{
                    padding: '9px 14px',
                    borderRadius: 8,
                    background: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.35)',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: 'var(--t-btn-color)',
                    letterSpacing: '0.04em',
                  }}>
                    {boeFields.boe_number}
                  </div>
                ) : (
                  <FieldInput value="" readOnly
                    placeholder="Generated on prepare"
                    style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                )}
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Date of Filing *</FieldLabel>
                <FieldInput type="date" value={boeFields.date_of_filing || ''}
                  onChange={e => updateField('date_of_filing', e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Port of Import *</FieldLabel>
                <FieldSelect value={boeFields.port_of_import || 'INMAA1'}
                  onChange={e => updateField('port_of_import', e.target.value)}>
                  {PORTS.map(p => <option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
                </FieldSelect>
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Type of Bill of Entry *</FieldLabel>
                <FieldSelect value={boeFields.boe_type || 'HOME_CONSUMPTION'}
                  onChange={e => updateField('boe_type', e.target.value)}>
                  {BOE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </FieldSelect>
              </FieldGroup>
            </FieldGrid>
          </Card>

          {/* ── Importer Details ───────────────────────────────── */}
          <Card>
            <CardTitle>Importer Details</CardTitle>
            <FieldGrid>
              <FieldGroup style={{ gridColumn: 'span 2' }}>
                <FieldLabelWithBadge label="Importer Name *" fieldKey="importer_name" />
                <FieldInput
                  error={fieldError('importer_name')}
                  autofilled={fieldState('importer_name') === 'autofilled'}
                  missing={fieldState('importer_name') === 'missing'}
                  value={boeFields.importer_name || ''}
                  onChange={e => updateField('importer_name', e.target.value)} />
              </FieldGroup>
              <FieldGroup style={{ gridColumn: 'span 2' }}>
                <FieldLabelWithBadge label="Importer Address *" fieldKey="importer_address" />
                <FieldTextarea
                  error={fieldError('importer_address')}
                  autofilled={fieldState('importer_address') === 'autofilled'}
                  missing={fieldState('importer_address') === 'missing'}
                  value={boeFields.importer_address || ''}
                  onChange={e => updateField('importer_address', e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="IEC (Import Export Code) *" fieldKey="importer_iec" />
                <FieldInput
                  error={fieldError('importer_iec')}
                  autofilled={fieldState('importer_iec') === 'autofilled'}
                  missing={fieldState('importer_iec') === 'missing'}
                  value={boeFields.importer_iec || ''}
                  onChange={e => updateField('importer_iec', e.target.value)}
                  placeholder="10-digit IEC number" maxLength={10} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="GSTIN (Optional)" fieldKey="importer_gstin" />
                <FieldInput
                  autofilled={fieldState('importer_gstin') === 'autofilled'}
                  value={boeFields.importer_gstin || ''}
                  onChange={e => updateField('importer_gstin', e.target.value)}
                  placeholder="15-character GSTIN" maxLength={15} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Importer Signature</FieldLabel>
                <FieldInput value={boeFields.importer_signature || ''}
                  onChange={e => updateField('importer_signature', e.target.value)}
                  placeholder="DIGITAL / WET INK" />
              </FieldGroup>
            </FieldGrid>
          </Card>

          {/* ── Shipment Details ───────────────────────────────── */}
          <Card>
            <CardTitle>Shipment Details</CardTitle>
            <FieldGrid>
              <FieldGroup>
                <FieldLabelWithBadge label="Bill of Lading / Airway Bill No. *" fieldKey="bill_of_lading_number" />
                <FieldInput
                  error={fieldError('bill_of_lading')}
                  autofilled={fieldState('bill_of_lading_number') === 'autofilled'}
                  missing={fieldState('bill_of_lading_number') === 'missing'}
                  value={boeFields.bill_of_lading_number || ''}
                  onChange={e => updateField('bill_of_lading_number', e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Shipping Line / Carrier" fieldKey="shipping_line" />
                <FieldInput
                  autofilled={fieldState('shipping_line') === 'autofilled'}
                  value={boeFields.shipping_line || ''}
                  onChange={e => updateField('shipping_line', e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Port of Shipment *" fieldKey="port_of_shipment" />
                <FieldInput
                  error={fieldError('port_of_shipment')}
                  autofilled={fieldState('port_of_shipment') === 'autofilled'}
                  missing={fieldState('port_of_shipment') === 'missing'}
                  value={boeFields.port_of_shipment || ''}
                  onChange={e => updateField('port_of_shipment', e.target.value)}
                  placeholder="e.g. CNSHA (Shanghai)" />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Arrival Date *" fieldKey="arrival_date" />
                <FieldInput
                  error={fieldError('arrival_date')}
                  autofilled={fieldState('arrival_date') === 'autofilled'}
                  missing={fieldState('arrival_date') === 'missing'}
                  type="date" value={boeFields.arrival_date || ''}
                  onChange={e => updateField('arrival_date', e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Country of Origin *" fieldKey="country_of_origin" />
                <FieldInput
                  error={fieldError('country_of_origin')}
                  autofilled={fieldState('country_of_origin') === 'autofilled'}
                  missing={fieldState('country_of_origin') === 'missing'}
                  value={boeFields.country_of_origin || ''}
                  onChange={e => updateField('country_of_origin', e.target.value)}
                  placeholder="ISO 3-letter code e.g. CHN" maxLength={3} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Country of Shipment" fieldKey="country_of_shipment" />
                <FieldInput
                  autofilled={fieldState('country_of_shipment') === 'autofilled'}
                  value={boeFields.country_of_shipment || ''}
                  onChange={e => updateField('country_of_shipment', e.target.value)}
                  placeholder="ISO 3-letter code e.g. SGP" maxLength={3} />
              </FieldGroup>
            </FieldGrid>
          </Card>

          {/* ── Goods & HS Classification ──────────────────────── */}
          <Card>
            <CardTitle>Goods Description & Classification</CardTitle>
            <FieldGrid>
              <FieldGroup style={{ gridColumn: 'span 2' }}>
                <FieldLabelWithBadge label="Description of Goods *" fieldKey="description_of_goods" />
                <FieldTextarea
                  error={fieldError('description')}
                  autofilled={fieldState('description_of_goods') === 'autofilled'}
                  missing={fieldState('description_of_goods') === 'missing'}
                  value={boeFields.description_of_goods || ''}
                  onChange={e => updateField('description_of_goods', e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="HS Code *" fieldKey="hsn_code" />
                <FieldInput
                  error={fieldError('hsn')}
                  autofilled={fieldState('hsn_code') === 'autofilled'}
                  missing={fieldState('hsn_code') === 'missing'}
                  value={boeFields.hsn_code || ''}
                  onChange={e => updateField('hsn_code', e.target.value)}
                  placeholder="8-digit HSN code" maxLength={10} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Quantity *" fieldKey="quantity" />
                <FieldInput
                  error={fieldError('quantity')}
                  autofilled={fieldState('quantity') === 'autofilled'}
                  missing={fieldState('quantity') === 'missing'}
                  value={boeFields.quantity || ''}
                  onChange={e => updateField('quantity', e.target.value)} type="number" min="0" />
              </FieldGroup>
            </FieldGrid>
          </Card>

          {/* ── Financial Details ──────────────────────────────── */}
          <Card>
            <CardTitle>Financial Details</CardTitle>
            <FieldGrid>
              <FieldGroup>
                <FieldLabelWithBadge label="Custom Value / Assessable Value (INR) *" fieldKey="custom_value_inr" />
                <FieldInput
                  error={fieldError('custom_value')}
                  autofilled={fieldState('custom_value_inr') === 'autofilled'}
                  missing={fieldState('custom_value_inr') === 'missing'}
                  value={boeFields.custom_value_inr || ''}
                  onChange={e => updateField('custom_value_inr', e.target.value)} type="number" min="0" />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Total Custom Duty (INR)" fieldKey="custom_duty" />
                <FieldInput
                  autofilled={fieldState('custom_duty') === 'autofilled'}
                  value={boeFields.custom_duty || ''}
                  onChange={e => updateField('custom_duty', e.target.value)} type="number" min="0" />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="GST / IGST (INR)" fieldKey="gst" />
                <FieldInput
                  autofilled={fieldState('gst') === 'autofilled'}
                  value={boeFields.gst || ''}
                  onChange={e => updateField('gst', e.target.value)} type="number" min="0" />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Total Payable (INR)" fieldKey="total_payable" />
                <FieldInput
                  autofilled={fieldState('total_payable') === 'autofilled'}
                  value={
                    boeFields.total_payable
                    || (boeFields.custom_value_inr && boeFields.custom_duty
                        ? (parseFloat(boeFields.custom_value_inr || 0) + parseFloat(boeFields.custom_duty || 0)).toFixed(2)
                        : '')
                  }
                  onChange={e => updateField('total_payable', e.target.value)} type="number" min="0" />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Currency" fieldKey="currency" />
                <FieldInput
                  autofilled={fieldState('currency') === 'autofilled'}
                  value={boeFields.currency || 'USD'}
                  onChange={e => updateField('currency', e.target.value)} maxLength={3} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabelWithBadge label="Exchange Rate (INR per unit)" fieldKey="exchange_rate" />
                <FieldInput
                  autofilled={fieldState('exchange_rate') === 'autofilled'}
                  value={boeFields.exchange_rate || ''}
                  onChange={e => updateField('exchange_rate', e.target.value)} type="number" min="0" />
              </FieldGroup>
            </FieldGrid>
          </Card>

          {/* ── M04 Duty Engine Full Breakdown ─────────────────── */}
          {boeFields.m04_duty_breakdown && (() => {
            const d = boeFields.m04_duty_breakdown;
            const inr = v => v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
            const pct = v => v != null ? `${Number(v).toFixed(2)}%` : '—';
            const fx  = v => v != null ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 4 }) : '—';
            return (
              <Card style={{ border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.03)' }}>
                <CardTitle style={{ color: 'var(--t-btn-color)' }}>
                  M04 Duty Engine — Full SOP Breakdown
                  {boeFields.m04_computation_uuid && (
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--t-text-sub)', marginLeft: 10 }}>
                      UUID: {boeFields.m04_computation_uuid?.slice(0, 8)}…
                    </span>
                  )}
                </CardTitle>

                {/* Step 1 — CIF */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-btn-color)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Step 1 — CIF Value ({d.input_currency || boeFields.currency || 'USD'})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                    {[
                      ['FOB Cost', `${d.input_currency || ''} ${fx(d.fob_cost_foreign)}`],
                      ['Freight', `${d.input_currency || ''} ${fx(d.freight_foreign)}`],
                      ['Insurance', `${d.input_currency || ''} ${fx(d.insurance_foreign)}`],
                      ['CIF Total', `${d.input_currency || ''} ${fx(d.cif_foreign)}`],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: 'var(--t-bg-dark)', borderRadius: 7, padding: '8px 12px', border: '1px solid var(--t-border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--t-text-sub)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 2 — AV */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Step 2 — Assessable Value (INR)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                    {[
                      ['Exchange Rate', `1 ${d.input_currency || ''}=₹${fx(d.exchange_rate)}`],
                      ['Source', d.exchange_rate_source || '—'],
                      ['AV (INR)', inr(d.assessable_value_inr)],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: 'var(--t-bg-dark)', borderRadius: 7, padding: '8px 12px', border: '1px solid var(--t-border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--t-text-sub)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#A78BFA' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Steps 3–7 duty table */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Steps 3–7 — Duty Components
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--t-border)' }}>
                        {['Component', 'Rate', 'Amount (INR)', 'Notes'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--t-text-sub)', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'BCD (Step 3)', rate: pct(d.bcd_rate), amount: inr(d.bcd_amount), note: '', color: '#3B82F6' },
                        { label: 'SWS (Step 4)', rate: pct(d.sws_rate), amount: inr(d.sws_amount), note: '10% of BCD', color: '#F59E0B' },
                        { label: `IGST (Step 5) — Base: ${inr(d.igst_base)}`, rate: pct(d.igst_rate), amount: inr(d.igst_amount), note: 'AV+BCD+SWS', color: '#10B981' },
                        d.add_amount > 0 && { label: 'ADD (Step 6)', rate: pct(d.add_rate), amount: inr(d.add_amount), note: d.add_notification_ref || '', color: '#EF4444' },
                        d.cvd_amount > 0 && { label: 'CVD (Step 7)', rate: pct(d.cvd_rate), amount: inr(d.cvd_amount), note: '', color: '#EC4899' },
                        d.sgd_amount > 0 && { label: 'SGD (Step 7)', rate: pct(d.sgd_rate), amount: inr(d.sgd_amount), note: '', color: '#F97316' },
                      ].filter(Boolean).map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--t-border-light)' }}>
                          <td style={{ padding: '7px 10px', color: row.color, fontWeight: 600 }}>{row.label}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--t-text)' }}>{row.rate}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--t-text)', fontWeight: 600 }}>{row.amount}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--t-text-sub)', fontSize: 11 }}>{row.note}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '2px solid var(--t-border)', background: 'rgba(59,130,246,0.05)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--t-text)' }}>TOTAL DUTY</td>
                        <td />
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 15, color: '#60a5fa' }}>{inr(d.total_duty_inr)}</td>
                        <td />
                      </tr>
                      <tr style={{ background: 'rgba(16,185,129,0.05)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--t-text)' }}>TOTAL PAYABLE (AV + Duty)</td>
                        <td />
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 15, color: '#34d399' }}>{inr(d.total_payable_inr)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Step 8 — FTA */}
                {d.fta_applicable && d.fta_agreement_code && (
                  <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 13 }}>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>✓ FTA Applicable — {d.fta_agreement_code}</span>
                    <span style={{ color: 'var(--t-text-sub)', marginLeft: 12 }}>
                      Preferential BCD: {pct(d.fta_preferential_bcd)}
                      {d.fta_roo_eligible === true  && ' · RoO: Eligible'}
                      {d.fta_roo_eligible === false && ' · RoO: Not eligible'}
                      {d.fta_exemption_amount > 0   && ` · Duty saved: ${inr(d.fta_exemption_amount)}`}
                    </span>
                  </div>
                )}

                {/* Anomaly flags */}
                {d.anomaly_flags?.has_anomalies && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 12, color: '#fbbf24' }}>
                    ⚠ Anomaly flags from M04: {(d.anomaly_flags?.anomalies || []).map(a => a.message || a.code).join(' · ')}
                  </div>
                )}
              </Card>
            );
          })()}

          {/* ── Customs Officer (assigned post-clearance) ──────── */}
          <Card>
            <CardTitle>Clearance Details (Assigned by Customs)</CardTitle>
            <FieldGrid>
              <FieldGroup>
                <FieldLabel>Custom Officer</FieldLabel>
                <FieldInput value={boeFields.custom_officer || ''} placeholder="Assigned at clearance"
                  onChange={e => updateField('custom_officer', e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Date of Clearance</FieldLabel>
                <FieldInput type="date" value={boeFields.date_of_clearance || ''}
                  onChange={e => updateField('date_of_clearance', e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Custom Officer Signature</FieldLabel>
                <FieldInput value={boeFields.custom_officer_signature || ''} placeholder="Post-clearance"
                  onChange={e => updateField('custom_officer_signature', e.target.value)} />
              </FieldGroup>
            </FieldGrid>
          </Card>
              </>
            )}
          </Card>{/* end collapsible card */}

          {/* ── Line Items ─────────────────────────────────────── */}
          {lineItems.length > 0 && (
            <Card>
              <CardTitle>Line Items ({lineItems.length}) — Full Duty Breakdown</CardTitle>
              <div style={{ overflowX: 'auto' }}>
                <LineItemsTable>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>HSN</th>
                      <th>Qty</th>
                      <th>CIF ({lineItems[0]?.input_currency || 'FC'})</th>
                      <th>AV (INR)</th>
                      <th>BCD Rate</th>
                      <th>BCD</th>
                      <th>SWS</th>
                      <th>IGST Rate</th>
                      <th>IGST</th>
                      <th>ADD</th>
                      <th>CVD</th>
                      <th>SGD</th>
                      <th>Total Duty</th>
                      <th>Total Payable</th>
                      <th>FTA</th>
                      <th>COO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const inr = v => v != null && v !== 0 ? fmtInr(v) : <span style={{ color: 'var(--t-text-sub)', fontSize: 11 }}>NIL</span>;
                      const totalPayable = item.assessable_value != null && item.total_duty != null
                        ? (parseFloat(item.assessable_value) + parseFloat(item.total_duty)).toFixed(2)
                        : null;
                      return (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td style={{ maxWidth: 200, whiteSpace: 'normal', lineHeight: 1.3 }}>
                            {item.description_of_goods || item.product_description || '—'}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.hsn_code || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmt(item.quantity)} {item.unit || 'NOS'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{item.cif_foreign != null ? Number(item.cif_foreign).toFixed(2) : '—'}</td>
                          <td style={{ color: '#A78BFA', fontWeight: 600 }}>{fmtInr(item.custom_value_inr || item.assessable_value)}</td>
                          <td style={{ color: '#3B82F6' }}>{item.bcd_rate != null ? `${item.bcd_rate}%` : '—'}</td>
                          <td style={{ color: '#3B82F6', fontWeight: 600 }}>{inr(item.bcd_amount)}</td>
                          <td>{inr(item.sws_amount)}</td>
                          <td style={{ color: '#10B981' }}>{item.igst_rate != null ? `${item.igst_rate}%` : '—'}</td>
                          <td style={{ color: '#10B981', fontWeight: 600 }}>{inr(item.igst_amount)}</td>
                          <td style={{ color: item.add_amount > 0 ? '#EF4444' : undefined }}>
                            {item.add_amount > 0 ? (
                              <span title={item.add_notification_ref || ''}>{inr(item.add_amount)}</span>
                            ) : inr(0)}
                          </td>
                          <td>{inr(item.cvd_amount)}</td>
                          <td>{inr(item.sgd_amount)}</td>
                          <td style={{ color: '#60a5fa', fontWeight: 700 }}>{inr(item.total_duty)}</td>
                          <td style={{ color: '#34d399', fontWeight: 700 }}>{fmtInr(totalPayable)}</td>
                          <td>
                            {item.fta_applicable && item.fta_agreement_code
                              ? <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }} title={`Preferential BCD: ${item.fta_preferential_bcd}%`}>✓ {item.fta_agreement_code}</span>
                              : <span style={{ color: 'var(--t-text-sub)', fontSize: 11 }}>—</span>}
                          </td>
                          <td>{item.country_of_origin || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </LineItemsTable>
              </div>
            </Card>
          )}

          {/* ── Action Buttons ─────────────────────────────────── */}
          <ButtonRow>
            <Button onClick={handleValidate} disabled={loadingValidate} variant="outline">
              {loadingValidate ? <><Spinner /> Validating...</> : 'Validate Fields'}
            </Button>
            <Button onClick={() => setStep(0)} variant="outline">Back: Select Document</Button>
            <Button onClick={handleReset} variant="danger">Reset</Button>
          </ButtonRow>
        </div>
      )}

      {/* ── STEP 2: Validation Report ───────────────────────────────────────── */}
      {validation && (
        <Card>
          <CardTitle>Validation Report</CardTitle>
          {validation.valid
            ? <Alert type="success">All {validation.errors_count === 0 ? 'fields passed' : ''} validations passed</Alert>
            : <Alert type="error">{validation.errors_count} error(s) must be fixed before submission</Alert>
          }
          {validation.errors?.map((e, i) => (
            <Alert key={i} type="error" style={{ marginBottom: 6 }}>✗ {e}</Alert>
          ))}
          {validation.warnings?.map((w, i) => (
            <Alert key={i} type="warning" style={{ marginBottom: 6 }}>⚠ {w}</Alert>
          ))}
        </Card>
      )}

      {/* ── STEP 2/3: Risk Predictor ────────────────────────────────────────── */}
      {risk && (
        <RiskMeter>
          <RiskTitle>Pre-Filing Risk Assessment ({risk.model_used === 'xgboost' ? 'XGBoost Model' : 'Rule-Based'})</RiskTitle>
          <RiskScoreRow>
            <RiskScore band={risk.risk_band}>{Math.round(risk.risk_score)}</RiskScore>
            <div>
              <RiskBand band={risk.risk_band}>{risk.risk_band} RISK</RiskBand>
              {risk.block_submit && (
                <Alert type="error" style={{ marginTop: 8 }}>
                  Submission is BLOCKED — risk score ≥ 70. Resolve the issues below before filing.
                </Alert>
              )}
            </div>
          </RiskScoreRow>
          <RiskBar score={risk.risk_score} band={risk.risk_band}><div /></RiskBar>
          {risk.reasons?.map((r, i) => (
            <RiskReason key={i}><span>⚠</span><span>{r}</span></RiskReason>
          ))}
        </RiskMeter>
      )}

      {/* ── STEP 3: Submit Button ───────────────────────────────────────────── */}
      {step >= 1 && !submission && (
        <Card>
          <CardTitle>Submit to ICEGATE</CardTitle>
          {risk?.block_submit
            ? <Alert type="error">Submission blocked — fix HIGH risk issues first</Alert>
            : <Alert type="info">
                {risk?.risk_band === 'MEDIUM'
                  ? 'MEDIUM risk detected — review the issues above before proceeding.'
                  : 'Risk is LOW — ready to submit to ICEGATE.'}
              </Alert>
          }
          <ButtonRow>
            <Button
              variant={risk?.block_submit ? 'danger' : 'success'}
              onClick={handleSubmit}
              disabled={loadingSubmit || risk?.block_submit}
            >
              {loadingSubmit ? <><Spinner /> Submitting to ICEGATE...</> : 'Submit Bill of Entry to ICEGATE'}
            </Button>
          </ButtonRow>
        </Card>
      )}

      {/* ── STEP 4: Submission Result ───────────────────────────────────────── */}
      {submission && (
        <div ref={statusRef}>
          <Card>
            <CardTitle>ICEGATE Submission Result</CardTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
              <StatusBadge status={submission.status}>
                {submission.status === 'ACCEPTED' ? '✓' : submission.status === 'REJECTED' ? '✗' : '⚠'}{' '}
                {submission.status}
              </StatusBadge>
              {boeFields.boe_number && (
                <span style={{
                  fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem',
                  color: 'var(--t-btn-color)',
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                  padding: '3px 10px', borderRadius: 6,
                }}>
                  {boeFields.boe_number}
                </span>
              )}
              {submission.icegate_boe_number && (
                <span style={{ color: 'var(--t-text-sub)', fontSize: 13 }}>
                  ICEGATE Ref: <strong style={{ color: 'var(--t-text)' }}>{submission.icegate_boe_number}</strong>
                </span>
              )}
              {submission.ack_number && (
                <span style={{ color: 'var(--t-text-sub)', fontSize: 13 }}>
                  Ack: <strong style={{ color: 'var(--t-text)' }}>{submission.ack_number}</strong>
                </span>
              )}
            </div>

            {submission.status === 'REJECTED' && submission.errors?.length > 0 && (
              <>
                <Alert type="error">ICEGATE rejected the filing — see error(s) below:</Alert>
                {submission.errors.map((e, i) => (
                  <Alert key={i} type="error" style={{ marginBottom: 6 }}>
                    [{e.code}] {e.message}
                  </Alert>
                ))}
              </>
            )}

            {submission.status === 'QUERY' && (
              <QueryBox>
                <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>
                  Customs Query Raised
                </div>
                <p style={{ color: 'var(--t-text)', fontSize: 13, margin: '8px 0' }}>
                  {submission.query_text}
                </p>
                <SectionDivider />
                <div style={{ color: 'var(--t-text-sub)', fontSize: 12, marginBottom: 8 }}>
                  AI-drafted response (edit before sending):
                </div>
                {submission.query_draft || queryDraft ? (
                  <QueryDraft>{submission.query_draft || queryDraft}</QueryDraft>
                ) : (
                  <>
                    <FieldGroup style={{ marginBottom: 10 }}>
                      <FieldLabel>Additional context (optional)</FieldLabel>
                      <FieldTextarea
                        value={queryContext}
                        onChange={e => setQueryContext(e.target.value)}
                        placeholder="Any extra information to include in the response..."
                      />
                    </FieldGroup>
                    <Button onClick={handleResolveQuery} disabled={loadingQuery}>
                      {loadingQuery ? <><Spinner /> Drafting response...</> : 'Draft Query Response with AI'}
                    </Button>
                  </>
                )}
                {queryDraft && (
                  <QueryDraft>{queryDraft}</QueryDraft>
                )}
              </QueryBox>
            )}

            {/* Download PDF button */}
            <SectionDivider />
            <ButtonRow>
              <Button variant="success" onClick={handleDownloadPdf} disabled={loadingPdf}>
                {loadingPdf ? <><Spinner /> Generating PDF...</> : 'Download Bill of Entry (PDF)'}
              </Button>
              <Button variant="outline" onClick={handleReset}>New Filing</Button>
            </ButtonRow>
          </Card>
        </div>
      )}

      {/* Download PDF even before submission (if filing exists) */}
      {filingId && !submission && step >= 1 && (
        <ButtonRow style={{ marginTop: 0 }}>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={loadingPdf}>
            {loadingPdf ? <><Spinner /> Generating PDF...</> : 'Download Draft BoE (PDF)'}
          </Button>
        </ButtonRow>
      )}

      {/* ── Filing History ──────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <Card style={{ marginTop: 24 }}>
          <CardTitle>Filing History</CardTitle>
          <div style={{ overflowX: 'auto' }}>
            <LineItemsTable>
              <thead>
                <tr>
                  <th>BoE Number</th>
                  <th>Port</th>
                  <th>ICEGATE Ref</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Filed At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map(f => (
                  <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => {
                    setFilingId(f.id);
                    setStep(4);
                  }}>
                    <td>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700,
                        fontSize: '0.82rem', color: 'var(--t-btn-color)',
                        background: 'rgba(59,130,246,0.10)',
                        padding: '2px 7px', borderRadius: 5,
                        border: '1px solid rgba(59,130,246,0.25)',
                        whiteSpace: 'nowrap',
                      }}>
                        {f.boe_number || `#${f.id}`}
                      </span>
                    </td>
                    <td>{f.port_of_import}</td>
                    <td style={{ fontSize: 11 }}>{f.icegate_boe_number || '—'}</td>
                    <td><StatusBadge status={f.icegate_status}>{f.icegate_status}</StatusBadge></td>
                    <td><RiskBand band={f.risk_band}>{f.risk_band} ({Math.round(f.risk_score || 0)})</RiskBand></td>
                    <td style={{ fontSize: 11, color: 'var(--t-text-sub)' }}>
                      {f.created_at ? new Date(f.created_at).toLocaleString() : '—'}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <Button variant="danger" style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => handleDeleteFiling(f.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </LineItemsTable>
          </div>
        </Card>
      )}
    </Container>
  );
};

export default BillOfEntryPanel;
