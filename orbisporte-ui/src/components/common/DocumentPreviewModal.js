/**
 * DocumentPreviewModal Component
 * 
 * Modal for previewing documents with extracted data side by side.
 * Supports PDF, JPG, JPEG, PNG files with 200MB size limit.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import theme from '../../styles/theme';
import JsonViewer from './JsonViewer';
import BarcodeViewer from './BarcodeViewer';

// File validation constants
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes

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

// Component to display a summary of the extracted data
const ExtractedSummary = ({ data }) => {
  if (!data) return null;

  // Extract contact information
  const address = data.address || data.sender_address || data.recipient_address || {};
  const contact = {
    phone: data.phone || data.contact_phone || data.sender_phone || data.recipient_phone,
    email: data.email || data.contact_email || data.sender_email || data.recipient_email,
    name: data.contact_name || data.sender_name || data.recipient_name
  };

  // Extract document metadata
  const metadata = {
    docType: data.document_type || data.doc_type,
    date: data.date || data.document_date || data.issue_date,
    number: data.document_number || data.invoice_number || data.reference_number,
    currency: data.currency
  };

  // Extract financial data
  const financial = {
    total: data.total_amount || data.total || data.amount,
    tax: data.tax_amount || data.vat || data.tax,
    subtotal: data.subtotal || data.net_amount
  };
  
  // Format address as a string if it's an object
  const formatAddress = (addr) => {
    if (typeof addr === 'string') return addr;
    if (typeof addr !== 'object') return '';
    
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.postal_code || addr.zip) parts.push(addr.postal_code || addr.zip);
    if (addr.country) parts.push(addr.country);
    
    return parts.join(', ');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
      {/* Document Metadata */}
      {(metadata.docType || metadata.date || metadata.number) && (
        <div style={{ padding: '8px', borderBottom: '1px solid var(--t-border)' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--t-text-sub)', marginBottom: '4px' }}>
            📄 Document Info
          </div>
          <div style={{ fontSize: '14px', color: 'var(--t-text)', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
            {metadata.docType && <div style={{ display: 'flex', gap: '4px' }}><strong>Type:</strong> {metadata.docType}</div>}
            {metadata.date && <div style={{ display: 'flex', gap: '4px' }}><strong>Date:</strong> {metadata.date}</div>}
            {metadata.number && <div style={{ display: 'flex', gap: '4px' }}><strong>Number:</strong> {metadata.number}</div>}
            {metadata.currency && <div style={{ display: 'flex', gap: '4px' }}><strong>Currency:</strong> {metadata.currency}</div>}
          </div>
        </div>
      )}
      
      {/* Contact Information */}
      {(contact.name || contact.phone || contact.email || formatAddress(address)) && (
        <div style={{ padding: '8px', borderBottom: '1px solid var(--t-border)' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--t-text-sub)', marginBottom: '4px' }}>
            👤 Contact Information
          </div>
          <div style={{ fontSize: '14px', color: 'var(--t-text)', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
            {contact.name && <div style={{ display: 'flex', gap: '4px' }}><strong>Name:</strong> {contact.name}</div>}
            {contact.phone && <div style={{ display: 'flex', gap: '4px' }}><strong>Phone:</strong> {contact.phone}</div>}
            {contact.email && <div style={{ display: 'flex', gap: '4px' }}><strong>Email:</strong> {contact.email}</div>}
            {formatAddress(address) && (
              <div style={{ display: 'flex', gap: '4px' }}><strong>Address:</strong> {formatAddress(address)}</div>
            )}
          </div>
        </div>
      )}
      
      {/* Financial Information */}
      {(financial.total || financial.tax || financial.subtotal) && (
        <div style={{ padding: '8px', borderBottom: '1px solid var(--t-border)' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--t-text-sub)', marginBottom: '4px' }}>
            💰 Financial Details
          </div>
          <div style={{ fontSize: '14px', color: 'var(--t-text)', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
            {financial.subtotal && <div style={{ display: 'flex', gap: '4px' }}><strong>Subtotal:</strong> {financial.subtotal}</div>}
            {financial.tax && <div style={{ display: 'flex', gap: '4px' }}><strong>Tax:</strong> {financial.tax}</div>}
            {financial.total && <div style={{ display: 'flex', gap: '4px' }}><strong>Total:</strong> {financial.total}</div>}
          </div>
        </div>
      )}
      
      {/* Items are handled separately in the HSCodeSection */}
      {!data.items && data.description && (
        <div style={{ padding: '8px', borderBottom: '1px solid var(--t-border)' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--t-text-sub)', marginBottom: '4px' }}>
            📝 Description
          </div>
          <div style={{ fontSize: '14px', color: 'var(--t-text)' }}>
            <div>{data.description}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const DocumentPreviewModal = ({ isOpen, onClose, document, extractedData, onSaveJson }) => {
  const [fileUrl, setFileUrl] = useState(null);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (isOpen && document?.file) {
      console.log('Setting up preview for document:', document);
      
      // Validate file
      const validation = validateFile(document.file);
      if (!validation.isValid) {
        setValidationError(validation.errors.join(', '));
        return;
      } else {
        setValidationError(null);
      }
      
      // Create object URL for the file
      let url;
      if (document.uploaded && document.url) {
        url = document.url;
      } else if (document.file) {
        url = URL.createObjectURL(document.file);
      }
      setFileUrl(url);
    }
  }, [isOpen, document]);
  
  // Clean up object URLs when component unmounts or document changes
  useEffect(() => {
    return () => {
      if (fileUrl && fileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

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
                📄 {documentType}
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
                {/* Try embed first for PDFs */}
                {document?.file?.type === 'application/pdf' || document?.file?.name?.toLowerCase().endsWith('.pdf') ? (
                  <embed 
                    src={fileUrl}
                    width="100%"
                    height="100%"
                    style={{
                      minHeight: '400px',
                      border: '1px solid var(--t-border)',
                      borderRadius: '8px'
                    }}
                  />
                ) : (
                  /* For images, use img tag */
                  <img 
                    src={fileUrl}
                    alt={document?.file?.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      minHeight: '400px',
                      border: '1px solid var(--t-border)',
                      borderRadius: '8px',
                      objectFit: 'contain'
                    }}
                  />
                )}
                <div style={{ 
                  marginTop: '10px', 
                  color: 'var(--t-text-sub)', 
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  📄 {document?.file?.name}
                </div>
              </div>
            ) : (
              <NoPreviewMessage>
                📄 No preview available
              </NoPreviewMessage>
            )}
          </DocumentPreviewPane>
          
          {/* Right side - Extracted Data */}
          <ExtractionDataPane>
            {hasExtraction ? (
              <DataContent>
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 15px', color: 'var(--t-text)' }}>Extracted Data</h3>
                  <ExtractedSummary data={extractedData} />
                </div>
                {/* Show barcode section if extraction was attempted */}
                {extractedData?.barcodes !== undefined && (
                  <>
                    {extractedData.barcodes.length > 0 ? (
                      <BarcodeViewer barcodes={extractedData.barcodes} />
                    ) : (
                      <div style={{
                        background: 'var(--t-card)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        border: '1px solid var(--t-border)',
                        color: 'var(--t-text-sub)',
                        fontSize: '14px'
                      }}>
                        ⚠️ Barcode scanning was enabled but no QR codes or barcodes were detected in this document.
                        {' '}Check browser console and backend logs for details.
                      </div>
                    )}
                  </>
                )}
                <div>
                  <JsonViewer data={extractedData} />
                </div>
              </DataContent>
            ) : (
              <DataContent>
                <NoDataMessage>
                  {noDataMessage}
                </NoDataMessage>
              </DataContent>
            )}
          </ExtractionDataPane>
        </ModalBody>

        {/* Footer: Save JSON / Cancel */}
        <ModalFooter>
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
          {onSaveJson && (
            <button
              onClick={onSaveJson}
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #6366f1)', color: 'white',
                border: 'none', borderRadius: 6,
                padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}
            >
              💾 Save as JSON
            </button>
          )}
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
