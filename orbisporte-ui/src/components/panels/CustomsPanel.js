/**
 * CustomsPanel Component - Professional UI
 *
 * Panel for customs declaration functionality with session document selection.
 * Only shows documents uploaded and extracted in the current session.
 */

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import { customsService } from '../../services/api';
import { useDocumentContext } from '../../contexts/DocumentContext';

const PanelContainer = styled.div`
  padding: ${theme.spacing.xxl}px;
  min-height: 100vh;
  display: flex;
  overflow-y: auto;
  flex-direction: column;
  gap: ${theme.spacing.xxl}px;
  background: ${theme.colors.ui.background};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.lg}px;
`;

const Title = styled.h1`
  font-weight: ${theme.typography.fontWeight.extrabold};
  font-size: ${theme.typography.fontSize['4xl']};
  color: ${theme.colors.text.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  text-shadow: ${theme.typography.textShadow.sm};
  letter-spacing: -0.02em;

  &:before {
    content: '📦';
    font-size: ${theme.typography.fontSize['5xl']};
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }
`;

const Subtitle = styled.p`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.medium};
  margin: ${theme.spacing.sm}px 0 0 0;
  line-height: 1.6;
`;

const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 400px 1fr 1fr;
  gap: ${theme.spacing.lg}px;
  height: calc(100vh - 180px);

  @media (max-width: 1400px) {
    grid-template-columns: 380px 1fr;
  }

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg}px;
`;

const Card = styled.div`
  background: ${theme.colors.ui.cardElevated};
  border-radius: ${theme.radius.xxl}px;
  padding: ${theme.spacing.xxl}px;
  box-shadow: ${theme.shadows.card};
  border: 1px solid ${theme.colors.ui.borderLight};
  transition: all ${theme.transitions.normal} ${theme.transitions.easing.default};
  position: relative;
  overflow: hidden;

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

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.md}px;
  padding-bottom: ${theme.spacing.sm}px;
  border-bottom: 2px solid var(--t-border);
`;

const CardTitle = styled.h2`
  font-weight: ${theme.typography.fontWeight.semibold};
  font-size: ${theme.typography.fontSize.lg}px;
  color: ${theme.colors.text.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
`;

const CardContent = styled.div`
  overflow-y: auto;
  max-height: ${props => props.maxHeight || 'auto'};

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--t-card);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.primary.main};
    border-radius: 3px;
  }
`;

const DocumentGroup = styled.div`
  margin-bottom: ${theme.spacing.lg}px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const DocumentGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%);
  border-radius: ${theme.radius.md}px;
  margin-bottom: ${theme.spacing.sm}px;
  border-left: 3px solid ${theme.colors.primary.main};
`;

const DocumentGroupTitle = styled.span`
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.primary.main};
  font-size: ${theme.typography.fontSize.md}px;
  text-transform: capitalize;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs}px;
`;

const DocumentItem = styled.label`
  display: flex;
  align-items: center;
  padding: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.xs}px;
  border-radius: ${theme.radius.md}px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.checked ? 'rgba(59, 130, 246, 0.15)' : 'var(--t-bg-dark)'};
  border: 1px solid ${props => props.checked ? theme.colors.primary.main : 'var(--t-border-light)'};

  &:hover {
    background: ${props => props.checked ? 'rgba(59, 130, 246, 0.25)' : 'var(--t-hover)'};
    transform: translateX(4px);
    border-color: ${props => props.checked ? theme.colors.primary.main : 'rgba(59, 130, 246, 0.3)'};
  }
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 20px;
  height: 20px;
  margin-right: ${theme.spacing.md}px;
  cursor: pointer;
  accent-color: ${theme.colors.primary.main};
`;

const DocumentInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const DocumentName = styled.span`
  font-size: ${theme.typography.fontSize.sm}px;
  color: ${theme.colors.text.primary};
  font-weight: ${theme.typography.fontWeight.medium};
`;

const DocumentBadge = styled.span`
  font-size: ${theme.typography.fontSize.xs}px;
  color: ${theme.colors.text.tertiary};
  font-style: italic;
`;

const SettingsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs}px;
`;

const Label = styled.label`
  font-size: ${theme.typography.fontSize.sm}px;
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Select = styled.select`
  padding: ${theme.spacing.md}px;
  border: 1px solid var(--t-input-border);
  border-radius: ${theme.radius.md}px;
  background: var(--t-input-bg);
  font-family: ${theme.typography.fontFamily.main};
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.md}px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    background: var(--t-input-bg-focus);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &:hover {
    border-color: rgba(59, 130, 246, 0.3);
  }

  option {
    background: ${theme.colors.ui.card};
    color: ${theme.colors.text.primary};
  }
`;

const GenerateButton = styled.button`
  padding: ${theme.spacing.md}px ${theme.spacing.xl}px;
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  color: white;
  border: none;
  border-radius: ${theme.radius.md}px;
  font-weight: ${theme.typography.fontWeight.bold};
  font-size: ${theme.typography.fontSize.md}px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: ${theme.spacing.sm}px;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(59, 130, 246, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: linear-gradient(135deg, #444 0%, #333 100%);
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }
`;

const TabContainer = styled.div`
  display: flex;
  gap: ${theme.spacing.xs}px;
  margin-bottom: ${theme.spacing.md}px;
  padding: ${theme.spacing.xs}px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: ${theme.radius.md}px;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.primary.main};
    border-radius: 2px;
  }
`;

const Tab = styled.button`
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  background: ${props => props.active
    ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
    : 'transparent'};
  color: ${props => props.active ? 'white' : theme.colors.text.secondary};
  border: none;
  border-radius: ${theme.radius.sm}px;
  cursor: pointer;
  font-weight: ${props => props.active ? theme.typography.fontWeight.bold : theme.typography.fontWeight.medium};
  transition: all 0.2s ease;
  font-size: ${theme.typography.fontSize.sm}px;
  white-space: nowrap;
  box-shadow: ${props => props.active ? '0 2px 10px rgba(59, 130, 246, 0.3)' : 'none'};

  &:hover {
    background: ${props => props.active
      ? 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)'
      : 'rgba(59, 130, 246, 0.1)'};
    color: ${props => props.active ? 'white' : theme.colors.text.primary};
  }
`;

const JSONContent = styled.pre`
  font-family: ${theme.typography.fontFamily.mono};
  font-size: ${theme.typography.fontSize.sm}px;
  margin: 0;
  color: ${theme.colors.text.primary};
  white-space: pre-wrap;
  line-height: 1.8;
  background: rgba(0, 0, 0, 0.2);
  padding: ${theme.spacing.lg}px;
  border-radius: ${theme.radius.md}px;
  border: 1px solid var(--t-border-light);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.primary.main};
    border-radius: 3px;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.xxl}px;
  gap: ${theme.spacing.md}px;
`;

const Spinner = styled.div`
  width: 50px;
  height: 50px;
  border: 4px solid rgba(59, 130, 246, 0.1);
  border-top: 4px solid ${theme.colors.primary.main};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.div`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.md}px;
  font-weight: ${theme.typography.fontWeight.medium};
`;

const ErrorMessage = styled.div`
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  background: linear-gradient(135deg, rgba(255, 50, 50, 0.15) 0%, rgba(200, 0, 0, 0.15) 100%);
  border: 1px solid rgba(255, 100, 100, 0.4);
  border-left: 4px solid #ff4444;
  border-radius: ${theme.radius.md}px;
  color: #ff6666;
  font-size: ${theme.typography.fontSize.sm}px;
  margin-bottom: ${theme.spacing.md}px;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;

  &:before {
    content: '⚠️';
    font-size: 20px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.spacing.xxl}px ${theme.spacing.xl}px;
  color: ${theme.colors.text.tertiary};
  font-size: ${theme.typography.fontSize.md}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.spacing.md}px;

  &:before {
    content: '${props => props.icon || '📄'}';
    font-size: 48px;
    opacity: 0.5;
  }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  color: white;
  border-radius: ${theme.radius.pill}px;
  font-size: ${theme.typography.fontSize.xs}px;
  font-weight: ${theme.typography.fontWeight.bold};
  min-width: 24px;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
`;

const SelectionSummary = styled.div`
  padding: ${theme.spacing.md}px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(75, 0, 130, 0.1) 100%);
  border-radius: ${theme.radius.md}px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: ${theme.spacing.sm}px;
`;

const SummaryText = styled.span`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.sm}px;
`;

const SummaryValue = styled.span`
  color: ${theme.colors.primary.main};
  font-weight: ${theme.typography.fontWeight.bold};
  font-size: ${theme.typography.fontSize.lg}px;
`;

const PreviewDocumentItem = styled.div`
  padding: ${theme.spacing.md}px;
  background: rgba(59, 130, 246, 0.05);
  border-radius: ${theme.radius.md}px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  margin-bottom: ${theme.spacing.md}px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const PreviewDocumentName = styled.div`
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.primary.main};
  margin-bottom: ${theme.spacing.sm}px;
  font-size: ${theme.typography.fontSize.sm}px;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs}px;

  &:before {
    content: '📄';
    font-size: 16px;
  }
`;

const CustomsPanel = () => {
  const [shipmentType, setShipmentType] = useState('Import');
  const [shipmentChannel, setShipmentChannel] = useState('Sea');
  const [declaration, setDeclaration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('party');
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [error, setError] = useState(null);

  const { files } = useDocumentContext();

  const extractedFiles = useMemo(() => {
    console.log('[CustomsPanel] Total files:', files.length);
    const extracted = files
      .map((fileState, index) => ({ ...fileState, originalIndex: index }))
      .filter(fileState => {
        const hasExtraction = !!fileState.extraction;
        const hasCombined = !!(fileState.extraction && fileState.extraction.combined);
        const hasAnyData = !!(fileState.extraction && (
          fileState.extraction.combined ||
          Object.keys(fileState.extraction).length > 0
        ));

        console.log(`[CustomsPanel] File "${fileState.file?.name}":`, {
          hasExtraction,
          hasCombined,
          hasAnyData,
          extractionKeys: fileState.extraction ? Object.keys(fileState.extraction) : []
        });

        // Include files that have extraction data (combined or any other extraction fields)
        return hasExtraction && hasAnyData;
      });

    console.log('[CustomsPanel] Extracted files count:', extracted.length);
    return extracted;
  }, [files]);

  const groupedDocuments = useMemo(() => {
    return extractedFiles.reduce((groups, fileState) => {
      const docType = fileState.classification?.document_type ||
                     fileState.extraction?.document_type ||
                     'unknown';
      if (!groups[docType]) {
        groups[docType] = [];
      }
      groups[docType].push(fileState);
      return groups;
    }, {});
  }, [extractedFiles]);

  // Get selected documents for preview
  const selectedDocuments = useMemo(() => {
    return selectedIndexes.map(idx => files[idx]).filter(Boolean);
  }, [selectedIndexes, files]);

  const toggleDocumentSelection = (originalIndex) => {
    setSelectedIndexes(prev => {
      if (prev.includes(originalIndex)) {
        return prev.filter(idx => idx !== originalIndex);
      } else {
        return [...prev, originalIndex];
      }
    });
  };

  const generateDeclaration = async () => {
    if (selectedIndexes.length === 0) {
      setError('Please select at least one document to generate declaration');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const selectedDocs = selectedIndexes.map(idx => {
        const fileState = files[idx];
        const docType = fileState.classification?.document_type ||
                       fileState.extraction?.document_type ||
                       'unknown';

        // Include barcodes in extracted data if available
        // Use combined if available, otherwise use full extraction
        const baseData = fileState.extraction?.combined || fileState.extraction || {};
        const extractedData = {
          ...baseData,
          ...(fileState.extraction?.barcodes && fileState.extraction.barcodes.length > 0
            ? { barcodes: fileState.extraction.barcodes }
            : {})
        };

        return {
          document_type: docType,
          extracted_data: extractedData,
          filename: fileState.file?.name || 'unknown'
        };
      });

      const response = await customsService.generateDeclarationFromSessionDocs(
        selectedDocs,
        shipmentType,
        shipmentChannel
      );

      if (response.error) {
        setError(response.error);
        setDeclaration(null);
      } else {
        setDeclaration(response);
        setActiveTab('party');

        // Increment customs declarations count for dashboard
        const currentCount = parseInt(sessionStorage.getItem('customs_declarations_count') || '0', 10);
        sessionStorage.setItem('customs_declarations_count', (currentCount + 1).toString());
      }
    } catch (err) {
      console.error('Declaration generation failed:', err);
      setError(err.response?.data?.detail || 'Failed to generate customs declaration. Please try again.');
      setDeclaration(null);
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    if (!declaration) return null;

    const tabData = {
      party: declaration.Tab_party || declaration.shipper_info || {},
      cargo: declaration.Tab_cargo || {},
      invoice: declaration.Tab_inv || {},
      items: declaration.Tab_item || declaration.items || [],
      summary: declaration.Tab_summary || {}
    };

    return (
      <JSONContent style={{ maxHeight: 'calc(100vh - 400px)' }}>
        {JSON.stringify(tabData[activeTab], null, 2)}
      </JSONContent>
    );
  };

  const renderExtractionPreview = () => {
    if (selectedDocuments.length === 0) {
      return (
        <EmptyState icon="🔍">
          Select documents to preview<br/>extracted data
        </EmptyState>
      );
    }

    return (
      <>
        {selectedDocuments.map((fileState, idx) => {
          // Merge all extraction data for complete preview
          // If combined doesn't exist, show the full extraction object
          const baseData = fileState.extraction?.combined || fileState.extraction || {};
          const previewData = {
            ...baseData,
            ...(fileState.extraction?.barcodes && fileState.extraction.barcodes.length > 0
              ? { barcodes: fileState.extraction.barcodes }
              : {})
          };

          return (
            <PreviewDocumentItem key={idx}>
              <PreviewDocumentName>
                {fileState.file?.name || 'Unknown'}
              </PreviewDocumentName>
              <JSONContent style={{ maxHeight: '300px', fontSize: '12px' }}>
                {JSON.stringify(previewData, null, 2)}
              </JSONContent>
            </PreviewDocumentItem>
          );
        })}
      </>
    );
  };

  return (
    <PanelContainer>
      <Header>
        <div>
          <Title>Customs Declaration Generator</Title>
          <Subtitle>Generate customs declarations from extracted session documents</Subtitle>
        </div>
      </Header>

      <MainLayout>
        {/* Left Column - Document Selection */}
        <Column>
          <Card>
            <CardHeader>
              <CardTitle>📁 Session Documents</CardTitle>
              {selectedIndexes.length > 0 && (
                <Badge>{selectedIndexes.length} selected</Badge>
              )}
            </CardHeader>
            <CardContent maxHeight="400px">
              {extractedFiles.length === 0 ? (
                <EmptyState icon="📤">
                  No extracted documents in current session.<br/>
                  Upload and extract documents first.
                </EmptyState>
              ) : (
                <>
                  {Object.keys(groupedDocuments).map(docType => (
                    <DocumentGroup key={docType}>
                      <DocumentGroupHeader>
                        <DocumentGroupTitle>
                          {docType.replace(/_/g, ' ')}
                        </DocumentGroupTitle>
                        <Badge>{groupedDocuments[docType].length}</Badge>
                      </DocumentGroupHeader>
                      {groupedDocuments[docType].map(fileState => (
                        <DocumentItem
                          key={fileState.originalIndex}
                          checked={selectedIndexes.includes(fileState.originalIndex)}
                        >
                          <Checkbox
                            checked={selectedIndexes.includes(fileState.originalIndex)}
                            onChange={() => toggleDocumentSelection(fileState.originalIndex)}
                          />
                          <DocumentInfo>
                            <DocumentName>{fileState.file?.name || 'Unknown'}</DocumentName>
                            <DocumentBadge>Current session</DocumentBadge>
                          </DocumentInfo>
                        </DocumentItem>
                      ))}
                    </DocumentGroup>
                  ))}
                </>
              )}
            </CardContent>

            {selectedIndexes.length > 0 && (
              <SelectionSummary>
                <SummaryText>Selected Documents</SummaryText>
                <SummaryValue>{selectedIndexes.length}</SummaryValue>
              </SelectionSummary>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⚙️ Declaration Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <SettingsSection>
                <InputGroup>
                  <Label>Shipment Type</Label>
                  <Select value={shipmentType} onChange={(e) => setShipmentType(e.target.value)}>
                    <option value="Import">Import</option>
                    <option value="Export">Export</option>
                  </Select>
                </InputGroup>

                <InputGroup>
                  <Label>Transport Channel</Label>
                  <Select value={shipmentChannel} onChange={(e) => setShipmentChannel(e.target.value)}>
                    <option value="Sea">🚢 Sea</option>
                    <option value="Air">✈️ Air</option>
                    <option value="Land">🚚 Land</option>
                  </Select>
                </InputGroup>

                <GenerateButton
                  onClick={generateDeclaration}
                  disabled={loading || selectedIndexes.length === 0}
                >
                  {loading ? '⏳ Generating...' : '✨ Generate Declaration'}
                </GenerateButton>
              </SettingsSection>
            </CardContent>
          </Card>
        </Column>

        {/* Middle Column - Extracted Data Preview */}
        <Column>
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader>
              <CardTitle>🔍 Extracted Data Preview</CardTitle>
              {selectedDocuments.length > 0 && (
                <Badge>{selectedDocuments.length} docs</Badge>
              )}
            </CardHeader>
            <CardContent style={{ flex: 1, maxHeight: 'calc(100vh - 280px)' }}>
              {renderExtractionPreview()}
            </CardContent>
          </Card>
        </Column>

        {/* Right Column - Generated Declaration */}
        <Column>
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader>
              <CardTitle>📋 Generated Declaration</CardTitle>
              {declaration && <Badge>Ready</Badge>}
            </CardHeader>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <CardContent style={{ flex: 1 }}>
              {loading ? (
                <LoadingContainer>
                  <Spinner />
                  <LoadingText>Generating customs declaration...</LoadingText>
                </LoadingContainer>
              ) : declaration ? (
                <>
                  <TabContainer>
                    <Tab active={activeTab === 'party'} onClick={() => setActiveTab('party')}>
                      👥 Party
                    </Tab>
                    <Tab active={activeTab === 'cargo'} onClick={() => setActiveTab('cargo')}>
                      📦 Cargo
                    </Tab>
                    <Tab active={activeTab === 'invoice'} onClick={() => setActiveTab('invoice')}>
                      💰 Invoice
                    </Tab>
                    <Tab active={activeTab === 'items'} onClick={() => setActiveTab('items')}>
                      📋 Items
                    </Tab>
                    <Tab active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>
                      📊 Summary
                    </Tab>
                  </TabContainer>
                  {renderTabContent()}
                </>
              ) : (
                <EmptyState icon="⚡">
                  {selectedIndexes.length === 0
                    ? 'Select documents to begin'
                    : 'Click "Generate Declaration" to create customs documentation'}
                </EmptyState>
              )}
            </CardContent>
          </Card>
        </Column>
      </MainLayout>
    </PanelContainer>
  );
};

export default CustomsPanel;
