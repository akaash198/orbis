/**
 * InvoiceDutyPanel Component
 * Week 1 - Module 1: Complete Invoice-to-Duty Integration
 *
 * Upload invoice → Auto-extract → Auto-classify HSN → Auto-calculate duties
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import { invoiceDutyService } from '../../services/api';

const PanelContainer = styled.div`
  padding: ${theme.spacing.xxl}px;
  min-height: 100vh;
  overflow: auto;
  background: ${theme.colors.ui.background};
  position: relative;
`;

const Header = styled.div`
  margin-bottom: ${theme.spacing.xxl}px;
`;

const Title = styled.h1`
  font-size: ${theme.typography.fontSize['4xl']};
  font-weight: ${theme.typography.fontWeight.extrabold};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.md}px;
  text-shadow: ${theme.typography.textShadow.sm};
  letter-spacing: -0.02em;

  &::before {
    content: '🧾 ';
    font-size: ${theme.typography.fontSize['5xl']};
    margin-right: ${theme.spacing.sm}px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }
`;

const Subtitle = styled.p`
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.secondary};
  line-height: 1.6;
`;

const Card = styled.div`
  background: ${theme.colors.ui.cardElevated};
  border-radius: ${theme.radius.xxl}px;
  padding: ${theme.spacing.xxl}px;
  box-shadow: ${theme.shadows.card};
  margin-bottom: ${theme.spacing.xxl}px;
  position: relative;
  overflow: hidden;
  transition: all ${theme.transitions.normal} ${theme.transitions.easing.default};
  transform: ${theme.transforms.card3D};

  /* 3D inner glow */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg,
      transparent,
      rgba(59, 130, 246, 0.3),
      transparent
    );
    pointer-events: none;
  }

  &:hover {
    box-shadow: ${theme.shadows.cardHover};
    transform: translateY(-4px);
  }
`;

const UploadArea = styled.div`
  border: 2px dashed ${props => props.isDragging ? theme.colors.primary.main : theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.xxxl}px;
  text-align: center;
  background: ${props => props.isDragging ? theme.colors.primary.light + '10' : theme.colors.ui.background};
  transition: all ${theme.transitions.normal};
  cursor: pointer;

  &:hover {
    border-color: ${theme.colors.primary.light};
    background: ${theme.colors.ui.hover};
  }
`;

const UploadIcon = styled.div`
  font-size: 48px;
  margin-bottom: ${theme.spacing.md}px;
`;

const UploadText = styled.div`
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.sm}px;
`;

const UploadHint = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.text.secondary};
`;

const HiddenInput = styled.input`
  display: none;
`;

const Button = styled.button`
  padding: ${theme.spacing.md}px ${theme.spacing.xl}px;
  background: ${props => props.$secondary ? theme.colors.ui.border : theme.colors.primary.gradient};
  color: ${props => props.$secondary ? theme.colors.text.secondary : theme.colors.primary.contrast};
  border: none;
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: ${theme.shadows.md};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const ProcessingStatus = styled.div`
  text-align: center;
  padding: ${theme.spacing.xl}px;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid ${theme.colors.ui.border};
  border-top: 4px solid ${theme.colors.primary.main};
  border-radius: 50%;
  margin: 0 auto ${theme.spacing.md}px;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const StatusText = styled.div`
  font-size: ${theme.typography.fontSize.md};
  color: ${theme.colors.text.secondary};
`;

const ResultsContainer = styled.div`
  margin-top: ${theme.spacing.xl}px;
`;

const SummaryCard = styled(Card)`
  background: ${theme.colors.primary.gradient};
  color: white;
`;

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.md}px;

  &:last-child {
    margin-bottom: 0;
    padding-top: ${theme.spacing.md}px;
    border-top: 1px solid var(--t-border-light);
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.bold};
  }
`;

const ItemsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${theme.typography.fontSize.sm};
`;

const TableHeader = styled.thead`
  background: ${theme.colors.ui.background};
`;

const TableRow = styled.tr`
  border-bottom: 1px solid ${theme.colors.ui.border};

  &:hover {
    background: ${theme.colors.ui.hover};
  }
`;

const TableHeaderCell = styled.th`
  padding: ${theme.spacing.md}px;
  text-align: left;
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.text.secondary};
`;

const TableCell = styled.td`
  padding: ${theme.spacing.md}px;
  color: ${theme.colors.text.primary};
`;

const Badge = styled.span`
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  border-radius: ${theme.radius.sm}px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  background: ${props => props.$success ? theme.colors.status.success : theme.colors.status.warning};
  color: ${props => props.$success ? '#fff' : '#1c1917'};
`;

const ErrorMessage = styled.div`
  padding: ${theme.spacing.md}px;
  background: ${theme.colors.status.error}20;
  border: 1px solid ${theme.colors.status.error};
  border-radius: ${theme.radius.md}px;
  color: ${theme.colors.status.error};
  margin-bottom: ${theme.spacing.md}px;

  strong {
    display: block;
    margin-bottom: ${theme.spacing.xs}px;
  }

  pre {
    margin-top: ${theme.spacing.sm}px;
    padding: ${theme.spacing.sm}px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: ${theme.radius.sm}px;
    font-size: ${theme.typography.fontSize.xs};
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
`;

const InvoiceDutyPanel = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleFileSelect = (file) => {
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    } else {
      setError('Please select a PDF file');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleExport = async () => {
    if (!result || !result.document_id) {
      setError('No results to export');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      await invoiceDutyService.exportResults(result.document_id, 'csv');
    } catch (err) {
      console.error('[InvoiceDutyPanel] Export error:', err);
      setError('Failed to export results. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const processInvoice = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Upload the file first
      setProcessingStatus('Uploading invoice...');

      // Import documentService
      const { documentService } = await import('../../services/api');

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Upload document
      const uploadResult = await documentService.uploadDocument(selectedFile);
      console.log('[InvoiceDutyPanel] Upload result:', uploadResult);

      if (!uploadResult || !uploadResult.file_path) {
        throw new Error('File upload failed - no file path returned');
      }

      const filePath = uploadResult.file_path;
      const documentId = uploadResult.document_id;

      console.log('[InvoiceDutyPanel] File uploaded successfully:', filePath);

      // Step 2: Process the invoice (extract, classify, calculate)
      setProcessingStatus('Extracting invoice data...');

      const processResult = await invoiceDutyService.processInvoiceComplete({
        file_path: filePath,
        document_id: documentId,
        auto_classify_hsn: true
      });

      console.log('[InvoiceDutyPanel] Process result:', processResult);

      if (processResult.success) {
        setResult(processResult);
        setProcessingStatus('');
      } else {
        setError(processResult.error || 'Processing failed');
      }

    } catch (err) {
      console.error('[InvoiceDutyPanel] Processing error:', err);

      // Better error messages
      let errorMessage = 'Failed to process invoice';

      if (err.response) {
        // HTTP error response
        errorMessage = err.response.data?.detail || err.response.statusText || errorMessage;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <PanelContainer>
      <Header>
        <Title>Invoice-to-Duty Calculator</Title>
        <Subtitle>Upload invoice → Auto-extract → Auto-classify HSN → Calculate duties</Subtitle>
      </Header>

      {error && (
        <ErrorMessage>
          <strong>⚠️ Error</strong>
          <div>{error}</div>
          {result && result.debug_info && (
            <pre>{JSON.stringify(result.debug_info, null, 2)}</pre>
          )}
        </ErrorMessage>
      )}

      <Card>
        {!selectedFile && !isProcessing && !result && (
          <>
            <UploadArea
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              isDragging={isDragging}
            >
              <UploadIcon>📄</UploadIcon>
              <UploadText>Upload Invoice (PDF)</UploadText>
              <UploadHint>Click to browse or drag and drop</UploadHint>
            </UploadArea>
            <HiddenInput
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleInputChange}
            />
          </>
        )}

        {selectedFile && !isProcessing && !result && (
          <div>
            <div style={{ marginBottom: theme.spacing.lg + 'px' }}>
              <strong>Selected File:</strong> {selectedFile.name}
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.md + 'px' }}>
              <Button onClick={processInvoice}>
                🚀 Process Invoice
              </Button>
              <Button $secondary onClick={() => setSelectedFile(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isProcessing && (
          <ProcessingStatus>
            <Spinner />
            <StatusText>{processingStatus || 'Processing...'}</StatusText>
          </ProcessingStatus>
        )}
      </Card>

      {result && result.success && (
        <ResultsContainer>
          {result.warnings && result.warnings.length > 0 && (
            <div style={{
              padding: theme.spacing.md + 'px',
              background: theme.colors.status.warning + '20',
              border: `1px solid ${theme.colors.status.warning}`,
              borderRadius: theme.radius.md + 'px',
              color: theme.colors.status.warning,
              marginBottom: theme.spacing.xl + 'px'
            }}>
              <strong>⚠️ Warning</strong>
              <ul style={{ marginTop: theme.spacing.sm + 'px', paddingLeft: theme.spacing.lg + 'px' }}>
                {result.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
              <div style={{ fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.sm + 'px', opacity: 0.9 }}>
                💡 Tip: Check if the invoice PDF has product descriptions (not just part numbers). You may need to improve the document extraction or manually add HSN codes.
              </div>
            </div>
          )}

          <SummaryCard>
            <h2 style={{ marginBottom: theme.spacing.lg + 'px' }}>📊 Duty Summary</h2>
            <SummaryRow>
              <span>Total Items:</span>
              <strong>{result.summary.total_items}</strong>
            </SummaryRow>
            <SummaryRow>
              <span>CIF Value:</span>
              <strong>{formatCurrency(result.summary.total_cif_value)}</strong>
            </SummaryRow>
            <SummaryRow>
              <span>Total Duty:</span>
              <strong>{formatCurrency(result.summary.total_duty)}</strong>
            </SummaryRow>
            <SummaryRow>
              <span>Total Payable:</span>
              <strong>{formatCurrency(result.summary.total_payable)}</strong>
            </SummaryRow>
          </SummaryCard>

          <Card>
            <h3 style={{ marginBottom: theme.spacing.md + 'px' }}>Line Items</h3>
            <ItemsTable>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>#</TableHeaderCell>
                  <TableHeaderCell>Description</TableHeaderCell>
                  <TableHeaderCell>HSN Code</TableHeaderCell>
                  <TableHeaderCell>Qty</TableHeaderCell>
                  <TableHeaderCell>CIF Value</TableHeaderCell>
                  <TableHeaderCell>Duty</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <tbody>
                {result.items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>
                      {item.hsn_code || '-'}
                      {item.hsn_auto_classified && (
                        <> <Badge $success>Auto</Badge></>
                      )}
                      {item.classification_error && (
                        <div style={{ fontSize: '11px', color: theme.colors.status.error, marginTop: '4px' }}>
                          ⚠️ {item.classification_error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{item.quantity || '-'} {item.unit}</TableCell>
                    <TableCell>
                      {item.total_value ? formatCurrency(item.total_value) : '-'}
                    </TableCell>
                    <TableCell>
                      {item.duty_calculation ?
                        formatCurrency(item.duty_calculation.total_duty) : '-'}
                      {item.duty_error && (
                        <div style={{ fontSize: '11px', color: theme.colors.status.error, marginTop: '4px' }}>
                          ⚠️ {item.duty_error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.duty_calculation ? (
                        <Badge $success>✓</Badge>
                      ) : item.classification_error || item.duty_error ? (
                        <Badge style={{ background: theme.colors.status.error }}>Failed</Badge>
                      ) : (
                        <Badge>Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </ItemsTable>
          </Card>

          <div style={{ display: 'flex', gap: theme.spacing.md + 'px', marginTop: theme.spacing.xl + 'px' }}>
            <Button onClick={() => {
              setSelectedFile(null);
              setResult(null);
            }}>
              📄 Process Another Invoice
            </Button>
            <Button $secondary onClick={handleExport} disabled={isExporting}>
              {isExporting ? '⏳ Exporting...' : '📥 Export Results'}
            </Button>
          </div>
        </ResultsContainer>
      )}
    </PanelContainer>
  );
};

export default InvoiceDutyPanel;
