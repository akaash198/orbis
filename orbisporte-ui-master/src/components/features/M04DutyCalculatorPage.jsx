/**
 * M04DutyCalculatorPage.jsx
 * Duty Computation Engine UI — with Formula Audit Trail & Bar Chart
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  BarChart2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  TrendingUp,
  Upload,
  Zap,
} from 'lucide-react';
import { m04Service, documentService, m02Service } from '../../services/api';

// ── Constants ──────────────────────────────────────────────────────────────────

const CURRENCY_OPTIONS = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'AED', name: 'UAE Dirham' },
];

const COUNTRY_OPTIONS = [
  { code: 'CHN', name: 'China' },
  { code: 'USA', name: 'United States' },
  { code: 'DEU', name: 'Germany' },
  { code: 'JPN', name: 'Japan' },
  { code: 'KOR', name: 'South Korea' },
  { code: 'TWN', name: 'Taiwan' },
  { code: 'VNM', name: 'Vietnam' },
  { code: 'THA', name: 'Thailand' },
  { code: 'MYS', name: 'Malaysia' },
];

const UNIT_OPTIONS = [
  { code: 'PCS', name: 'Pieces' },
  { code: 'KG',  name: 'Kilogram' },
  { code: 'MT',  name: 'Metric Ton' },
  { code: 'MTR', name: 'Meter' },
  { code: 'LTR', name: 'Liter' },
];

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizeCountry(raw) {
  if (!raw) return '';
  const v = String(raw).trim().toUpperCase();
  const map = {
    CN: 'CHN', CHINA: 'CHN', CHN: 'CHN',
    US: 'USA', USA: 'USA', UNITEDSTATES: 'USA', 'UNITED STATES': 'USA', AMERICA: 'USA',
    DE: 'DEU', DEU: 'DEU', GERMANY: 'DEU', DEUTSCHLAND: 'DEU',
    JP: 'JPN', JPN: 'JPN', JAPAN: 'JPN',
    KR: 'KOR', KOR: 'KOR', SOUTHKOREA: 'KOR', 'SOUTH KOREA': 'KOR',
    TW: 'TWN', TWN: 'TWN', TAIWAN: 'TWN',
    VN: 'VNM', VNM: 'VNM', VIETNAM: 'VNM',
    TH: 'THA', THA: 'THA', THAILAND: 'THA',
    MY: 'MYS', MYS: 'MYS', MALAYSIA: 'MYS',
  };
  return map[v] || (COUNTRY_OPTIONS.find(o => o.code === v) ? v : '');
}

function normalizeUnit(raw) {
  if (!raw) return '';
  const v = String(raw).trim().toUpperCase();
  const map = {
    PCS: 'PCS', PC: 'PCS', PIECE: 'PCS', PIECES: 'PCS', NOS: 'PCS', NO: 'PCS', UNITS: 'PCS',
    KG: 'KG', KGS: 'KG', KILOGRAM: 'KG', KILOGRAMS: 'KG',
    MT: 'MT', MTS: 'MT', 'METRIC TON': 'MT', 'METRIC TONS': 'MT', TONNE: 'MT', TONNES: 'MT',
    MTR: 'MTR', M: 'MTR', METER: 'MTR', METERS: 'MTR', METRE: 'MTR', METRES: 'MTR',
    LTR: 'LTR', L: 'LTR', LT: 'LTR', LITER: 'LTR', LITERS: 'LTR', LITRE: 'LTR', LITRES: 'LTR',
  };
  return map[v] || (UNIT_OPTIONS.find(o => o.code === v) ? v : '');
}

function normalizeCurrency(raw) {
  if (!raw) return '';
  const v = String(raw).trim().toUpperCase();
  return CURRENCY_OPTIONS.find(o => o.code === v) ? v : '';
}

// ── Field extraction ───────────────────────────────────────────────────────────

function extractDutyFields(data, initialHsnCode) {
  if (!data) return {};
  const fields = data.normalised_fields || data.extracted_fields || data.extracted_data || {};
  const lineItems = data.line_items || fields.line_items || [];
  const item = lineItems[0] || {};
  const str = (v) => (v != null && v !== '' ? String(v) : null);

  return {
    fob_cost:
      str(fields.total_value) || str(fields.total_amount) || str(fields.fob_value)
      || str(fields.fob) || str(fields.invoice_value) || str(item.total_price)
      || str(item.amount) || str(item.line_total) || null,
    freight:
      str(fields.freight) || str(fields.freight_charges) || str(fields.freight_cost)
      || str(fields.freight_value) || str(item.freight) || null,
    insurance:
      str(fields.insurance) || str(fields.insurance_charges) || str(fields.insurance_cost)
      || str(fields.insurance_value) || str(item.insurance) || null,
    input_currency:
      normalizeCurrency(fields.currency || fields.invoice_currency || fields.currency_code
        || item.currency) || null,
    hsn_code:
      initialHsnCode || fields.hsn_code || fields.hs_code || data.hs_code
      || item.hsn_code || item.hs_code || null,
    country_of_origin:
      normalizeCountry(fields.country_of_origin || fields.origin_country
        || fields.country_of_export || fields.country || item.country_of_origin) || null,
    quantity:
      str(fields.quantity) || str(fields.total_quantity) || str(item.quantity) || null,
    unit:
      normalizeUnit(fields.unit || fields.unit_of_measurement || fields.uom
        || item.unit || item.uom) || null,
    port_of_import:
      fields.port_of_import || fields.port_of_entry || fields.port_of_discharge
      || fields.destination_port || fields.port_code || fields.port || null,
  };
}

async function loadDocumentWithM02(documentId) {
  const doc = await documentService.getDocumentById(documentId);
  if (!doc) return null;
  let m02Result = null;
  try { m02Result = await m02Service.getResult(documentId); } catch {}
  if (m02Result && (m02Result.normalised_fields || m02Result.extracted_fields)) {
    return {
      ...doc,
      normalised_fields: m02Result.normalised_fields,
      extracted_fields:  m02Result.extracted_fields,
      document_type:     m02Result.document_type || doc.doc_type,
    };
  }
  return doc;
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function fmtCurrency(amount) {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
}

function fmtNumber(num) {
  if (num == null || isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN').format(num);
}

function fmtShort(v) {
  if (!v && v !== 0) return '—';
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

function pct(v) {
  if (!v && v !== 0) return '—';
  const s = String(v);
  if (s.includes('%')) return s;
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  return n <= 1 ? `${(n * 100).toFixed(0)}%` : `${n.toFixed(0)}%`;
}

// ── BarChart (SVG, zero deps) ─────────────────────────────────────────────────

function BarChart({ bars }) {
  const W = 400, H = 210;
  const pl = 62, pr = 10, pt = 32, pb = 38;
  const iW = W - pl - pr, iH = H - pt - pb;
  const maxVal = Math.max(...bars.map(b => b.value || 0), 1);
  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const niceMax = Math.ceil(maxVal / mag) * mag;
  const bw = iW / bars.length;
  const pad = bw * 0.30;
  const abw = bw - pad;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ val: niceMax * f, y: pt + iH * (1 - f) }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        {bars.map((b, i) => (
          <linearGradient key={i} id={`bcg${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={b.color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={b.color} stopOpacity="0.45" />
          </linearGradient>
        ))}
      </defs>

      {/* Y-axis grid + labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={pl} y1={t.y} x2={W - pr} y2={t.y}
            stroke="#1E293B" strokeWidth={i === 0 ? 1 : 0.5}
            strokeDasharray={i === 0 ? '' : '4 4'}
          />
          <text x={pl - 5} y={t.y + 3.5} textAnchor="end" fontSize={8} fill="#475569">
            {fmtShort(t.val)}
          </text>
        </g>
      ))}

      {/* Bars */}
      {bars.map((b, i) => {
        const bh = Math.max(((b.value || 0) / niceMax) * iH, b.value > 0 ? 3 : 0);
        const x = pl + i * bw + pad / 2;
        const y = pt + iH - bh;
        return (
          <g key={i}>
            {/* Shadow */}
            <rect x={x + 2} y={y + 2} width={abw} height={bh} rx={5} fill={b.color} fillOpacity={0.12} />
            {/* Bar */}
            <rect x={x} y={y} width={abw} height={bh} rx={5} fill={`url(#bcg${i})`} />
            {/* Base accent */}
            <rect x={x} y={pt + iH - 3} width={abw} height={3} rx={2} fill={b.color} fillOpacity={0.5} />
            {/* Value label */}
            {b.value > 0 && (
              <text x={x + abw / 2} y={y - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill={b.color}>
                {fmtShort(b.value)}
              </text>
            )}
            {/* X label */}
            <text x={x + abw / 2} y={H - pb + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">
              {b.label}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={pl} y1={pt} x2={pl} y2={pt + iH} stroke="#334155" strokeWidth={1} />
      <line x1={pl} y1={pt + iH} x2={W - pr} y2={pt + iH} stroke="#334155" strokeWidth={1} />

      {/* Y-axis title */}
      <text
        x={10} y={pt + iH / 2}
        textAnchor="middle" fontSize={8} fill="#475569"
        transform={`rotate(-90, 10, ${pt + iH / 2})`}
      >
        Amount (INR)
      </text>
    </svg>
  );
}

// ── Summary View ──────────────────────────────────────────────────────────────

function SummaryView({ result }) {
  const bcdAmt  = result.duties?.bcd_amount  ?? result.duties?.bcd  ?? 0;
  const swsAmt  = result.duties?.sws_amount  ?? result.duties?.sws  ?? 0;
  const igstAmt = result.duties?.igst_amount ?? result.duties?.igst ?? 0;
  const addAmt  = result.duties?.add_amount  ?? result.duties?.add  ?? 0;
  const cvdAmt  = result.duties?.cvd_amount  ?? result.duties?.cvd  ?? 0;
  const sgdAmt  = result.duties?.sgd_amount  ?? result.duties?.sgd  ?? 0;
  const av      = result.assessable_value_inr ?? 0;
  const computedTotalDuty = bcdAmt + swsAmt + igstAmt + addAmt + cvdAmt + sgdAmt;
  const totalDuty = Number.isFinite(Number(result.total_duty_inr)) ? Number(result.total_duty_inr) : computedTotalDuty;
  const totalPayable = Number.isFinite(Number(result.total_payable_inr))
    ? Number(result.total_payable_inr)
    : Number.isFinite(Number(result.total_amount_payable_inr))
      ? Number(result.total_amount_payable_inr)
      : (av + totalDuty);

  const rows = [
    { label: 'CIF / Assessable Value',       value: av,      color: '#3B82F6', rgb: '59,130,246' },
    { label: `BCD (${pct(result.rates?.bcd_rate ?? result.rates?.bcd)})`, value: bcdAmt, color: '#F59E0B', rgb: '245,158,11' },
    { label: 'Social Welfare Surcharge (10% of BCD)', value: swsAmt, color: '#EC4899', rgb: '236,72,153' },
    { label: `IGST (${pct(result.rates?.igst_rate ?? result.rates?.igst)})`, value: igstAmt, color: '#22C55E', rgb: '34,197,94' },
    ...(addAmt > 0 ? [{ label: 'Anti-Dumping Duty (ADD)', value: addAmt, color: '#EF4444', rgb: '239,68,68' }] : []),
    ...(cvdAmt > 0 ? [{ label: 'Countervailing Duty (CVD)', value: cvdAmt, color: '#8B5CF6', rgb: '139,92,246' }] : []),
    ...(sgdAmt > 0 ? [{ label: 'Safeguard Duty (SGD)', value: sgdAmt, color: '#14B8A6', rgb: '20,184,166' }] : []),
  ];

  return (
    <div style={{ background: '#0F172A', borderRadius: 12, border: '1px solid #1E293B', padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
        Duty Breakdown
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map((row, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px',
            background: `rgba(${row.rgb},0.06)`,
            border: `1px solid rgba(${row.rgb},0.18)`,
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#94A3B8' }}>{row.label}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: row.color, fontFamily: 'monospace' }}>
              {fmtCurrency(row.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(239,68,68,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(239,68,68,0.07)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1' }}>Total Customs Duty</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#EF4444', fontFamily: 'monospace' }}>{fmtCurrency(totalDuty)}</span>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: '14px 16px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10 }}>
        <div style={{ fontSize: 10, color: '#4ADE80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Total Payable
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#22C55E', fontFamily: 'monospace', lineHeight: 1.2 }}>
          {fmtCurrency(totalPayable)}
        </div>
      </div>
    </div>
  );
}

// ── Audit Trail ───────────────────────────────────────────────────────────────

function AuditTrail({ form, result }) {
  const fob     = parseFloat(form.fob_cost) || 0;
  const frt     = parseFloat(form.freight)  || 0;
  const ins     = parseFloat(form.insurance) || 0;
  const cur     = form.input_currency || 'USD';
  const rate    = result.exchange_rate ?? 1;
  const cif     = result.cif_value ?? (fob + frt + ins);
  const av      = result.assessable_value_inr ?? 0;
  const bcdAmt  = result.duties?.bcd_amount  ?? result.duties?.bcd  ?? 0;
  const swsAmt  = result.duties?.sws_amount  ?? result.duties?.sws  ?? 0;
  const igstAmt = result.duties?.igst_amount ?? result.duties?.igst ?? 0;
  const addAmt  = result.duties?.add_amount  ?? result.duties?.add  ?? 0;
  const cvdAmt  = result.duties?.cvd_amount  ?? result.duties?.cvd  ?? 0;
  const sgdAmt  = result.duties?.sgd_amount  ?? result.duties?.sgd  ?? 0;
  const bcdRate = result.rates?.bcd_rate  ?? result.rates?.bcd  ?? 0;
  const igstRate = result.rates?.igst_rate ?? result.rates?.igst ?? 0;
  const hasAdd = addAmt > 0;
  const hasAdditionalCharges = cvdAmt > 0 || sgdAmt > 0;
  const totalDuty = Number.isFinite(Number(result.total_duty_inr))
    ? Number(result.total_duty_inr)
    : (bcdAmt + swsAmt + igstAmt + addAmt + cvdAmt + sgdAmt);
  const totalPayable = Number.isFinite(Number(result.total_payable_inr))
    ? Number(result.total_payable_inr)
    : Number.isFinite(Number(result.total_amount_payable_inr))
      ? Number(result.total_amount_payable_inr)
      : (av + totalDuty);
  const totalDutyStepNo = 6 + (hasAdd ? 1 : 0) + (hasAdditionalCharges ? 1 : 0);
  const totalPayableStepNo = totalDutyStepNo + 1;

  const steps = [
    // ── Inputs ──
    {
      type: 'inputs',
      rows: [
        { k: 'FOB Cost',      v: `${cur} ${fmtNumber(fob)}` },
        { k: 'Freight',       v: `${cur} ${fmtNumber(frt)}` },
        { k: 'Insurance',     v: `${cur} ${fmtNumber(ins)}` },
        { k: 'Currency',      v: cur },
        { k: 'Exchange Rate', v: `1 ${cur} = ₹${Number(rate).toFixed(4)}` },
        { k: 'HSN Code',      v: form.hsn_code || '—' },
        ...(form.quantity ? [{ k: 'Quantity', v: `${form.quantity} ${form.unit || ''}`.trim() }] : []),
      ],
    },
    // ── Step 1: CIF ──
    {
      n: 1, color: '#3B82F6', rgb: '59,130,246',
      label: 'CIF Value',
      formula: 'CIF  =  FOB  +  Freight  +  Insurance',
      sub: `=  ${cur} ${fmtNumber(fob)}  +  ${fmtNumber(frt)}  +  ${fmtNumber(ins)}`,
      res: `=  ${cur} ${fmtNumber(cif)}`,
    },
    // ── Step 2: AV ──
    {
      n: 2, color: '#3B82F6', rgb: '59,130,246',
      label: 'Assessable Value (INR)',
      formula: 'AV  =  CIF  ×  Exchange Rate',
      sub: `=  ${cur} ${fmtNumber(cif)}  ×  ₹${Number(rate).toFixed(4)}`,
      res: `=  ${fmtCurrency(av)}`,
      highlight: true,
    },
    // ── Step 3: BCD ──
    {
      n: 3, color: '#F59E0B', rgb: '245,158,11',
      label: `Basic Customs Duty — BCD @ ${pct(bcdRate)}`,
      formula: 'BCD  =  AV  ×  BCD Rate',
      sub: `=  ${fmtCurrency(av)}  ×  ${pct(bcdRate)}`,
      res: `=  ${fmtCurrency(bcdAmt)}`,
    },
    // ── Step 4: SWS ──
    {
      n: 4, color: '#EC4899', rgb: '236,72,153',
      label: 'Social Welfare Surcharge — SWS @ 10% of BCD',
      formula: 'SWS  =  BCD  ×  10%',
      sub: `=  ${fmtCurrency(bcdAmt)}  ×  10%`,
      res: `=  ${fmtCurrency(swsAmt)}`,
    },
    // ── Step 5: IGST ──
    {
      n: 5, color: '#22C55E', rgb: '34,197,94',
      label: `IGST @ ${pct(igstRate)}`,
      formula: 'IGST  =  (AV  +  BCD  +  SWS)  ×  IGST Rate',
      sub: `=  (${fmtCurrency(av)}  +  ${fmtCurrency(bcdAmt)}  +  ${fmtCurrency(swsAmt)})  ×  ${pct(igstRate)}`,
      res: `=  ${fmtCurrency(igstAmt)}`,
    },
    // ── Step 6: ADD (conditional) ──
    ...(hasAdd ? [{
      n: 6, color: '#EF4444', rgb: '239,68,68',
      label: 'Anti-Dumping Duty (ADD)',
      formula: 'ADD  =  from trade remedies schedule',
      sub: '',
      res: `=  ${fmtCurrency(addAmt)}`,
    }] : []),
    ...(hasAdditionalCharges ? [{
      n: hasAdd ? 7 : 6, color: '#8B5CF6', rgb: '139,92,246',
      label: 'Additional Charges (CVD / SGD)',
      formula: 'Additional Charges  =  CVD  +  SGD',
      sub: `=  ${fmtCurrency(cvdAmt)}  +  ${fmtCurrency(sgdAmt)}`,
      res: `=  ${fmtCurrency(cvdAmt + sgdAmt)}`,
    }] : []),
    // ── Step 7: Total Duty ──
    {
      n: totalDutyStepNo, color: '#EF4444', rgb: '239,68,68',
      label: 'Total Customs Duty',
      formula: `Total Duty  =  BCD  +  SWS  +  IGST${hasAdd ? '  +  ADD' : ''}${hasAdditionalCharges ? '  +  CVD  +  SGD' : ''}`,
      sub: `=  ${fmtCurrency(bcdAmt)}  +  ${fmtCurrency(swsAmt)}  +  ${fmtCurrency(igstAmt)}${hasAdd ? `  +  ${fmtCurrency(addAmt)}` : ''}${hasAdditionalCharges ? `  +  ${fmtCurrency(cvdAmt)}  +  ${fmtCurrency(sgdAmt)}` : ''}`,
      res: `=  ${fmtCurrency(totalDuty)}`,
      highlight: true,
    },
    // ── Step 8: Total Payable ──
    {
      n: totalPayableStepNo, color: '#22C55E', rgb: '34,197,94',
      label: 'Total Payable',
      formula: 'Total Payable  =  AV  +  Total Duty',
      sub: `=  ${fmtCurrency(av)}  +  ${fmtCurrency(totalDuty)}`,
      res: `=  ${fmtCurrency(totalPayable)}`,
      highlight: true, isTotal: true,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((step, idx) => {
        if (step.type === 'inputs') {
          return (
            <div key={idx} style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Input Values
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                {step.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{r.k}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#CBD5E1', fontFamily: 'monospace' }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const borderColor = step.isTotal
          ? `rgba(${step.rgb},0.35)`
          : step.highlight
            ? `rgba(${step.rgb},0.22)`
            : '#1E293B';
        const bgColor = step.isTotal
          ? `rgba(${step.rgb},0.08)`
          : '#0F172A';

        return (
          <div key={idx} style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10, padding: '12px 14px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: step.color,
                background: `rgba(${step.rgb},0.14)`,
                padding: '2px 8px', borderRadius: 4, flexShrink: 0,
              }}>
                STEP {step.n}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1' }}>{step.label}</span>
            </div>

            {/* Formula lines */}
            <div style={{ paddingLeft: 10, borderLeft: `2px solid rgba(${step.rgb},0.3)` }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 5, fontFamily: 'monospace' }}>
                {step.formula}
              </div>
              {step.sub && (
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94A3B8', marginBottom: 4 }}>
                  {step.sub}
                </div>
              )}
              <div style={{
                fontSize: step.isTotal ? 15 : 13,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: step.color,
              }}>
                {step.res}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Form field components ──────────────────────────────────────────────────────

function FieldBadge({ fromDoc, needsInput }) {
  if (fromDoc) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.12)', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.05em' }}>
      <CheckCircle2 size={8} /> FROM DOC
    </span>
  );
  if (needsInput) return (
    <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.05em' }}>
      ENTER MANUALLY
    </span>
  );
  return null;
}

function SectionTitle({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, marginTop: 20 }}>
      <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B', margin: 0 }}>
        {children}
      </h2>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'number', prefix, fromDoc, needsInput }) {
  const border = fromDoc ? '#22C55E' : needsInput ? '#F59E0B' : '#1E293B';
  const bg     = fromDoc ? 'rgba(34,197,94,0.05)' : needsInput ? 'rgba(245,158,11,0.04)' : '#0F172A';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>{label}</label>
        <FieldBadge fromDoc={fromDoc} needsInput={needsInput} />
      </div>
      <div style={{ position: 'relative' }}>
        {prefix && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: 13 }}>{prefix}</span>}
        <input
          type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: prefix ? '10px 12px 10px 32px' : '10px 12px',
            fontSize: 14, fontWeight: 500,
            background: bg, border: `1px solid ${border}`,
            borderRadius: 8, color: '#E2E8F0', outline: 'none',
            transition: 'border-color 0.2s', boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, fromDoc, needsInput }) {
  const border = fromDoc ? '#22C55E' : needsInput ? '#F59E0B' : '#1E293B';
  const bg     = fromDoc ? 'rgba(34,197,94,0.05)' : needsInput ? 'rgba(245,158,11,0.04)' : '#0F172A';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>{label}</label>
        <FieldBadge fromDoc={fromDoc} needsInput={needsInput} />
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 14, fontWeight: 500, background: bg, border: `1px solid ${border}`, borderRadius: 8, color: value ? '#E2E8F0' : '#64748B', outline: 'none' }}>
        <option value="" style={{ color: '#64748B' }}>{placeholder || 'Select...'}</option>
        {options.map((opt) => <option key={opt.code} value={opt.code} style={{ color: '#E2E8F0' }}>{opt.code} - {opt.name}</option>)}
      </select>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function M04DutyCalculatorPage({ onNavigate, initialHsnCode, initialGoodsDesc, initialDocumentId }) {
  const [form, setForm] = useState({
    fob_cost: '', freight: '', insurance: '',
    input_currency: 'USD',
    hsn_code: initialHsnCode || '',
    country_of_origin: '', port_of_import: '',
    quantity: '', unit: '',
  });

  const [docFilledFields, setDocFilledFields] = useState(null);
  const [uploadedDoc, setUploadedDoc]         = useState(null);
  const [extractedData, setExtractedData]     = useState(null);
  const [isExtracting, setIsExtracting]       = useState(false);
  const [recentDocs, setRecentDocs]           = useState([]);
  const [showRecentDocs, setShowRecentDocs]   = useState(false);
  const fileInputRef = useRef(null);

  const [status, setStatus]       = useState('idle');
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [viewMode, setViewMode]     = useState('summary'); // 'summary' | 'detailed'
  const [boeRedirecting, setBoeRedirecting] = useState(false);
  const autoFilledRef = useRef(false);

  // Live exchange rate
  useEffect(() => {
    if (form.input_currency && form.input_currency !== 'INR') {
      m04Service.getExchangeRate(form.input_currency).then(setExchangeRate).catch(console.error);
    } else {
      setExchangeRate({ rate_inr: 1, source: '1:1' });
    }
  }, [form.input_currency]);

  // Recent docs list
  useEffect(() => {
    documentService.getAllDocuments().then((res) => {
      const docs = res.documents || res.results || res || [];
      setRecentDocs(docs.slice(0, 6));
    }).catch(console.error);
  }, []);

  // Auto-load document from HS Code navigation
  useEffect(() => {
    if (!initialDocumentId) return;
    autoFilledRef.current = false;
    setIsExtracting(true);
    setExtractedData(null);
    (async () => {
      try {
        const merged = await loadDocumentWithM02(initialDocumentId);
        if (!merged) { setError('Document not found'); return; }
        setUploadedDoc({ id: initialDocumentId, name: merged.filename || merged.original_filename || `Document ${initialDocumentId}` });
        if (!merged.normalised_fields && !merged.extracted_fields) {
          try { await m02Service.process(initialDocumentId); } catch {}
          await new Promise(r => setTimeout(r, 3000));
          const retried = await loadDocumentWithM02(initialDocumentId);
          setExtractedData(retried || merged);
        } else {
          setExtractedData(merged);
        }
      } catch (err) {
        setError('Failed to load document: ' + (err.message || 'Unknown'));
      } finally {
        setIsExtracting(false);
      }
    })();
  }, [initialDocumentId]);

  // Auto-fill from extracted document
  useEffect(() => {
    if (!extractedData || autoFilledRef.current) return;
    autoFilledRef.current = true;
    const extracted = extractDutyFields(extractedData, initialHsnCode);
    const filled = {};
    Object.keys(extracted).forEach(k => { filled[k] = !!extracted[k]; });
    setDocFilledFields(filled);
    setForm(prev => ({
      ...prev,
      fob_cost:          extracted.fob_cost          || prev.fob_cost,
      freight:           extracted.freight            || prev.freight,
      insurance:         extracted.insurance          || prev.insurance,
      input_currency:    extracted.input_currency     || prev.input_currency || 'USD',
      hsn_code:          extracted.hsn_code           || prev.hsn_code || '',
      country_of_origin: extracted.country_of_origin  || prev.country_of_origin,
      quantity:          extracted.quantity           || prev.quantity,
      unit:              extracted.unit               || prev.unit,
      port_of_import:    extracted.port_of_import     || prev.port_of_import,
    }));
  }, [extractedData, initialHsnCode]);

  // Upload new file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    autoFilledRef.current = false;
    setDocFilledFields(null);
    setIsExtracting(true);
    setUploadedDoc(file);
    setError(null);
    try {
      const uploadData = await documentService.uploadDocument(file);
      const documentId = uploadData.document_id || uploadData.id;
      if (!documentId) throw new Error('Upload failed — no document ID returned');
      setUploadedDoc({ id: documentId, name: file.name || `Document ${documentId}` });
      try { await m02Service.process(documentId); } catch {}
      let m02Result = null;
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const r = await m02Service.getResult(documentId);
          if (r && r.review_status !== 'processing') { m02Result = r; break; }
        } catch {}
      }
      const doc = await documentService.getDocumentById(documentId).catch(() => null);
      if (m02Result && (m02Result.normalised_fields || m02Result.extracted_fields)) {
        setExtractedData({ ...(doc || {}), normalised_fields: m02Result.normalised_fields, extracted_fields: m02Result.extracted_fields, document_type: m02Result.document_type || doc?.doc_type });
      } else if (doc && doc.extracted_data) {
        setExtractedData(doc);
      } else {
        setError('Extraction timed out — fill remaining fields manually.');
      }
    } catch (err) {
      setError('Upload failed: ' + (err.message || 'Unknown'));
    } finally {
      setIsExtracting(false);
      e.target.value = '';
    }
  };

  // Load a recent document
  const handleRecentDoc = async (doc) => {
    setShowRecentDocs(false);
    autoFilledRef.current = false;
    setDocFilledFields(null);
    setIsExtracting(true);
    setError(null);
    try {
      const merged = await loadDocumentWithM02(doc.id);
      if (merged) {
        setUploadedDoc({ id: doc.id, name: doc.filename || doc.original_filename || `Document ${doc.id}` });
        setExtractedData(merged);
      }
    } catch (err) {
      setError('Failed to load document: ' + (err.message || 'Unknown'));
    } finally {
      setIsExtracting(false);
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCalculate = async () => {
    if (!form.fob_cost || !form.hsn_code) { setError('FOB Cost and HSN Code are required'); return; }
    setStatus('calculating');
    setResult(null);
    setError(null);
    try {
      const payload = {
        fob_cost:          parseFloat(form.fob_cost) || 0,
        freight:           parseFloat(form.freight) || 0,
        insurance:         parseFloat(form.insurance) || 0,
        input_currency:    form.input_currency || 'USD',
        hsn_code:          form.hsn_code,
        country_of_origin: form.country_of_origin || undefined,
        port_code:         form.port_of_import || undefined,
        quantity:          form.quantity ? parseFloat(form.quantity) : undefined,
        unit:              form.unit || undefined,
      };
      const res = await m04Service.compute(payload);
      setResult(res);
      setStatus('success');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Calculation failed');
      setStatus('error');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duty_calculation_${result.computation_uuid?.slice(0, 8) || 'result'}.json`;
    a.click();
  };

  const handleOpenBOE = async () => {
    if (!result || !onNavigate) return;
    setBoeRedirecting(true);
    const documentId = extractedData?.id || uploadedDoc?.id || initialDocumentId || null;
    const extractedRoot = extractedData?.normalised_fields || extractedData?.extracted_fields || extractedData?.extracted_data || {};
    const firstLine = extractedData?.line_items?.[0] || extractedRoot?.line_items?.[0] || {};
    const inferredGoodsDescription =
      initialGoodsDesc ||
      extractedRoot?.goods_description ||
      extractedRoot?.description_of_goods ||
      firstLine?.description ||
      firstLine?.product_description ||
      '';
    // Small delay for visual feedback, then navigate with full payload
    await new Promise(r => setTimeout(r, 600));
    onNavigate('boe-filing', {
      boeData: {
        document_id:       documentId,
        document_name:     uploadedDoc?.name || null,
        extracted_data:    extractedData || null,
        doc_filled_fields: docFilledFields || {},
        // Inputs from form
        hsn_code:          form.hsn_code,
        goods_description: inferredGoodsDescription,
        country_of_origin: form.country_of_origin,
        port_of_import:    form.port_of_import,
        port_code:         form.port_of_import,
        quantity:          form.quantity,
        unit:              form.unit,
        fob_cost:          parseFloat(form.fob_cost) || 0,
        freight:           parseFloat(form.freight)  || 0,
        insurance:         parseFloat(form.insurance) || 0,
        input_currency:    form.input_currency,
        // Computed results from M04
        cif_value:                   result.cif_value,
        assessable_value_inr:        result.assessable_value_inr,
        exchange_rate:               result.exchange_rate,
        duties:                      result.duties,
        rates:                       result.rates,
        total_duty_inr:              result.total_duty_inr,
        total_payable_inr:           result.total_payable_inr,
        total_amount_payable_inr:    result.total_payable_inr ?? result.total_amount_payable_inr,
        computation_uuid:            result.computation_uuid,
      },
    });
    setBoeRedirecting(false);
  };

  // Derived UI helpers
  const hasExtraction = docFilledFields !== null;
  const filledCount   = hasExtraction ? Object.values(docFilledFields).filter(Boolean).length : 0;
  const totalFields   = 9;
  const missingCount  = hasExtraction ? totalFields - filledCount : 0;
  const fromDoc    = (f) => hasExtraction && !!docFilledFields?.[f];
  const needsInput = (f) => hasExtraction && !docFilledFields?.[f] && !form[f];
  const currSymbol = form.input_currency === 'INR' ? '₹' : form.input_currency === 'EUR' ? '€' : '$';

  // Bar chart data (available as soon as result exists)
  const additionalCharges = result
    ? ((result.duties?.add_amount ?? 0) + (result.duties?.cvd_amount ?? 0) + (result.duties?.sgd_amount ?? 0))
    : 0;
  const chartBars = result ? [
    { label: 'CIF Value', value: result.assessable_value_inr ?? 0,                                              color: '#3B82F6' },
    { label: 'BCD',       value: result.duties?.bcd_amount  ?? result.duties?.bcd  ?? 0,                       color: '#F59E0B' },
    { label: 'IGST',      value: result.duties?.igst_amount ?? result.duties?.igst ?? 0,                       color: '#22C55E' },
    ...(additionalCharges > 0 ? [{ label: 'Additional', value: additionalCharges, color: '#8B5CF6' }] : []),
    { label: 'Total Duty',value: result.total_duty_inr ?? 0,                                                    color: '#EF4444' },
  ] : [];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Calculator size={24} color="#3B82F6" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', margin: 0 }}>Duty Calculator</h1>
        </div>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Calculate customs duties for imports</p>
        {initialHsnCode && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8 }}>
            <Zap size={14} color="#3B82F6" />
            <span style={{ fontSize: 12, color: '#94A3B8' }}>
              Navigated from HS Code — HSN <strong style={{ color: '#3B82F6', fontFamily: 'monospace' }}>{initialHsnCode}</strong>
              {initialDocumentId && <> · document fields are being auto-filled</>}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left column: form ── */}
        <div>

          {/* Document import */}
          <SectionTitle>Import from Document</SectionTitle>
          <div style={{ padding: 16, background: '#0F172A', borderRadius: 12, border: '1px solid #1E293B', marginBottom: 24 }}>

            {uploadedDoc && (
              <div style={{ marginBottom: 12, padding: '12px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={18} color="#3B82F6" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedDoc.name}</div>
                    {isExtracting && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Extracting fields…</div>}
                    {hasExtraction && !isExtracting && (
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        <span style={{ color: '#22C55E', fontWeight: 600 }}>{filledCount} field{filledCount !== 1 ? 's' : ''} auto-filled</span>
                        {missingCount > 0 && <span style={{ color: '#F59E0B' }}> · {missingCount} need{missingCount === 1 ? 's' : ''} manual entry</span>}
                      </div>
                    )}
                  </div>
                </div>
                {hasExtraction && !isExtracting && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { key: 'fob_cost', label: 'FOB' }, { key: 'freight', label: 'Freight' },
                      { key: 'insurance', label: 'Insurance' }, { key: 'input_currency', label: 'Currency' },
                      { key: 'hsn_code', label: 'HSN' }, { key: 'country_of_origin', label: 'Country' },
                      { key: 'quantity', label: 'Qty' }, { key: 'unit', label: 'Unit' },
                      { key: 'port_of_import', label: 'Port of Import' },
                    ].map(({ key, label }) => (
                      <span key={key} style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: docFilledFields[key] ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)',
                        color: docFilledFields[key] ? '#22C55E' : '#F59E0B',
                        border: `1px solid ${docFilledFields[key] ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.25)'}`,
                      }}>
                        {docFilledFields[key] ? '✓' : '○'} {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <input type="file" ref={fileInputRef} accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isExtracting} style={{ width: '100%', padding: '10px 16px', fontSize: 12, fontWeight: 600, background: isExtracting ? '#1E293B' : '#0F172A', color: isExtracting ? '#64748B' : '#E2E8F0', border: '1px solid #1E293B', borderRadius: 8, cursor: isExtracting ? 'not-allowed' : 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {isExtracting ? <><Loader2 size={14} /> Extracting fields…</> : <><Upload size={14} /> Upload Document</>}
            </button>

            <button onClick={() => setShowRecentDocs(!showRecentDocs)} disabled={recentDocs.length === 0 || isExtracting} style={{ width: '100%', padding: '10px 16px', fontSize: 12, fontWeight: 600, background: recentDocs.length > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)', color: recentDocs.length > 0 ? '#22C55E' : '#16A34A', border: `1px solid ${recentDocs.length > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.15)'}`, borderRadius: 8, cursor: recentDocs.length > 0 && !isExtracting ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <FileText size={14} /> Use Recent Document {recentDocs.length > 0 ? `(${recentDocs.length})` : ''}
              {showRecentDocs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showRecentDocs && recentDocs.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 210, overflowY: 'auto', background: '#0D1020', borderRadius: 8, border: '1px solid #1E293B' }}>
                {recentDocs.map((doc, idx) => (
                  <div key={doc.id || idx} onClick={() => handleRecentDoc(doc)} style={{ padding: '10px 12px', borderBottom: idx < recentDocs.length - 1 ? '1px solid #1E293B' : 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>{doc.filename || doc.original_filename || `Document ${doc.id}`}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{doc.doc_type || doc.document_type || 'Unknown type'}{doc.hs_code ? ` · HSN: ${doc.hs_code}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unified CIF & Classification */}
          <SectionTitle>CIF &amp; Classification</SectionTitle>
          <div style={{ padding: 20, background: '#0F172A', borderRadius: 12, border: '1px solid #1E293B' }}>
            <InputField label="FOB Cost" value={form.fob_cost} onChange={(v) => updateField('fob_cost', v)} placeholder="0.00" prefix={currSymbol} fromDoc={fromDoc('fob_cost')} needsInput={needsInput('fob_cost')} />
            <InputField label="Freight" value={form.freight} onChange={(v) => updateField('freight', v)} placeholder="0.00" prefix={currSymbol} fromDoc={fromDoc('freight')} needsInput={needsInput('freight')} />
            <InputField label="Insurance" value={form.insurance} onChange={(v) => updateField('insurance', v)} placeholder="0.00" prefix={currSymbol} fromDoc={fromDoc('insurance')} needsInput={needsInput('insurance')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InputField label="Quantity" value={form.quantity} onChange={(v) => updateField('quantity', v)} placeholder="0" type="text" fromDoc={fromDoc('quantity')} needsInput={needsInput('quantity')} />
              <SelectField label="Unit" value={form.unit} onChange={(v) => updateField('unit', v)} options={UNIT_OPTIONS} placeholder="Select unit" fromDoc={fromDoc('unit')} needsInput={needsInput('unit')} />
            </div>
            <SelectField label="Currency" value={form.input_currency} onChange={(v) => updateField('input_currency', v)} options={CURRENCY_OPTIONS} placeholder="Select currency" fromDoc={fromDoc('input_currency')} needsInput={false} />

            {exchangeRate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, marginBottom: 12 }}>
                <TrendingUp size={14} color="#3B82F6" />
                <span style={{ fontSize: 12, color: '#94A3B8' }}>1 {form.input_currency} = <strong style={{ color: '#3B82F6' }}>₹{exchangeRate.rate_inr?.toFixed(2)}</strong></span>
                <span style={{ fontSize: 10, color: '#64748B' }}>({exchangeRate.source})</span>
              </div>
            )}

            {/* Live CIF preview */}
            {(form.fob_cost || form.freight || form.insurance) && (() => {
              const cif = (parseFloat(form.fob_cost) || 0) + (parseFloat(form.freight) || 0) + (parseFloat(form.insurance) || 0);
              return (
                <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>CIF Preview</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22C55E', fontFamily: 'monospace' }}>
                    {fmtNumber(parseFloat(form.fob_cost)||0)} + {fmtNumber(parseFloat(form.freight)||0)} + {fmtNumber(parseFloat(form.insurance)||0)} = <span style={{ fontSize: 15 }}>{currSymbol}{fmtNumber(cif)}</span>
                  </div>
                </div>
              );
            })()}

            <div style={{ borderTop: '1px solid #1E293B', margin: '4px 0 16px' }} />

            <InputField label="HSN Code" value={form.hsn_code} onChange={(v) => updateField('hsn_code', v.replace(/\D/g, '').slice(0, 10))} placeholder="e.g. 85171290" type="text" fromDoc={fromDoc('hsn_code')} needsInput={needsInput('hsn_code')} />
            <SelectField label="Country of Origin" value={form.country_of_origin} onChange={(v) => updateField('country_of_origin', v)} options={COUNTRY_OPTIONS} placeholder="Select country" fromDoc={fromDoc('country_of_origin')} needsInput={needsInput('country_of_origin')} />
            <InputField label="Port of Import" value={form.port_of_import} onChange={(v) => updateField('port_of_import', v)} placeholder="e.g. INMAA1" type="text" fromDoc={fromDoc('port_of_import')} needsInput={needsInput('port_of_import')} />
          </div>

          <button onClick={handleCalculate} disabled={status === 'calculating'} style={{ width: '100%', marginTop: 20, padding: '14px 20px', fontSize: 14, fontWeight: 700, background: status === 'calculating' ? '#1E293B' : '#3B82F6', color: status === 'calculating' ? '#64748B' : '#fff', border: 'none', borderRadius: 10, cursor: status === 'calculating' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {status === 'calculating' ? <Loader2 size={18} /> : <Zap size={18} />}
            {status === 'calculating' ? 'Calculating…' : 'Calculate Duty'}
          </button>

          {error && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={16} color="#EF4444" />
              <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>
            </div>
          )}
        </div>

        {/* ── Right column: audit trail & visualization ── */}
        <div>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Toggle tabs */}
              <div style={{ display: 'flex', background: '#0D1120', borderRadius: 10, padding: 4, border: '1px solid #1E293B' }}>
                <button
                  onClick={() => setViewMode('summary')}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: viewMode === 'summary' ? '#1E293B' : 'transparent', color: viewMode === 'summary' ? '#E2E8F0' : '#64748B', transition: 'all 0.15s' }}
                >
                  <BarChart2 size={13} /> View Summary
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: viewMode === 'detailed' ? '#1E293B' : 'transparent', color: viewMode === 'detailed' ? '#E2E8F0' : '#64748B', transition: 'all 0.15s' }}
                >
                  <ClipboardList size={13} /> Detailed Calculation
                </button>
              </div>

              {/* Bar chart — always visible */}
              <div style={{ background: '#0F172A', borderRadius: 12, border: '1px solid #1E293B', padding: '14px 12px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                  <BarChart2 size={14} color="#3B82F6" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cost Breakdown (INR)</span>
                </div>
                <BarChart bars={chartBars} />
                {/* Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingTop: 6, paddingBottom: 4, flexWrap: 'wrap' }}>
                  {chartBars.map((b, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#94A3B8' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: b.color }} />
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Summary or Audit Trail */}
              {viewMode === 'summary'
                ? <SummaryView result={result} />
                : <AuditTrail form={form} result={result} />
              }

              {/* Open in BOE Filing — primary CTA */}
              <button
                onClick={handleOpenBOE}
                disabled={boeRedirecting}
                style={{
                  width: '100%', padding: '14px 20px',
                  fontSize: 14, fontWeight: 700,
                  background: boeRedirecting
                    ? '#1E293B'
                    : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  color: boeRedirecting ? '#64748B' : '#fff',
                  border: 'none', borderRadius: 10,
                  cursor: boeRedirecting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: boeRedirecting ? 'none' : '0 0 24px rgba(37,99,235,0.4)',
                  transition: 'all 0.2s',
                }}
              >
                {boeRedirecting
                  ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Opening BOE Filing…</>
                  : <><FileText size={18} /> Open in BOE Filing</>
                }
              </button>

              {/* Secondary actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleDownload} style={{ flex: 1, padding: '10px 16px', fontSize: 12, fontWeight: 600, background: '#1E293B', color: '#E2E8F0', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Download size={14} /> Download JSON
                </button>
                <button onClick={() => { setResult(null); setStatus('idle'); }} style={{ flex: 1, padding: '10px 16px', fontSize: 12, fontWeight: 600, background: 'transparent', color: '#64748B', border: '1px solid #1E293B', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <RefreshCw size={14} /> Reset
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 48, background: '#0F172A', borderRadius: 12, border: '1px solid #1E293B', textAlign: 'center' }}>
              <Calculator size={44} color="#1E293B" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#64748B', marginBottom: 8, marginTop: 18 }}>No Calculation Yet</h3>
              <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>Upload a document or fill in the form<br />and click Calculate Duty</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Legend + info footer ── */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, padding: '10px 16px', background: 'rgba(15,23,42,0.6)', borderRadius: 8, border: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Field Legend</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22C55E' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(34,197,94,0.2)', border: '1px solid #22C55E' }} /> Auto-filled from document
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#F59E0B' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(245,158,11,0.15)', border: '1px solid #F59E0B' }} /> Needs manual entry
          </span>
        </div>
        <div style={{ flex: 2, minWidth: 280, padding: 14, background: 'rgba(59,130,246,0.05)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Info size={14} color="#3B82F6" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>Calculation Flow</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 10, color: '#94A3B8' }}>
            <div><strong style={{ color: '#E2E8F0', display: 'block', marginBottom: 2 }}>CIF</strong>FOB + Freight + Insurance</div>
            <div><strong style={{ color: '#E2E8F0', display: 'block', marginBottom: 2 }}>AV</strong>CIF × Exchange Rate</div>
            <div><strong style={{ color: '#E2E8F0', display: 'block', marginBottom: 2 }}>BCD + SWS</strong>AV × Rate% + 10% of BCD</div>
            <div><strong style={{ color: '#E2E8F0', display: 'block', marginBottom: 2 }}>IGST</strong>(AV + BCD + SWS) × Rate%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
