import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { m05Service } from '../../services/api';

const EDITABLE_FIELDS = [
  { key: 'importer_name', label: 'Importer Name', required: true },
  { key: 'importer_iec', label: 'Importer IEC', required: true, monospace: true },
  { key: 'importer_address', label: 'Importer Address', required: true },
  { key: 'invoice_number', label: 'Invoice Number', required: false, monospace: true },
  { key: 'invoice_date', label: 'Invoice Date', required: false },
  { key: 'bill_of_lading_number', label: 'Bill of Lading', required: true, monospace: true },
  { key: 'hsn_code', label: 'HSN Code', required: true, monospace: true },
  { key: 'description_of_goods', label: 'Goods Description', required: true },
  { key: 'country_of_origin', label: 'Country of Origin', required: true, monospace: true },
  { key: 'port_of_import', label: 'Port of Import', required: true, monospace: true },
  { key: 'port_of_shipment', label: 'Port of Shipment', required: true, monospace: true },
  { key: 'arrival_date', label: 'Arrival Date', required: true },
  { key: 'quantity', label: 'Quantity', required: false },
  { key: 'unit', label: 'Unit', required: false, monospace: true },
  { key: 'custom_value_inr', label: 'CIF / Invoice Value (INR)', required: true },
  { key: 'bcd_amount', label: 'BCD Amount (INR)', required: false },
  { key: 'sws_amount', label: 'SWS Amount (INR)', required: false },
  { key: 'custom_duty', label: 'Total Duty (INR)', required: false },
  { key: 'gst', label: 'IGST (INR)', required: false },
  { key: 'total_payable', label: 'Total Payable Duty (INR)', required: false },
];

function fmtCurrency(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
}

function fmtDutyNilOrCurrency(v) {
  if (typeof v === 'string' && v.trim().toLowerCase() === 'nil') return 'Nil';
  const n = Number(v);
  if (Number.isFinite(n) && n === 0) return 'Nil';
  return fmtCurrency(v);
}

function asString(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function firstValue(...vals) {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    return v;
  }
  return '';
}

function mergeNonEmpty(base, incoming) {
  const out = { ...base };
  Object.entries(incoming || {}).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string' && v.trim() === '') return;
    out[k] = v;
  });
  return out;
}

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isZeroLike(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string' && v.trim().toLowerCase() === 'nil') return true;
  const n = Number(v);
  return Number.isFinite(n) && n === 0;
}

function withNilDisplayForDutyZeros(input = {}) {
  const out = { ...input };
  if (isZeroLike(out.bcd_amount)) out.bcd_amount = 'Nil';
  if (isZeroLike(out.sws_amount)) out.sws_amount = 'Nil';
  return out;
}

function normaliseSubmissionFields(input = {}) {
  const out = { ...input };
  if (typeof out.bcd_amount === 'string' && out.bcd_amount.trim().toLowerCase() === 'nil') out.bcd_amount = 0;
  if (typeof out.sws_amount === 'string' && out.sws_amount.trim().toLowerCase() === 'nil') out.sws_amount = 0;
  return out;
}

function baseFieldsFromNav(boeData) {
  if (!boeData) return {};
  const extracted = boeData.extracted_data || {};
  const docFields =
    extracted.normalised_fields ||
    extracted.extracted_fields ||
    extracted.extracted_data ||
    {};
  const firstItem = (extracted.line_items && extracted.line_items[0]) || (docFields.line_items && docFields.line_items[0]) || {};

  return {
    importer_name: firstValue(
      boeData.importer_name,
      docFields.importer_name,
      docFields.buyer_name,
      docFields.consignee_name
    ),
    importer_iec: firstValue(
      boeData.importer_iec,
      docFields.importer_iec,
      docFields.iec,
      docFields.iec_number
    ),
    importer_address: firstValue(
      boeData.importer_address,
      docFields.importer_address,
      docFields.buyer_address,
      docFields.consignee_address
    ),
    invoice_number: firstValue(
      boeData.invoice_number,
      docFields.invoice_number,
      docFields.invoice_no
    ),
    invoice_date: firstValue(
      boeData.invoice_date,
      docFields.invoice_date,
      docFields.date_of_invoice
    ),
    bill_of_lading_number: firstValue(
      boeData.bill_of_lading,
      boeData.bill_of_lading_number,
      docFields.bill_of_lading_number,
      docFields.bill_of_lading,
      docFields.bl_number
    ),
    hsn_code: boeData.hsn_code || '',
    description_of_goods: firstValue(
      boeData.goods_description,
      boeData.description_of_goods,
      docFields.description_of_goods,
      docFields.goods_description,
      firstItem.description,
      firstItem.product_description
    ),
    country_of_origin: firstValue(
      boeData.country_of_origin,
      docFields.country_of_origin,
      docFields.origin_country
    ),
    port_of_import: boeData.port_of_import || boeData.port_code || 'INMAA1',
    port_of_shipment: firstValue(
      boeData.port_of_shipment,
      docFields.port_of_shipment,
      docFields.port_of_loading,
      docFields.origin_port
    ),
    arrival_date: firstValue(
      boeData.arrival_date,
      docFields.arrival_date,
      docFields.eta
    ),
    quantity: firstValue(
      boeData.quantity,
      docFields.quantity,
      docFields.total_quantity,
      firstItem.quantity
    ),
    unit: firstValue(
      boeData.unit,
      docFields.unit,
      docFields.uom,
      firstItem.unit
    ),
    custom_value_inr: firstValue(
      boeData.assessable_value_inr,
      docFields.custom_value_inr,
      docFields.invoice_value,
      docFields.total_value
    ),
    bcd_amount: firstValue(
      boeData.duties?.bcd_amount,
      boeData.duties?.bcd,
      docFields.bcd_amount,
      0
    ),
    sws_amount: firstValue(
      boeData.duties?.sws_amount,
      boeData.duties?.sws,
      docFields.sws_amount,
      0
    ),
    custom_duty: boeData.total_duty_inr ?? '',
    gst: boeData.duties?.igst_amount ?? boeData.duties?.igst ?? '',
    total_payable: boeData.total_payable_inr ?? boeData.total_amount_payable_inr ?? '',
    currency: boeData.input_currency || 'USD',
    exchange_rate: boeData.exchange_rate ?? '',
    importer_signature: 'DIGITAL',
    document_id: boeData.document_id || null,
    m04_computation_uuid: boeData.computation_uuid || null,
  };
}

function buildLineItems(fields, boeData) {
  const duties = boeData?.duties || {};
  const rates = boeData?.rates || {};
  return [{
    hsn_code: fields.hsn_code,
    description_of_goods: fields.description_of_goods,
    quantity: Number(fields.quantity || 0),
    unit: fields.unit || 'NOS',
    country_of_origin: fields.country_of_origin,
    custom_value_inr: Number(fields.custom_value_inr || 0),
    bcd_amount: numberOrZero(fields.bcd_amount ?? duties.bcd_amount ?? duties.bcd ?? 0),
    sws_amount: numberOrZero(fields.sws_amount ?? duties.sws_amount ?? duties.sws ?? 0),
    igst_amount: numberOrZero(fields.gst ?? duties.igst_amount ?? duties.igst ?? 0),
    add_amount: Number(duties.add_amount ?? duties.add ?? 0),
    cvd_amount: Number(duties.cvd_amount ?? duties.cvd ?? 0),
    sgd_amount: Number(duties.sgd_amount ?? duties.sgd ?? 0),
    total_duty: Number(fields.custom_duty || 0),
    bcd_rate: Number(rates.bcd_rate ?? rates.bcd ?? 0),
    igst_rate: Number(rates.igst_rate ?? rates.igst ?? 0),
    m04_computation_uuid: fields.m04_computation_uuid || boeData?.computation_uuid || null,
  }];
}

function AutoFieldInput({ field, value, onChange, autoFilled, hasError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {field.label}{field.required ? ' *' : ''}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#0D1120',
            color: '#E2E8F0',
            border: `1px solid ${hasError ? 'rgba(239,68,68,0.55)' : '#1E293B'}`,
            borderRadius: 8,
            padding: autoFilled ? '10px 100px 10px 12px' : '10px 12px',
            fontSize: 13,
            fontFamily: field.monospace ? 'monospace' : 'inherit',
          }}
        />
        {autoFilled && (
          <span style={{
            position: 'absolute',
            right: 8,
            top: 8,
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 4,
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.35)',
            color: '#22C55E',
          }}>
            Auto-filled
          </span>
        )}
      </div>
    </div>
  );
}

export default function M05BOEFilingPage({ onNavigate, boeData }) {
  const navFields = useMemo(() => withNilDisplayForDutyZeros(baseFieldsFromNav(boeData || {})), [boeData]);
  const [fields, setFields] = useState(navFields);
  const [lineItems, setLineItems] = useState(buildLineItems(navFields, boeData));
  const [autoFilled, setAutoFilled] = useState({});
  const [filingId, setFilingId] = useState(null);
  const [risk, setRisk] = useState(null);
  const [validation, setValidation] = useState(null);
  const [failedFields, setFailedFields] = useState([]);
  const [loadingPrepare, setLoadingPrepare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [registry, setRegistry] = useState([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [previewFiling, setPreviewFiling] = useState(null);

  const missingRequiredFields = useMemo(() => {
    return EDITABLE_FIELDS
      .filter((f) => f.required)
      .filter((f) => {
        const v = fields[f.key];
        return v === null || v === undefined || String(v).trim() === '';
      })
      .map((f) => f.key);
  }, [fields]);

  const updateField = (k, v) => {
    setFields((prev) => ({ ...prev, [k]: v }));
    setLineItems((prev) => {
      const next = [...prev];
      next[0] = {
        ...(next[0] || {}),
        hsn_code: k === 'hsn_code' ? v : (next[0]?.hsn_code || fields.hsn_code),
        description_of_goods: k === 'description_of_goods' ? v : (next[0]?.description_of_goods || fields.description_of_goods),
        quantity: Number(k === 'quantity' ? v : (next[0]?.quantity || fields.quantity || 0)),
        unit: k === 'unit' ? v : (next[0]?.unit || fields.unit || 'NOS'),
        country_of_origin: k === 'country_of_origin' ? v : (next[0]?.country_of_origin || fields.country_of_origin),
        custom_value_inr: Number(k === 'custom_value_inr' ? v : (next[0]?.custom_value_inr || fields.custom_value_inr || 0)),
        bcd_amount: numberOrZero(k === 'bcd_amount' ? v : (next[0]?.bcd_amount ?? fields.bcd_amount ?? 0)),
        sws_amount: numberOrZero(k === 'sws_amount' ? v : (next[0]?.sws_amount ?? fields.sws_amount ?? 0)),
        igst_amount: Number(k === 'gst' ? v : (next[0]?.igst_amount || fields.gst || 0)),
        total_duty: Number(k === 'custom_duty' ? v : (next[0]?.total_duty || fields.custom_duty || 0)),
      };
      return next;
    });
  };

  const loadRegistry = async () => {
    setRegistryLoading(true);
    try {
      const hist = await m05Service.history(50, false);
      setRegistry(hist.filings || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load BOE registry');
    } finally {
      setRegistryLoading(false);
    }
  };

  useEffect(() => {
    setFields(navFields);
    setLineItems(buildLineItems(navFields, boeData));
    const auto = {};
    Object.keys(navFields).forEach((k) => {
      if (navFields[k] !== '' && navFields[k] !== null && navFields[k] !== undefined) auto[k] = true;
    });
    setAutoFilled(auto);
    setError('');
    setActionNotice('');
    setSuccess(null);
    setValidation(null);
    setFailedFields([]);
    void loadRegistry();
  }, [navFields, boeData]);

  useEffect(() => {
    const prepareFromModules = async () => {
      if (!boeData?.document_id) return;
      setLoadingPrepare(true);
      try {
        const prepared = await m05Service.prepare({
          document_id: boeData.document_id,
          port_of_import: fields.port_of_import || 'INMAA1',
          m04_computation_uuid: boeData.computation_uuid || null,
        });
        setFilingId(prepared.filing_id || null);
        setRisk(prepared.risk || null);
        const merged = withNilDisplayForDutyZeros(mergeNonEmpty(fields, prepared.boe_fields || {}));
        setFields(merged);
        setLineItems(prepared.line_items?.length ? prepared.line_items : buildLineItems(merged, boeData));
        const preparedAuto = {};
        Object.entries(prepared.boe_fields || {}).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) preparedAuto[k] = true;
        });
        setAutoFilled((prev) => ({ ...prev, ...preparedAuto }));
      } catch (e) {
        setError(e?.response?.data?.detail?.error || e?.response?.data?.detail || e.message || 'BoE pre-fill failed');
      } finally {
        setLoadingPrepare(false);
      }
    };
    void prepareFromModules();
  }, [boeData?.document_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    setActionNotice('');
    setSuccess(null);
    setValidation(null);
    setFailedFields([]);
    try {
      if (missingRequiredFields.length > 0) {
        setFailedFields(missingRequiredFields);
        const explicitErrors = [];
        if (missingRequiredFields.includes('importer_iec')) explicitErrors.push('Missing IEC');
        if (missingRequiredFields.includes('hsn_code')) explicitErrors.push('Missing HSN');
        if (missingRequiredFields.includes('custom_value_inr')) explicitErrors.push('Missing invoice value');
        throw new Error(explicitErrors.length > 0 ? explicitErrors.join(' | ') : 'Mandatory fields are missing');
      }

      if (!filingId) {
        throw new Error('Missing filing ID. Open BOE from Duty Calculator with a document context.');
      }
      const payloadFields = normaliseSubmissionFields({ ...fields });
      const validationResp = await m05Service.validate(payloadFields, lineItems);
      setValidation(validationResp);
      if (!validationResp.valid) {
        setFailedFields(validationResp.failed_fields || []);
        throw new Error('Validation failed. Please correct highlighted fields.');
      }
      const submitResp = await m05Service.submit({
        filing_id: filingId,
        boe_fields: payloadFields,
        line_items: lineItems,
      });
      setRisk(submitResp.risk || risk);
      setSuccess(submitResp);
      setActionNotice(`BOE submitted with status: ${submitResp.status}`);
      await loadRegistry();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.failed_fields) setFailedFields(detail.failed_fields);
      if (detail?.validation) setValidation(detail.validation);
      if (detail?.risk) setRisk(detail.risk);
      setError(
        detail?.error ||
        detail?.message ||
        (typeof detail === 'string' ? detail : '') ||
        e.message ||
        'Submission failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const downloadDraftBoe = () => {
    const draft = {
      draft_status: 'DRAFT_NOT_SUBMITTED',
      generated_at: new Date().toISOString(),
      filing_id: filingId || null,
      document_id: boeData?.document_id || null,
      boe_fields: fields,
      line_items: lineItems,
      metadata: {
        source: 'M05 BOE Filing',
        note: 'Draft BOE (Not Submitted to ICEGATE)',
      },
    };
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `draft_boe_${filingId || 'unsaved'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleView = async (id) => {
    try {
      const filing = await m05Service.status(id);
      setPreviewFiling({
        ...filing,
        boe_fields: filing.boe_fields_json || {},
        line_items: filing.line_items_json || [],
      });
      setError('');
      setActionNotice(`Opened BOE preview #${id}`);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to open filing');
    }
  };

  const downloadFinalBoe = async (id) => {
    try {
      const resp = await m05Service.downloadPdf(id);
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' });
      let filename = `BOE_${id}.pdf`;
      const disposition = resp.headers['content-disposition'] || '';
      const match = disposition.match(/filename=\"?([^"]+)\"?/i);
      if (match?.[1]) filename = match[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setActionNotice(`Downloaded BOE for filing #${id}`);
    } catch (_) {
      try {
        const filing = await m05Service.status(id);
        const jsonBlob = new Blob([JSON.stringify({
          status: filing.icegate_status || filing.filing_status || 'UNKNOWN',
          filing_id: id,
          boe_fields: filing.boe_fields_json || {},
          line_items: filing.line_items_json || [],
          note: 'Final submitted BOE JSON export',
        }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(jsonBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BOE_${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setActionNotice(`Downloaded BOE JSON for filing #${id}`);
      } catch (e) {
        setError(e?.response?.data?.detail || e.message || 'Failed to download BOE');
      }
    }
  };

  const handleSoftDelete = async (id) => {
    try {
      await m05Service.softDelete(id);
      setActionNotice(`BOE #${id} deleted`);
      void loadRegistry();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to delete filing');
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={22} color="#3B82F6" />
            <h1 style={{ margin: 0, color: '#E2E8F0', fontSize: 22 }}>BOE Filing</h1>
          </div>
          <p style={{ marginTop: 6, color: '#64748B', fontSize: 13 }}>
            Auto-filled from Duty Calculator and document extraction (M01-M04)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadRegistry} style={{ background: '#0F172A', border: '1px solid #1E293B', color: '#CBD5E1', borderRadius: 8, padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          {onNavigate && (
            <button onClick={() => onNavigate('duty-calculator')} style={{ background: 'transparent', border: '1px solid #1E293B', color: '#94A3B8', borderRadius: 8, padding: '9px 12px', cursor: 'pointer' }}>
              Back to Calculator
            </button>
          )}
        </div>
      </div>

      {loadingPrepare && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#93C5FD', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Preparing BOE payload from document + M04 duty computation...
        </div>
      )}

      {risk && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid #1E293B', background: '#0F172A' }}>
          <div style={{ fontSize: 12, color: '#CBD5E1', fontWeight: 700 }}>
            AI Pre-Validation: {risk.risk_score}% ({risk.risk_band})
          </div>
          <div style={{ fontSize: 11, color: risk.risk_score > 30 ? '#F59E0B' : '#22C55E', marginTop: 3 }}>
            {risk.risk_score > 30 ? 'Submission will be blocked until issues are fixed.' : 'Ready for submission.'}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {actionNotice && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.1)', color: '#86EFAC', fontSize: 12 }}>
          {actionNotice}
        </div>
      )}

      {missingRequiredFields.length > 0 && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.1)', color: '#FCD34D', fontSize: 12 }}>
          Mandatory fields pending: {missingRequiredFields.join(', ')}
        </div>
      )}

      {success?.status && (
        <div style={{
          marginBottom: 12,
          padding: 12,
          borderRadius: 10,
          border: success.status === 'ACCEPTED' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(245,158,11,0.35)',
          background: success.status === 'ACCEPTED' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
          color: success.status === 'ACCEPTED' ? '#86EFAC' : '#FCD34D',
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <CheckCircle2 size={14} />
            Status: {success.status}. Ack: {success.ack_number || '—'} | ICEGATE BOE: {success.icegate_boe_number || '—'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadFinalBoe(success.filing_id || filingId)}
              style={{
                border: '1px solid rgba(34,197,94,0.35)',
                background: 'rgba(15,23,42,0.5)',
                color: '#BBF7D0',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
              }}
            >
              <Download size={14} /> Download BOE
            </button>
            <button
              onClick={() => {
                const fid = success.filing_id || filingId;
                window.location.hash = `#/fraud-detection?filingId=${fid}`;
              }}
              style={{
                border: '1px solid rgba(201,165,32,0.35)',
                background: 'rgba(201,165,32,0.15)',
                color: '#E8C84A',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={14} /> Run Fraud Analysis
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        <div style={{ padding: 16, border: '1px solid #1E293B', borderRadius: 12, background: '#0F172A' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {EDITABLE_FIELDS.map((f) => (
              <AutoFieldInput
                key={f.key}
                field={f}
                value={fields[f.key]}
                onChange={(v) => updateField(f.key, v)}
                autoFilled={!!autoFilled[f.key]}
                hasError={failedFields.includes(f.key)}
              />
            ))}
          </div>

          {validation && !validation.valid && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#FCA5A5' }}>
              Validation errors: {validation.errors_count}
            </div>
          )}

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button
              onClick={downloadDraftBoe}
              disabled={loadingPrepare}
              style={{
                border: '1px solid #1E293B',
                borderRadius: 10,
                padding: '12px 14px',
                fontWeight: 700,
                color: '#CBD5E1',
                background: '#111827',
                cursor: loadingPrepare ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minWidth: 220,
              }}
            >
              <Download size={14} /> Download Draft BOE
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || loadingPrepare}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 10,
                padding: '12px 14px',
                fontWeight: 700,
                color: '#fff',
                background: submitting ? '#1E293B' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {submitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Filing...</> : <><Send size={14} /> Submit to ICEGATE</>}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: 14, border: '1px solid #1E293B', borderRadius: 12, background: '#0F172A' }}>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Current Totals</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>CIF: {fmtCurrency(fields.custom_value_inr)}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>BCD: {fmtDutyNilOrCurrency(fields.bcd_amount)}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>SWS: {fmtDutyNilOrCurrency(fields.sws_amount)}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>IGST: {fmtCurrency(fields.gst)}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Duty: {fmtCurrency(fields.custom_duty)}</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Total Payable: {fmtCurrency(fields.total_payable)}</div>
          </div>

          <div style={{ padding: 14, border: '1px solid #1E293B', borderRadius: 12, background: '#0F172A' }}>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Filing Context</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Document ID: {boeData?.document_id || '—'}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Computation UUID: {boeData?.computation_uuid || '—'}</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Filing ID: {filingId || '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: previewFiling ? '1fr 1fr' : '1fr', gap: 18 }}>
        <div style={{ padding: 16, border: '1px solid #1E293B', borderRadius: 12, background: '#0F172A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: '#CBD5E1', fontSize: 14 }}>BOE Registry</h3>
            {registryLoading && <Loader2 size={13} color="#64748B" style={{ animation: 'spin 1s linear infinite' }} />}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {(registry || []).map((row) => (
              <div key={row.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(30,41,59,0.7)' }}>
                <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 600 }}>
                  {row.importer_name || '—'} | HSN {row.hsn_code || '—'}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  CIF {fmtCurrency(row.custom_value_inr)} | Duty {fmtCurrency(row.custom_duty)} | {row.icegate_status || row.filing_status}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Submitted: {row.updated_at ? new Date(row.updated_at).toLocaleString() : (row.created_at ? new Date(row.created_at).toLocaleString() : '—')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={() => handleView(row.id)} style={{ border: '1px solid #1E293B', background: '#111827', color: '#CBD5E1', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>View</button>
                  <button onClick={() => downloadFinalBoe(row.id)} style={{ border: '1px solid #1E293B', background: '#111827', color: '#CBD5E1', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={11} /> Download
                  </button>
                  <button onClick={() => handleSoftDelete(row.id)} style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
            {registry.length === 0 && (
              <div style={{ color: '#64748B', fontSize: 12, padding: '10px 0' }}>No active BOE filings.</div>
            )}
          </div>
        </div>

        {previewFiling && (
          <div style={{ padding: 16, border: '1px solid #1E293B', borderRadius: 12, background: '#0F172A' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: '#CBD5E1', fontSize: 14 }}>BOE Preview</h3>
              <button
                onClick={() => setPreviewFiling(null)}
                style={{ border: '1px solid #1E293B', background: '#111827', color: '#94A3B8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}
              >
                Close
              </button>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', fontSize: 12, color: '#94A3B8', display: 'grid', gap: 6 }}>
              <div><strong style={{ color: '#E2E8F0' }}>Filing ID:</strong> {previewFiling.id}</div>
              <div><strong style={{ color: '#E2E8F0' }}>Status:</strong> {previewFiling.icegate_status || previewFiling.filing_status || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>BOE Number:</strong> {previewFiling.boe_fields?.boe_number || previewFiling.boe_number || previewFiling.icegate_boe_number || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>Ack Number:</strong> {previewFiling.icegate_ack_number || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>Importer:</strong> {previewFiling.boe_fields?.importer_name || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>IEC:</strong> {previewFiling.boe_fields?.importer_iec || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>B/L Number:</strong> {previewFiling.boe_fields?.bill_of_lading_number || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>HSN:</strong> {previewFiling.boe_fields?.hsn_code || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>Goods:</strong> {previewFiling.boe_fields?.description_of_goods || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>Port of Import:</strong> {previewFiling.boe_fields?.port_of_import || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>Country of Origin:</strong> {previewFiling.boe_fields?.country_of_origin || '—'}</div>
              <div><strong style={{ color: '#E2E8F0' }}>CIF Value:</strong> {fmtCurrency(previewFiling.boe_fields?.custom_value_inr)}</div>
              <div><strong style={{ color: '#E2E8F0' }}>Duty:</strong> {fmtCurrency(previewFiling.boe_fields?.custom_duty)}</div>
              <div><strong style={{ color: '#E2E8F0' }}>Total Payable:</strong> {fmtCurrency(previewFiling.boe_fields?.total_payable)}</div>
              <div style={{ marginTop: 8, fontWeight: 700, color: '#CBD5E1' }}>Line Items</div>
              {(previewFiling.line_items || []).length === 0 && <div>—</div>}
              {(previewFiling.line_items || []).map((item, idx) => (
                <div key={`${idx}-${item.hsn_code || 'row'}`} style={{ border: '1px solid #1E293B', borderRadius: 8, padding: 8, background: '#111827' }}>
                  <div><strong style={{ color: '#E2E8F0' }}>#{idx + 1}</strong> {item.description_of_goods || '—'}</div>
                  <div>HSN: {item.hsn_code || '—'} | Qty: {item.quantity || '—'} {item.unit || ''}</div>
                  <div>CIF: {fmtCurrency(item.custom_value_inr)} | Duty: {fmtCurrency(item.total_duty)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
