import React, { useState } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';

const BarcodeContainer = styled.div`
  background: var(--t-card);
  border-radius: 16px;
  padding: ${theme.spacing.lg}px;
  margin-bottom: ${theme.spacing.lg}px;
  border: 1px solid ${theme.colors.ui.borderLight};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;

const BarcodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.lg}px;
  padding-bottom: ${theme.spacing.md}px;
  border-bottom: 1px solid ${theme.colors.ui.border};
`;

const BarcodeIcon = styled.div`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(32, 197, 180, 0.15) 0%, rgba(42, 179, 200, 0.15) 100%);
  border-radius: 12px;
  color: ${theme.colors.primary.main};
  box-shadow: 0 0 15px rgba(32, 197, 180, 0.2);
`;

const HeaderText = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.h3`
  color: ${theme.colors.text.primary};
  font-weight: ${theme.typography.fontWeight.semibold};
  font-size: ${theme.typography.fontSize.lg};
  margin: 0 0 4px 0;
`;

const HeaderSubtitle = styled.div`
  color: ${theme.colors.text.tertiary};
  font-size: ${theme.typography.fontSize.xs};
`;

const BarcodeCount = styled.span`
  background: ${theme.colors.primary.main};
  color: #0b1f26;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  box-shadow: 0 0 12px rgba(32, 197, 180, 0.3);
`;

const BarcodeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
`;

const BarcodeItem = styled.div`
  background: var(--t-card-elevated);
  border-radius: 12px;
  padding: ${theme.spacing.md}px;
  border-left: 3px solid ${props => props.type === 'QRCODE' ? theme.colors.primary.main : theme.colors.secondary.main};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const BarcodeItemHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.sm}px;
`;

const BarcodeMetadata = styled.div`
  display: flex;
  gap: ${theme.spacing.xs}px;
  align-items: center;
  flex-wrap: wrap;
`;

const BarcodeType = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.text.secondary};
  font-weight: ${theme.typography.fontWeight.medium};
  text-transform: uppercase;
  background: rgba(32, 197, 180, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(32, 197, 180, 0.2);
`;

const BarcodeText = styled.div`
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm};
  font-family: ${theme.typography.fontFamily.mono};
  word-break: break-all;
  padding: ${theme.spacing.sm}px;
  background: rgba(11, 31, 38, 0.5);
  border-radius: 8px;
  line-height: 1.6;
`;

const BarcodeActions = styled.div`
  display: flex;
  gap: ${theme.spacing.xs}px;
  margin-top: ${theme.spacing.sm}px;
`;

const ActionButton = styled.button`
  padding: 6px 12px;
  background: linear-gradient(135deg, rgba(32, 197, 180, 0.15) 0%, rgba(42, 179, 200, 0.15) 100%);
  color: ${theme.colors.primary.light};
  border: 1px solid rgba(32, 197, 180, 0.3);
  border-radius: 8px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, rgba(32, 197, 180, 0.25) 0%, rgba(42, 179, 200, 0.25) 100%);
    border-color: ${theme.colors.primary.main};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(32, 197, 180, 0.2);
  }

  &:active {
    transform: translateY(0);
  }
`;

const CopiedNotification = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  background: ${theme.colors.primary.main};
  color: #0b1f26;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  box-shadow: 0 4px 12px rgba(32, 197, 180, 0.4);
  z-index: 1000;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

const BarcodeViewer = ({ barcodes }) => {
  const [copiedText, setCopiedText] = useState(null);

  if (!barcodes || barcodes.length === 0) {
    return null;
  }

  const isUrl = (text) => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText('Barcode');
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <BarcodeContainer>
      <BarcodeHeader>
        <BarcodeIcon>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 4H10V10H4V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 4H20V10H14V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 14H10V20H4V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 14H20V20H14V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </BarcodeIcon>
        <HeaderText>
          <HeaderTitle>QR Codes & Barcodes</HeaderTitle>
          <HeaderSubtitle>Scanned from document</HeaderSubtitle>
        </HeaderText>
        <BarcodeCount>{barcodes.length}</BarcodeCount>
      </BarcodeHeader>

      <BarcodeList>
        {barcodes.map((barcode, index) => (
          <BarcodeItem key={index} type={barcode.type}>
            <BarcodeItemHeader>
              <BarcodeMetadata>
                <BarcodeType>
                  {barcode.type === 'QRCODE' ? '⊞' : '|||'} {barcode.type}
                </BarcodeType>
              </BarcodeMetadata>
            </BarcodeItemHeader>

            <BarcodeText>{barcode.text || '(empty)'}</BarcodeText>

            <BarcodeActions>
              <ActionButton onClick={() => copyToClipboard(barcode.text)}>
                📋 Copy
              </ActionButton>
              {isUrl(barcode.text) && (
                <ActionButton onClick={() => window.open(barcode.text, '_blank', 'noopener,noreferrer')}>
                  🔗 Open Link
                </ActionButton>
              )}
            </BarcodeActions>
          </BarcodeItem>
        ))}
      </BarcodeList>

      {copiedText && (
        <CopiedNotification>
          ✓ {copiedText} copied to clipboard!
        </CopiedNotification>
      )}
    </BarcodeContainer>
  );
};

export default BarcodeViewer;
