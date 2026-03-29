/**
 * HSN/ECCN Engine Panel Component
 *
 * Panel for displaying HSN (Harmonized System Nomenclature) and ECCN (Export Control Classification Number)
 * codes for items extracted from documents.
 */

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { hsCodeService } from '../../services/api';

const PanelContainer = styled.div`
  padding: ${theme.spacing.xxl}px;
  max-width: 1600px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
`;

const PanelHeader = styled.div`
  margin-bottom: ${theme.spacing.xxl}px;

  h1 {
    font-size: ${theme.typography.fontSize['3xl']};
    font-weight: ${theme.typography.fontWeight.bold};
    background: linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.primary.cyan});
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0 0 ${theme.spacing.sm}px 0;
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md}px;
  }

  p {
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.fontSize.md};
    margin: 0;
  }
`;

const StatsBar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${theme.spacing.lg}px;
  margin-bottom: ${theme.spacing.xxl}px;
`;

const StatCard = styled.div`
  background: ${theme.colors.ui.card};
  backdrop-filter: ${theme.colors.ui.glassBlur};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.lg}px;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs}px;
  transition: all ${theme.transitions.normal};

  &:hover {
    border-color: ${theme.colors.primary.main};
    box-shadow: ${theme.shadows.md};
  }

  .label {
    font-size: ${theme.typography.fontSize.xs};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.secondary};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .value {
    font-size: ${theme.typography.fontSize['3xl']};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
  }
`;

const DocumentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xl}px;
`;

const DocumentCard = styled.div`
  background: ${theme.colors.ui.card};
  backdrop-filter: ${theme.colors.ui.glassBlur};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.xl}px;
  padding: ${theme.spacing.xl}px;
  box-shadow: ${theme.shadows.card};
  transition: all ${theme.transitions.normal};

  &:hover {
    box-shadow: ${theme.shadows.cardHover};
    border-color: ${theme.colors.primary.main};
  }
`;

const DocumentHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.lg}px;
  padding-bottom: ${theme.spacing.md}px;
  border-bottom: 1px solid ${theme.colors.ui.border};

  .doc-info {
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xs}px;

    .doc-name {
      font-size: ${theme.typography.fontSize.lg};
      font-weight: ${theme.typography.fontWeight.semibold};
      color: ${theme.colors.text.primary};
      display: flex;
      align-items: center;
      gap: ${theme.spacing.sm}px;
    }

    .doc-type {
      font-size: ${theme.typography.fontSize.sm};
      color: ${theme.colors.text.secondary};
    }
  }

  .doc-status {
    padding: ${theme.spacing.xs}px ${theme.spacing.md}px;
    background: ${props => props.processed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'};
    color: ${props => props.processed ? theme.colors.status.success : theme.colors.status.warning};
    border-radius: ${theme.radius.pill}px;
    font-size: ${theme.typography.fontSize.xs};
    font-weight: ${theme.typography.fontWeight.semibold};
  }
`;

const ItemsTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm}px;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 3fr 2fr 1.5fr 1.5fr 2fr;
  gap: ${theme.spacing.md}px;
  padding: ${theme.spacing.md}px;
  background: rgba(30, 42, 78, 0.5);
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 3fr 2fr 1.5fr 1.5fr 2fr;
  gap: ${theme.spacing.md}px;
  padding: ${theme.spacing.md}px;
  background: rgba(30, 42, 78, 0.3);
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.text.primary};
  transition: all ${theme.transitions.normal};

  &:hover {
    background: rgba(30, 42, 78, 0.5);
    border-color: ${theme.colors.primary.main};
    transform: translateX(4px);
  }

  .item-name {
    font-weight: ${theme.typography.fontWeight.medium};
  }

  .hsn-code {
    font-family: ${theme.typography.fontFamily.mono};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.primary.cyan};
  }

  .eccn-code {
    font-family: ${theme.typography.fontFamily.mono};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.primary.light};
  }

  .quantity {
    color: ${theme.colors.text.secondary};
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing.xs}px;
    font-size: ${theme.typography.fontSize.xs};
    font-weight: ${theme.typography.fontWeight.semibold};
    padding: 4px 8px;
    background: ${props => props.verified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'};
    color: ${props => props.verified ? theme.colors.status.success : theme.colors.status.warning};
    border-radius: ${theme.radius.sm}px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.spacing.xxxl}px;
  color: ${theme.colors.text.secondary};

  .icon {
    font-size: 64px;
    margin-bottom: ${theme.spacing.lg}px;
    opacity: 0.5;
  }

  h3 {
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    margin: 0 0 ${theme.spacing.sm}px 0;
  }

  p {
    font-size: ${theme.typography.fontSize.md};
    margin: 0;
  }
`;

const ActionButton = styled.button`
  background: ${theme.colors.primary.gradient};
  color: ${theme.colors.text.primary};
  border: none;
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  box-shadow: ${theme.shadows.button};

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${theme.shadows.buttonHover};
  }

  &:active {
    transform: translateY(0);
  }
`;

const HSNECCNPanel = () => {
  const { files } = useDocumentContext();
  const [loading, setLoading] = useState(false);
  const [processedDocuments, setProcessedDocuments] = useState([]);

  // Filter documents that have been extracted and have items
  const documentsWithItems = useMemo(() => {
    return files
      .filter(fileState => {
        const extraction = fileState.extraction?.combined || fileState.extraction;
        return extraction && extraction.items && extraction.items.length > 0;
      })
      .map(fileState => {
        const extraction = fileState.extraction?.combined || fileState.extraction;
        const classification = fileState.classification;

        return {
          id: fileState.id,
          name: fileState.file?.name || 'Unknown Document',
          type: classification?.document_type || 'Unknown',
          items: extraction.items || [],
          timestamp: fileState.timestamp,
          processed: true
        };
      });
  }, [files]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalItems = documentsWithItems.reduce((sum, doc) => sum + doc.items.length, 0);
    const itemsWithHSN = documentsWithItems.reduce((sum, doc) => {
      return sum + doc.items.filter(item => item.hsn_code || item.hs_code).length;
    }, 0);

    return {
      totalDocuments: documentsWithItems.length,
      totalItems: totalItems,
      itemsWithHSN: itemsWithHSN,
      pendingItems: totalItems - itemsWithHSN
    };
  }, [documentsWithItems]);

  // Function to get HSN code for an item (from different possible field names)
  const getHSNCode = (item) => {
    return item.hsn_code || item.hs_code || item.hscode || 'N/A';
  };

  // Function to get ECCN code (placeholder - would need actual ECCN mapping logic)
  const getECCNCode = (item, hsnCode) => {
    // Placeholder: In a real implementation, this would map HSN to ECCN
    // based on product characteristics and export control regulations
    if (hsnCode && hsnCode !== 'N/A') {
      return 'EAR99'; // Default ECCN for items not subject to specific controls
    }
    return 'N/A';
  };

  // Function to get item quantity
  const getQuantity = (item) => {
    return item.quantity || item.qty || '-';
  };

  return (
    <PanelContainer>
      <PanelHeader>
        <h1>
          <span>🏷️</span>
          HSN/ECCN Engine
        </h1>
        <p>
          View and manage HSN (Harmonized System Nomenclature) and ECCN (Export Control Classification Number)
          codes for all items extracted from your documents.
        </p>
      </PanelHeader>

      <StatsBar>
        <StatCard>
          <div className="label">Total Documents</div>
          <div className="value">{stats.totalDocuments}</div>
        </StatCard>
        <StatCard>
          <div className="label">Total Items</div>
          <div className="value">{stats.totalItems}</div>
        </StatCard>
        <StatCard>
          <div className="label">Items with HSN</div>
          <div className="value">{stats.itemsWithHSN}</div>
        </StatCard>
        <StatCard>
          <div className="label">Pending Items</div>
          <div className="value">{stats.pendingItems}</div>
        </StatCard>
      </StatsBar>

      {documentsWithItems.length === 0 ? (
        <EmptyState>
          <div className="icon">📦</div>
          <h3>No Documents Processed Yet</h3>
          <p>Upload and process documents in the Document Manager to see HSN/ECCN codes for extracted items.</p>
        </EmptyState>
      ) : (
        <DocumentList>
          {documentsWithItems.map((doc) => (
            <DocumentCard key={doc.id}>
              <DocumentHeader processed={doc.processed}>
                <div className="doc-info">
                  <div className="doc-name">
                    <span>📄</span>
                    {doc.name}
                  </div>
                  <div className="doc-type">
                    Document Type: {doc.type} • {doc.items.length} item{doc.items.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="doc-status">
                  {doc.processed ? 'Processed' : 'Pending'}
                </div>
              </DocumentHeader>

              <ItemsTable>
                <TableHeader>
                  <div>Item Description</div>
                  <div>HSN Code</div>
                  <div>ECCN Code</div>
                  <div>Quantity</div>
                  <div>Status</div>
                </TableHeader>
                {doc.items.map((item, index) => {
                  const hsnCode = getHSNCode(item);
                  const eccnCode = getECCNCode(item, hsnCode);
                  const hasHSN = hsnCode !== 'N/A';

                  return (
                    <TableRow key={index} verified={hasHSN}>
                      <div className="item-name">{item.description || item.item_description || 'Unknown Item'}</div>
                      <div className="hsn-code">{hsnCode}</div>
                      <div className="eccn-code">{eccnCode}</div>
                      <div className="quantity">{getQuantity(item)}</div>
                      <div className="status">
                        {hasHSN ? (
                          <>
                            <span>✓</span>
                            <span>Verified</span>
                          </>
                        ) : (
                          <>
                            <span>⚠</span>
                            <span>Pending</span>
                          </>
                        )}
                      </div>
                    </TableRow>
                  );
                })}
              </ItemsTable>
            </DocumentCard>
          ))}
        </DocumentList>
      )}
    </PanelContainer>
  );
};

export default HSNECCNPanel;
