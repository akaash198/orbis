/**
 * FileCard Component
 * 
 * Displays file information and provides controls for document processing.
 */

import React from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import Collapsible from './Collapsible';

const Card = styled.div`
  border: 2px solid ${props => props.highlighted ? '#fbbf24' : theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.md}px;
  background: ${props => props.highlighted
    ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(250, 204, 21, 0.15) 100%)'
    : '#263548'}; /* Strong gradient highlight */
  box-shadow: ${props => props.highlighted
    ? '0 0 0 4px rgba(251, 191, 36, 0.5), 0 0 20px rgba(251, 191, 36, 0.6), ' + theme.shadows.xl
    : theme.shadows.md};
  transition: all ${theme.transitions.normal};
  animation: ${props => props.highlighted ? 'strongPulse 0.6s ease-in-out 4' : 'none'};
  position: relative;
  overflow: visible;

  ${props => props.highlighted && `
    &::before {
      content: '⚠️ DUPLICATE';
      position: absolute;
      top: -12px;
      right: 12px;
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      color: #000;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(251, 191, 36, 0.6);
      animation: bounce 0.6s ease-in-out infinite;
      z-index: 10;
    }
  `}

  &:hover {
    box-shadow: ${props => props.highlighted
      ? '0 0 0 4px rgba(251, 191, 36, 0.5), 0 0 25px rgba(251, 191, 36, 0.7), ' + theme.shadows.xl
      : theme.shadows.lg};
  }

  @keyframes strongPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.5), 0 0 20px rgba(251, 191, 36, 0.6);
    }
    50% {
      transform: scale(1.03);
      box-shadow: 0 0 0 6px rgba(251, 191, 36, 0.7), 0 0 30px rgba(251, 191, 36, 0.8);
    }
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0) scale(1);
    }
    50% {
      transform: translateY(-4px) scale(1.05);
    }
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const FileInfo = styled.div`
  flex: 1;
`;

const FileName = styled.div`
  font-weight: ${theme.typography.fontWeight.bold};
  font-size: ${theme.typography.fontSize.md};
  color: ${theme.colors.text.primary};
`;

const FilePath = styled.div`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.xs};
  margin-top: ${theme.spacing.xs}px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.sm}px;
`;

const CodeBlock = styled.pre`
  margin: 0;
  max-height: 240px;
  overflow: auto;
  font-family: ${theme.typography.fontFamily.mono};
  font-size: ${theme.typography.fontSize.sm};
  background: ${theme.colors.ui.background};
  padding: ${theme.spacing.sm}px;
  border-radius: ${theme.radius.sm}px;
`;

const LoadingIndicator = styled.div`
  margin-top: ${theme.spacing.sm}px;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  
  &::before {
    content: '';
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid ${theme.colors.ui.border};
    border-top: 2px solid ${theme.colors.primary.main};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
`;

const DuplicateBadge = styled.div`
  position: absolute;
  top: -10px;
  left: 12px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #1c1917;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const FileCard = ({ fileState, onUpload, onExtract, onPreview, cardRef }) => {
  const {
    file,
    serverPath,
    classification,
    extraction,
    loading,
    highlighted,
    isDuplicate,
    isUploaded,
    isExtracted,
    duplicateInfo
  } = fileState;

  // Debug log to see what data we have
  console.log('[FileCard] Rendering with:', {
    filename: file?.name,
    isDuplicate,
    isUploaded,
    isExtracted,
    hasServerPath: !!serverPath,
    serverPath,
    hasExtraction: !!extraction,
    extractionData: extraction,
    extractionKeys: extraction ? Object.keys(extraction) : [],
    duplicateInfo
  });

  const handlePreview = () => {
    console.log('FileCard: Preview clicked for file:', fileState);
    if (onPreview) {
      onPreview(fileState);
    }
  };

  // Determine button states
  const uploadDisabled = !file || loading || isDuplicate || isUploaded;
  const extractDisabled = !serverPath || loading || isExtracted;
  const previewDisabled = !file;

  return (
    <Card ref={cardRef} highlighted={highlighted}>
      {isDuplicate && (
        <DuplicateBadge>
          ⚠️ DUPLICATE - Data Loaded
        </DuplicateBadge>
      )}
      {isDuplicate && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)',
          padding: '8px 12px',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '12px',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }}>
          {duplicateInfo?.originalFilename && duplicateInfo.originalFilename !== file?.name ? (
            <>
              📋 <strong>Same content as:</strong> {duplicateInfo.originalFilename}
              <br />
              <span style={{ fontSize: '11px', marginTop: '4px', display: 'inline-block' }}>
                Data loaded from original. Upload/Extract disabled.
              </span>
            </>
          ) : (
            <>
              📋 <strong>Exact duplicate:</strong> Previously uploaded.
              <br />
              <span style={{ fontSize: '11px', marginTop: '4px', display: 'inline-block' }}>
                Data loaded. Upload/Extract disabled.
              </span>
            </>
          )}
        </div>
      )}
      <CardHeader>
        <FileInfo>
          <FileName
            onClick={handlePreview}
            style={{
              cursor: 'pointer',
              color: '#6366f1',
              textDecoration: 'underline'
            }}
            title="Click to preview document"
          >
            {file ? file.name : 'No file chosen'}
          </FileName>
          {serverPath && <FilePath>{serverPath}</FilePath>}
          {isDuplicate && duplicateInfo && (
            <div style={{
              fontSize: '11px',
              color: '#f59e0b',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              Originally uploaded: {new Date(duplicateInfo.uploadedAt).toLocaleString()}
            </div>
          )}
        </FileInfo>
        <ButtonGroup>
          <button
            onClick={onUpload}
            disabled={uploadDisabled}
            title={isUploaded ? 'File already uploaded' : 'Upload file'}
          >
            {loading ? '⏳' : isUploaded ? '✅' : '📤'}
            {isUploaded ? 'Uploaded' : 'Upload'}
          </button>
          <button
            onClick={onExtract}
            disabled={extractDisabled}
            title={isExtracted ? 'Data already extracted' : 'Extract data'}
          >
            {loading ? '⏳' : isExtracted ? '✅' : '🧠'}
            {isExtracted ? 'Extracted' : 'Extract'}
          </button>
          <button
            onClick={handlePreview}
            disabled={previewDisabled}
            style={{
              background: '#6366f1',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: previewDisabled ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: previewDisabled ? 0.5 : 1
            }}
          >
            👁️ Preview
          </button>
        </ButtonGroup>
      </CardHeader>

      {/* Show extraction status */}
      {extraction && (
        <Collapsible
          title={`📊 Extraction Results ${extraction.error ? '(Error)' : '(Success)'}`}
          defaultOpen={isDuplicate ? true : false}
        >
          <CodeBlock>{JSON.stringify(extraction, null, 2)}</CodeBlock>
        </Collapsible>
      )}

      {loading && <LoadingIndicator>Processing...</LoadingIndicator>}

      {/* Show file status */}
      <div style={{
        marginTop: '10px',
        fontSize: '12px',
        color: 'var(--t-text-sub)',
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
      }}>
        {file && <span>📄 File selected</span>}
        {(serverPath || isUploaded) && <span>✅ Uploaded</span>}
        {(extraction || isExtracted) && <span>🧠 Extracted</span>}
        {loading && <span>⏳ Processing...</span>}
        {isDuplicate && <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⚠️ Duplicate</span>}
      </div>
    </Card>
  );
};

export default FileCard;
