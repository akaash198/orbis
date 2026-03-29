/**
 * DocumentPanel Component
 * 
 * Panel for document processing, including upload, classification, and extraction.
 */

import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import FileCard from '../common/FileCard';
import useDocumentProcessing from '../../hooks/useDocumentProcessing';
import { hsCodeService, chatService, API_URL as BACKEND_URL, apiClient, m02Service } from '../../services/api';
import JsonViewer from '../common/JsonViewer';
import DocumentPreviewModal, { validateFile } from '../common/DocumentPreviewModal';

const PanelContainer = styled.div`
  padding: ${theme.spacing.md}px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${theme.colors.ui.background};
  color: ${theme.colors.text.primary};
  overflow: auto;
`;

const ContentContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.xl}px;
  height: calc(100% - 80px); /* Adjust height to account for metrics row */
`;

const UploadSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
`;

const UploadArea = styled.div`
  padding: ${theme.spacing.xl}px;
  border: 2px dashed ${theme.colors.ui.border};
  border-radius: ${theme.radius.xl}px;
  background: ${theme.colors.ui.backgroundDark};
  transition: all ${theme.transitions.normal} cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.08), transparent);
    transition: left 0.5s;
  }
  
  &:hover {
    border-color: ${theme.colors.primary.light};
    background: ${theme.colors.ui.card};
    transform: translateY(-2px);
    box-shadow: ${theme.shadows.cardHover};
    
    &::before {
      left: 100%;
    }
  }
  
  &:active {
    transform: translateY(-1px);
  }
`;

const UploadTitle = styled.div`
  font-size: ${theme.typography.fontSize.xl};
  font-weight: ${theme.typography.fontWeight.bold};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.sm}px;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  position: relative;
  z-index: 2;
  
  &::before {
    content: '📤';
    font-size: 1.2em;
  }
`;

const UploadHint = styled.div`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.sm};
  margin-top: ${theme.spacing.sm}px;
  position: relative;
  z-index: 2;
`;

const ValidationMessage = styled.div`
  margin-top: ${theme.spacing.sm}px;
  padding: ${theme.spacing.sm}px;
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.sm};
  
  &.error {
    background: ${theme.colors.status.errorLight};
    color: ${theme.colors.status.error};
    border: 1px solid ${theme.colors.status.error};
  }
  
  &.success {
    background: ${theme.colors.status.successLight};
    color: ${theme.colors.status.success};
    border: 1px solid ${theme.colors.status.success};
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileInputLabel = styled.label`
  display: block;
  width: 100%;
  height: 100%;
  cursor: pointer;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
`;

const BulkActions = styled.div`
  display: flex;
  gap: ${theme.spacing.sm}px;
`;

const BulkButton = styled.button`
  background: ${theme.colors.primary.main};
  color: white;
  border: none;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: background ${theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${theme.colors.primary.dark};
  }

  &:disabled {
    background: ${theme.colors.text.disabled};
    cursor: not-allowed;
  }
`;

const FilesList = styled.div`
  height: calc(100vh - 400px); /* Adjusted for metrics row */
  overflow: auto;
  padding-right: ${theme.spacing.sm}px;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
`;

const EmptyMessage = styled.div`
  color: ${theme.colors.text.tertiary};
  padding: ${theme.spacing.xl}px;
  text-align: center;
  background: ${theme.colors.ui.cardGradient};
  border-radius: ${theme.radius.lg}px;
  border: 1px solid ${theme.colors.ui.borderLight};
  font-style: italic;
  
  &::before {
    content: '📄';
    font-size: 2em;
    display: block;
    margin-bottom: ${theme.spacing.sm}px;
    opacity: 0.5;
  }
`;

// Collapsible left sidebar styles
const AppLayout = styled.div`
  display: grid;
  grid-template-columns: ${props => props.sidebarOpen ? '1fr 280px' : '1fr 56px'};
  gap: ${theme.spacing.md}px;
  height: calc(100vh - 140px);
  flex: 1;
`;

const Sidebar = styled.aside`
  background: ${theme.colors.ui.cardGradient};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: ${theme.shadows.card};
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.md}px ${theme.spacing.md}px;
  border-bottom: 1px solid ${theme.colors.ui.borderLight};
`;

const SidebarTitle = styled.div`
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SidebarToggle = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.ui.borderLight};
  color: ${theme.colors.text.secondary};
  width: 32px;
  height: 28px;
  border-radius: ${theme.radius.sm}px;
  cursor: pointer;
`;

const SidebarList = styled.div`
  overflow: auto;
  padding: ${theme.spacing.sm}px ${theme.spacing.sm}px;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs}px;
`;

const SidebarItem = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: ${theme.spacing.sm}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.sm}px;
  border: 2px solid ${props => props.highlighted ? '#fbbf24' : theme.colors.ui.borderLight};
  border-radius: ${theme.radius.md}px;
  background: ${props => props.highlighted
    ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(250, 204, 21, 0.2) 100%)'
    : theme.colors.ui.card};
  box-shadow: ${props => props.highlighted
    ? '0 0 0 3px rgba(251, 191, 36, 0.4), 0 0 15px rgba(251, 191, 36, 0.5)'
    : 'none'};
  animation: ${props => props.highlighted ? 'sidebarPulse 0.6s ease-in-out 4' : 'none'};
  transition: all ${theme.transitions.normal};
  position: relative;

  @keyframes sidebarPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.4), 0 0 15px rgba(251, 191, 36, 0.5);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 0 5px rgba(251, 191, 36, 0.6), 0 0 25px rgba(251, 191, 36, 0.7);
    }
  }
`;

const SidebarFileName = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
`;

const SidebarActions = styled.div`
  display: flex;
  gap: ${theme.spacing.xs}px;
  align-items: center;
  > button {
    background: ${theme.colors.ui.background};
    border: 1px solid ${theme.colors.ui.borderLight};
    color: ${theme.colors.text.secondary};
    padding: 4px 6px;
    border-radius: ${theme.radius.sm}px;
    font-size: 11px;
    cursor: pointer;
  }
`;

const MainColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg}px;
`;

// Chat interface styles integrated into DocumentPanel
const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${theme.colors.ui.cardGradient};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  overflow: hidden;
  box-shadow: ${theme.shadows.card};
`;

const ChatHeader = styled.div`
  background: linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.primary.dark});
  color: white;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--t-border);
  flex-shrink: 0;
`;

const ChatTitle = styled.div`
  font-weight: ${theme.typography.fontWeight.semibold};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
`;

const ChatMessages = styled.div`
  flex: 1;
  padding: ${theme.spacing.md}px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
`;

const MessageBubble = styled.div`
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: ${props => props.isUser ? theme.colors.feature.userMessage : theme.colors.feature.aiMessage};
  border-radius: ${theme.radius.md}px;
  max-width: 90%;
  align-self: ${props => props.isUser ? 'flex-end' : 'flex-start'};
`;

const MessageSender = styled.div`
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.text.secondary};
  margin-bottom: ${theme.spacing.xs}px;
`;

const MessageContent = styled.div`
  word-break: break-word;
`;

const DocumentReference = styled.div`
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.secondary.dark};
  background: ${theme.colors.status.successLight};
  padding: ${theme.spacing.xs}px;
  border-radius: ${theme.radius.sm}px;
  margin-top: ${theme.spacing.xs}px;
`;

const ChatInputContainer = styled.div`
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  border-top: 1px solid ${theme.colors.ui.border};
  background: var(--t-bg-dark);
  display: flex;
  gap: ${theme.spacing.sm}px;
  align-items: center;
  flex-shrink: 0;
`;

const InputActionButtons = styled.div`
  display: flex;
  gap: ${theme.spacing.xs}px;
`;

const ActionButton = styled.button`
  background: ${props => props.active ? theme.colors.status.error : theme.colors.ui.background};
  color: ${props => props.active ? 'white' : theme.colors.text.secondary};
  border: 1px solid ${theme.colors.ui.borderLight};
  padding: ${theme.spacing.sm}px;
  border-radius: ${theme.radius.md}px;
  cursor: pointer;
  font-size: ${theme.typography.fontSize.md};
  transition: all ${theme.transitions.fast};
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover:not(:disabled) {
    background: ${props => props.active ? theme.colors.status.errorDark : theme.colors.ui.card};
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ChatInput = styled.input`
  flex: 1;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  font-family: ${theme.typography.fontFamily.main};
  font-size: ${theme.typography.fontSize.sm};
  background: ${theme.colors.ui.background};
  color: ${theme.colors.text.primary};
  height: 36px;
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 2px ${theme.colors.primary.light}40;
    background: ${theme.colors.ui.card};
  }
  
  &::placeholder {
    color: ${theme.colors.text.tertiary};
  }
`;

const SendButton = styled.button`
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  background: ${theme.colors.primary.main};
  color: white;
  border: none;
  border-radius: ${theme.radius.md}px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  transition: all ${theme.transitions.fast};
  font-weight: ${theme.typography.fontWeight.medium};
  font-size: ${theme.typography.fontSize.sm};
  height: 36px;
  
  &:hover:not(:disabled) {
    background-color: ${theme.colors.primary.dark};
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: ${theme.colors.feature.aiMessage};
  border-radius: ${theme.radius.md}px;
  
  &::before {
    content: '';
    width: 16px;
    height: 16px;
    border: 2px solid ${theme.colors.ui.border};
    border-top: 2px solid ${theme.colors.primary.main};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;


const ItemsGrid = styled.div`
  display: grid;
  gap: ${theme.spacing.sm}px;
  margin-top: ${theme.spacing.md}px;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
`;

const ItemCard = styled.div`
  background: transparent;
  border-bottom: 1px solid ${theme.colors.ui.borderLight};
  padding: ${theme.spacing.sm}px 0;
  
  &:last-child {
    border-bottom: none;
  }
`;

const ItemDetail = styled.div`
  margin-bottom: ${theme.spacing.xs}px;
  font-size: ${theme.typography.fontSize.sm};
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: ${theme.spacing.xs}px;
  align-items: baseline;
  
  strong {
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.secondary};
  }
`;

const HSCodeBadge = styled.span`
  color: ${props => 
    props.status === 'found' ? theme.colors.status.success :
    props.status === 'not-found' ? theme.colors.status.warning :
    theme.colors.status.error
  };
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.medium};
`;

// Styled components for the summary display
const ExtractedSummaryContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const SummarySection = styled.div`
  padding: ${theme.spacing.sm}px;
  border-bottom: 1px solid ${theme.colors.ui.borderLight};
`;

const SummaryHeading = styled.div`
  font-weight: ${theme.typography.fontWeight.semibold};
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.text.secondary};
  margin-bottom: ${theme.spacing.xs}px;
`;

const SummaryContent = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.text.primary};
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.spacing.xs}px ${theme.spacing.md}px;
`;

const SummaryDetail = styled.div`
  display: flex;
  gap: ${theme.spacing.xs}px;
  align-items: baseline;
  
  strong {
    color: ${theme.colors.text.secondary};
    font-weight: ${theme.typography.fontWeight.medium};
  }
`;

// ViewRawButton removed (unused)

// Metrics styled components simplified elsewhere; keep existing inline layout in JSX

// Minimal metrics styled components (used in JSX)
const MetricsRow = styled.div`
  display: flex;
  gap: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.md}px;
  padding: ${theme.spacing.md}px;
  background: ${theme.colors.ui.backgroundDark};
  border-radius: ${theme.radius.lg}px;
`;

const MetricCard = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.sm}px;
  background: ${theme.colors.ui.cardGradient};
  border-radius: ${theme.radius.md}px;
`;

const MetricValue = styled.div`
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.bold};
  color: ${theme.colors.primary.light};
`;

const MetricLabel = styled.div`
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.text.secondary};
`;

// Toggle switch styled components - Professional & Attractive Design
const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  background: ${props => props.active
    ? 'linear-gradient(135deg, rgba(32, 197, 180, 0.1) 0%, rgba(42, 179, 200, 0.1) 100%)'
    : 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(30, 41, 59, 0.2) 100%)'
  };
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid ${props => props.active ? 'rgba(32, 197, 180, 0.3)' : theme.colors.ui.border};
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: ${props => props.active
    ? '0 4px 12px rgba(32, 197, 180, 0.15), 0 0 0 1px rgba(32, 197, 180, 0.1) inset'
    : '0 2px 8px rgba(0, 0, 0, 0.1)'
  };

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(32, 197, 180, 0.1), transparent);
    transition: left 0.5s;
  }

  &:hover {
    transform: translateY(-2px);
    border-color: ${props => props.active ? 'rgba(32, 197, 180, 0.5)' : 'rgba(42, 179, 200, 0.3)'};
    box-shadow: ${props => props.active
      ? '0 6px 20px rgba(32, 197, 180, 0.25), 0 0 0 1px rgba(32, 197, 180, 0.2) inset'
      : '0 4px 12px rgba(42, 179, 200, 0.15)'
    };

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(0);
  }
`;

const ToggleLabel = styled.span`
  font-size: ${theme.typography.fontSize.sm};
  color: ${props => props.active ? '#4fe0d1' : theme.colors.text.primary};
  font-weight: ${theme.typography.fontWeight.semibold};
  flex: 1;
  letter-spacing: 0.3px;
  transition: color 0.3s ease;
  text-shadow: ${props => props.active ? '0 0 10px rgba(32, 197, 180, 0.3)' : 'none'};
`;

const ToggleSwitch = styled.div`
  position: relative;
  width: 52px;
  height: 28px;
  background: ${props => props.active
    ? 'linear-gradient(135deg, #20c5b4 0%, #2ab3c8 100%)'
    : 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)'
  };
  border-radius: 50px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  box-shadow: ${props => props.active
    ? '0 0 20px rgba(32, 197, 180, 0.4), inset 0 1px 3px rgba(0, 0, 0, 0.2)'
    : 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
  };
  border: 2px solid ${props => props.active ? 'rgba(79, 224, 209, 0.3)' : 'rgba(71, 85, 105, 0.3)'};

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${props => props.active ? 'calc(100% - 22px - 3px)' : '3px'};
    width: 22px;
    height: 22px;
    background: ${props => props.active
      ? 'linear-gradient(135deg, #ffffff 0%, #e0f9f6 100%)'
      : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)'
    };
    border-radius: 50%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: ${props => props.active
      ? '0 2px 8px rgba(0, 0, 0, 0.2), 0 0 12px rgba(32, 197, 180, 0.3)'
      : '0 2px 6px rgba(0, 0, 0, 0.3)'
    };
  }

  &:hover::after {
    box-shadow: ${props => props.active
      ? '0 3px 10px rgba(0, 0, 0, 0.25), 0 0 16px rgba(32, 197, 180, 0.4)'
      : '0 3px 8px rgba(0, 0, 0, 0.35)'
    };
  }
`;

const ToggleIcon = styled.span`
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: ${props => props.active
    ? 'linear-gradient(135deg, rgba(32, 197, 180, 0.2) 0%, rgba(42, 179, 200, 0.2) 100%)'
    : 'rgba(51, 65, 85, 0.3)'
  };
  transition: all 0.3s ease;
  box-shadow: ${props => props.active
    ? '0 0 15px rgba(32, 197, 180, 0.3)'
    : 'none'
  };
  filter: ${props => props.active ? 'brightness(1.2)' : 'brightness(0.9)'};
`;

// Extraction Loading Modal styled components
const ExtractionModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ExtractionModalContent = styled.div`
  background: ${theme.colors.ui.card};
  border: 2px solid ${theme.colors.primary.main};
  border-radius: ${theme.radius.xl}px;
  padding: ${theme.spacing.xl}px ${theme.spacing.xxl}px;
  max-width: 500px;
  width: 90%;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
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

const ExtractionSpinner = styled.div`
  width: 60px;
  height: 60px;
  margin: 0 auto ${theme.spacing.lg}px;
  border: 4px solid ${theme.colors.ui.border};
  border-top: 4px solid ${theme.colors.primary.main};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ExtractionTitle = styled.h3`
  color: ${theme.colors.primary.light};
  font-size: ${theme.typography.fontSize.xl};
  font-weight: ${theme.typography.fontWeight.bold};
  margin: 0 0 ${theme.spacing.md}px 0;
`;

const ExtractionMessage = styled.p`
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.md};
  margin: 0 0 ${theme.spacing.sm}px 0;
`;

const ExtractionFilename = styled.p`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.sm};
  font-style: italic;
  margin: 0;
  word-break: break-word;
`;

// ── M02 Pipeline Results Panel ────────────────────────────────────────────────
const CONFIDENCE_COLOR = (score) => {
  if (score === null || score === undefined) return '#64748b';
  if (score >= 0.95) return '#16a34a';
  if (score >= 0.90) return '#ca8a04';
  if (score >= 0.70) return '#ea580c';
  return '#dc2626';
};

const CONFIDENCE_LABEL = (score) => {
  if (score === null || score === undefined) return 'N/A';
  if (score >= 0.95) return 'Auto';
  if (score >= 0.90) return 'Soft Review';
  if (score >= 0.70) return 'Hard Review';
  return 'Quality Alert';
};

const PIPELINE_STAGES = ['OCR', 'Layout', 'Identify', 'Extract', 'GLiNER', 'Normalise', 'Confidence', 'Route'];

function M02Panel({ m02State, fileState, onClose, onSubmitReview, onDownloadJson }) {
  const [editedFields, setEditedFields]   = useState({});
  const [submitted, setSubmitted]         = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState(null);
  const [activeTab, setActiveTab]         = useState('fields'); // 'fields' | 'corrections' | 'json'

  const { status, result, error } = m02State;
  const filename = fileState?.file?.name || fileState?.name || 'Document';

  // Fields that need manual correction
  const lowFields  = Object.keys(result?.fields_low        || {});
  const hardFields = Object.keys(result?.fields_hard_review || {});
  const softFields = Object.keys(result?.fields_soft_review || {});
  const allReviewFields = [...new Set([...lowFields, ...hardFields, ...softFields])];

  // How many review fields have been touched by the user
  const correctedCount = allReviewFields.filter(f => editedFields[f] !== undefined && editedFields[f] !== '').length;

  const handleFieldEdit = (key, value) => {
    setEditedFields(prev => ({ ...prev, [key]: value }));
    setSaveError(null);
  };

  const handleSaveCorrections = async () => {
    const merged = { ...(result?.normalised_fields || {}), ...editedFields };
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmitReview(merged);
      setSubmitted(true);
    } catch (err) {
      setSaveError(err?.response?.data?.detail || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Switch to corrections tab automatically when quality_alert
  useEffect(() => {
    if (result?.quality_alert && activeTab === 'fields') {
      setActiveTab('corrections');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.quality_alert]);

  const queueColor = {
    auto: '#16a34a',
    soft_review: '#ca8a04',
    hard_review: '#ea580c',
    quality_alert: '#dc2626',
    pending: '#6366f1',
    processing: '#6366f1',
    error: '#dc2626',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--t-card)', border: '1px solid var(--t-border)', borderRadius: 12,
        width: '90%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto',
        padding: 24, position: 'relative', color: 'var(--t-text)'
      }}>
        <style>{`@keyframes m02pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, background: 'transparent', border: 'none', color: 'var(--t-text-sub)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        <h2 style={{ margin: '0 0 4px', color: 'var(--t-btn-color)', fontSize: 18 }}>M02 AI Extraction Pipeline</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--t-text-sub)', fontSize: 13 }}>{filename}</p>

        {/* Pipeline stage progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const done = status === 'done';
            const running = status === 'starting' || status === 'processing';
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: done ? '#1e3a2f' : running ? '#1e3a5f' : 'var(--t-bg-dark)',
                  border: `1px solid ${done ? '#16a34a' : running ? '#60a5fa' : 'var(--t-border)'}`,
                  color: done ? '#4ade80' : running ? 'var(--t-btn-color)' : 'var(--t-text-sub)',
                  animation: running ? 'm02pulse 1.5s ease-in-out infinite' : 'none',
                  animationDelay: running ? `${i * 0.15}s` : '0s',
                }}>
                  {done ? '✓ ' : running ? '⟳ ' : ''}{stage}
                </div>
                {i < PIPELINE_STAGES.length - 1 && <span style={{ color: running ? '#60a5fa' : 'var(--t-text-sub)' }}>→</span>}
              </div>
            );
          })}
        </div>

        {status === 'starting' || status === 'processing' ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--t-btn-color)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⟳</div>
            <div>Running M02 pipeline... This may take 30-60 seconds.</div>
            <div style={{ fontSize: 12, color: 'var(--t-text-sub)', marginTop: 8 }}>OCR → Layout → Field Extraction → GLiNER → Normalisation → Confidence → Routing</div>
          </div>
        ) : status === 'error' ? (
          <div style={{ color: '#f87171', padding: 16, background: '#450a0a', borderRadius: 8 }}>
            Pipeline error: {error || 'Unknown error'}
          </div>
        ) : status === 'done' && result && result.review_status === 'error' ? (
          <div style={{ color: '#f87171', padding: 20, background: '#450a0a', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⚠</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Pipeline failed on the server</div>
            <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 16 }}>
              The document was received but extraction could not complete. Check backend logs for details.
            </div>
            <button
              onClick={() => { onClose(); }}
              style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
            >
              Close &amp; Retry
            </button>
          </div>
        ) : status === 'done' && result ? (
          <>
            {/* Document Type Identification Banner */}
            {result.document_type && result.document_type !== 'unknown' ? (
              <div style={{
                background: (result.document_type_color || '#3b82f6') + '18',
                border: `2px solid ${result.document_type_color || '#3b82f6'}`,
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}>
                <div style={{ fontSize: 32 }}>{result.document_type_icon || '📄'}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: 'var(--t-text-sub)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                    Document Identified
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: result.document_type_color || '#3b82f6', lineHeight: 1.2 }}>
                    {result.document_type_display || result.document_type}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t-text-sub)', marginTop: 3 }}>
                    {result.document_type_description || ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginBottom: 2 }}>Confidence</div>
                  <div style={{
                    fontSize: 22, fontWeight: 800,
                    color: result.document_type_confidence >= 0.85 ? '#16a34a'
                         : result.document_type_confidence >= 0.70 ? '#ca8a04'
                         : '#ea580c',
                  }}>
                    {result.document_type_confidence != null
                      ? `${(result.document_type_confidence * 100).toFixed(0)}%`
                      : 'N/A'}
                  </div>
                </div>
                {result.document_type_signals && result.document_type_signals.length > 0 && (
                  <div style={{ width: '100%', marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-sub)', marginRight: 2 }}>Signals:</span>
                    {result.document_type_signals.slice(0, 6).map((sig, i) => (
                      <span key={i} style={{
                        fontSize: 10, background: 'var(--t-card)', border: '1px solid var(--t-border)',
                        borderRadius: 4, padding: '2px 6px', color: 'var(--t-text-sub)',
                      }}>{sig}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: 'var(--t-card)', border: '1px solid var(--t-border)', borderRadius: 10,
                padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 24 }}>❓</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-sub)' }}>Document type could not be identified</div>
                  <div style={{ fontSize: 11, color: 'var(--t-text-sub)' }}>Extraction was performed using the generic template</div>
                </div>
              </div>
            )}

            {/* Summary row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120, background: 'var(--t-card)', borderRadius: 8, padding: '10px 14px', border: `2px solid ${queueColor[result.review_queue] || 'var(--t-border)'}` }}>
                <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginBottom: 4 }}>REVIEW QUEUE</div>
                <div style={{ fontWeight: 700, color: queueColor[result.review_queue] || 'var(--t-text)', fontSize: 14 }}>
                  {(result.review_queue || 'N/A').replace('_', ' ').toUpperCase()}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 120, background: 'var(--t-card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--t-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginBottom: 4 }}>OVERALL CONFIDENCE</div>
                <div style={{ fontWeight: 700, color: CONFIDENCE_COLOR(result.overall_confidence), fontSize: 20 }}>
                  {result.overall_confidence != null ? `${(result.overall_confidence * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 120, background: 'var(--t-card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--t-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginBottom: 4 }}>STATUS</div>
                <div style={{ fontWeight: 700, color: 'var(--t-btn-color)', fontSize: 14 }}>
                  {submitted ? '✅ APPROVED' : (result.review_status || 'pending').replace('_', ' ').toUpperCase()}
                </div>
              </div>
              {result.pipeline_duration_ms && (
                <div style={{ flex: 1, minWidth: 120, background: 'var(--t-card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--t-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginBottom: 4 }}>PIPELINE TIME</div>
                  <div style={{ fontWeight: 700, color: 'var(--t-text)', fontSize: 14 }}>{(result.pipeline_duration_ms / 1000).toFixed(1)}s</div>
                </div>
              )}
            </div>

            {/* Quality alert banner with progress */}
            {result.quality_alert && !submitted && (
              <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ color: '#f87171', fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                      ⚠ Quality Alert — HITL (Manual Correction and Approval Required)
                    </div>
                    <div style={{ color: '#fca5a5', fontSize: 12 }}>
                      {lowFields.length} field{lowFields.length !== 1 ? 's' : ''} have confidence below 70%. Please review and correct them before approving.
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('corrections')}
                    style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Go to Corrections →
                  </button>
                </div>
                {allReviewFields.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#7f1d1d', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round((correctedCount / allReviewFields.length) * 100)}%`, background: correctedCount === allReviewFields.length ? '#16a34a' : '#f59e0b', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#fca5a5', whiteSpace: 'nowrap' }}>
                        {correctedCount}/{allReviewFields.length} corrected
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Soft/hard review banner */}
            {!result.quality_alert && allReviewFields.length > 0 && !submitted && (
              <div style={{ background: '#431407', border: '1px solid #ea580c', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ color: '#fb923c', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                      🔍 Human Review Needed — {allReviewFields.length} field{allReviewFields.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ color: '#fed7aa', fontSize: 12 }}>
                      {hardFields.length > 0 && `${hardFields.length} hard review`}
                      {hardFields.length > 0 && softFields.length > 0 && ' · '}
                      {softFields.length > 0 && `${softFields.length} soft review`}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('corrections')}
                    style={{ background: '#ea580c', color: 'white', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Review Fields →
                  </button>
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { key: 'fields', label: 'All Fields' },
                  { key: 'corrections', label: `Corrections${allReviewFields.length > 0 ? ` (${allReviewFields.length})` : ''}`, highlight: allReviewFields.length > 0 },
                  { key: 'json', label: 'JSON' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                      border: tab.highlight && activeTab !== tab.key ? '1px solid #ea580c' : 'none',
                      background: activeTab === tab.key ? '#1d4ed8' : 'var(--t-card)',
                      color: activeTab === tab.key ? 'white' : tab.highlight ? '#fb923c' : 'var(--t-text-sub)',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {onDownloadJson && (
                <button
                  onClick={onDownloadJson}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', background: '#065f46', border: '1px solid #10b981', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  ⬇ Download JSON
                </button>
              )}
            </div>

            {/* ── CORRECTIONS TAB ── */}
            {activeTab === 'corrections' && (
              <>
                {submitted || result.review_status === 'approved' ? (
                  <ApprovedBanner />
                ) : allReviewFields.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#4ade80', fontSize: 14 }}>
                    ✓ No fields require correction — all confidence scores are acceptable.
                    <div style={{ marginTop: 16 }}>
                      <SaveButton onClick={handleSaveCorrections} saving={saving} label="Approve & Continue" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--t-text-sub)', marginBottom: 12 }}>
                      Edit the values below. Changes are uploaded automatically when you click <strong style={{ color: 'var(--t-text)' }}>Save &amp; Approve</strong>.
                    </div>

                    {/* Low confidence fields (quality_alert) */}
                    {lowFields.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                          Very Low Confidence (&lt;70%) — {lowFields.length} field{lowFields.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                          {lowFields.map(key => (
                            <CorrectionField
                              key={key}
                              fieldKey={key}
                              result={result}
                              editedFields={editedFields}
                              onEdit={handleFieldEdit}
                              borderColor="#dc2626"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hard review fields */}
                    {hardFields.filter(f => !lowFields.includes(f)).length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                          Hard Review (70–89%) — needs re-entry
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                          {hardFields.filter(f => !lowFields.includes(f)).map(key => (
                            <CorrectionField
                              key={key}
                              fieldKey={key}
                              result={result}
                              editedFields={editedFields}
                              onEdit={handleFieldEdit}
                              borderColor="#ea580c"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Soft review fields */}
                    {softFields.filter(f => !lowFields.includes(f) && !hardFields.includes(f)).length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                          Soft Review (90–94%) — confirm AI value
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                          {softFields.filter(f => !lowFields.includes(f) && !hardFields.includes(f)).map(key => (
                            <CorrectionField
                              key={key}
                              fieldKey={key}
                              result={result}
                              editedFields={editedFields}
                              onEdit={handleFieldEdit}
                              borderColor="#f59e0b"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress + save button */}
                    {allReviewFields.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--t-card)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round((correctedCount / allReviewFields.length) * 100)}%`, background: correctedCount === allReviewFields.length ? '#16a34a' : '#f59e0b', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--t-text-sub)', whiteSpace: 'nowrap' }}>
                          {correctedCount}/{allReviewFields.length} corrected
                        </span>
                      </div>
                    )}

                    {saveError && (
                      <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: 6, padding: '8px 12px', marginBottom: 10, color: '#f87171', fontSize: 12 }}>
                        ✕ {saveError}
                      </div>
                    )}

                    <SaveButton onClick={handleSaveCorrections} saving={saving} label="Save Corrections & Approve" />
                  </>
                )}
              </>
            )}

            {/* ── ALL FIELDS TAB ── */}
            {activeTab === 'fields' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginBottom: 20 }}>
                  {Object.entries(result.normalised_fields || result.extracted_fields || {}).map(([key, value]) => {
                    if (key === 'line_items') return null;
                    const score = result.confidence_scores?.[key];
                    const needsReview = allReviewFields.includes(key);
                    const isArray = Array.isArray(value);
                    const rawDisplay = value != null ? (isArray ? JSON.stringify(value, null, 2) : String(value)) : '';
                    const displayValue = editedFields[key] !== undefined ? editedFields[key] : rawDisplay;
                    return (
                      <div key={key} style={{ background: 'var(--t-card)', borderRadius: 8, padding: '10px 12px', border: `1px solid ${needsReview ? CONFIDENCE_COLOR(score) : 'var(--t-border)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--t-text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{key.replace(/_/g, ' ')}</span>
                          {score != null && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: CONFIDENCE_COLOR(score), background: CONFIDENCE_COLOR(score) + '20', padding: '2px 6px', borderRadius: 10 }}>
                              {CONFIDENCE_LABEL(score)} {(score * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: value ? 'var(--t-text)' : 'var(--t-text-sub)', fontStyle: value ? 'normal' : 'italic' }}>
                          {displayValue || '(not found)'}
                        </div>
                        {needsReview && !submitted && (
                          <div style={{ fontSize: 10, color: CONFIDENCE_COLOR(score), marginTop: 4 }}>
                            ✎ Editable in Corrections tab
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Line items table */}
                {(() => {
                  const fields = result.normalised_fields || result.extracted_fields || {};
                  const items = fields.line_items;
                  if (!items || !Array.isArray(items) || items.length === 0) return null;
                  const cols = Array.from(new Set(items.flatMap(r => (r && typeof r === 'object' ? Object.keys(r) : []))));
                  if (cols.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ color: 'var(--t-btn-color)', fontSize: 13, margin: '0 0 8px' }}>Line Items ({items.length})</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'var(--t-text)' }}>
                          <thead>
                            <tr>{cols.map(c => <th key={c} style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', padding: '6px 10px', textAlign: 'left', color: 'var(--t-text-sub)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{c.replace(/_/g, ' ')}</th>)}</tr>
                          </thead>
                          <tbody>
                            {items.map((row, ri) => (
                              <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--t-card-elevated)' : 'var(--t-card)' }}>
                                {cols.map(c => <td key={c} style={{ border: '1px solid var(--t-border)', padding: '5px 10px', whiteSpace: 'nowrap' }}>{row && row[c] != null ? String(row[c]) : '—'}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {result.fields_auto && Object.keys(result.fields_auto).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: '#4ade80' }}>✓ Auto-approved ({Object.keys(result.fields_auto).length}): </span>
                    <span style={{ fontSize: 12, color: 'var(--t-text-sub)' }}>{Object.keys(result.fields_auto).join(', ')}</span>
                  </div>
                )}

                {submitted || result.review_status === 'approved' ? (
                  <ApprovedBanner />
                ) : result.review_queue !== 'auto' && (
                  <SaveButton onClick={handleSaveCorrections} saving={saving} label="Approve & Upload" />
                )}
              </>
            )}

            {/* ── JSON TAB ── */}
            {activeTab === 'json' && (
              <pre style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', borderRadius: 8, padding: 16, fontSize: 12, color: 'var(--t-text)', overflowX: 'auto', overflowY: 'auto', maxHeight: 420, margin: 0, lineHeight: 1.6 }}>
                {JSON.stringify({
                  document_type: result.document_type,
                  document_type_display: result.document_type_display,
                  document_type_confidence: result.document_type_confidence,
                  overall_confidence: result.overall_confidence,
                  review_queue: result.review_queue,
                  extracted_fields: result.normalised_fields || result.extracted_fields || {},
                  corrections: editedFields,
                  confidence_scores: result.confidence_scores,
                  pipeline_duration_ms: result.pipeline_duration_ms,
                }, null, 2)}
              </pre>
            )}
          </>
        ) : null}

      </div>
    </div>
  );
}

// ── Shared sub-components used inside M02Panel ────────────────────────────────

function CorrectionField({ fieldKey, result, editedFields, onEdit, borderColor }) {
  const score        = result.confidence_scores?.[fieldKey];
  const allFields    = result.normalised_fields || result.extracted_fields || {};
  const originalVal  = allFields[fieldKey];
  const rawDisplay   = originalVal != null ? String(originalVal) : '';
  const currentValue = editedFields[fieldKey] !== undefined ? editedFields[fieldKey] : rawDisplay;
  const isEdited     = editedFields[fieldKey] !== undefined && editedFields[fieldKey] !== rawDisplay;

  return (
    <div style={{ background: 'var(--t-card)', borderRadius: 8, padding: '12px 14px', border: `2px solid ${borderColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--t-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {fieldKey.replace(/_/g, ' ')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isEdited && <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>✓ Edited</span>}
          {score != null && (
            <span style={{ fontSize: 10, fontWeight: 700, color: CONFIDENCE_COLOR(score), background: CONFIDENCE_COLOR(score) + '22', padding: '2px 7px', borderRadius: 10 }}>
              {(score * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      {rawDisplay && (
        <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--t-text-sub)' }}>AI extracted:</span>
          <span style={{ color: 'var(--t-text-sub)', fontStyle: 'italic' }}>{rawDisplay}</span>
        </div>
      )}
      <input
        value={currentValue}
        onChange={e => onEdit(fieldKey, e.target.value)}
        placeholder={`Enter correct ${fieldKey.replace(/_/g, ' ')}…`}
        style={{
          width: '100%', background: 'var(--t-card)',
          border: `1px solid ${isEdited ? '#22c55e' : '#60a5fa'}`,
          borderRadius: 5, color: 'var(--t-text)', padding: '6px 10px',
          fontSize: 13, boxSizing: 'border-box', outline: 'none',
        }}
      />
    </div>
  );
}

function SaveButton({ onClick, saving, label }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        background: saving ? '#374151' : 'linear-gradient(135deg, #1d4ed8, #6366f1)',
        color: saving ? '#9ca3af' : 'white', border: 'none', borderRadius: 8,
        padding: '11px 28px', fontSize: 14, fontWeight: 700,
        cursor: saving ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      {saving ? '⟳ Uploading…' : `✔ ${label}`}
    </button>
  );
}

function ApprovedBanner() {
  return (
    <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 22 }}>🔍</span>
      <div>
        <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>✅ Approved — jumping to HSN / ECCN Engine…</div>
        <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginTop: 2 }}>Extracted items are being sent to M03 Classification Engine</div>
      </div>
    </div>
  );
}

// Component to display a summary of the extracted data
// ExtractedSummary removed (not used in current DocumentPanel UI)

const DocumentPanel = ({ onExtractedItems, pendingDocument, onClearPending }) => {
  const [extractedFiles, setExtractedFiles] = useState([]);
  // HS code and raw view states are unused in current UI; remove to silence lint
  const [previewModal, setPreviewModal] = useState({ isOpen: false, fileIndex: null });
  const [validationMessage, setValidationMessage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [extractionModal, setExtractionModal] = useState({ isOpen: false, message: '', filename: '' });
  const [extractBarcodes, setExtractBarcodes] = useState(false); // DISABLED: Barcode extraction disabled by default

  // Chat state
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const { files, addFile, handleFileInput: originalHandleFileInput, uploadDocument, extractDocument, highlightFile, updateFile, removeFile,
          m02States, setM02States, activeM02Idx, setActiveM02Idx } = useDocumentProcessing((extractionData, fileState) => {
    // After successful extraction, extract line items and pass to parent
    console.log('[DocumentPanel] ✓ Extraction completed:', extractionData);
    console.log('[DocumentPanel] Extraction keys:', Object.keys(extractionData || {}));
    console.log('[DocumentPanel] extractionData.items:', extractionData?.items);
    console.log('[DocumentPanel] extractionData.line_items:', extractionData?.line_items);
    console.log('[DocumentPanel] extractionData.extracted_data:', extractionData?.extracted_data);

    let items = extractionData?.items || extractionData?.line_items || extractionData?.extracted_data?.items || [];
    console.log('[DocumentPanel] Items array found:', items?.length || 0);

    // If no items array, check for single-item documents (like AWB, Packing List)
    if ((!items || items.length === 0) && extractionData) {
      const goodsDescription = extractionData['Items/Goods Description'] ||
                              extractionData['Goods Description'] ||
                              extractionData['Product Description'] ||
                              extractionData['Description of Goods'];

      if (goodsDescription) {
        console.log('[DocumentPanel] Creating single item from goods description:', goodsDescription);
        items = [{
          description: goodsDescription,
          quantity: extractionData['Number of pieces'] || extractionData['Quantity'] || '1',
          weight: extractionData['Weight'] || '',
          value: extractionData['Total amount'] || extractionData['Declared Value for Carriage'] || '',
          hsCode: extractionData['HS Code/HSN Code'] || extractionData['HSN Code'] || ''
        }];
      }
    }

    console.log('[DocumentPanel] Final items count:', items?.length || 0);

    if (items && items.length > 0 && onExtractedItems) {
      const documentName = fileState?.name || extractionData?.document_name || 'Unknown Document';
      console.log('[DocumentPanel] ✓ Found', items.length, 'items from document:', documentName);
      onExtractedItems(items, documentName);
    } else {
      console.warn('[DocumentPanel] ⚠️ No items found to send to parent. onExtractedItems:', !!onExtractedItems);
    }
  });

  // Debug: Log files whenever they change
  useEffect(() => {
    console.log('[DocumentPanel] Files changed:', files.length, 'files');
    console.log('[DocumentPanel] File details:', files.map((f, idx) => ({
      index: idx,
      name: f.file?.name,
      isDuplicate: f.isDuplicate,
      isUploaded: f.isUploaded,
      hasExtraction: !!f.extraction
    })));
  }, [files]);

  // Create refs for each file item (for scrolling to highlighted file)
  const fileRefs = useRef([]);

  // Update refs array when files change
  useEffect(() => {
    fileRefs.current = fileRefs.current.slice(0, files.length);
  }, [files.length]);

  // Custom file input handler
  const handleFileInput = async (e) => {
    await originalHandleFileInput(e);
    // Reset the input value to allow re-selecting the same file
    e.target.value = '';
  };




  // Voice recording functions (single consolidated implementation)
  const startVoiceRecording = async () => {
    try {
      setVoiceStatus('Requesting microphone access...');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await processVoiceRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setVoiceStatus('Recording... Speak now!');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setVoiceStatus('Error: Could not access microphone');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setVoiceStatus('Processing audio...');
    }
  };

  const processVoiceRecording = async (audioBlob) => {
    try {
      setVoiceStatus('Transcribing audio...');

      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice_input.wav');

      const response = await fetch('/api/react/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const result = await response.json();

      if (result.success && result.transcription) {
        setVoiceStatus('Transcription successful! Extracting data...');
        await extractFromVoiceTranscription(result.transcription);
      } else {
        setVoiceStatus('Error: Transcription failed');
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      setVoiceStatus('Error: Voice processing failed');
    }
  };

  // Single implementation for extractFromVoiceTranscription (avoid duplicates)
  const extractFromVoiceTranscription = async (transcription) => {
    try {
      setVoiceStatus('Submitting transcription for extraction...');

      const response = await fetch('/api/react/voice/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: transcription,
          document_type: 'voice_input'
        }),
      });

      if (!response.ok) {
        throw new Error('Voice extraction failed');
      }

      const result = await response.json();

      if (result.success && result.task_id) {
        setVoiceStatus('Voice extraction in progress...');

        const pollTaskStatus = async () => {
          try {
            const statusResponse = await fetch(`/api/react/voice/status/${result.task_id}`);
            const statusResult = await statusResponse.json();

            if (statusResult.success && statusResult.status === 'completed') {
              // Create a virtual file entry for the voice input
              const voiceFile = {
                file: new File([transcription], 'voice_input.txt', { type: 'text/plain' }),
                name: 'Voice Input',
                uploaded: true,
                extraction: statusResult.data,
                status: 'extracted'
              };

              // NOTE: useDocumentProcessing hook currently manages `files`.
              // If you need to add this voiceFile into that hook-managed list,
              // expose an addFile method from the hook and call it here.
              console.log('Voice extraction completed:', voiceFile);
              // Add virtual voice file to files list if hook supports it
              try {
                if (typeof addFile === 'function') {
                  addFile(voiceFile);
                }
              } catch (e) {
                console.warn('addFile not available on hook', e);
              }

              setVoiceStatus('Voice extraction completed successfully!');
            } else if (statusResult.success && statusResult.status === 'processing') {
              setTimeout(pollTaskStatus, 2000);
            } else if (statusResult.success && statusResult.status === 'failed') {
              setVoiceStatus(`Error: ${statusResult.error}`);
            } else {
              setVoiceStatus('Error: Unknown status from voice extraction');
            }
          } catch (pollError) {
            console.error('Error polling task status:', pollError);
            setVoiceStatus('Error: Failed to check extraction status');
          }
        };

        setTimeout(pollTaskStatus, 1000);
      } else {
        setVoiceStatus('Error: Voice extraction failed');
      }
    } catch (error) {
      console.error('Voice extraction error:', error);
      setVoiceStatus('Error: Voice extraction failed');
    }
  };

  // Auto-scroll to bottom when new messages arrive (only if there are messages)
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      // Scroll within the chat messages container only, not the whole page
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',  // Changed from default to prevent page scroll
        inline: 'nearest'
      });
    }
  }, [messages]);

  // Chat message handler
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { 
      content: userMessage, 
      isUser: true, 
      timestamp: new Date() 
    }]);
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(userMessage);
      
      // Create enhanced message with document information
      const enhancedMessage = {
        content: response.answer || 'No response received',
        isUser: false,
        timestamp: new Date(),
        documentsUsed: response.documents_used || [],
        contextAvailable: response.context_available,
        searchMethod: response.search_method,
        documentsCount: response.documents_count
      };
      
      setMessages(prev => [...prev, enhancedMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        content: 'Sorry, I encountered an error. Please try again.',
        isUser: false, 
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // File upload handler for chat input button
  const handleFileUpload = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    const validFiles = [];
    const errors = [];

    selectedFiles.forEach((file, index) => {
      const validation = validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.errors.join(', ')}`);
      }
    });

    if (errors.length > 0) {
      setValidationMessage({
        type: 'error',
        message: `Upload failed: ${errors.join('; ')}`
      });
      setTimeout(() => setValidationMessage(null), 5000);
    }

    if (validFiles.length > 0) {
      // Use handler with duplicate detection (now async)
      const syntheticEvent = {
        target: { files: validFiles, value: '' }
      };
      const results = await handleFileInput(syntheticEvent);

      // Show success message only for added files
      if (results && results.added.length > 0) {
        setValidationMessage({
          type: 'success',
          message: `${results.added.length} file(s) added successfully`
        });
        setTimeout(() => setValidationMessage(null), 3000);
      }
    }

    // Reset input
    event.target.value = '';
  };

  // Track extracted files for chat context
  useEffect(() => {
    const extracted = files.filter(f => f.extraction);
    setExtractedFiles(extracted);
  }, [files]);

  // Inject document arriving from DataIntakePanel
  useEffect(() => {
    if (!pendingDocument) return;
    const { documentId, filename, filePath } = pendingDocument;
    if (onClearPending) onClearPending();

    // addFile in DocumentContext uses setFiles(prev => ...) so it always
    // checks against the latest state — no stale-closure duplicates possible
    const syntheticFile = new File([], filename || 'intake-document', { type: 'application/octet-stream' });
    addFile({
      file: syntheticFile,
      name: filename || 'intake-document',
      hash: `intake-${documentId}`,
      serverPath: filePath,
      documentId,
      loading: false,
      isUploaded: true,
      uploaded: true,
      isExtracted: false,
      isDuplicate: false,
      highlighted: true,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocument]);
  
  // Toggle raw JSON view for a file
  // HS code helpers and raw view helpers removed (not used in current UI)

  // Open the preview modal for a document
  const handleDocumentPreview = (fileState, index) => {
    setPreviewModal({ isOpen: true, fileIndex: index });
  };

  // Build and download the JSON export for a file
  const handleSaveJson = (fileIndex) => {
    const fileState = files[fileIndex];
    if (!fileState) return;
    const name = fileState?.file?.name || fileState?.name || `document_${fileIndex + 1}`;
    const m02Result = m02States[fileIndex]?.result || null;
    const payload = {
      filename: name,
      documentId: fileState?.documentId || null,
      document_type: m02Result?.document_type_display || null,
      document_type_confidence: m02Result?.document_type_confidence || null,
      extracted_fields: m02Result?.normalised_fields || fileState?.extraction || null,
      confidence_scores: m02Result?.confidence_scores || null,
      overall_confidence: m02Result?.overall_confidence || null,
      review_queue: m02Result?.review_queue || null,
      pipeline_duration_ms: m02Result?.pipeline_duration_ms || null,
    };
    if (!payload.extracted_fields && !payload.document_type) {
      alert('No extracted data available yet. The M02 pipeline will run automatically after upload.');
      return;
    }
    const baseName = name.replace(/\.[^.]+$/, '');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${baseName}_extracted.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add this function to close the modal
  const closePreviewModal = () => {
    setPreviewModal({
      isOpen: false,
      fileIndex: null
    });
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Per-file auto-detected document type: { [idx]: { status, docType, display, icon } }
  const [fileClassifications, setFileClassifications] = useState({});

  const DOC_TYPE_META = {
    invoice:           { display: 'Commercial Invoice', icon: '🧾' },
    commercial_invoice:{ display: 'Commercial Invoice', icon: '🧾' },
    packing_list:      { display: 'Packaging Label',    icon: '📦' },
    airwaybill:        { display: 'Airway Bill',        icon: '✈️' },
    bill_of_lading:    { display: 'Bill of Lading',     icon: '🚢' },
  };

  const classifyDocument = async (idx) => {
    const fileState = files[idx];
    if (!fileState?.serverPath) return;
    setFileClassifications(prev => ({ ...prev, [idx]: { status: 'classifying' } }));
    try {
      const token = localStorage.getItem('authToken');
      const resp = await fetch(`${BACKEND_URL}/react/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ file_path: fileState.serverPath }),
      });
      if (!resp.ok) throw new Error(`Classify failed: ${resp.status}`);
      const data = await resp.json();
      const rawType = data.document_type || 'unknown';
      const meta = DOC_TYPE_META[rawType] || { display: 'Unknown Document', icon: '📄' };
      setFileClassifications(prev => ({
        ...prev,
        [idx]: { status: 'done', docType: rawType, display: meta.display, icon: meta.icon },
      }));
    } catch (err) {
      console.error('[CLASSIFY] Error:', err);
      setFileClassifications(prev => ({ ...prev, [idx]: { status: 'error' } }));
    }
  };

  // m02States, setM02States, activeM02Idx, setActiveM02Idx come from DocumentContext via useDocumentProcessing
  const m02PollRef = useRef({});
  // Tracks which files have already been scheduled for auto-upload / auto-M02 (by hash)
  const autoScheduledRef = useRef(new Set());

  const triggerM02 = async (idx, documentType = null) => {
    const fileState = files[idx];
    const docId = fileState?.documentId;
    if (!docId) {
      setM02States(prev => ({ ...prev, [idx]: { status: 'error', resultId: null, result: null, error: 'Document not uploaded yet. Please wait for upload to complete.' } }));
      return;
    }

    setM02States(prev => ({ ...prev, [idx]: { status: 'starting', resultId: null, result: null, error: null } }));
    setActiveM02Idx(idx);

    try {
      // m02Service.process uses postWithFallback — retries all known backend
      // hosts on ERR_NETWORK before giving up, same as the login flow.
      const data = await m02Service.process(docId, documentType);
      const resultId = data.result_id;
      setM02States(prev => ({ ...prev, [idx]: { status: 'processing', resultId, result: null, error: null } }));
      pollM02Result(idx, docId, resultId);
    } catch (err) {
      let msg;
      if (err?.code === 'ERR_NETWORK' || (!err?.response && err?.request)) {
        msg = 'Cannot reach server. Check that the backend is running.';
      } else if (err?.response?.status === 401) {
        msg = 'Session expired. Please log in again.';
      } else if (err?.response?.status === 404) {
        // Document was removed from DB (e.g. server restart with fresh DB).
        // Re-upload the file and retry M02 automatically (silent recovery).
        const staleFileState = files[idx];
        if (staleFileState?.file) {
          setM02States(prev => ({ ...prev, [idx]: { status: 'starting', resultId: null, result: null, error: null } }));
          try {
            const { documentService: ds } = await import('../../services/api');
            const uploadRes = await ds.uploadDocument(staleFileState.file, staleFileState.hash);
            const newDocId = uploadRes.document_id || uploadRes.id;
            updateFile(idx, { documentId: newDocId, isUploaded: true, uploaded: true });
            const data = await m02Service.process(newDocId, documentType);
            const resultId = data.result_id;
            setM02States(prev => ({ ...prev, [idx]: { status: 'processing', resultId, result: null, error: null } }));
            pollM02Result(idx, newDocId, resultId);
            return;
          } catch (retryErr) {
            msg = retryErr?.response?.data?.detail || retryErr?.message || 'Re-upload failed. Please try again.';
          }
        } else {
          msg = 'Document not found. Please re-upload the file.';
        }
      } else {
        msg = err?.response?.data?.detail || err?.message || 'Unknown error';
      }
      setM02States(prev => ({ ...prev, [idx]: { status: 'error', resultId: null, result: null, error: msg } }));
    }
  };

  const pollM02Result = (idx, docId, resultId) => {
    if (m02PollRef.current[idx]) clearInterval(m02PollRef.current[idx]);
    m02PollRef.current[idx] = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/m02/result/${docId}`);
        // Only act on the result that belongs to THIS pipeline run.
        if (data.result_id !== resultId) return;
        if (data.review_status && data.review_status !== 'processing') {
          clearInterval(m02PollRef.current[idx]);
          if (data.review_status === 'error') {
            setM02States(prev => ({ ...prev, [idx]: { status: 'error', resultId: data.result_id, result: null, error: 'Extraction pipeline failed. Please retry.' } }));
          } else {
            setM02States(prev => ({ ...prev, [idx]: { status: 'done', resultId: data.result_id, result: data, error: null } }));
          }
        }
      } catch (_) {}
    }, 2500);
  };

  const submitM02Review = async (idx, reviewedFields) => {
    const m02 = m02States[idx];
    if (!m02?.resultId) return;
    try {
      const { data } = await apiClient.patch(`/m02/review/${m02.resultId}`, {
        reviewed_fields: reviewedFields,
        approved: true,
      });
      setM02States(prev => ({
        ...prev,
        [idx]: { ...prev[idx], result: { ...prev[idx].result, review_status: data.review_status } }
      }));

      // Navigate to HSN/ECCN Engine with the approved document's items
      const fields = { ...(m02?.result?.normalised_fields || {}), ...reviewedFields };
      const fileState = files[idx];
      const documentName = fileState?.file?.name || fileState?.name || 'Document';

      // Build items: use line_items if present, else synthesize from goods_description
      let navItems = [];
      const lineItems = fields.line_items;
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        navItems = lineItems.map(item => ({
          description: item.description || item.goods_description || item.product || item.name || '',
          quantity: item.quantity || item.qty || 1,
          hsCode: item.hsn_code || item.hs_code || fields.hsn_code || '',
          unit_price: item.unit_price || '',
          total_value: item.total_value || item.amount || '',
        }));
      } else if (fields.goods_description) {
        navItems = [{
          description: fields.goods_description,
          quantity: fields.quantity || 1,
          hsCode: fields.hsn_code || '',
          unit_price: fields.unit_price || '',
          total_value: fields.total_value || '',
        }];
      }

      if (navItems.length > 0 && onExtractedItems) {
        setActiveM02Idx(null); // close M02 panel
        onExtractedItems(navItems, documentName);
      }
    } catch (err) {
      alert('Review submission failed: ' + (err?.response?.data?.detail || err.message));
    }
  };

  const handleDeleteFile = async (idx) => {
    const fileState = files[idx];
    const name = fileState?.file?.name || fileState?.name || `File ${idx + 1}`;
    if (!window.confirm(`Delete "${name}"? This will remove it from Document Management and the database.`)) return;
    try {
      if (fileState?.documentId) {
        await apiClient.delete(`/react/documents/${fileState.documentId}`);
      }
      removeFile(idx);
      if (activeM02Idx === idx) setActiveM02Idx(null);
    } catch (err) {
      alert('Delete failed: ' + (err?.response?.data?.detail || err.message));
    }
  };

  // Cleanup poll intervals on unmount
  useEffect(() => {
    const refs = m02PollRef.current;
    return () => Object.values(refs).forEach(clearInterval);
  }, []);

  // Auto-upload newly added files (file selected → upload automatically)
  useEffect(() => {
    files.forEach((fileState, idx) => {
      if (fileState.isUploaded || fileState.loading || !fileState.file || !fileState.hash) return;
      const key = `upload-${fileState.hash}`;
      if (autoScheduledRef.current.has(key)) return;
      autoScheduledRef.current.add(key);
      uploadDocument(idx);
    });
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-classify once upload completes (detect type before user triggers extraction)
  useEffect(() => {
    files.forEach((fileState, idx) => {
      if (!fileState.isUploaded || !fileState.serverPath) return;
      if (fileClassifications[idx]) return; // already classified or classifying
      const key = `classify-${fileState.hash || fileState.serverPath}`;
      if (autoScheduledRef.current.has(key)) return;
      autoScheduledRef.current.add(key);
      classifyDocument(idx);
    });
  }, [files, fileClassifications]); // eslint-disable-line react-hooks/exhaustive-deps

  // M02 is now triggered manually after the user reviews the auto-detected type.

  // Get current file state for preview modal (reactive to extraction updates)
  const currentPreviewFile = previewModal.fileIndex !== null ? files[previewModal.fileIndex] : null;
  const currentPreviewExtraction = (() => {
    if (!currentPreviewFile) return null;
    // Prefer M02 normalised fields (richer, with confidence scores)
    const m02Result = previewModal.fileIndex !== null ? m02States[previewModal.fileIndex]?.result : null;
    if (m02Result?.normalised_fields) {
      return {
        ...m02Result.normalised_fields,
        document_type: m02Result.document_type_display || m02Result.document_type,
        overall_confidence: m02Result.overall_confidence,
      };
    }
    // Fallback to standard extraction
    if (currentPreviewFile?.extraction) {
      return {
        ...(currentPreviewFile.extraction.combined || currentPreviewFile.extraction),
        barcodes: currentPreviewFile.extraction.barcodes || [],
      };
    }
    return null;
  })();

  return (
    <PanelContainer>
      {/* Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={closePreviewModal}
        document={currentPreviewFile}
        extractedData={currentPreviewExtraction}
        onSaveJson={previewModal.fileIndex !== null ? () => handleSaveJson(previewModal.fileIndex) : null}
      />

      {/* Extraction Loading Modal */}
      {extractionModal.isOpen && (
        <ExtractionModalOverlay>
          <ExtractionModalContent>
            <ExtractionSpinner />
            <ExtractionTitle>Extracting Document</ExtractionTitle>
            <ExtractionMessage>{extractionModal.message}</ExtractionMessage>
            <ExtractionFilename>{extractionModal.filename}</ExtractionFilename>
          </ExtractionModalContent>
        </ExtractionModalOverlay>
      )}

      <MetricsRow className="animate-fade-in">
        <MetricCard>
          <MetricLabel>Accuracy</MetricLabel>
          <MetricValue>99%</MetricValue>
        </MetricCard>
        <MetricCard>
          <MetricLabel>Avg Latency</MetricLabel>
          <MetricValue>&lt;5s</MetricValue>
        </MetricCard>
        <MetricCard>
          <MetricLabel>Throughput</MetricLabel>
          <MetricValue>12k/hr</MetricValue>
        </MetricCard>
        <MetricCard>
          <MetricLabel>Uptime</MetricLabel>
          <MetricValue>99.95%</MetricValue>
        </MetricCard>
        {/* BARCODE TOGGLE HIDDEN */}
        <MetricCard style={{ background: '#ff6b35', color: 'white', fontWeight: 'bold' }}>
          <MetricLabel style={{ color: 'white' }}>🚫 Barcode Disabled</MetricLabel>
          <MetricValue style={{ color: 'white' }}>OFF</MetricValue>
        </MetricCard>
      </MetricsRow>
      
      <AppLayout sidebarOpen={sidebarOpen}>
         <MainColumn>
           <ChatContainer>
             <ChatHeader>
               <ChatTitle>
                 🤖 Document Assistant
               </ChatTitle>
               {extractedFiles.length > 0 && (
                 <div style={{ fontSize: '12px', opacity: 0.9 }}>
                   {extractedFiles.length} document{extractedFiles.length > 1 ? 's' : ''} ready
                 </div>
               )}
             </ChatHeader>

             <ChatMessages>
               {messages.length === 0 && (
                 <EmptyMessage>
                   Ask questions about your uploaded documents!
                   <br />
                   <small style={{ color: theme.colors.text.tertiary }}>
                     Upload files using the 📎 button or record voice with 🎤
                   </small>
                 </EmptyMessage>
               )}
               
               {messages.map((message, index) => (
                 <MessageBubble key={index} isUser={message.isUser}>
                   <MessageSender>{message.isUser ? 'You' : 'Assistant'}</MessageSender>
                   <MessageContent>{message.content}</MessageContent>
                   
                   {message.documentsUsed && message.documentsUsed.length > 0 && (
                     <DocumentReference>
                       📄 Used context from: {message.documentsUsed.join(', ')}
                     </DocumentReference>
                   )}
                 </MessageBubble>
               ))}
               
               {isLoading && (
                 <MessageBubble isUser={false}>
                   <MessageSender>Assistant</MessageSender>
                   <LoadingIndicator>Searching documents and thinking...</LoadingIndicator>
                 </MessageBubble>
               )}
               <div ref={messagesEndRef} />
             </ChatMessages>
             
             {/* Status messages */}
             {validationMessage && (
               <div style={{
                 padding: '8px 16px',
                 margin: '0 16px',
                 borderRadius: '8px',
                 background: validationMessage.type === 'error' ? '#fef2f2' : '#f0f9ff',
                 color: validationMessage.type === 'error' ? '#dc2626' : '#0369a1',
                 border: `1px solid ${validationMessage.type === 'error' ? '#fecaca' : '#bae6fd'}`,
                 fontSize: '12px'
               }}>
                 {validationMessage.message}
               </div>
             )}
             
             {voiceStatus && (
               <div style={{
                 padding: '8px 16px',
                 margin: '0 16px',
                 borderRadius: '8px',
                 background: voiceStatus.includes('Error') ? '#fef2f2' : '#f0f9ff',
                 color: voiceStatus.includes('Error') ? '#dc2626' : '#0369a1',
                 border: `1px solid ${voiceStatus.includes('Error') ? '#fecaca' : '#bae6fd'}`,
                 fontSize: '12px'
               }}>
                 🎤 {voiceStatus}
               </div>
             )}

             <ChatInputContainer>
               <InputActionButtons>
                 <ActionButton 
                   onClick={() => document.getElementById('chat-file-input').click()}
                   title="Upload files"
                 >
                   📎
                 </ActionButton>
                 <ActionButton 
                   active={isRecording}
                   onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                   title={isRecording ? 'Stop recording' : 'Record voice'}
                 >
                   {isRecording ? '⏹️' : '🎤'}
                 </ActionButton>
               </InputActionButtons>
               
               <ChatInput
                 value={inputMessage}
                 onChange={e => setInputMessage(e.target.value)}
                 onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                 placeholder="Ask about your documents or upload files..."
                 disabled={isLoading}
               />
               
               <SendButton onClick={handleSendMessage} disabled={isLoading || !inputMessage.trim()}>
                 Send
               </SendButton>
               
               <HiddenFileInput
                 id="chat-file-input"
                 type="file"
                 multiple
                 accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/jpg,image/png"
                 onChange={handleFileUpload}
               />
             </ChatInputContainer>
           </ChatContainer>
         </MainColumn>

        <Sidebar>
          <SidebarHeader>
            {sidebarOpen ? <SidebarTitle>Files</SidebarTitle> : <span title="Files">📁</span>}
            <SidebarToggle onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? 'Collapse' : 'Expand'}>
              {sidebarOpen ? '⟨' : '⟩'}
            </SidebarToggle>
          </SidebarHeader>
          {sidebarOpen && (
            <SidebarList>
              {files.length === 0 && (
                <EmptyMessage style={{ margin: 8, padding: 12 }}>No files yet</EmptyMessage>
              )}
              {files.map((fileState, idx) => {
                const m02Status = m02States[idx]?.status;
                const m02Result = m02States[idx]?.result;
                const clf = fileClassifications[idx];
                const isUploading = fileState.loading && !fileState.isUploaded;
                const isClassifying = fileState.isUploaded && (!clf || clf.status === 'classifying');
                const classifyDone = clf?.status === 'done';
                const classifyError = clf?.status === 'error';
                const isExtracting = m02Status === 'starting' || m02Status === 'processing';
                const extractDone = m02Status === 'done';
                const extractError = m02Status === 'error';
                // Show extract button: classification done, extraction not yet started
                const awaitingExtract = classifyDone && !isExtracting && !extractDone && !extractError;

                const Tick = () => (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 15, height: 15, borderRadius: '50%',
                    background: '#166534', border: '2px solid #4ade80', fontSize: 8, fontWeight: 900,
                    flexShrink: 0,
                  }}>✓</span>
                );

                return (
                  <SidebarItem
                    key={idx}
                    ref={el => fileRefs.current[idx] = el}
                    highlighted={fileState.highlighted}
                  >
                    <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                      <SidebarFileName
                        onClick={() => handleDocumentPreview(fileState, idx)}
                        title={fileState?.file?.name || fileState?.name || 'File'}
                      >
                        {fileState?.file?.name || fileState?.name || `File ${idx + 1}`}
                      </SidebarFileName>

                      <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>

                        {/* Step 1 — Uploading */}
                        {isUploading && (
                          <div style={{ fontSize: 10, color: 'var(--t-btn-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>⟳</span> Uploading…
                          </div>
                        )}

                        {/* Step 1 done — Uploaded tick */}
                        {fileState.isUploaded && (
                          <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Tick /> Uploaded
                          </div>
                        )}

                        {/* Step 2 — Classifying */}
                        {isClassifying && (
                          <div style={{ fontSize: 10, color: 'var(--t-btn-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>⟳</span> Detecting document type…
                          </div>
                        )}

                        {/* Step 2 done — Detected type + Extract button */}
                        {(classifyDone || classifyError) && !isExtracting && !extractDone && !extractError && (
                          <div>
                            {classifyDone ? (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: 'var(--t-card)', border: '1px solid var(--t-border)',
                                borderRadius: 6, padding: '5px 8px', marginBottom: 6,
                              }}>
                                <span style={{ fontSize: 14 }}>{clf.icon}</span>
                                <span style={{ fontSize: 11, color: 'var(--t-text)', fontWeight: 600, lineHeight: 1.2 }}>
                                  {clf.display}
                                </span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 10, color: 'var(--t-text-sub)', marginBottom: 6 }}>
                                Could not detect type
                              </div>
                            )}
                            <button
                              onClick={() => { triggerM02(idx, clf?.docType || null); setActiveM02Idx(idx); }}
                              disabled={!fileState?.documentId}
                              style={{
                                width: '100%',
                                background: 'linear-gradient(135deg, #1d4ed8, #6366f1)',
                                color: 'white', border: 'none',
                                borderRadius: 5, padding: '5px 8px',
                                fontSize: 11, fontWeight: 700,
                                cursor: fileState?.documentId ? 'pointer' : 'not-allowed',
                                opacity: fileState?.documentId ? 1 : 0.5,
                                letterSpacing: '0.3px',
                              }}
                            >
                              Extract Fields →
                            </button>
                          </div>
                        )}

                        {/* Step 3 — Extracting */}
                        {isExtracting && (
                          <>
                            {clf?.display && (
                              <div style={{ fontSize: 10, color: 'var(--t-text-sub)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>{clf.icon}</span> {clf.display}
                              </div>
                            )}
                            <div style={{ fontSize: 10, color: 'var(--t-btn-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>⟳</span>
                              {m02Status === 'starting' ? 'Starting extraction…' : 'Extracting fields…'}
                            </div>
                          </>
                        )}

                        {/* Step 3 done — Extracted tick + type */}
                        {extractDone && (
                          <>
                            <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Tick /> Extracted
                            </div>
                            {(m02Result?.document_type_display || clf?.display) && (
                              <div style={{ fontSize: 10, color: 'var(--t-text-sub)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>{m02Result?.document_type_icon || clf?.icon}</span>
                                <span>{m02Result?.document_type_display || clf?.display}</span>
                                {m02Result?.overall_confidence != null && (
                                  <span style={{ color: 'var(--t-text-sub)' }}>
                                    {(m02Result.overall_confidence * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Extraction error */}
                        {extractError && (
                          <div style={{ fontSize: 10, color: '#f87171' }}>✕ Extraction failed</div>
                        )}
                      </div>
                    </div>

                    <SidebarActions>
                      {/* Re-run extraction button (only after done or error) */}
                      {(extractDone || extractError) && (
                        <button
                          onClick={() => { triggerM02(idx, clf?.docType || null); setActiveM02Idx(idx); }}
                          disabled={!fileState?.documentId}
                          title="Re-run extraction"
                          style={{
                            background: extractDone ? '#166534' : '#7f1d1d',
                            color: 'white', border: 'none', borderRadius: 4,
                            padding: '3px 7px', fontSize: 11,
                            cursor: fileState?.documentId ? 'pointer' : 'not-allowed',
                          }}
                        >
                          ↺
                        </button>
                      )}

                      {/* View results */}
                      {extractDone && (
                        <button
                          onClick={() => setActiveM02Idx(idx)}
                          title="View extraction results"
                          style={{ fontSize: 11, padding: '3px 7px' }}
                        >
                          Results
                        </button>
                      )}

                      <button
                        onClick={() => handleDocumentPreview(fileState, idx)}
                        title="Preview document"
                        style={{ fontSize: 11, padding: '3px 7px' }}
                      >
                        Preview
                      </button>

                      <button
                        onClick={() => handleDeleteFile(idx)}
                        title="Delete this file"
                        style={{
                          background: '#7f1d1d', color: '#fca5a5',
                          border: 'none', borderRadius: 4,
                          padding: '3px 7px', fontSize: 11, cursor: 'pointer',
                        }}
                      >
                        🗑
                      </button>
                    </SidebarActions>
                  </SidebarItem>
                );
              })}
            </SidebarList>
          )}
        </Sidebar>
      </AppLayout>

      {/* M02 Results Panel */}
      {activeM02Idx !== null && m02States[activeM02Idx] && (
        <M02Panel
          m02State={m02States[activeM02Idx]}
          fileState={files[activeM02Idx]}
          onClose={() => setActiveM02Idx(null)}
          onSubmitReview={(fields) => submitM02Review(activeM02Idx, fields)}
          onDownloadJson={() => handleSaveJson(activeM02Idx)}
        />
      )}
    </PanelContainer>
  );
};

export default DocumentPanel;