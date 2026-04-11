/**
 * DocumentPreviewModal Component
 * 
 * Modal for previewing documents with extracted data side by side.
 * Supports PDF, JPG, JPEG, PNG files with 200MB size limit.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import theme from '../../styles/theme';
import BarcodeViewer from './BarcodeViewer';
import { hsCodeService, documentService } from '../../services/api';

// File validation constants
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes

const normalizeMimeType = (value = '') => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'pdf' || v === '.pdf') return 'application/pdf';
  if (v === 'jpg' || v === 'jpeg' || v === '.jpg' || v === '.jpeg') return 'image/jpeg';
  if (v === 'png' || v === '.png') return 'image/png';
  return v;
};

// Styled components
const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  opacity: 0;
  transform: scale(0.95);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);

  &.visible {
    opacity: 1;
    transform: scale(1);
  }
`;

const ModalContent = styled.div`
  background: ${theme.colors.ui.background};
  border-radius: ${theme.radius.lg}px;
  border: 1px solid ${theme.colors.ui.borderLight};
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  position: relative;
  z-index: 2147483647;
  width: 90%;
  height: 90%;
  max-width: 1400px;
  max-height: 900px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  transform: translateY(20px);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  .visible & {
    transform: translateY(0);
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  border-bottom: 1px solid ${theme.colors.ui.borderLight};
  position: relative;
`;

const ModalTitle = styled.h3`
  margin: 0;
  color: ${theme.colors.text.primary};
  font-weight: ${theme.typography.fontWeight.semibold};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  
  &::before {
    content: '📄';
    font-size: 1.2em;
  }
`;

const CloseButton = styled.button`
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.borderLight};
  color: ${theme.colors.text.primary}; /* Make X always visible */
  font-size: ${theme.typography.fontSize.lg};
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  transition: all 0.2s ease-out;
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  
  &:hover {
    background: ${theme.colors.ui.hover};
    color: ${theme.colors.primary.light};
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 12px ${theme.colors.primary.main}40;
    transform: translateY(-50%) scale(1.05);
    /* Glow effect for the X */
    text-shadow: 0 0 8px ${theme.colors.primary.main}, 0 0 12px ${theme.colors.primary.light};
  }
  
  &:active {
    transform: translateY(-50%) scale(0.95);
  }
  
  /* Render the X as regular content so it's always visible and accessible */
`;

const ModalBody = styled.div`
  display: grid;
  grid-template-columns: ${props => props.splitView ? '1fr 1fr' : '1fr'};
  gap: ${theme.spacing.lg}px;
  padding: ${theme.spacing.lg}px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const ModalFooter = styled.div`
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  border-top: 1px solid ${theme.colors.ui.borderLight};
  display: flex;
  justify-content: flex-end;
  gap: ${theme.spacing.sm}px;
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
`;

const DocumentPreviewPane = styled.div`
  height: 100%;
  overflow: auto;
  padding: ${theme.spacing.md}px;
  border-radius: ${theme.radius.md}px;
  background: rgba(0, 0, 0, 0.2);
`;

const ExtractionDataPane = styled.div`
  height: 100%;
  overflow: auto;
  padding: 0;
  border-radius: ${theme.radius.md}px;
  background: var(--t-bg-dark);
  display: flex;
  flex-direction: column;
`;

const DataContent = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${theme.spacing.md}px;
`;


const ErrorMessage = styled.div`
  padding: ${theme.spacing.md}px;
  background: ${theme.colors.status.errorLight};
  color: ${theme.colors.status.error};
  border-radius: ${theme.radius.md}px;
  margin: ${theme.spacing.md}px 0;
  border: 1px solid ${theme.colors.status.error};
`;

const NoPreviewMessage = styled.div`
  padding: 40px;
  text-align: center;
  color: var(--t-text-sub);
  background: var(--t-bg-dark);
  border-radius: 8px;
  margin: 20px 0;
`;

const NoDataMessage = styled.div`
  padding: 40px;
  text-align: center;
  color: var(--t-text-sub);
  background: var(--t-bg-dark);
  border-radius: 8px;
  margin: 20px 0;
`;

const SearchContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 20;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border-bottom: 1px solid ${theme.colors.ui.border};
  display: flex;
  gap: ${theme.spacing.sm}px;
  align-items: center;
  border-radius: ${theme.radius.lg}px ${theme.radius.lg}px 0 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const SearchInput = styled.input`
  flex: 1;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: rgba(15, 23, 42, 0.8);
  border: 2px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    background: rgba(15, 23, 42, 0.95);
    box-shadow: 0 0 0 3px ${theme.colors.primary.main}20, 
                0 4px 12px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
  }
  
  &::placeholder {
    color: ${theme.colors.text.tertiary};
    font-weight: ${theme.typography.fontWeight.normal};
  }
`;

const SearchIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: ${theme.colors.text.secondary};
  font-size: 16px;
  margin-right: ${theme.spacing.sm}px;
`;

const ClearButton = styled.button`
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: linear-gradient(135deg, #475569 0%, #64748b 100%);
  color: ${theme.colors.text.secondary};
  border: none;
  border-radius: ${theme.radius.lg}px;
  cursor: pointer;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  
  &:hover {
    background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%);
    color: ${theme.colors.text.primary};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

// File validation utility functions
export const validateFile = (file) => {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }
  
  // Check file type
  const isValidType = ALLOWED_FILE_TYPES.includes(file.type) || 
                     ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  
  if (!isValidType) {
    errors.push(`File type not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    errors.push(`File size (${sizeMB}MB) exceeds the 200MB limit`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Keys to skip in the display - confidence scores and pipeline metadata
const SKIP_KEYS = new Set([
  // Shown as line-items table below
  'barcodes', 'items', 'line_items',
  // Confidence / scoring — internal M02 metrics, not document content
  'overall_confidence', 'confidence_scores', 'raw_confidence_scores',
  'field_confidence', 'confidence', 'document_type_confidence',
  'calibration_deltas', 'doc_confidence',
  // Pipeline / routing metadata
  'pipeline_stages', 'pipeline_duration_ms', 'review_queue', 'routing',
  'scorer', 'fields_auto', 'fields_soft_review', 'fields_hard_review',
  'fields_low', 'quality_alert', 'document_type_signals',
  'document_type_reasoning', 'document_type_description', 'document_type_icon',
  'document_type_color', 'document_type_signals',
  // OCR and extraction metadata
  'ocr_text', 'gliner_entities', 'extracted_fields', 'normalised_fields',
  'layout_blocks', 'document_quality',
  // IDs and internal references
  'document_id', 'file_path', 'id', 'user_id', 'company_id',
]);

// Only show these essential field keys in the display
const ESSENTIAL_FIELD_KEYS = new Set([
  'invoice_number', 'invoice_date', 'exporter_name', 'exporter_address',
  'importer_name', 'importer_address', 'gst_number', 'iec_number',
  'shipment_address', 'hsn_code', 'hs_code', 'hs_tariff_code',
  'goods_description', 'product_description', 'description',
  'quantity', 'unit', 'unit_price', 'currency',
  'total_value', 'freight', 'insurance', 'cif_value',
  'country_of_origin', 'port_of_loading', 'port_of_discharge',
  'shipment_date', 'payment_terms', 'incoterms',
  'bill_of_lading_number', 'awb_number', 'container_number',
  'vessel_name', 'purchase_order_number', 'flight_number',
  'document_type', 'overall_confidence', 'raw_lake_path', 'processed_lake_path',
]);

// Display all extracted fields in a structured grid + line items table
const AllFieldsDisplay = ({ data, onDownload }) => {
  if (!data) return null;

  // Only show essential fields, skip metadata and confidence scores
  const scalarEntries = Object.entries(data).filter(
    ([k, v]) => ESSENTIAL_FIELD_KEYS.has(k) && !SKIP_KEYS.has(k) && v !== null && v !== undefined && v !== ''
  );

  const lineItems = data.line_items || data.items;
  const hasLineItems = Array.isArray(lineItems) && lineItems.length > 0;
  const lineItemCols = hasLineItems
    ? Array.from(new Set(lineItems.flatMap(r => (r && typeof r === 'object' ? Object.keys(r) : []))))
    : [];

  const confidenceColor = (v) => {
    if (v == null) return '#64748b';
    if (v >= 0.85) return '#16a34a';
    if (v >= 0.75) return '#ca8a04';
    if (v >= 0.55) return '#ea580c';
    return '#dc2626';
  };

  return (
    <div>
      {/* Document type + confidence banner */}
      {(data.document_type || data.overall_confidence != null) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: '#0c1a3a', border: '1px solid #1e3a5f',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 22 }}>{data.document_type_icon || '📄'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              Document Type
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
              {data.document_type_display || data.document_type || '—'}
            </div>
          </div>
        </div>
      )}

      {/* All scalar fields grid */}
      {scalarEntries.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 8, marginBottom: 18,
        }}>
          {scalarEntries.map(([key, value]) => {
            if (key === 'document_type' || key === 'overall_confidence') return null;
            const displayVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return (
              <div key={key} style={{
                background: '#0a1628', border: '1px solid #1e3a5f',
                borderRadius: 7, padding: '8px 11px',
              }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3, fontWeight: 600 }}>
                  {key.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 13, color: '#e2e8f0', wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {displayVal || <span style={{ color: '#475569', fontStyle: 'italic' }}>—</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Line items table */}
      {hasLineItems && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E8C84A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Line Items ({lineItems.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#e2e8f0' }}>
              <thead>
                <tr>
                  {lineItemCols.map(c => (
                    <th key={c} style={{
                      background: '#0c1a3a', border: '1px solid #1e3a5f',
                      padding: '6px 10px', textAlign: 'left',
                      color: '#94a3b8', textTransform: 'uppercase',
                      fontSize: 10, letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    }}>
                      {c.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? '#0a1628' : '#0d1f3c' }}>
                    {lineItemCols.map(c => (
                      <td key={c} style={{ border: '1px solid #1e3a5f', padding: '5px 10px', whiteSpace: 'nowrap' }}>
                        {row && row[c] != null ? String(row[c]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Download JSON button */}
      {onDownload && (
        <button
          onClick={onDownload}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #065f46, #047857)',
            color: '#6ee7b7', border: '1px solid #10b981',
            borderRadius: 7, padding: '9px 18px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          ⬇ Download JSON
        </button>
      )}
    </div>
  );
};

const HSN_KEYS = ['hsn_code', 'hs_code', 'hscode', 'HS Code/HSN Code', 'HSN Code',
                   'hs_tariff_code', 'tariff_code', 'commodity_code'];
const DESC_KEYS = ['goods_description', 'Goods Description', 'product_description',
                   'Product Description', 'Description of Goods', 'Items/Goods Description', 'description'];

const DocumentPreviewModal = ({ isOpen, onClose, document, extractedData, onSaveJson, onMoveToHSN }) => {
  const [fileUrl, setFileUrl] = useState(null);
  const [previewMimeType, setPreviewMimeType] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [hsnEditMode, setHsnEditMode] = useState(false);
  const [hsnEditValue, setHsnEditValue] = useState('');
  const objectUrlRef = useRef(null);

  // HSN search state (for when no HSN is found in document)
  // phase: 'idle' | 'searching' | 'results' | 'error' | 'manual'
  const [hsnSearchPhase, setHsnSearchPhase] = useState('idle');
  const [hsnSearchResults, setHsnSearchResults] = useState(null);
  const [hsnSearchError, setHsnSearchError] = useState('');
  const [manualHsnValue, setManualHsnValue] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const revokeObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    const toRenderableUrl = async (src, mimeHint = '') => {
      if (!src || typeof src !== 'string') return null;
      const normalized = src.trim();
      const isPdfDataUrl = /^data:application\/pdf/i.test(normalized);
      const isPdfMimeHint = String(mimeHint || '').toLowerCase().includes('pdf');

      if (isPdfDataUrl || isPdfMimeHint) {
        try {
          const blob = await fetch(normalized).then((r) => r.blob());
          if (cancelled) return null;
          revokeObjectUrl();
          const blobUrl = URL.createObjectURL(blob);
          objectUrlRef.current = blobUrl;
          return blobUrl;
        } catch (err) {
          console.warn('[DocumentPreviewModal] Failed to convert preview to blob URL:', err);
        }
      }

      return normalized;
    };

    const resolvePreviewUrl = async () => {
      const file = document?.file;
      setValidationError(null);

      if (document?.uploaded && document?.url) {
        setPreviewMimeType(String(file?.type || '').toLowerCase());
        setFileUrl(document.url);
        return;
      }

      // Always prefer backend preview when documentId exists so the panel
      // renders the uploaded source document (not any local placeholder).
      const shouldUseServerPreview = !!document?.documentId;

      if (shouldUseServerPreview) {
        try {
          const payload = await documentService.getDocumentPreview(document.documentId);
          if (cancelled) return;

          const previewFromServer =
            payload?.data_url ||
            payload?.preview_url ||
            payload?.url ||
            payload?.signed_url ||
            null;

          if (previewFromServer) {
            const mime = normalizeMimeType(payload?.content_type || file?.type || '');
            const name = String(payload?.filename || document?.file?.name || '').toLowerCase();
            const looksLikePdf =
              mime.includes('pdf') ||
              name.endsWith('.pdf') ||
              (typeof previewFromServer === 'string' && /^data:application\/pdf/i.test(previewFromServer.trim()));

            if (!looksLikePdf) {
              setFileUrl(null);
              setPreviewMimeType('');
              return;
            }

            const renderable = await toRenderableUrl(previewFromServer, mime);
            if (cancelled) return;
            setPreviewMimeType(mime);
            setFileUrl(renderable);
            return;
          }
        } catch (err) {
          console.warn('[DocumentPreviewModal] Failed to fetch server preview:', err);
        }
      }

      if (file) {
        const localType = normalizeMimeType(file.type || '');
        const localName = String(file.name || '').toLowerCase();
        const localMimeForValidation = localType || (localName.endsWith('.pdf') ? 'application/pdf' : '');
        const isAllowedType =
          ALLOWED_FILE_TYPES.includes(localMimeForValidation) ||
          ALLOWED_EXTENSIONS.some((ext) => localName.endsWith(ext));
        if (!isAllowedType) {
          setValidationError(`File type not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          setValidationError(`File size (${sizeMB}MB) exceeds the 200MB limit`);
          return;
        }

        const mime = localMimeForValidation || localType;
        setPreviewMimeType(mime);

        // Blob URLs are more reliable for in-iframe PDF rendering than very large data URLs.
        if (mime.includes('pdf') || localName.endsWith('.pdf')) {
          revokeObjectUrl();
          const localBlobUrl = URL.createObjectURL(file);
          objectUrlRef.current = localBlobUrl;
          if (!cancelled) setFileUrl(localBlobUrl);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          if (!cancelled) setFileUrl(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    };

    resolvePreviewUrl();

    return () => {
      cancelled = true;
      revokeObjectUrl();
    };
  }, [isOpen, document]);

  // Reset fileUrl when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setFileUrl(null);
      setPreviewMimeType('');
    }
  }, [isOpen]);

  // Detect HSN and description from extractedData
  const ef = extractedData || {};
  let detectedHsn = null;
  for (const k of HSN_KEYS) { if (ef[k]) { detectedHsn = String(ef[k]).trim(); break; } }
  if (!detectedHsn && Array.isArray(ef.line_items)) {
    outer: for (const item of ef.line_items) {
      for (const k of HSN_KEYS) { if (item?.[k]) { detectedHsn = String(item[k]).trim(); break outer; } }
    }
  }

  let detectedDescription = null;
  for (const k of DESC_KEYS) { if (ef[k]) { detectedDescription = String(ef[k]).trim(); break; } }
  if (!detectedDescription && Array.isArray(ef.line_items) && ef.line_items.length > 0) {
    const first = ef.line_items[0];
    detectedDescription = (first?.description || first?.goods_description || first?.product || first?.name || '').trim() || null;
  }

  // Reset edit state whenever the modal opens with new data
  useEffect(() => {
    setHsnEditMode(false);
    setHsnEditValue(detectedHsn || '');
    // Reset HSN search state on every open
    setHsnSearchPhase('idle');
    setHsnSearchResults(null);
    setHsnSearchError('');
    setManualHsnValue('');
  }, [isOpen, detectedHsn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search HSN via PostgreSQL + GPT-4o-mini pipeline
  const handleSearchHSN = async () => {
    if (!detectedDescription) return;
    setHsnSearchPhase('searching');
    setHsnSearchResults(null);
    setHsnSearchError('');
    try {
      const data = await hsCodeService.lookupHSCode(detectedDescription);
      setHsnSearchResults(data);
      setHsnSearchPhase('results');
    } catch (err) {
      console.error('[DocumentPreviewModal] HSN search failed:', err);
      setHsnSearchError(err?.response?.data?.detail || err?.message || 'Search failed. Please try again.');
      setHsnSearchPhase('error');
    }
  };

  // Build navItems and call onMoveToHSN — used by both footer actions
  const buildNavItems = (hsnOverride) => {
    const hsn = hsnOverride !== undefined ? hsnOverride : (detectedHsn || '');
    let items = [];
    if (Array.isArray(ef.line_items) && ef.line_items.length > 0) {
      items = ef.line_items
        .map(item => ({
          description: item.description || item.goods_description || item.product || item.name || '',
          hsCode:   item.hsn_code || item.hs_code || item.hscode || hsn,
          hsn_code: item.hsn_code || item.hs_code || item.hscode || hsn,
          quantity: item.quantity || item.qty || 1,
          unit_price:  item.unit_price || '',
          total_value: item.total_value || item.amount || '',
        }))
        .filter(i => i.description.trim());
    }
    if (items.length === 0 && detectedDescription) {
      items = [{ description: detectedDescription, hsCode: hsn, hsn_code: hsn, quantity: ef.quantity || 1 }];
    }
    return items;
  };

  const computeNoDataMessage = () => {
    // validationError handled above (shown in UI)
    if (!document?.file) {
      return 'No file selected. Choose a file in the File Card to preview or extract.';
    }

    // if file exists locally but not uploaded to server
    const isUploaded = !!document?.uploaded || !!document?.url || !!document?.serverPath;
    const isExtracting = !!document?.loading && !!isUploaded; // loading while uploaded = extracting
    const hasExtraction = !!document?.extraction;

    if (!isUploaded) {
      return 'File is selected locally. Click "Upload" in the File Card to upload the file first.';
    }

    // Currently extracting
    if (isExtracting && !hasExtraction) {
      return '⏳ Extraction in progress... Please wait while we process your document.';
    }

    // uploaded but no extraction result yet and not currently extracting
    if (isUploaded && !hasExtraction && !isExtracting) {
      return 'File uploaded successfully. Click "Extract" in the File Card to start extraction.';
    }

    // fallback (shouldn't reach here if extractedData is passed correctly)
    return '📝 No extracted data available yet.';
  };
  const noDataMessage = computeNoDataMessage();

  if (!isOpen) return null;

  const hasExtraction = !!extractedData;
  const documentName = String(document?.file?.name || '').toLowerCase();
  const fileType = String(document?.file?.type || '').toLowerCase();
  const isPdfPreview =
    previewMimeType.includes('pdf') ||
    fileType.includes('pdf') ||
    documentName.endsWith('.pdf');

  // Get document type for header
  const documentType = extractedData?.document_type || extractedData?.doc_type || (extractedData?.details && (extractedData.details.document_type || extractedData.details.doc_type)) || null;

  console.log('Rendering modal with:', { hasExtraction, fileUrl, extractedData });
  console.log('Portal check - window.document:', window.document);
  console.log('Portal check - window.document.body:', window.document?.body);

  const modalElement = (
    <Modal
      className={isOpen ? 'visible' : ''}
      onClick={onClose}
      data-modal-portal="true"
      style={{ isolation: 'isolate' }}
    >
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            {document?.file?.name || 'Document Preview'}
            {documentType && (
              <span style={{
                marginLeft: '12px',
                padding: '4px 12px',
                background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(75, 0, 130, 0.2) 100%)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#8a2be2',
                border: '1px solid rgba(138, 43, 226, 0.3)'
              }}>
                {extractedData?.document_type_icon || '📄'} {extractedData?.document_type_display || documentType}
              </span>
            )}
          </ModalTitle>
          <CloseButton onClick={onClose} aria-label="Close preview">✕</CloseButton>
        </ModalHeader>
        
        <ModalBody splitView={true}>
          {/* Left side - Document Preview */}
          <DocumentPreviewPane>
            {validationError ? (
              <ErrorMessage>
                <strong>File Validation Error:</strong> {validationError}
              </ErrorMessage>
            ) : fileUrl ? (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Use iframe for PDFs to prevent automatic browser download */}
                {isPdfPreview ? (
                  <iframe
                    src={fileUrl}
                    title={document?.file?.name || 'PDF Preview'}
                    loading="lazy"
                    width="100%"
                    height="100%"
                    style={{
                      minHeight: '400px',
                      border: '1px solid var(--t-border)',
                      borderRadius: '8px'
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </DocumentPreviewPane>
          
          {/* Right side - Extracted Data */}
          <ExtractionDataPane>
            {hasExtraction ? (
              <DataContent>
                <AllFieldsDisplay data={extractedData} onDownload={onSaveJson} />
                {extractedData?.barcodes?.length > 0 && (
                  <BarcodeViewer barcodes={extractedData.barcodes} />
                )}
              </DataContent>
            ) : (
              <DataContent>
                <NoDataMessage>{noDataMessage}</NoDataMessage>
              </DataContent>
            )}
          </ExtractionDataPane>
        </ModalBody>

        <ModalFooter>
          {/* ── HSN action area (left side) ── */}
          {onMoveToHSN && extractedData && (() => {
            // Case 1: HSN code found
            if (detectedHsn) return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto', flexWrap: 'wrap' }}>
                {hsnEditMode ? (
                  <>
                    <input
                      value={hsnEditValue}
                      onChange={e => setHsnEditValue(e.target.value)}
                      placeholder="Enter HSN code"
                      style={{
                        background: 'var(--t-card)', color: 'var(--t-text)',
                        border: '1px solid #3b82f6', borderRadius: 6,
                        padding: '6px 10px', fontSize: 13, width: 140,
                      }}
                    />
                    <button
                      onClick={() => {
                        const trimmed = hsnEditValue.trim();
                        if (trimmed) { onMoveToHSN(buildNavItems(trimmed)); }
                      }}
                      style={{
                        background: '#1d4ed8', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '7px 14px', fontSize: 13,
                        fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => { setHsnEditMode(false); setHsnEditValue(detectedHsn); }}
                      style={{
                        background: 'transparent', color: 'var(--t-text-sub)',
                        border: '1px solid var(--t-border)', borderRadius: 6,
                        padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onMoveToHSN(buildNavItems(detectedHsn))}
                      style={{
                        background: 'linear-gradient(135deg, #052e16, #166534)',
                        color: '#4ade80', border: '1px solid #16a34a',
                        borderRadius: 6, padding: '8px 18px',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      🏷 Use this HSN Code: {detectedHsn}
                    </button>
                    <button
                      onClick={() => { setHsnEditMode(true); setHsnEditValue(detectedHsn); }}
                      style={{
                        background: 'transparent', color: '#93c5fd',
                        border: '1px solid #3b82f6', borderRadius: 6,
                        padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      ✏ Edit
                    </button>
                  </>
                )}
              </div>
            );

            // Case 2: No HSN but description available — multi-phase search flow
            if (detectedDescription) return (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginRight: 'auto', flexWrap: 'wrap', maxWidth: '70%' }}>

                {/* ── IDLE: initial action buttons ── */}
                {hsnSearchPhase === 'idle' && (
                  <>
                    <button
                      onClick={handleSearchHSN}
                      style={{
                        background: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)',
                        color: '#fff', border: '1px solid #3b82f6',
                        borderRadius: 6, padding: '8px 18px',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      🔍 Search HSN
                    </button>
                    <button
                      onClick={() => setHsnSearchPhase('manual')}
                      style={{
                        background: 'transparent', color: '#93c5fd',
                        border: '1px solid #3b82f6', borderRadius: 6,
                        padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      ✏ Enter Manually
                    </button>
                  </>
                )}

                {/* ── SEARCHING: spinner ── */}
                {hsnSearchPhase === 'searching' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    color: '#93c5fd', fontSize: 13,
                    padding: '8px 14px',
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid #3b82f6', borderRadius: 6,
                  }}>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Searching HSN via PostgreSQL + GPT-4o-mini…
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}

                {/* ── ERROR ── */}
                {hsnSearchPhase === 'error' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{
                      padding: '7px 12px', background: '#3b1a1a',
                      border: '1px solid #f87171', borderRadius: 6,
                      fontSize: 12, color: '#fca5a5',
                    }}>
                      ⚠ {hsnSearchError}
                    </div>
                    <button onClick={handleSearchHSN} style={{ background: 'transparent', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                      Retry
                    </button>
                    <button onClick={() => setHsnSearchPhase('manual')} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                      Enter Manually
                    </button>
                  </div>
                )}

                {/* ── RESULTS: top predictions ── */}
                {hsnSearchPhase === 'results' && hsnSearchResults && (() => {
                  const predictions = hsnSearchResults.top3_predictions || [];
                  const best = hsnSearchResults.selected_hsn || predictions[0]?.hsn_code || '';
                  const confPct = v => v != null ? `${Math.round(v * 100)}%` : '';
                  const confColor = v => v >= 0.85 ? '#4ade80' : v >= 0.7 ? '#facc15' : '#f87171';
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        HSN Search Results
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {predictions.slice(0, 3).map((p, i) => (
                          <button
                            key={p.hsn_code}
                            onClick={() => onMoveToHSN(buildNavItems(p.hsn_code))}
                            title={p.description || p.hsn_code}
                            style={{
                              background: i === 0
                                ? 'linear-gradient(135deg, #052e16, #166534)'
                                : 'rgba(15,23,42,0.9)',
                              color: i === 0 ? '#4ade80' : '#e2e8f0',
                              border: `1px solid ${i === 0 ? '#16a34a' : '#334155'}`,
                              borderRadius: 6, padding: '7px 14px',
                              fontSize: 13, fontWeight: i === 0 ? 700 : 500,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            {i === 0 ? '🏷 Use ' : ''}{p.hsn_code}
                            {p.confidence != null && (
                              <span style={{ fontSize: 11, color: confColor(p.confidence), fontWeight: 600 }}>
                                {confPct(p.confidence)}
                              </span>
                            )}
                          </button>
                        ))}
                        {predictions.length === 0 && best && (
                          <button
                            onClick={() => onMoveToHSN(buildNavItems(best))}
                            style={{
                              background: 'linear-gradient(135deg, #052e16, #166534)',
                              color: '#4ade80', border: '1px solid #16a34a',
                              borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            🏷 Use {best}
                          </button>
                        )}
                      </div>
                      {hsnSearchResults.classification_notes && (
                        <div style={{ fontSize: 11, color: '#64748b', maxWidth: 420, lineHeight: 1.4 }}>
                          {hsnSearchResults.classification_notes}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        <button onClick={handleSearchHSN} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                          🔄 Re-search
                        </button>
                        <button onClick={() => setHsnSearchPhase('manual')} style={{ background: 'transparent', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                          ✏ Enter Manually
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── MANUAL ENTRY ── */}
                {hsnSearchPhase === 'manual' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      value={manualHsnValue}
                      onChange={e => setManualHsnValue(e.target.value)}
                      placeholder="Enter HSN code (e.g. 85171200)"
                      autoFocus
                      style={{
                        background: 'var(--t-card)', color: 'var(--t-text)',
                        border: '1px solid #3b82f6', borderRadius: 6,
                        padding: '7px 11px', fontSize: 13, width: 200,
                      }}
                    />
                    <button
                      onClick={() => {
                        const trimmed = manualHsnValue.trim();
                        if (trimmed) onMoveToHSN(buildNavItems(trimmed));
                      }}
                      disabled={!manualHsnValue.trim()}
                      style={{
                        background: manualHsnValue.trim() ? '#1d4ed8' : '#1e293b',
                        color: '#fff', border: 'none',
                        borderRadius: 6, padding: '7px 14px', fontSize: 13,
                        fontWeight: 700, cursor: manualHsnValue.trim() ? 'pointer' : 'not-allowed',
                        opacity: manualHsnValue.trim() ? 1 : 0.5,
                      }}
                    >
                      Go to HSN Engine
                    </button>
                    <button
                      onClick={() => { setHsnSearchPhase('idle'); setManualHsnValue(''); }}
                      style={{
                        background: 'transparent', color: 'var(--t-text-sub)',
                        border: '1px solid var(--t-border)', borderRadius: 6,
                        padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );

            // Case 3: Neither HSN nor description — offer manual entry
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto', flexWrap: 'wrap' }}>
                <div style={{
                  padding: '7px 14px',
                  background: '#3b1a1a', border: '1px solid #f87171',
                  borderRadius: 6, fontSize: 12, color: '#fca5a5',
                }}>
                  ⚠ Insufficient data to determine HSN. Please review the document.
                </div>
                {hsnSearchPhase !== 'manual' ? (
                  <button
                    onClick={() => setHsnSearchPhase('manual')}
                    style={{
                      background: 'transparent', color: '#93c5fd',
                      border: '1px solid #3b82f6', borderRadius: 6,
                      padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    ✏ Enter HSN Manually
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      value={manualHsnValue}
                      onChange={e => setManualHsnValue(e.target.value)}
                      placeholder="Enter HSN code"
                      autoFocus
                      style={{
                        background: 'var(--t-card)', color: 'var(--t-text)',
                        border: '1px solid #3b82f6', borderRadius: 6,
                        padding: '6px 10px', fontSize: 13, width: 180,
                      }}
                    />
                    <button
                      onClick={() => { const t = manualHsnValue.trim(); if (t) onMoveToHSN(buildNavItems(t)); }}
                      disabled={!manualHsnValue.trim()}
                      style={{
                        background: '#1d4ed8', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '7px 14px', fontSize: 13,
                        fontWeight: 700, cursor: 'pointer',
                        opacity: manualHsnValue.trim() ? 1 : 0.5,
                      }}
                    >
                      Go to HSN Engine
                    </button>
                    <button
                      onClick={() => { setHsnSearchPhase('idle'); setManualHsnValue(''); }}
                      style={{
                        background: 'transparent', color: 'var(--t-text-sub)',
                        border: '1px solid var(--t-border)', borderRadius: 6,
                        padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Download JSON — always visible in footer when extraction exists */}
          {onSaveJson && extractedData && (
            <button
              onClick={onSaveJson}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, #065f46, #047857)',
                color: '#6ee7b7', border: '1px solid #10b981',
                borderRadius: 6, padding: '8px 16px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              ⬇ Download JSON
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'var(--t-card)', color: 'var(--t-text-sub)',
              border: '1px solid var(--t-border)', borderRadius: 6,
              padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            Close
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  // Render modal via portal to escape stacking context
  // Use window.document to avoid shadowing from the 'document' prop
  try {
    const container = window.document?.body;
    if (container) {
      console.log('✅ Using React Portal - rendering to document.body');
      return createPortal(modalElement, container);
    }
  } catch (error) {
    console.error('❌ Portal error:', error);
  }

  // Fallback: render normally if portal isn't available
  console.warn('⚠️ Portal not available - using fallback rendering');
  return modalElement;
};

export default DocumentPreviewModal;
