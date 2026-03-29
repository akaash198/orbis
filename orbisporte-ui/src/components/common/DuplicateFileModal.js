/**
 * DuplicateFileModal Component
 *
 * Modal that displays when user tries to upload duplicate files.
 * Shows warning and highlights the existing file in the list.
 */

import React from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const ModalContent = styled.div`
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.xl}px;
  padding: ${theme.spacing.xl}px;
  max-width: 500px;
  width: 90%;
  box-shadow: ${theme.shadows.modal};
  animation: slideUp 0.3s ease-out;

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const WarningIcon = styled.div`
  font-size: 48px;
  animation: bounce 0.5s ease-in-out;

  @keyframes bounce {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }
`;

const ModalTitle = styled.h2`
  color: ${theme.colors.status.warning};
  margin: 0;
  font-size: ${theme.typography.fontSize.xl};
  font-weight: ${theme.typography.fontWeight.bold};
`;

const ModalBody = styled.div`
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.lg}px;
`;

const DuplicateList = styled.div`
  background: ${theme.colors.ui.background};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  margin-top: ${theme.spacing.md}px;
  max-height: 200px;
  overflow-y: auto;
`;

const DuplicateItem = styled.div`
  padding: ${theme.spacing.sm}px;
  margin-bottom: ${theme.spacing.sm}px;
  background: ${theme.colors.ui.heroBackground};
  border-left: 3px solid ${theme.colors.status.warning};
  border-radius: ${theme.radius.sm}px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const FileName = styled.div`
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.xs}px;
  word-break: break-word;
`;

const FileInfo = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.text.secondary};
  display: flex;
  gap: ${theme.spacing.md}px;
`;

const InfoItem = styled.span`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs}px;
`;

const ModalFooter = styled.div`
  display: flex;
  gap: ${theme.spacing.sm}px;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  border-radius: ${theme.radius.md}px;
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  border: none;
  font-size: ${theme.typography.fontSize.md};
`;

const PrimaryButton = styled(Button)`
  background: ${theme.colors.primary.main};
  color: white;

  &:hover {
    background: ${theme.colors.primary.dark};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const SecondaryButton = styled(Button)`
  background: transparent;
  color: ${theme.colors.text.primary};
  border: 1px solid ${theme.colors.ui.border};

  &:hover {
    background: ${theme.colors.ui.heroBackground};
  }
`;

const RescanButton = styled(Button)`
  background: ${theme.colors.status.warning};
  color: #000;
  font-weight: ${theme.typography.fontWeight.bold};

  &:hover {
    background: #f59e0b;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const DuplicateFileModal = ({ duplicates, onClose, onShowExisting, onRescan }) => {
  if (!duplicates || duplicates.length === 0) return null;

  const hasLocalDuplicate = duplicates.some(dup => dup.duplicateType === 'local');
  const hasDatabaseDuplicate = duplicates.some(dup => dup.duplicateType === 'database');

  const handleShowExisting = () => {
    // Find the first local duplicate
    const localDup = duplicates.find(dup => dup.duplicateType === 'local');
    if (onShowExisting && localDup && localDup.existingIndex !== undefined) {
      onShowExisting(localDup.existingIndex);
    }
    onClose();
  };

  const handleRescan = () => {
    // Pass the duplicates to the parent component for rescanning
    if (onRescan) {
      onRescan(duplicates);
    }
    onClose();
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <WarningIcon>⚠️</WarningIcon>
          <ModalTitle>Duplicate File{duplicates.length > 1 ? 's' : ''} Detected</ModalTitle>
        </ModalHeader>

        <ModalBody>
          <p>
            {duplicates.length === 1
              ? 'This file has already been uploaded:'
              : `${duplicates.length} files have already been uploaded:`}
          </p>

          <DuplicateList>
            {duplicates.map((dup, idx) => {
              const isDatabaseDup = dup.duplicateType === 'database';
              const existingFileInfo = dup.existingFile;

              // Check if filename is different from original
              const originalFilename = isDatabaseDup
                ? existingFileInfo?.filename
                : existingFileInfo?.file?.name;
              const isDifferentName = originalFilename && originalFilename !== dup.file.name;

              return (
                <DuplicateItem key={idx}>
                  <FileName>📄 {dup.file.name}</FileName>
                  {isDifferentName && (
                    <div style={{
                      fontSize: '11px',
                      color: '#f59e0b',
                      marginTop: '4px',
                      marginBottom: '4px',
                      padding: '4px 8px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderRadius: '4px',
                      fontStyle: 'italic',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      ⚠️ Same content as: <strong>{originalFilename}</strong>
                    </div>
                  )}
                  <FileInfo>
                    <InfoItem>
                      📦 <span>{formatFileSize(dup.file.size)}</span>
                    </InfoItem>
                    {isDatabaseDup ? (
                      <>
                        <InfoItem>
                          💾 <span>Previously uploaded in past session</span>
                        </InfoItem>
                        {existingFileInfo?.uploaded_at && (
                          <InfoItem>
                            🕒 <span>{new Date(existingFileInfo.uploaded_at).toLocaleString()}</span>
                          </InfoItem>
                        )}
                      </>
                    ) : (
                      <>
                        <InfoItem>
                          💾 <span>Already in current session</span>
                        </InfoItem>
                        <InfoItem>
                          🕒 <span>{formatDate(existingFileInfo?.timestamp)}</span>
                        </InfoItem>
                      </>
                    )}
                  </FileInfo>
                </DuplicateItem>
              );
            })}
          </DuplicateList>

          <p style={{ marginTop: theme.spacing.md + 'px', color: theme.colors.text.secondary }}>
            {(() => {
              // Check if any duplicate has a different filename
              const hasDifferentFilename = duplicates.some(dup => {
                const originalFilename = dup.existingFile?.filename || dup.existingFile?.file?.name;
                return originalFilename && originalFilename !== dup.file.name;
              });

              if (hasDatabaseDuplicate && hasDifferentFilename) {
                return `Same content, different name. File added with existing data. Upload/Extract disabled.`;
              } else if (hasDatabaseDuplicate) {
                return `File added with existing data from previous session. Upload/Extract disabled.`;
              } else if (hasLocalDuplicate && hasDifferentFilename) {
                return `Same content detected. File added with existing data. Upload/Extract disabled.`;
              } else {
                return `This exact file is already in your list and will NOT be added again.`;
              }
            })()}
          </p>
        </ModalBody>

        <ModalFooter>
          {hasLocalDuplicate && (
            <SecondaryButton onClick={handleShowExisting}>
              Show Existing File
            </SecondaryButton>
          )}
          <RescanButton onClick={handleRescan}>
            Rescan
          </RescanButton>
          <PrimaryButton onClick={onClose}>
            Got It
          </PrimaryButton>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

export default DuplicateFileModal;
