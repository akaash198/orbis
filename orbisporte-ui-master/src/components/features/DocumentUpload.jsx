import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { documentService, m02Service } from '../../services/api';
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  X,
  File,
  Image,
  ArrowRight,
  FolderOpen,
  Cloud,
  Link,
  Search,
  FileSearch,
  Eye,
  RefreshCw,
  Clock3,
  AlertTriangle,
  Paperclip,
  Sparkles,
  Download,
  FileJson,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Input } from '../ui/Input';
import { Modal, Avatar, Alert } from '../ui';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers shared between DocumentUpload and the M02 panel
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { id: 'upload', icon: <Upload className="h-5 w-5" />, label: 'File Upload', description: 'Drag & drop or browse' },
  { id: 'email', icon: <Cloud className="h-5 w-5" />, label: 'Email Import', description: 'Import from email' },
  { id: 'api', icon: <Link className="h-5 w-5" />, label: 'API Integration', description: 'Connect external sources' },
  { id: 'folder', icon: <FolderOpen className="h-5 w-5" />, label: 'Folder Sync', description: 'Watch folder for files' },
];

const INITIAL_DOCS = [
  { id: 'd1', name: 'Invoice_INV2024_089.pdf', category: 'Commercial Invoice', source: 'Email Import', status: 'processed', label: 'Processed', updated: '2 min ago', size: '842 KB', type: 'application/pdf', owner: 'Asha Patel', confidence: 98, notes: 'HS code validated automatically.' },
  { id: 'd2', name: 'Packing_List_0432.pdf', category: 'Packing List', source: 'File Upload', status: 'processing', label: 'Processing', updated: '12 min ago', size: '1.3 MB', type: 'application/pdf', owner: 'Rohan Mehta', confidence: 92, notes: 'Pending review for quantity mismatch.' },
  { id: 'd3', name: 'Bill_of_Lading_9912.pdf', category: 'Bill of Lading', source: 'Folder Sync', status: 'pending', label: 'Pending', updated: '18 min ago', size: '1.1 MB', type: 'application/pdf', owner: 'Priya Shah', confidence: 95, notes: 'Ready for classification.' },
  { id: 'd4', name: 'Certificate_of_Origin.pdf', category: 'Certificate', source: 'API Integration', status: 'flagged', label: 'Flagged', updated: '41 min ago', size: '512 KB', type: 'application/pdf', owner: 'Nikhil Rao', confidence: 78, notes: 'Origin evidence requires attention.' },
];

const KEY_FIELD_META = {
  invoice_number:    { label: 'Invoice Number',    icon: '🧾' },
  invoice_date:      { label: 'Invoice Date',       icon: '📅' },
  exporter_name:     { label: 'Exporter Name',      icon: '🏭' },
  importer_name:     { label: 'Importer Name',      icon: '🏢' },
  gst_number:        { label: 'GST Number',         icon: '🔢' },
  shipment_address:  { label: 'Shipment Address',   icon: '📍' },
  hsn_code:          { label: 'HSN Code',           icon: '📦' },
  quantity:          { label: 'Quantity',            icon: '⚖️'  },
  unit_price:        { label: 'Unit Price',         icon: '💰' },
  total_value:       { label: 'Total Value',        icon: '💵' },
  country_of_origin: { label: 'Country of Origin', icon: '🌐' },
  freight:           { label: 'Freight',            icon: '🚢' },
  insurance:         { label: 'Insurance',          icon: '🛡️' },
};

const ESSENTIAL_FIELDS_META = {
  invoice_number:     { label: 'Invoice Number',     icon: '🧾', category: 'Document' },
  invoice_date:       { label: 'Invoice Date',      icon: '📅', category: 'Document' },
  exporter_name:     { label: 'Exporter Name',     icon: '🏭', category: 'Party' },
  exporter_address:   { label: 'Exporter Address',  icon: '🏭', category: 'Party' },
  importer_name:      { label: 'Importer Name',    icon: '🏢', category: 'Party' },
  importer_address:   { label: 'Importer Address',  icon: '🏢', category: 'Party' },
  gst_number:        { label: 'GST Number',        icon: '🔢', category: 'Identifiers' },
  iec_number:        { label: 'IEC Number',       icon: '🔢', category: 'Identifiers' },
  shipment_address:   { label: 'Shipment Address', icon: '📍', category: 'Location' },
  port_of_loading:   { label: 'Port of Loading',  icon: '📍', category: 'Location' },
  port_of_discharge: { label: 'Port of Discharge', icon: '📍', category: 'Location' },
  hsn_code:          { label: 'HSN Code',         icon: '🏷️', category: 'Product' },
  goods_description: { label: 'Goods Description', icon: '📦', category: 'Product' },
  quantity:          { label: 'Quantity',           icon: '⚖️', category: 'Financial' },
  unit:              { label: 'Unit',               icon: '⚖️', category: 'Financial' },
  unit_price:        { label: 'Unit Price',        icon: '💰', category: 'Financial' },
  currency:          { label: 'Currency',           icon: '💱', category: 'Financial' },
  total_value:       { label: 'Total Value',       icon: '💵', category: 'Financial' },
  freight:           { label: 'Freight',           icon: '🚢', category: 'Financial' },
  insurance:         { label: 'Insurance',          icon: '🛡️', category: 'Financial' },
  cif_value:         { label: 'CIF Value',         icon: '🛡️', category: 'Financial' },
  country_of_origin: { label: 'Country of Origin', icon: '🌐', category: 'Location' },
  incoterms:         { label: 'Incoterms',        icon: '📋', category: 'Document' },
  payment_terms:     { label: 'Payment Terms',     icon: '💳', category: 'Document' },
  bill_of_lading_number: { label: 'B/L Number',   icon: '🧾', category: 'Document' },
  awb_number:        { label: 'AWB Number',       icon: '🧾', category: 'Document' },
  shipment_date:     { label: 'Shipment Date',    icon: '📅', category: 'Document' },
};

const ESSENTIAL_FIELD_KEYS = [
  'invoice_number',
  'invoice_date',
  'exporter_name',
  'exporter_address',
  'importer_name',
  'importer_address',
  'gst_number',
  'iec_number',
  'shipment_address',
  'port_of_loading',
  'port_of_discharge',
  'hsn_code',
  'goods_description',
  'quantity',
  'unit',
  'unit_price',
  'currency',
  'total_value',
  'freight',
  'insurance',
  'cif_value',
  'country_of_origin',
  'incoterms',
  'payment_terms',
  'bill_of_lading_number',
  'awb_number',
  'shipment_date',
];

const POLL_MS = 2500;

function confBadgeStyle(score) {
  if (score == null) return { bg: 'rgba(255,255,255,0.04)', color: '#4A5A72', label: '—' };
  const pct = Math.round(score * 100);
  if (pct >= 85) return { bg: 'rgba(61,190,126,0.15)',   color: '#3DBE7E', label: `${pct}%` };
  if (pct >= 60) return { bg: 'rgba(201,165,32,0.18)',   color: '#E8C84A', label: `${pct}%` };
  return           { bg: 'rgba(240,112,112,0.15)', color: '#F07070', label: `${pct}%` };
}

function fmtVal(val) {
  if (val == null || val === '') return <span style={{ color: '#4A5A72', fontStyle: 'italic' }}>—</span>;
  if (typeof val === 'object') return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{JSON.stringify(val)}</span>;
  return String(val);
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileIcon(type) {
  if (type?.includes('pdf'))   return <FileText className="h-5 w-5 text-error" />;
  if (type?.includes('image')) return <Image    className="h-5 w-5 text-brand-accent" />;
  return <File className="h-5 w-5 text-text-muted" />;
}

const DOC_TYPE_META = {
  commercial_invoice: { label: 'Commercial Invoice', icon: '🧾' },
  packing_list: { label: 'Packing List', icon: '📦' },
  bill_of_lading: { label: 'Bill of Lading', icon: '🚢' },
  air_waybill: { label: 'Airway Bill', icon: '✈️' },
  purchase_order: { label: 'Purchase Order', icon: '🛒' },
  proforma_invoice: { label: 'Proforma Invoice', icon: '📋' },
  certificate_of_origin: { label: 'Certificate of Origin', icon: '📜' },
  letter_of_credit: { label: 'Letter of Credit', icon: '🏦' },
  customs_declaration: { label: 'Customs Declaration', icon: '🛃' },
  unknown: { label: 'Unknown Document', icon: '❓' },
};

function normalizeDocumentType(rawType) {
  if (!rawType) return 'unknown';
  
  const normalized = String(rawType)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (['commercial_invoice', 'invoice', 'tax_invoice', 'sales_invoice'].includes(normalized)) return 'commercial_invoice';
  if (['packing_list', 'packaging_list', 'packinglist', 'pack_list', 'weight_list'].includes(normalized)) return 'packing_list';
  if (['bill_of_lading', 'bl', 'b_l', 'hbl', 'mbl', 'obl'].includes(normalized)) return 'bill_of_lading';
  if (['air_waybill', 'airway_bill', 'airwaybill', 'awb', 'mawb', 'hawb'].includes(normalized)) return 'air_waybill';
  if (['purchase_order', 'po', 'p_o', 'purchase_order'].includes(normalized)) return 'purchase_order';
  if (['proforma_invoice', 'proforma', 'pi', 'pro_forma'].includes(normalized)) return 'proforma_invoice';
  if (['certificate_of_origin', 'cert_origin', 'form_a', 'gsp'].includes(normalized)) return 'certificate_of_origin';
  if (['letter_of_credit', 'lc', 'doc_credit'].includes(normalized)) return 'letter_of_credit';
  if (['customs_declaration', 'shipping_bill', 'bill_of_entry'].includes(normalized)) return 'customs_declaration';
  
  return normalized in DOC_TYPE_META ? normalized : 'unknown';
}

function getDocumentTypeUi(rawType, displayName, iconOverride) {
  const canonical = normalizeDocumentType(rawType || displayName);
  const meta = DOC_TYPE_META[canonical];
  const fallback = DOC_TYPE_META.unknown;
  const label = (displayName && String(displayName).trim()) || (meta?.label || fallback.label);
  const icon = iconOverride || meta?.icon || fallback.icon;
  return { canonical, label, icon };
}

const ESSENTIAL_FIELD_ALIASES = {
  invoice_number: [
    'invoice_number', 'invoice number', 'invoice no', 'invoice no.',
    'invoice #', 'invoice_num', 'inv no', 'inv_no', 'inv number',
    'invoice id', 'doc_number', 'ref_number', 'reference', 'invoice_num',
  ],
  invoice_date: [
    'invoice_date', 'invoice date', 'date of invoice', 'invoice dt',
    'inv date', 'inv_date', 'bill date', 'document_date', 'date',
    'issue_date', 'dated', 'date_issue', 'shipment_date', 'date_issue',
  ],
  exporter_name: [
    'exporter_name', 'exporter name', 'exporter', 'shipper', 'seller',
    'vendor', 'supplier_name', 'supplier', 'manufacturer', 'manufacturers',
    'manufacturer_name',
  ],
  exporter_address: [
    'exporter_address', 'exporter address', 'shipper_address', 'seller_address',
    'supplier_address', 'manufacturer_address',
  ],
  importer_name: [
    'importer_name', 'importer name', 'importer', 'buyer', 'consignee',
    'customer', 'buyer_name', 'consignee_name',
  ],
  importer_address: [
    'importer_address', 'importer address', 'buyer_address', 'consignee_address',
    'customer_address',
  ],
  gst_number: [
    'gst_number', 'gstin', 'gst no', 'gstin_no', 'gstin number',
    'tax_id', 'tax_number', 'gstin_no',
  ],
  iec_number: [
    'iec_number', 'iec', 'iec no', 'iec_no', 'import_export_code',
  ],
  shipment_address: [
    'shipment_address', 'shipment address', 'address', 'delivery_address',
    'final_destination', 'destination_address',
  ],
  port_of_loading: [
    'port_of_loading', 'loading_port', 'pol', 'port_loading', 'load_port',
    'port_of_loading', 'loading_point',
  ],
  port_of_discharge: [
    'port_of_discharge', 'discharge_port', 'pod', 'port_discharge',
    'discharge_point', 'destination_port',
  ],
  hsn_code: [
    'hsn_code', 'hsn', 'hs_code', 'hs code', 'tariff_code', 'tariff',
    'customs_code', 'hsn_no',
  ],
  goods_description: [
    'goods_description', 'description', 'product_description', 'product description',
    'item_description', 'item_desc', 'goods_desc', 'product', 'item',
  ],
  quantity: [
    'quantity', 'qty', 'number_of_units', 'units', 'pcs', 'pieces',
    'number_of_items', 'item_count', 'count', 'nos',
  ],
  unit: [
    'unit', 'uom', 'unit_of_measure', 'unit_of_measurement', 'measure',
  ],
  unit_price: [
    'unit_price', 'unit price', 'price_per_unit', 'rate', 'price',
    'per_unit_price', 'unit_rate', 'price_per_unit',
  ],
  currency: [
    'currency', 'curr', 'currency_code', 'currency_type', 'curr_code',
  ],
  total_value: [
    'total_value', 'total value', 'total_amount', 'invoice_value', 'invoice_amount',
    'amount', 'grand_total', 'total', 'net_amount', 'gross_value', 'invoice_total',
  ],
  country_of_origin: [
    'country_of_origin', 'country of origin', 'origin_country', 'origin',
    'manufacturing_country', 'made_in', 'country', 'origin_country',
  ],
  freight: [
    'freight', 'freight_charges', 'freight_amount', 'shipping_charges',
    'ocean_freight', 'air_freight', 'transport_charges', 'freight_cost',
  ],
  insurance: [
    'insurance', 'insurance_charges', 'insurance_amount', 'insurance_premium',
    'insurance_fee', 'insurance_cost',
  ],
  cif_value: [
    'cif_value', 'cif', 'cif_amount', 'cif_total',
  ],
  incoterms: [
    'incoterms', 'incoterm', 'terms', 'trade_terms', 'delivery_terms',
  ],
  payment_terms: [
    'payment_terms', 'payment', 'terms_of_payment', 'payment_condition',
  ],
  bill_of_lading_number: [
    'bill_of_lading_number', 'bl_number', 'bl_no', 'bol_number', 'b_l_number',
    'bill_of_lading', 'b/l',
  ],
  awb_number: [
    'awb_number', 'awb_no', 'airway_bill_number', 'airwaybill_number',
  ],
};

const normalizeFieldKey = (key) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function normalizeEssentialExtractedFields(rawFields) {
  if (!rawFields || typeof rawFields !== 'object') return {};

  const normalized = { ...rawFields };
  const keyValueMap = {};
  Object.entries(rawFields).forEach(([k, v]) => {
    keyValueMap[normalizeFieldKey(k)] = v;
  });

  Object.entries(ESSENTIAL_FIELD_ALIASES).forEach(([canonicalKey, aliases]) => {
    const current = normalized[canonicalKey];
    if (current !== undefined && current !== null && String(current).trim() !== '') return;

    for (const alias of aliases) {
      const match = keyValueMap[normalizeFieldKey(alias)];
      if (match !== undefined && match !== null && String(match).trim() !== '') {
        normalized[canonicalKey] = match;
        break;
      }
    }
  });

  return normalized;
}

function hasExtractedFieldData(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const normalised = payload.normalised_fields && typeof payload.normalised_fields === 'object'
    ? payload.normalised_fields
    : null;
  const extracted = payload.extracted_fields && typeof payload.extracted_fields === 'object'
    ? payload.extracted_fields
    : null;
  const combined = payload.fields && typeof payload.fields === 'object'
    ? payload.fields
    : null;
  const source = normalised || extracted || combined;
  if (!source) return false;
  return Object.keys(source).length > 0;
}

function buildResultFromEssential(essential) {
  const safe = essential && typeof essential === 'object' ? essential : {};
  const fields = safe.fields && typeof safe.fields === 'object' ? safe.fields : {};
  const lineItems = Array.isArray(safe.line_items) ? safe.line_items : [];
  const merged = { ...fields, line_items: lineItems };
  return {
    review_status: 'approved',
    review_queue: 'auto',
    document_type: safe.document_type || 'unknown',
    normalised_fields: merged,
    extracted_fields: merged,
    documents: [],
    document_types: [],
    page_classifications: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// M02 Extraction Panel
// ─────────────────────────────────────────────────────────────────────────────

function ExtractionModal({ doc, onClose, onNavigate }) {
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [error, setError]         = useState(null);
  const [dlBusy, setDlBusy]       = useState(false);
  const [jsonView, setJsonView]   = useState(false);
  const [hsnEditMode, setHsnEditMode] = useState(false);
  const [hsnEditValue, setHsnEditValue] = useState('');
  const pollRef                   = useRef(null);

  const docId = doc?._numericId ?? (isNaN(Number(doc?.id)) ? null : Number(doc?.id));

  const DEMO_ESSENTIAL_FIELDS = {
    invoice_number: 'INV-2024-0892',
    invoice_date: '2024-03-15',
    exporter_name: 'Shenzhen Electronics Co., Ltd.',
    importer_name: 'Orbisporte Global Trading Pvt Ltd',
    gst_number: '27AAACH1234C1ZA',
    shipment_address: '142, Industrial Area, Phase II, Navi Mumbai - 400701',
    hsn_code: '85171290',
    quantity: '5000',
    unit_price: 'USD 12.50',
    currency: 'USD',
    total_value: 'USD 62,500.00',
    country_of_origin: 'China',
    freight: 'USD 1,200.00',
  };

  const isProcessing = result?.review_status === 'processing';
  const hasResult    = result && !isProcessing && result.review_status !== 'error' && hasExtractedFieldData(result);
  const essentialFields = useMemo(() => {
    const raw = hasResult ? (result.fields || result.normalised_fields || result.extracted_fields || {}) : {};
    return normalizeEssentialExtractedFields(raw);
  }, [hasResult, result]);
  const detectedHsn   = essentialFields.hsn_code || null;
  const lineItems     = essentialFields.line_items || [];
  const docTypeUi     = getDocumentTypeUi(result?.document_type, result?.document_type_display, result?.document_type_icon);
  const detectedTypeList = Array.isArray(result?.document_types) ? result.document_types.map((t) => getDocumentTypeUi(t).label) : [];

  const jsonString = JSON.stringify(result, null, 2);

  useEffect(() => {
    if (!docId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    m02Service.getResult(docId)
      .then(r => {
        console.log('[ExtractionModal] Existing result:', r);
        setResult(r);
        if (r.review_status === 'processing') {
          setRunning(true);
          startPoll(docId);
        } else if (!r.normalised_fields && !r.extracted_fields) {
          console.log('[ExtractionModal] No fields found, triggering extraction');
          handleExtract();
        } else {
          console.log('[ExtractionModal] Fields found:', Object.keys(r.normalised_fields || r.extracted_fields || {}));
        }
      })
      .catch((err) => {
        console.error('[ExtractionModal] getResult error:', err);
        handleExtract();
      })
      .finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [docId]);

  const startPoll = useCallback((id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let pollCount = 0;
    const maxPolls = 60;
    pollRef.current = setInterval(async () => {
      pollCount++;
      try {
        const r = await m02Service.getResult(id);
        console.log('[ExtractionModal] Poll', pollCount, 'Result:', r?.review_status);
        setResult(r);
        if (r.review_status !== 'processing') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunning(false);
          console.log('[ExtractionModal] Extraction complete, fields:', r.normalised_fields || r.extracted_fields);
        } else if (pollCount >= maxPolls) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunning(false);
          setError('Extraction timed out');
        }
      } catch (pollErr) {
        console.error('[ExtractionModal] Poll error:', pollErr);
        if (pollCount >= maxPolls) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunning(false);
        }
      }
    }, 2500);
  }, []);

  const handleExtract = async () => {
    setRunning(true);
    setError(null);
    try {
      if (docId) {
        console.log('[ExtractionModal] Starting extraction for docId:', docId);
        const response = await m02Service.process(docId);
        console.log('[ExtractionModal] Extraction result:', response);
        
        // Check if response is synchronous (has normalised_fields) or background (needs polling)
        if (response.normalised_fields || response.extracted_fields) {
          // Synchronous extraction succeeded - use result directly
          setResult(response);
          setRunning(false);
        } else if (response.status === 'background') {
          // Background extraction started - poll for result
          setResult({ review_status: 'processing', review_queue: 'pending' });
          startPoll(docId);
        } else {
          // Unknown response format - treat as processing
          setResult(response);
          setRunning(false);
        }
      } else {
        await new Promise(r => setTimeout(r, 1500));
        setResult({ ...DEMO_ESSENTIAL_FIELDS, _demo: true, review_status: 'completed', document_type: 'commercial_invoice', document_type_display: 'Commercial Invoice', document_type_icon: '🧾' });
        setRunning(false);
      }
    } catch (err) {
      console.error('[ExtractionModal] Extraction error:', err);
      setRunning(false);
      setError(err?.response?.data?.detail || 'Extraction failed');
    }
  };

  const handleDownload = async () => {
    if (!docId) {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      triggerBlobDownload(blob, `extraction_${doc?.name || 'document'}.json`);
      return;
    }
    setDlBusy(true);
    try {
      const resp = await m02Service.exportJson(docId, false);
      const blob = new Blob([resp.data], { type: 'application/json' });
      triggerBlobDownload(blob, `m02_extraction_${docId}.json`);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Download failed');
    } finally {
      setDlBusy(false);
    }
  };

  const handleMoveToHSN = (hsnCode, goodsDesc) => {
    // Get product description from various possible sources
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
        description = essentialFields.goods_description || 
                     essentialFields.product_description ||
                     essentialFields.description ||
                     essentialFields.item_description ||
                     essentialFields.product ||
                     essentialFields.name || null;
      }
    }
    
    // Fallback to document name
    description = description || doc?.name || 'Document extraction';
    
    // Clean up the description - remove file extensions
    if (description) {
      description = description.replace(/\.(pdf|jpg|jpeg|png|tiff|tif)$/i, '').trim();
    }
    
    console.log('[HSN Navigation] Product description:', description, 'HSN:', hsnCode);
    onNavigate?.('hs-codes', { hsnCode, goodsDesc: description, navigationKey: Date.now(), documentId: docId });
    onClose();
  };

  const handleSaveHsn = () => {
    if (hsnEditValue && hsnEditValue.trim()) {
      // Get description for the HSN code (reuse the improved extraction logic)
      let description = essentialFields.goods_description || 
                       essentialFields.product_description ||
                       essentialFields.description ||
                       essentialFields.item_description ||
                       essentialFields.product || null;
      description = description || doc?.name || 'Manual entry';
      
      // Clean up the description - remove file extensions
      if (description) {
        description = description.replace(/\.(pdf|jpg|jpeg|png|tiff|tif)$/i, '').trim();
      }
      
      handleMoveToHSN(hsnEditValue.trim(), description);
    }
    setHsnEditMode(false);
  };

  return (
    <Modal
      open={Boolean(doc)}
      onClose={onClose}
      title={doc?.name || 'Document Extraction'}
      description="AI-powered extraction of essential fields"
      size="xl"
    >
      <div className="max-h-[60vh] overflow-y-auto pr-2">
        <div className="space-y-4">
          <div className="space-y-4">
            {(running || loading) && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Loader2 size={36} color="#C9A520" style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto' }} />
                <p style={{ fontSize: 13, color: '#8B97AE', marginTop: 12 }}>
                  {loading ? 'Loading document…' : 'Extracting essential fields…'}
                </p>
              </div>
            )}

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(240,112,112,0.08)', border: '1px solid rgba(240,112,112,0.2)', borderRadius: 8, fontSize: 12, color: '#F07070' }}>
                {error}
              </div>
            )}

            {!docId && !running && !hasResult && (
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #1E2638', borderRadius: 8, fontSize: 12, color: '#4A5A72', textAlign: 'center' }}>
                AI extraction is only available for documents saved in the system. Demo mode will be used.
              </div>
            )}

            {hasResult && (
              <>
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #1E2638' }}>
                <span style={{ fontSize: 20 }}>{docTypeUi.icon || result.document_type_icon || '📄'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#E2E8F5' }}>
                    {docTypeUi.label}
                  </p>
                </div>
                {!result._demo && detectedTypeList.length > 1 && (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(96,165,250,0.14)', color: '#9DC9FF', fontWeight: 600 }}>
                    {detectedTypeList.length} types
                  </span>
                )}
                {result._demo && (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(201,165,32,0.15)', color: '#E8C84A', fontWeight: 600 }}>
                    Demo
                  </span>
                )}
              </div>

            {!result._demo && detectedTypeList.length > 1 && (
              <p style={{ margin: '6px 2px 0', fontSize: 11, color: '#6E7E99' }}>
                Detected document types: {detectedTypeList.join(', ')}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setJsonView(false)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: `1px solid ${!jsonView ? 'rgba(201,165,32,0.4)' : '#1E2638'}`,
                  background: !jsonView ? 'rgba(201,165,32,0.1)' : 'transparent',
                  color: !jsonView ? '#C9A520' : '#4A5A72',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Sparkles size={12} /> Field View
              </button>
              <button
                type="button"
                onClick={() => setJsonView(true)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: `1px solid ${jsonView ? 'rgba(61,190,126,0.4)' : '#1E2638'}`,
                  background: jsonView ? 'rgba(61,190,126,0.1)' : 'transparent',
                  color: jsonView ? '#3DBE7E' : '#4A5A72',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <FileJson size={12} /> JSON View
              </button>
            </div>

            {!jsonView && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.entries(ESSENTIAL_FIELDS_META).map(([k, m]) => {
                  const value = essentialFields[k];
                  if (value == null || value === '') return null;
                  const isHsn = k === 'hsn_code';
                  return (
                    <div 
                      key={k} 
                      style={{ 
                        background: isHsn ? 'rgba(201,165,32,0.08)' : '#161D2C', 
                        border: isHsn ? '1px solid rgba(201,165,32,0.4)' : '1px solid #1E2638', 
                        borderRadius: 10, 
                        padding: '10px 12px',
                        position: 'relative',
                      }}
                    >
                      {isHsn && detectedHsn && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: 8,
                            background: essentialFields.hsn_source === 'auto_lookup' ? '#60A5FA' : '#E8C84A',
                            color: '#0A0D14',
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {essentialFields.hsn_source === 'auto_lookup' ? 'Auto' : 'Found'}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: isHsn ? '#E8C84A' : '#8B97AE', fontWeight: 600 }}>
                          {m.icon} {m.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isHsn ? '#E8C84A' : '#E2E8F5', wordBreak: 'break-word', fontFamily: isHsn ? 'monospace' : 'inherit' }}>
                        {fmtVal(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {lineItems.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5A72', margin: '12px 0 8px' }}>
                  Line Items ({lineItems.length})
                </p>
                <div style={{ background: '#0D1020', border: '1px solid #1E2638', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#111620' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4A5A72', fontWeight: 600 }}>#</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4A5A72', fontWeight: 600 }}>Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4A5A72', fontWeight: 600 }}>HSN</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4A5A72', fontWeight: 600 }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4A5A72', fontWeight: 600 }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid #1E2638' }}>
                          <td style={{ padding: '8px 12px', color: '#4A5A72' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', color: '#E2E8F5' }}>{item.description || item.goods_description || item.product_description || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#E8C84A', fontFamily: 'monospace' }}>{item.hsn_code || item.hs_code || '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#E2E8F5' }}>{item.quantity || '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#E2E8F5' }}>{item.unit_price || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {jsonView && (
              <div style={{ background: '#07090F', border: '1px solid #1E2638', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #1E2638', background: '#0D1020', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#4A5A72', fontFamily: 'monospace' }}>
                    extraction_result.json
                  </span>
                  <span style={{ fontSize: 10, color: '#3DBE7E', fontWeight: 600 }}>
                    {Object.keys(essentialFields).length} fields extracted
                  </span>
                </div>
                <div style={{ maxHeight: 380, overflowY: 'auto', padding: '14px 16px' }}>
                  <pre style={{
                    margin: 0, fontSize: 11.5, lineHeight: 1.7,
                    fontFamily: '"Fira Code", "Cascadia Code", monospace',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#E2E8F5',
                  }}>
                    {jsonString}
                  </pre>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: '1px solid #1E2638', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {detectedHsn ? (
                  hsnEditMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        value={hsnEditValue}
                        onChange={(e) => setHsnEditValue(e.target.value)}
                        placeholder="Enter HSN code"
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #1E2638',
                          background: '#0D1020',
                          color: '#E2E8F5',
                          fontSize: 13,
                          fontFamily: 'monospace',
                          width: 120,
                        }}
                      />
                      <Button variant="primary" size="sm" onClick={handleSaveHsn}>Save</Button>
                      <Button variant="secondary" size="sm" onClick={() => { setHsnEditMode(false); setHsnEditValue(detectedHsn); }}>Cancel</Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button
                        variant={essentialFields.hsn_source === 'auto_lookup' ? "info" : "warning"}
                        size="sm"
                        onClick={() => handleMoveToHSN(detectedHsn, '')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {essentialFields.hsn_source === 'auto_lookup' ? '🔍' : '🏷'}{' '}
                        {essentialFields.hsn_source === 'auto_lookup' ? 'Auto HSN: ' : 'Use HSN: '}{detectedHsn}
                        {essentialFields.hsn_confidence && (
                          <span style={{ fontSize: 10, opacity: 0.8 }}>
                            ({Math.round(essentialFields.hsn_confidence * 100)}%)
                          </span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setHsnEditMode(true); setHsnEditValue(detectedHsn); }}
                      >
                        ✏️
                      </Button>
                    </div>
                  )
                ) : (
                  <Button
                    variant="info"
                    size="sm"
                    onClick={() => handleMoveToHSN('', '')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    🔍 Search HSN Code
                  </Button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleDownload}
                  disabled={dlBusy}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {dlBusy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
                  Download JSON
                </Button>
              </div>
            </div>
              </>
            )}

            {result?.review_status === 'error' && (
              <div style={{ padding: '12px 14px', background: 'rgba(240,112,112,0.08)', border: '1px solid rgba(240,112,112,0.2)', borderRadius: 10, fontSize: 12, color: '#F07070' }}>
                Extraction failed. Click <strong>Extract</strong> to retry.
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Modal>
  );
}

function M02Panel({ documentId, documentName, onNavigate }) {
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [running, setRunning]     = useState(false);
  const [error, setError]         = useState(null);
  const [dlBusy, setDlBusy]       = useState(false);
  const [jsonView, setJsonView]   = useState(false);
  const [hsnEditMode, setHsnEditMode] = useState(false);
  const [hsnEditValue, setHsnEditValue] = useState('');
  const pollRef                   = useRef(null);
  const autoExtractTriggeredRef   = useRef(false);

  const startPoll = useCallback((docId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let pollCount = 0;
    const maxPolls = 60; // 60 polls * 2.5s = 150 seconds max wait
    pollRef.current = setInterval(async () => {
      pollCount++;
      try {
        const r = await m02Service.getResult(docId);
        console.log('[M02Panel] Poll', pollCount, '- Result:', JSON.stringify(r).substring(0, 200));
        setResult(r);
        if (r.review_status !== 'processing') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunning(false);
          console.log('[M02Panel] Extraction complete. Fields:', r.normalised_fields || r.extracted_fields);
        } else if (pollCount >= maxPolls) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunning(false);
          setError('Extraction timed out after 150 seconds');
        }
      } catch (pollErr) {
        console.error('[M02Panel] Poll error:', pollErr);
        if (pollCount >= maxPolls) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunning(false);
          setError('Failed to get extraction result');
        }
      }
    }, POLL_MS);
  }, []);

  const runAutoExtract = useCallback(async (docId) => {
    if (!docId || autoExtractTriggeredRef.current) return;
    autoExtractTriggeredRef.current = true;
    setRunning(true);
    setError(null);
    console.log('[M02Panel] Starting extraction for document:', docId);
    try {
      const response = await m02Service.process(docId);
      console.log('[M02Panel] Extraction result:', response);
      
      // Check if response is synchronous (has normalised_fields) or background (needs polling)
      if (response.normalised_fields || response.extracted_fields) {
        // Synchronous extraction succeeded - use result directly
        setResult(response);
        setRunning(false);
      } else if (response.status === 'background') {
        // Background extraction started - poll for result
        setResult({ review_status: 'processing', review_queue: 'pending' });
        startPoll(docId);
      } else {
        // Unknown response format - treat as processing
        setResult(response);
        setRunning(false);
      }
    } catch (err) {
      console.error('[M02Panel] process() failed:', err);
      try {
        const fallback = await m02Service.extractEssential(null, docId);
        const essential = fallback?.data || fallback;
        console.log('[M02Panel] Fallback result:', essential);
        setResult(buildResultFromEssential(essential));
        setRunning(false);
        setError(null);
      } catch (fallbackErr) {
        console.error('[M02Panel] extractEssential fallback failed:', fallbackErr);
        setRunning(false);
        setError(
          fallbackErr?.response?.data?.detail ||
          err?.response?.data?.detail ||
          'Failed to start extraction'
        );
      }
    }
  }, [startPoll]);

  useEffect(() => {
    if (!documentId) return;
    autoExtractTriggeredRef.current = false;
    setLoading(true);
    console.log('[M02Panel] Checking existing result for document:', documentId);
    m02Service.getResult(documentId)
      .then(r => {
        console.log('[M02Panel] Existing result:', JSON.stringify(r).substring(0, 300));
        setResult(r);
        if (r.review_status === 'processing') {
          console.log('[M02Panel] Extraction in progress, starting poll...');
          setRunning(true);
          startPoll(documentId);
        } else if (!hasExtractedFieldData(r)) {
          console.warn('[M02Panel] No extracted fields found, auto-triggering extraction', { documentId });
          runAutoExtract(documentId);
        } else {
          console.log('[M02Panel] Fields found:', Object.keys(r.normalised_fields || r.extracted_fields || {}));
        }
      })
      .catch((err) => {
        console.error('[M02Panel] getResult failed:', err);
        runAutoExtract(documentId);
      })
      .finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [documentId, startPoll]);

  const handleExtract = async () => {
    if (!documentId) return;
    setRunning(true);
    setError(null);
    try {
      await m02Service.process(documentId);
      setResult({ review_status: 'processing', review_queue: 'pending' });
      startPoll(documentId);
    } catch (err) {
      console.error('[M02Panel] manual process() failed, trying extractEssential fallback', err);
      try {
        const fallback = await m02Service.extractEssential(null, documentId);
        const essential = fallback?.data || fallback;
        setResult(buildResultFromEssential(essential));
        setRunning(false);
        setError(null);
      } catch (fallbackErr) {
        console.error('[M02Panel] manual extractEssential fallback failed', fallbackErr);
        setRunning(false);
        setError(
          fallbackErr?.response?.data?.detail ||
          err?.response?.data?.detail ||
          'Failed to start extraction'
        );
      }
    }
  };

  const handleDownload = async (keyOnly) => {
    if (!documentId) return;
    setDlBusy(true);
    try {
      const resp = await m02Service.exportJson(documentId, keyOnly);
      const blob = new Blob([resp.data], { type: 'application/json' });
      triggerBlobDownload(blob, `m02_extraction_${documentId}${keyOnly ? '_key_fields' : ''}.json`);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Download failed');
    } finally {
      setDlBusy(false);
    }
  };

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
        description = essentialFields.goods_description || 
                     essentialFields.product_description ||
                     essentialFields.description ||
                     essentialFields.item_description ||
                     essentialFields.product ||
                     essentialFields.name || null;
      }
    }
    
    // Fallback to document name
    description = description || documentName || 'Document extraction';
    
    // Clean up the description - remove file extensions
    if (description) {
      description = description.replace(/\.(pdf|jpg|jpeg|png|tiff|tif)$/i, '').trim();
    }
    
    console.log('[M02 HSN Navigation] Product description:', description, 'HSN:', hsnCode);
    onNavigate?.('hs-codes', { hsnCode, goodsDesc: description, navigationKey: Date.now(), documentId: documentId });
  };

  const handleSaveHsn = () => {
    if (hsnEditValue && hsnEditValue.trim()) {
      let description = essentialFields.goods_description || 
                       essentialFields.product_description ||
                       essentialFields.description ||
                       essentialFields.item_description ||
                       essentialFields.product || null;
      description = description || documentName || 'Manual entry';
      
      if (description) {
        description = description.replace(/\.(pdf|jpg|jpeg|png|tiff|tif)$/i, '').trim();
      }
      
      handleMoveToHSN(hsnEditValue.trim(), description);
    }
    setHsnEditMode(false);
  };

  const isProcessing = result?.review_status === 'processing';
  const hasResult    = result && !isProcessing && result.review_status !== 'error' && hasExtractedFieldData(result);
  const essentialFields = useMemo(() => {
    const raw = hasResult ? (result.fields || result.normalised_fields || result.extracted_fields || {}) : {};
    return normalizeEssentialExtractedFields(raw);
  }, [hasResult, result]);
  const detectedHsn   = essentialFields.hsn_code || null;
  const lineItems     = essentialFields.line_items || [];
  const fields        = essentialFields;

  const jsonString = JSON.stringify(result, null, 2);

  const statusColor  = result?.review_status === 'approved'  ? '#3DBE7E'
                     : result?.review_status === 'error'     ? '#F07070'
                     : result?.review_status === 'processing' ? '#C9A520'
                     : '#60A5FA';
  const docTypeUi = getDocumentTypeUi(result?.document_type, result?.document_type_display, result?.document_type_icon);
  const detectedTypeList = Array.isArray(result?.document_types) ? result.document_types.map((t) => getDocumentTypeUi(t).label) : [];

  return (
    <div style={{ background: '#0D1020', borderRadius: 14, border: '1px solid #1E2638', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #1E2638', background: '#111620' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(201,165,32,0.12)', border: '1px solid rgba(201,165,32,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={14} color="#C9A520" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#E2E8F5' }}>M02 AI Extraction</p>
          <p style={{ margin: 0, fontSize: 11, color: '#4A5A72' }}>OCR → GLiNER → Normalise → JSON</p>
        </div>
        {result && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
            background: `${statusColor}18`, color: statusColor, textTransform: 'capitalize',
            border: `1px solid ${statusColor}30`,
          }}>
            {result.review_status?.replace('_', ' ')}
          </span>
        )}
      </div>

      <div style={{ padding: 18 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B97AE', fontSize: 13, padding: '12px 0' }}>
            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Loading extraction result…
          </div>
        )}

        {!loading && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={running}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
              cursor: running ? 'not-allowed' : 'pointer',
              background: running ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,#C9A520,#A07C10)',
              color: running ? '#4A5A72' : '#0A0D14',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            {running
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running M02 Pipeline…</>
              : <><Zap size={14} /> {hasResult ? 'Re-run Extraction' : 'Extract Document'}</>}
          </button>
        )}

        {error && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(240,112,112,0.08)', border: '1px solid rgba(240,112,112,0.2)', borderRadius: 8, fontSize: 12, color: '#F07070' }}>
            {error}
          </div>
        )}

        {isProcessing && (
          <div style={{ marginTop: 14, padding: '14px 0', textAlign: 'center' }}>
            <Loader2 size={28} color="#C9A520" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 12, color: '#8B97AE', marginTop: 8 }}>
              OCR → Layout → Extract → GLiNER → Normalise → Score → Route
            </p>
          </div>
        )}

        {hasResult && (
          <div style={{ marginTop: 14 }}>
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #1E2638' }}>
                <span style={{ fontSize: 22 }}>{docTypeUi.icon || result.document_type_icon || '📄'}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#E2E8F5' }}>
                    {docTypeUi.label}
                  </p>
                </div>
                {result.overall_confidence != null && (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 10, color: '#4A5A72' }}>Overall</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: result.overall_confidence >= 0.85 ? '#3DBE7E' : result.overall_confidence >= 0.6 ? '#C9A520' : '#F07070' }}>
                      {Math.round(result.overall_confidence * 100)}%
                    </p>
                  </div>
                )}
              </div>

            {detectedTypeList.length > 1 && (
              <p style={{ margin: '6px 2px 0', fontSize: 11, color: '#6E7E99' }}>
                Detected document types: {detectedTypeList.join(', ')}
              </p>
            )}

            {/* Field View / JSON View Toggle */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setJsonView(false)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: `1px solid ${!jsonView ? 'rgba(201,165,32,0.4)' : '#1E2638'}`,
                  background: !jsonView ? 'rgba(201,165,32,0.1)' : 'transparent',
                  color: !jsonView ? '#C9A520' : '#4A5A72',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Sparkles size={12} /> Field View
              </button>
              <button
                type="button"
                onClick={() => setJsonView(true)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: `1px solid ${jsonView ? 'rgba(61,190,126,0.4)' : '#1E2638'}`,
                  background: jsonView ? 'rgba(61,190,126,0.1)' : 'transparent',
                  color: jsonView ? '#3DBE7E' : '#4A5A72',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <FileJson size={12} /> JSON View
              </button>
            </div>

            {!jsonView ? (
              <>
                {/* Essential Fields Grid - 12 Key Customs Fields */}
                <div style={{ marginTop: 14, background: '#161D2C', border: '1px solid #1E2638', borderRadius: 10, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F5', margin: 0 }}>
                        Essential Customs Fields
                      </p>
                      <p style={{ fontSize: 11, color: '#6E7E99', margin: '4px 0 0 0' }}>
                        These fields will be exported to JSON
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: '#3DBE7E', background: 'rgba(61,190,126,0.1)', padding: '4px 10px', borderRadius: 4, fontWeight: 600 }}>
                      {ESSENTIAL_FIELD_KEYS.filter(k => fields[k] != null && fields[k] !== '').length} of {ESSENTIAL_FIELD_KEYS.length} Found
                    </span>
                  </div>
                  
                  {/* Two Column Layout for Essential Fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {ESSENTIAL_FIELD_KEYS.map((key) => {
                      const meta = ESSENTIAL_FIELDS_META[key] || { label: key.replace(/_/g, ' '), icon: '📋' };
                      const value = fields[key];
                      const hasValue = value != null && value !== '';
                      const isHsn = key === 'hsn_code';
                      
                      return (
                        <div 
                          key={key} 
                          style={{ 
                            background: hasValue ? (isHsn ? 'rgba(201,165,32,0.08)' : 'rgba(255,255,255,0.03)') : 'transparent',
                            border: hasValue ? (isHsn ? '1px solid rgba(201,165,32,0.4)' : '1px solid #1E2638') : '1px dashed #2a3444',
                            borderRadius: 8, 
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasValue ? 4 : 0 }}>
                            <span style={{ fontSize: 14 }}>{meta.icon}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: isHsn ? '#E8C84A' : '#8B97AE' }}>
                              {meta.label}
                            </span>
                          </div>
                          {hasValue ? (
                            <div style={{ fontSize: 13, color: isHsn ? '#E8C84A' : '#E2E8F5', wordBreak: 'break-word', fontFamily: isHsn ? 'monospace' : 'inherit', fontWeight: 500 }}>
                              {fmtVal(value)}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#4A5A72', fontStyle: 'italic' }}>
                              Not found in document
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Extracted Fields (if any) */}
                {Object.keys(fields).filter(k => !ESSENTIAL_FIELD_KEYS.includes(k) && k !== 'line_items' && fields[k] != null && fields[k] !== '').length > 0 && (
                  <div style={{ marginTop: 14, background: '#161D2C', border: '1px solid #1E2638', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5A72', margin: '0 0 10px 0' }}>
                      Additional Fields ({Object.keys(fields).filter(k => !ESSENTIAL_FIELD_KEYS.includes(k) && k !== 'line_items' && fields[k] != null && fields[k] !== '').length})
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                      {Object.entries(fields).map(([key, value]) => {
                        if (ESSENTIAL_FIELD_KEYS.includes(key) || key === 'line_items' || value == null || value === '' || typeof value === 'object') return null;
                        const isHsn = key === 'hsn_code';
                        const fieldMeta = ESSENTIAL_FIELDS_META[key] || { icon: '📋' };
                        return (
                          <div 
                            key={key} 
                            style={{ 
                              background: isHsn ? 'rgba(201,165,32,0.08)' : '#0D1020', 
                              border: isHsn ? '1px solid rgba(201,165,32,0.4)' : '1px solid #1E2638', 
                              borderRadius: 8, 
                              padding: '8px 10px',
                            }}
                          >
                            <div style={{ fontSize: 10, color: isHsn ? '#E8C84A' : '#8B97AE', fontWeight: 600, marginBottom: 2 }}>
                              {fieldMeta.icon} {key.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: 12, color: isHsn ? '#E8C84A' : '#E2E8F5', wordBreak: 'break-word', fontFamily: isHsn ? 'monospace' : 'inherit' }}>
                              {fmtVal(value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Line Items */}
                {lineItems.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5A72', marginBottom: 8 }}>
                      Line Items ({lineItems.length})
                    </p>
                    <div style={{ background: '#0D1020', border: '1px solid #1E2638', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#111620' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4A5A72', fontWeight: 600 }}>#</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4A5A72', fontWeight: 600 }}>Description</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4A5A72', fontWeight: 600 }}>HSN</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4A5A72', fontWeight: 600 }}>Qty</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: '#4A5A72', fontWeight: 600 }}>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, idx) => (
                            <tr key={idx} style={{ borderTop: '1px solid #1E2638' }}>
                              <td style={{ padding: '8px 12px', color: '#4A5A72' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 12px', color: '#E2E8F5' }}>{item.description || item.goods_description || item.product_description || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#E8C84A', fontFamily: 'monospace' }}>{item.hsn_code || item.hs_code || '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#E2E8F5' }}>{item.quantity || '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#E2E8F5' }}>{item.unit_price || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* JSON View */
              <div style={{ marginTop: 14, background: '#07090F', border: '1px solid #1E2638', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #1E2638', background: '#0D1020', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileJson size={14} color="#3DBE7E" />
                    <span style={{ fontSize: 12, color: '#E2E8F5', fontWeight: 600 }}>
                      extraction_result.json
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: '#3DBE7E', fontWeight: 600 }}>
                    {Object.keys(fields).filter(k => k !== 'line_items').length} fields
                  </span>
                </div>
                <div style={{ maxHeight: 350, overflowY: 'auto', padding: '14px 16px' }}>
                  <pre style={{
                    margin: 0, fontSize: 11.5, lineHeight: 1.6,
                    fontFamily: '"Fira Code", "Cascadia Code", monospace',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#E2E8F5',
                  }}>
                    {jsonString}
                  </pre>
                </div>
              </div>
            )}

            {/* Prominent Download JSON Button Section */}
            <div style={{ marginTop: 14, padding: '14px', background: 'rgba(61,190,126,0.06)', border: '1px solid rgba(61,190,126,0.25)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(61,190,126,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileJson size={18} color="#3DBE7E" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#E2E8F5' }}>Download Extracted Data as JSON</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6E7E99' }}>
                      {ESSENTIAL_FIELD_KEYS.filter(k => fields[k] != null && fields[k] !== '').length} essential fields • {Object.keys(fields).filter(k => !ESSENTIAL_FIELD_KEYS.includes(k) && k !== 'line_items').length} additional fields
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(false)}
                  disabled={dlBusy || running}
                  style={{
                    padding: '10px 18px', borderRadius: 8,
                    border: 'none',
                    background: dlBusy || running ? 'rgba(61,190,126,0.3)' : 'linear-gradient(135deg,#3DBE7E,#2D9E6E)',
                    color: dlBusy || running ? 'rgba(226,232,245,0.5)' : '#0A0D14',
                    cursor: dlBusy || running ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                    boxShadow: dlBusy || running ? 'none' : '0 2px 8px rgba(61,190,126,0.3)',
                  }}
                >
                  {dlBusy ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
                  {dlBusy ? 'Generating...' : 'Download JSON'}
                </button>
              </div>
            </div>

            {/* HSN Code Section - Use or Search */}
            <div style={{ marginTop: 12, padding: '14px', background: '#161D2C', border: '1px solid #1E2638', borderRadius: 10 }}>
              <p style={{ margin: '0 0 12px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5A72' }}>
                HSN Code Lookup
              </p>
              {detectedHsn ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(201,165,32,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18 }}>🏷️</span>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#E8C84A' }}>HSN Code Found: {detectedHsn}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#6E7E99' }}>
                        {essentialFields.hsn_source === 'auto_lookup' ? 'Auto-detected' : 'Extracted from document'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMoveToHSN(detectedHsn, '')}
                    style={{
                      padding: '10px 16px', borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg,#C9A520,#A07C10)',
                      color: '#0A0D14',
                      cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 2px 8px rgba(201,165,32,0.3)',
                    }}
                  >
                    Use this HSN Code
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18 }}>🔍</span>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#60A5FA' }}>No HSN Code Found</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#6E7E99' }}>
                        Search based on product description
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMoveToHSN('', '')}
                    style={{
                      padding: '10px 16px', borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg,#60A5FA,#3B82F6)',
                      color: '#0A0D14',
                      cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 2px 8px rgba(96,165,250,0.3)',
                    }}
                  >
                    Search HSN Code
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {detectedHsn && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1E2638' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      value={hsnEditValue}
                      onChange={(e) => setHsnEditValue(e.target.value)}
                      placeholder="Enter different HSN code"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #1E2638',
                        background: '#0D1020',
                        color: '#E2E8F5',
                        fontSize: 13,
                        fontFamily: 'monospace',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveHsn}
                      disabled={!hsnEditValue.trim()}
                      style={{
                        padding: '8px 14px', borderRadius: 6, border: 'none',
                        background: hsnEditValue.trim() ? '#3DBE7E' : 'rgba(61,190,126,0.3)',
                        color: hsnEditValue.trim() ? '#0A0D14' : 'rgba(226,232,245,0.5)',
                        fontSize: 12, fontWeight: 700, cursor: hsnEditValue.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Use Custom HSN
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {result?.review_status === 'error' && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(240,112,112,0.08)', border: '1px solid rgba(240,112,112,0.2)', borderRadius: 10, fontSize: 12, color: '#F07070' }}>
            Extraction failed. Click <strong>Extract</strong> to retry.
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document row in the repository table
// ─────────────────────────────────────────────────────────────────────────────

function DocRow({ doc, onPreview, onDelete, onExtract, isDeleting }) {
  const variant = doc.status === 'processed' ? 'success' : doc.status === 'flagged' ? 'error' : doc.status === 'processing' ? 'warning' : 'info';
  return (
    <tr className="group border-b border-[#1E2638]/50 hover:bg-[#1C2438]/40 transition-all duration-150">
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D1020] border border-[#273047] text-[#C9A520] group-hover:border-[#C9A520]/40 group-hover:shadow-[0_0_12px_rgba(201,165,32,0.12)] transition-all">
            {fileIcon(doc.type)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[#E2E8F5] leading-tight">{doc.name}</p>
            <p className="mt-0.5 text-[12px] font-medium text-[#4A5A72]">{doc.category}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4A5A72]" />
          <span className="text-[13px] font-medium text-[#8B97AE]">{doc.source}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant={variant} dot>{doc.label}</Badge>
      </td>
      <td className="px-6 py-4 text-[13px] font-medium text-[#8B97AE]">{doc.updated}</td>
      <td className="px-6 py-4">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onExtract(doc)} className="h-8 px-3 gap-1.5 text-[#C9A520] bg-[#C9A520]/10 hover:bg-[#C9A520]/20 border border-[#C9A520]/20 rounded-lg text-xs font-bold" title="Extract Document">
            <Zap className="h-3.5 w-3.5" /> Extract
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onPreview(doc)} className="h-8 w-8 p-0 text-[#8B97AE] hover:text-[#C9A520] hover:bg-[#C9A520]/10" title="Preview Document">
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(doc.id, doc.name)} 
            disabled={isDeleting}
            className="h-8 w-8 p-0 text-[#8B97AE] hover:text-[#E05656] hover:bg-[#E05656]/10 disabled:opacity-40" 
            title="Delete Document"
          >
            {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <X className="h-4.5 w-4.5" />}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DocumentUpload page
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentUpload({ onNavigate, initialDocumentId }) {
  const [documents, setDocuments]         = useState(INITIAL_DOCS);
  const [files, setFiles]                 = useState([]);
  const [uploadSource, setUploadSource]   = useState('upload');
  const [searchTerm, setSearchTerm]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [extractTarget, setExtractTarget] = useState(null);
  const [mode, setMode]                   = useState('repository');
  const [uploading, setUploading]         = useState(false);
  const [deleting, setDeleting]           = useState(null);
  const fileInputRef = useRef(null);
  const lastAutoOpenIdRef = useRef(null);

  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Delete document handler - calls backend API
  const handleDeleteDocument = async (docId, docName) => {
    if (!window.confirm(`Permanently delete "${docName}"?\n\nThis will remove the document from the database and data lake.`)) {
      return;
    }
    setDeleting(docId);
    
    // Check if it's a demo/mock document (IDs like 'd1', 'd2', etc.)
    const isMockDoc = /^d\d+$/.test(docId);
    
    try {
      if (isMockDoc) {
        // For demo documents, just remove from local state
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      } else {
        // For real documents, call the backend API
        await documentService.deleteDocument(docId);
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
      if (selectedDocument?.id === docId) {
        setSelectedDocument(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err?.response?.data?.detail || 'Failed to delete document. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  // Load real documents from backend
  useEffect(() => {
    documentService.getAllDocuments()
      .then((docs) => {
        if (Array.isArray(docs) && docs.length > 0) {
          const mapped = docs.map((d) => ({
            id: String(d.id),
            _numericId: d.id,        // keep numeric id for M02 API calls
            name: d.original_filename || d.filename,
            category: getDocumentTypeUi(d.doc_type).label,
            source: 'File Upload',
            status: d.processing_status === 'extracted' || d.processing_status === 'completed'
              ? 'processed'
              : d.processing_status === 'uploaded'
              ? 'pending'
              : 'processing',
            label: d.processing_status === 'extracted' || d.processing_status === 'completed'
              ? 'Processed'
              : d.processing_status === 'uploaded'
              ? 'Pending'
              : 'Processing',
            updated: d.created_at ? new Date(d.created_at).toLocaleString() : '',
            size: '',
            type: d.file_type || 'application/pdf',
            owner: '',
            confidence: 0,
            notes: '',
          }));
          setDocuments(mapped);

          // initialDocumentId handling is done in the dedicated effect below.
        }
      })
      .catch((err) => {
        console.error('[DocumentUpload] getAllDocuments failed, using local fallback list', err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialDocumentId) return;
    const idStr = String(initialDocumentId);
    if (lastAutoOpenIdRef.current === idStr) return;
    const match = documents.find(
      (d) => String(d._numericId ?? d.id) === idStr
    );
    if (!match) return;

    lastAutoOpenIdRef.current = idStr;
    setMode('repository');
    setSelectedDocument(match);
    console.log('[DocumentUpload] Auto-opened document from redirect and triggered extraction panel', {
      initialDocumentId: idStr,
      matchedDocumentId: match._numericId ?? match.id,
    });
  }, [initialDocumentId, documents]);

  const filtered = useMemo(() => documents.filter((doc) => {
    const q = searchTerm.trim().toLowerCase();
    const matches = !q || [doc.name, doc.category, doc.source].some((v) => v.toLowerCase().includes(q));
    const statusMatch = statusFilter === 'all' || doc.status === statusFilter;
    return matches && statusMatch;
  }), [documents, searchTerm, statusFilter]);

  const kpis = [
    { label: 'Total Documents',  value: documents.length,                                         icon: <FileText    className="h-5 w-5 text-brand-accent" /> },
    { label: 'Processed',        value: documents.filter(d => d.status === 'processed').length,   icon: <CheckCircle2 className="h-5 w-5 text-success" /> },
    { label: 'Pending Review',   value: documents.filter(d => d.status === 'processing' || d.status === 'pending').length, icon: <Clock3 className="h-5 w-5 text-warning" /> },
    { label: 'Flagged',          value: documents.filter(d => d.status === 'flagged').length,     icon: <AlertTriangle className="h-5 w-5 text-error" /> },
  ];

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = (incoming) => {
    const mapped = incoming.map((file) => ({
      id: Math.random().toString(36).slice(2, 9),
      name: file.name,
      size: formatSize(file.size),
      type: file.type || 'application/pdf',
      progress: 0,
      status: 'pending',
      _file: file, // Store the actual File object for upload
    }));
    setFiles((prev) => [...prev, ...mapped]);
    setMode('upload');
  };

  const uploadInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept=".pdf,.jpg,.jpeg,.png,.tiff"
      className="hidden"
      id="document-upload-input"
      onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
    />
  );

  // Numeric document ID for M02 panel (works for both real and mock docs)
  const m02DocId = selectedDocument?._numericId
    ?? (isNaN(Number(selectedDocument?.id)) ? null : Number(selectedDocument?.id));

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-background-secondary via-surface to-background-secondary p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-tiny font-semibold text-brand-accent">
              <Paperclip className="h-3.5 w-3.5" /> Document Management
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-text-primary sm:text-4xl">
              Repository, upload, and AI extraction in one place
            </h1>
            <p className="mt-3 max-w-2xl text-body text-text-secondary">
              Manage customs documents, monitor status, preview extracted data, and download structured JSON without leaving the workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setDocuments(INITIAL_DOCS)}>Reset Demo Data</Button>
            <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setMode('upload')}>Upload Documents</Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} hover className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-label font-medium text-text-secondary">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">{kpi.value}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-surface">{kpi.icon}</div>
            </div>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant={mode === 'repository' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('repository')}>Repository</Button>
          <Button variant={mode === 'upload' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('upload')}>Upload Queue</Button>
          <Button variant={mode === 'workflow' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('workflow')}>Workflow</Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">204 files this month</Badge>
          <Badge variant="success" dot>Sync healthy</Badge>
        </div>
      </div>

      {mode === 'repository' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-8 xl:col-span-8">
            <Card hover>
              <CardHeader className="border-b border-border/60">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div><CardTitle>Document Repository</CardTitle><CardDescription className="mt-1">Search, filter, and open documents for AI extraction.</CardDescription></div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search documents..." icon={<Search className="h-4 w-4" />} />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary">
                      <option value="all">All Status</option>
                      <option value="processed">Processed</option>
                      <option value="processing">Processing</option>
                      <option value="pending">Pending</option>
                      <option value="flagged">Flagged</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile cards */}
                <div className="grid gap-3 px-4 py-4 md:hidden">
                  {filtered.map((doc) => (
                    <article key={doc.id} className="rounded-2xl border border-border bg-background-secondary/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-accent/10">{fileIcon(doc.type)}</div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">{doc.name}</p>
                            <p className="text-xs text-text-tertiary">{doc.category}</p>
                          </div>
                        </div>
                        <Badge variant={(doc.status === 'processed' ? 'success' : doc.status === 'flagged' ? 'error' : doc.status === 'processing' ? 'warning' : 'info')}>{doc.label}</Badge>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" icon={<Zap className="h-4 w-4" />} onClick={() => setExtractTarget(doc)} className="text-[#C9A520] bg-[#C9A520]/10 border border-[#C9A520]/20">Extract</Button>
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => setSelectedDocument(doc)}>Open</Button>
                        <button type="button" onClick={() => handleDeleteDocument(doc.id, doc.name)} disabled={deleting === doc.id} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-subtle hover:text-red-500 disabled:opacity-40" aria-label={`Delete ${doc.name}`}>
                          {deleting === doc.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        </button>
                      </div>
                    </article>
                  ))}
                  {!filtered.length && <div className="rounded-2xl border border-border bg-surface-subtle px-4 py-10 text-center text-sm text-text-secondary">No documents match the current filters.</div>}
                </div>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full table-fixed border-collapse">
                    <thead className="bg-[#0D1020]">
                      <tr className="border-b border-[#273047]">
                        <th className="w-[35%] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Document</th>
                        <th className="w-[18%] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Source</th>
                        <th className="w-[15%] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Status</th>
                        <th className="w-[17%] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Updated</th>
                        <th className="w-[15%] px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((doc) => <DocRow key={doc.id} doc={doc} onPreview={setSelectedDocument} onDelete={handleDeleteDocument} onExtract={setExtractTarget} isDeleting={deleting === doc.id} />)}
                      {!filtered.length && (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-text-secondary">No documents match the current filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card hover>
              <CardHeader>
                <CardTitle>Upload Sources</CardTitle>
                <CardDescription>Choose how new documents enter the system.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {SOURCE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setUploadSource(option.id)}
                      className={`rounded-xl border p-6 text-left transition-all duration-200 ${uploadSource === option.id ? 'border-brand-accent/30 bg-brand-accent/10 text-text-primary' : 'border-border bg-surface text-text-secondary hover:border-border-accent hover:bg-surface-subtle'}`}
                    >
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand/15 text-brand-accent">{option.icon}</div>
                      <h4 className="text-sm font-semibold">{option.label}</h4>
                      <p className="mt-1 text-body-sm text-text-secondary">{option.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 xl:col-span-4">
            <Card hover>
              <CardHeader>
                <CardTitle>Repository Health</CardTitle>
                <CardDescription>Current upload and processing posture.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-text-secondary">Processing Rate</span><span className="font-semibold text-text-primary">94%</span></div><Progress value={94} variant="success" /></div>
                <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-text-secondary">Manual Review</span><span className="font-semibold text-text-primary">12%</span></div><Progress value={12} variant="warning" /></div>
                <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-text-secondary">Flagged Docs</span><span className="font-semibold text-text-primary">5%</span></div><Progress value={5} variant="error" /></div>
              </CardContent>
            </Card>
            <Alert variant="info" title="Upload Tip">Use the upload queue to batch documents before routing them into classification or review.</Alert>
            <Card hover>
              <CardHeader><CardTitle>Quick Actions</CardTitle><CardDescription>Actions for the selected document.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Button variant="secondary" className="w-full" icon={<FileSearch className="h-4 w-4" />}>Classify Document</Button>
                <Button variant="secondary" className="w-full" icon={<ArrowRight className="h-4 w-4" />} onClick={() => onNavigate?.('hs-codes')}>Go to HS Code Lookup</Button>
                <Button variant="secondary" className="w-full" icon={<Sparkles className="h-4 w-4" />} onClick={() => onNavigate?.('m02-extraction')}>M02 Extraction Page</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Card hover>
              <CardHeader><CardTitle>Upload Queue</CardTitle><CardDescription>Drag and drop files, then run bulk processing.</CardDescription></CardHeader>
              <CardContent>
                <div className="rounded-2xl border-2 border-dashed border-border bg-background-secondary/50 p-8 text-center hover:border-border-accent hover:bg-surface-subtle" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand-accent"><Upload className="h-8 w-8" /></div>
                  <h3 className="text-lg font-semibold text-text-primary">Drop documents here</h3>
                  <p className="mt-2 text-body-sm text-text-secondary">PDF, JPG, PNG, and TIFF are supported.</p>
                  <div className="mt-5"><Button variant="secondary" onClick={triggerFileInput} className="cursor-pointer">Browse Files</Button>{uploadInput}</div>
                </div>
              </CardContent>
            </Card>
            <Card hover>
              <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Current Batch</CardTitle><CardDescription>Files waiting to be processed.</CardDescription></div><Button variant="ghost" size="sm" onClick={() => setFiles([])}>Clear Batch</Button></CardHeader>
              <CardContent className="space-y-3">
                {!files.length ? <div className="rounded-xl border border-border bg-surface-subtle px-4 py-10 text-center text-sm text-text-secondary">No files in the upload queue yet.</div> : files.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                    {fileIcon(file.type)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
                      <p className="text-xs text-text-tertiary">{file.size}</p>
                      <div className="mt-2"><Progress value={file.progress} variant={file.status === 'completed' ? 'success' : 'default'} /></div>
                    </div>
                    <Badge variant={file.status === 'completed' ? 'success' : 'info'}>{file.status === 'completed' ? 'Done' : 'Queued'}</Badge>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-subtle hover:text-text-primary" aria-label={`Remove ${file.name}`}><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </CardContent>
              <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                <Button variant="secondary" onClick={() => setMode('repository')}>Back to Repository</Button>
                <Button
                  onClick={async () => {
                    if (!files.length) return;
                    setUploading(true);
                    setFiles((prev) => prev.map((f) => ({ ...f, progress: 10, status: 'processing' })));
                    
                    try {
                      // Upload each file to backend
                      const uploadedDocs = [];
                      for (let i = 0; i < files.length; i++) {
                        const f = files[i];
                        setFiles((prev) => prev.map((file) => file.id === f.id ? { ...file, progress: 30 } : file));
                        
                        try {
                          // Get the actual File object from the files array
                          const fileObj = f._file;
                          if (fileObj) {
                            const result = await documentService.uploadDocument(fileObj);
                            uploadedDocs.push({
                              id: String(result.id),
                              _numericId: result.id,
                              name: f.name,
                              category: 'Imported Document',
                              source: SOURCE_OPTIONS.find((s) => s.id === uploadSource)?.label || 'File Upload',
                              status: 'processed', 
                              label: 'Processed',
                              updated: new Date().toLocaleString(),
                              size: f.size, 
                              type: f.type,
                              owner: 'Current User', 
                              confidence: 96,
                              notes: 'Imported and ready for extraction.',
                            });
                          }
                        } catch (uploadErr) {
                          console.error('Upload error:', uploadErr);
                          // Still add to list even if upload fails (for demo purposes)
                          uploadedDocs.push({
                            id: f.id,
                            name: f.name,
                            category: 'Imported Document',
                            source: SOURCE_OPTIONS.find((s) => s.id === uploadSource)?.label || 'File Upload',
                            status: 'processed', 
                            label: 'Processed',
                            updated: new Date().toLocaleString(),
                            size: f.size, 
                            type: f.type,
                            owner: 'Current User', 
                            confidence: 96,
                            notes: 'Imported (demo mode).',
                          });
                        }
                        
                        setFiles((prev) => prev.map((file) => file.id === f.id ? { ...file, progress: 100, status: 'completed' } : file));
                      }
                      
                      // Add uploaded documents to the registry
                      setDocuments((prev) => [...prev, ...uploadedDocs]);
                    } catch (err) {
                      console.error('Upload batch error:', err);
                    } finally {
                      setUploading(false);
                      setFiles([]);
                      setMode('repository');
                    }
                  }}
                  disabled={!files.length || uploading}
                  icon={<Loader2 className={`h-4 w-4 ${uploading ? 'animate-spin' : ''}`} />}
                >
                  {uploading ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </Card>
          </div>
          <div className="space-y-6 xl:col-span-4">
            <Card hover><CardHeader><CardTitle>Batch Metadata</CardTitle><CardDescription>Source and workflow context.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Upload Source</p><p className="mt-1 text-sm font-medium text-text-primary">{SOURCE_OPTIONS.find((o) => o.id === uploadSource)?.label}</p></div><div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Batch Size</p><p className="mt-1 text-sm font-medium text-text-primary">{files.length} file(s)</p></div><div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Status</p><p className="mt-1 text-sm font-medium text-text-primary">{uploading ? 'Processing' : 'Ready'}</p></div></CardContent></Card>
            <Alert variant="warning" title="Tip">Use batch upload for invoices and packing lists before extracting HS codes.</Alert>
          </div>
        </div>
      )}

      {mode === 'workflow' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card hover><CardHeader><CardTitle>Workflow Stages</CardTitle><CardDescription>Document lifecycle from intake to review.</CardDescription></CardHeader><CardContent className="space-y-4">{[{ label: 'Ingest', value: 100 }, { label: 'Classify', value: 94 }, { label: 'Extract', value: 88 }, { label: 'Review', value: 42 }].map((stage) => <div key={stage.label}><div className="mb-1 flex items-center justify-between text-sm"><span className="text-text-secondary">{stage.label}</span><span className="font-medium text-text-primary">{stage.value}%</span></div><Progress value={stage.value} /></div>)}</CardContent></Card>
          <Card hover><CardHeader><CardTitle>Operational Notes</CardTitle><CardDescription>What the team should watch next.</CardDescription></CardHeader><CardContent className="space-y-3"><Alert variant="info" title="Auto Routing">Documents from email and folder sync are routed into the repository automatically.</Alert><Alert variant="success" title="Preview Ready">Open any processed document to inspect the extracted metadata side by side.</Alert></CardContent></Card>
        </div>
      )}

      {/* ── Extraction Modal ───────────────────────────────────────────────── */}
      <ExtractionModal doc={extractTarget} onClose={() => setExtractTarget(null)} onNavigate={onNavigate} />

      {/* ── Document Detail Modal ──────────────────────────────────────────── */}
      <Modal
        open={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
        title={selectedDocument?.name}
        description={selectedDocument ? `${selectedDocument.category}${selectedDocument.owner ? ` · ${selectedDocument.owner}` : ''}` : undefined}
        size="xl"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {selectedDocument?.owner && (
                <>
                  <Avatar name={selectedDocument.owner} />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{selectedDocument.owner}</p>
                    {selectedDocument.confidence > 0 && (
                      <p className="text-xs text-text-tertiary">Confidence {selectedDocument.confidence}%</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setSelectedDocument(null)}>Close</Button>
              <Button onClick={() => onNavigate?.('hs-codes')} icon={<ArrowRight className="h-4 w-4" />} iconPosition="right">HS Code Lookup</Button>
            </div>
          </div>
        }
      >
        {selectedDocument && (
          <div className="space-y-5">
            {/* Document metadata */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Status</p>
                <p className="mt-1 text-sm font-medium text-text-primary">{selectedDocument.label}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Updated</p>
                <p className="mt-1 text-sm font-medium text-text-primary">{selectedDocument.updated}</p>
              </div>
              {selectedDocument.confidence > 0 && (
                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Confidence</p>
                  <p className="mt-1 text-sm font-medium text-text-primary">{selectedDocument.confidence}%</p>
                </div>
              )}
              {selectedDocument.size && (
                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Size</p>
                  <p className="mt-1 text-sm font-medium text-text-primary">{selectedDocument.size}</p>
                </div>
              )}
            </div>

            {selectedDocument.notes && (
              <div className="rounded-2xl border border-border bg-background-secondary p-4">
                <p className="text-sm font-medium text-text-primary">Notes</p>
                <p className="mt-2 text-body-sm text-text-secondary">{selectedDocument.notes}</p>
              </div>
            )}

            {/* ── M02 Extraction Panel ─────────────────────────────────── */}
            {m02DocId ? (
              <M02Panel documentId={m02DocId} documentName={selectedDocument.name} onNavigate={onNavigate} />
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-text-secondary">
                AI extraction is only available for documents saved in the system.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
