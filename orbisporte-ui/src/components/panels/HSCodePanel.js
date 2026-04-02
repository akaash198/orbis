/**
 * HSCodePanel Component
 * 
 * Panel for looking up HS codes for products.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import { hsCodeService } from '../../services/api';

const PanelContainer = styled.div`
  padding: ${theme.spacing.xxl}px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xxl}px;
  overflow-y: auto;
  background: ${theme.colors.ui.background};
  position: relative;

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg,
      ${theme.colors.primary.main} 0%,
      ${theme.colors.primary.light} 50%,
      ${theme.colors.primary.main} 100%
    );
    box-shadow: 0 2px 8px ${theme.colors.primary.main}40;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: ${theme.spacing.xxl}px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const MainSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xl}px;
`;

const SideSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xl}px;
`;

const PageTitle = styled.h1`
  font-weight: ${theme.typography.fontWeight.extrabold};
  font-size: ${theme.typography.fontSize['4xl']};
  color: ${theme.colors.text.primary};
  margin: 0 0 ${theme.spacing.lg}px 0;
  text-shadow: ${theme.typography.textShadow.sm};
  letter-spacing: -0.02em;

  &:before {
    content: '🔍 ';
    font-size: ${theme.typography.fontSize['5xl']};
    margin-right: ${theme.spacing.sm}px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }
`;

const PanelTitle = styled.div`
  font-weight: ${theme.typography.fontWeight.bold};
  margin-bottom: ${theme.spacing.md}px;
  font-size: ${theme.typography.fontSize.xxl};
  color: ${theme.colors.text.primary};
  text-shadow: ${theme.typography.textShadow.sm};
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  font-family: ${theme.typography.fontFamily.main};
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 2px ${theme.colors.primary.light}40;
  }
`;

const LookupButton = styled.button`
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  background: ${theme.colors.primary.main};
  color: ${theme.colors.primary.contrast};
  border: none;
  border-radius: ${theme.radius.md}px;
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: background-color ${theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${theme.colors.primary.dark};
  }

  &:disabled {
    background: ${theme.colors.text.tertiary};
    cursor: not-allowed;
  }

  ${props => props.loading && `
    &::before {
      content: '';
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  `}
`;

const ResultSection = styled.div`
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  background: ${theme.colors.ui.card};
  padding: ${theme.spacing.md}px;
  overflow: auto;
  flex: 1;
`;

const EmptyResult = styled.div`
  color: ${theme.colors.text.tertiary};
  text-align: center;
  padding: ${theme.spacing.xl}px;
`;

const ResultContent = styled.div`
  font-family: ${theme.typography.fontFamily.main};
  font-size: ${theme.typography.fontSize.sm};
  line-height: 1.6;
`;

const SuccessResult = styled.div`
  background: ${theme.colors.status.successLight};
  border: 1px solid ${theme.colors.status.success};
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const WarningResult = styled.div`
  background: ${theme.colors.status.warningLight};
  border: 1px solid ${theme.colors.status.warning};
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const InfoBox = styled.div`
  background: ${theme.colors.feature.cardGradient};
  border: 1px solid ${theme.colors.ui.borderLight};
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.lg}px;
  margin-bottom: ${theme.spacing.md}px;
  box-shadow: ${theme.shadows.sm};
  
  strong {
    color: ${theme.colors.text.primary};
  }
  
  ul {
    color: ${theme.colors.text.secondary};
    
    li {
      margin-bottom: ${theme.spacing.xs}px;
    }
  }
`;

const SampleProductsTitle = styled.div`
  font-weight: ${theme.typography.fontWeight.semibold};
  margin-bottom: ${theme.spacing.sm}px;
  color: ${theme.colors.text.primary};
`;

const SampleProductButton = styled.button`
  width: 100%;
  text-align: left;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: ${theme.colors.ui.card};
  color: ${theme.colors.text.primary};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  margin-bottom: ${theme.spacing.xs}px;
  font-family: ${theme.typography.fontFamily.main};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};

  &:hover:not(:disabled) {
    background: ${theme.colors.ui.hover};
    border-color: ${theme.colors.primary.main};
    color: ${theme.colors.primary.main};
    transform: translateX(2px);
  }

  &:active:not(:disabled) {
    transform: translateX(1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const ExtractedItemsSection = styled.div`
  background: linear-gradient(135deg, ${theme.colors.primary.light}15 0%, ${theme.colors.ui.card} 100%);
  border: 2px solid ${theme.colors.primary.main};
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.xl}px;
  margin-bottom: ${theme.spacing.xxl}px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px ${theme.colors.primary.light}40;
  position: relative;

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, ${theme.colors.primary.main}, ${theme.colors.primary.light});
    border-radius: ${theme.radius.lg}px ${theme.radius.lg}px 0 0;
  }
`;

const ExtractedItemsTitle = styled.div`
  font-size: ${theme.typography.fontSize['2xl']};
  font-weight: ${theme.typography.fontWeight.extrabold};
  color: ${theme.colors.primary.main};
  margin-bottom: ${theme.spacing.lg}px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-shadow: ${theme.typography.textShadow.sm};

  span {
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm}px;
  }
`;

const ClearButton = styled.button`
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  background: linear-gradient(135deg, ${theme.colors.status.error}, #d32f2f);
  color: white;
  border: none;
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  box-shadow: 0 2px 6px ${theme.colors.status.error}40;

  &:hover {
    background: linear-gradient(135deg, #d32f2f, ${theme.colors.status.error});
    transform: translateY(-1px);
    box-shadow: 0 4px 8px ${theme.colors.status.error}60;
  }

  &:active {
    transform: translateY(0);
  }
`;

const ItemsTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: ${theme.spacing.md}px;
  border-radius: ${theme.radius.md}px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  thead {
    background: linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.primary.dark});

    th {
      padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
      text-align: left;
      font-weight: ${theme.typography.fontWeight.bold};
      color: white;
      font-size: ${theme.typography.fontSize.sm};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 3px solid ${theme.colors.primary.dark};

      &:first-child {
        border-top-left-radius: ${theme.radius.md}px;
      }

      &:last-child {
        border-top-right-radius: ${theme.radius.md}px;
      }
    }
  }

  tbody {
    background: var(--t-bg-dark);

    tr {
      border-bottom: 1px solid ${theme.colors.ui.borderLight};
      transition: all ${theme.transitions.fast};

      &:hover {
        background: ${theme.colors.primary.light}10;
        transform: translateX(2px);
      }

      &:last-child {
        border-bottom: none;

        td:first-child {
          border-bottom-left-radius: ${theme.radius.md}px;
        }

        td:last-child {
          border-bottom-right-radius: ${theme.radius.md}px;
        }
      }

      td {
        padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
        color: ${theme.colors.text.secondary};
        font-size: ${theme.typography.fontSize.sm};
        vertical-align: middle;

        &:first-child {
          font-weight: ${theme.typography.fontWeight.bold};
          color: ${theme.colors.text.primary};
        }
      }
    }
  }
`;

const HSCodeBadge = styled.span`
  display: inline-block;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: linear-gradient(135deg, ${theme.colors.status.success}, ${theme.colors.status.successLight});
  color: white;
  border-radius: ${theme.radius.md}px;
  font-weight: ${theme.typography.fontWeight.bold};
  font-size: ${theme.typography.fontSize.sm};
  box-shadow: 0 2px 6px ${theme.colors.status.success}40;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.5px;
  border: 1px solid ${theme.colors.status.success};
`;

const LookupItemButton = styled.button`
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  background: ${theme.colors.primary.main};
  color: ${theme.colors.primary.contrast};
  border: none;
  border-radius: ${theme.radius.sm}px;
  font-size: ${theme.typography.fontSize.xs};
  cursor: pointer;
  transition: background ${theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${theme.colors.primary.dark};
  }

  &:disabled {
    background: ${theme.colors.text.tertiary};
    cursor: not-allowed;
  }
`;


const HSCodePanel = ({ extractedDocuments = [], onClearAll, onPageChange }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchedProduct, setSearchedProduct] = useState('');
  const [itemResults, setItemResults] = useState({});
  const [lookingUpItems, setLookingUpItems] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [overrideRowIdx, setOverrideRowIdx] = useState(null);
  const [overrideInput, setOverrideInput]   = useState('');
  const [manualHsnCode, setManualHsnCode]   = useState('');
  const [savedManualEntries, setSavedManualEntries] = useState([]);
  const [manualSaveMsg, setManualSaveMsg]   = useState('');

  const sampleProducts = [
    "iPhone smartphone",
    "Samsung Galaxy smartphone mobile phone", 
    "MacBook Pro laptop computer",
    "iPad tablet computer",
    "Apple Watch smartwatch",
    "Bluetooth wireless headphones earphones",
    "USB cable data charging cable",
    "Wireless mouse computer accessory"
  ];
  
  const lookupHSCode = async (productText = null) => {
    const searchText = productText || text;
    if (!searchText.trim()) return;
    
    setLoading(true);
    // Store the product description that we're actually searching for
    setSearchedProduct(searchText.trim());
    
    try {
      const response = await hsCodeService.lookupHSCode(searchText);
      setResult(response);
    } catch (err) {
      console.error('HS code lookup error:', err);
      alert(`HS code classification failed: ${err?.response?.status} ${err?.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleProduct = async (product) => {
    setText(product);
    await lookupHSCode(product);
  };

  // Lookup HSN code for a specific extracted item
  const lookupItemHSCode = async (index, productDescription) => {
    if (!productDescription || !productDescription.trim()) return;

    setLookingUpItems(prev => new Set(prev).add(index));

    try {
      const response = await hsCodeService.lookupHSCode(productDescription);
      setItemResults(prev => ({
        ...prev,
        [index]: response
      }));
    } catch (err) {
      console.error(`HS code lookup error for item ${index}:`, err);
      setItemResults(prev => ({
        ...prev,
        [index]: { error: err.message }
      }));
    } finally {
      setLookingUpItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  // Save an inline per-row HSN override
  const saveRowOverride = (groupIndex) => {
    const code = overrideInput.trim();
    if (!code) return;
    const idx = groupedItems[groupIndex]?.itemIndices[0];
    if (idx !== undefined) {
      setItemResults(prev => ({
        ...prev,
        [idx]: { selected_hsn: code, hs_code: code, selected_confidence: 1.0, source: 'manual' },
      }));
    }
    setOverrideRowIdx(null);
    setOverrideInput('');
  };

  // Save standalone manual entry
  const saveManualEntry = () => {
    const code = manualHsnCode.trim();
    if (!code) return;
    setSavedManualEntries(prev => [...prev, {
      id: Date.now(),
      hsn_code: code,
      timestamp: new Date().toLocaleTimeString(),
    }]);
    setManualHsnCode('');
    setManualSaveMsg('Saved!');
    setTimeout(() => setManualSaveMsg(''), 3000);
  };

  // Group items by document and description to show quantity
  const groupedItems = React.useMemo(() => {
    const groups = [];
    const groupMap = new Map();

    extractedDocuments.forEach((doc) => {
      doc.items.forEach((item, itemIndex) => {
        const description = (item.product_description || item.description || item.name || 'N/A').trim();
        const documentName = item.documentName || doc.name || 'Unknown';

        // Create unique key for this document + description combination
        const groupKey = `${documentName}|||${description}`;

        if (groupMap.has(groupKey)) {
          // Add to existing group
          const existingGroup = groupMap.get(groupKey);
          existingGroup.quantity += 1;
          existingGroup.itemIndices.push(existingGroup.allItemsCount);
          existingGroup.allItemsCount += 1;
        } else {
          // Create new group
          const newGroup = {
            groupKey,
            documentName,
            description,
            quantity: 1,
            itemIndices: [groups.reduce((sum, g) => sum + g.quantity, 0)], // Start with current total count
            allItemsCount: groups.reduce((sum, g) => sum + g.quantity, 0) + 1,
            originalItem: item
          };
          groupMap.set(groupKey, newGroup);
          groups.push(newGroup);
        }
      });
    });

    console.log('[HSCodePanel] Total unique groups:', groups.length);
    console.log('[HSCodePanel] Total individual items:', groups.reduce((sum, g) => sum + g.quantity, 0));
    return groups;
  }, [extractedDocuments]);

  // Auto-select all items when new documents are added
  React.useEffect(() => {
    if (groupedItems && groupedItems.length > 0) {
      const allIndices = groupedItems.map((_, idx) => idx);
      setSelectedItems(new Set(allIndices));
      console.log('[HSCodePanel] ✓ Auto-selected all', allIndices.length, 'items');
    }
  }, [groupedItems]);

  // Pre-populate itemResults for items that already carry an HSN code from M02
  React.useEffect(() => {
    if (!groupedItems || groupedItems.length === 0) return;
    const prePopulated = {};
    groupedItems.forEach((group) => {
      const item = group.originalItem;
      const existingHsn = item?.hsn_code || item?.hsCode || item?.hs_code || item?.hscode;
      if (existingHsn) {
        group.itemIndices.forEach(idx => {
          prePopulated[idx] = {
            selected_hsn: existingHsn,
            hs_code: existingHsn,
            selected_confidence: 1.0,
            source: 'document',
          };
        });
      }
    });
    if (Object.keys(prePopulated).length > 0) {
      setItemResults(prev => ({ ...prePopulated, ...prev }));
    }
  }, [groupedItems]);

  // When a new document arrives with no HSN code, pre-fill the search box with the
  // first item's product description so the user can click "Search Code" right away.
  React.useEffect(() => {
    if (!extractedDocuments.length) return;
    const latest = extractedDocuments[extractedDocuments.length - 1];
    if (!latest?.items?.length) return;
    const noHsnItem = latest.items.find(item => {
      const hsn = item.hsCode || item.hsn_code || item.hs_code || item.hscode;
      return !hsn || !String(hsn).trim();
    });
    if (noHsnItem) {
      const desc = (noHsnItem.product_description || noHsnItem.description || noHsnItem.name || '').trim();
      if (desc) setText(desc);
    }
  }, [extractedDocuments]);

  // Toggle selection for a grouped item
  const toggleItemSelection = (groupIndex) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupIndex)) {
        newSet.delete(groupIndex);
      } else {
        newSet.add(groupIndex);
      }
      return newSet;
    });
  };

  // Select/Deselect all grouped items
  const toggleSelectAll = () => {
    if (selectedItems.size === groupedItems.length) {
      setSelectedItems(new Set()); // Deselect all
    } else {
      setSelectedItems(new Set(groupedItems.map((_, idx) => idx))); // Select all
    }
  };

  // Lookup selected grouped items
  const lookupSelected = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to lookup');
      return;
    }

    console.log(`[HSCodePanel] Looking up ${selectedItems.size} selected groups...`);
    console.log('[HSCodePanel] Selected item indices:', Array.from(selectedItems));
    console.log('[HSCodePanel] Grouped items:', groupedItems);

    for (const groupIndex of selectedItems) {
      const group = groupedItems[groupIndex];
      const description = group.description;

      console.log(`[HSCodePanel] Processing group ${groupIndex}:`, group);
      console.log(`[HSCodePanel] Description: "${description}"`);

      // Check if we already have a VALID result for any item in this group
      // "0000.00.00" is a placeholder, not a real result
      const hasResult = group.itemIndices.some(idx => {
        const result = itemResults[idx];
        console.log(`[HSCodePanel] Checking item ${idx} result:`, result);
        return result && result.hs_code && result.hs_code !== '0000.00.00';
      });

      console.log(`[HSCodePanel] Group ${groupIndex} hasResult:`, hasResult);

      if (description && !hasResult) {
        console.log(`[HSCodePanel] ✓ Starting lookup for group ${groupIndex}...`);
        // Lookup once and apply to all items in the group
        await lookupGroupHSCode(groupIndex, description, group.itemIndices);
      } else {
        console.log(`[HSCodePanel] ✗ Skipping group ${groupIndex} - hasResult: ${hasResult}, description: "${description}"`);
      }
    }
  };

  // Lookup HSN code for a grouped item (applies to all items in the group)
  const lookupGroupHSCode = async (groupIndex, productDescription, itemIndices) => {
    if (!productDescription || !productDescription.trim()) return;

    console.log(`[HSCodePanel] 🔍 Looking up HS code for: "${productDescription}"`);
    setLookingUpItems(prev => new Set(prev).add(groupIndex));

    try {
      console.log('[HSCodePanel] 📡 Calling API...');
      const response = await hsCodeService.lookupHSCode(productDescription);
      console.log('[HSCodePanel] ✅ API Response:', response);

      // Apply the result to all items in this group
      setItemResults(prev => {
        const newResults = { ...prev };
        itemIndices.forEach(itemIndex => {
          newResults[itemIndex] = response;
          console.log(`[HSCodePanel] Stored result for item ${itemIndex}:`, response);
        });
        return newResults;
      });
    } catch (err) {
      console.error(`[HSCodePanel] ❌ HS code lookup error for group ${groupIndex}:`, err);
      setItemResults(prev => {
        const newResults = { ...prev };
        itemIndices.forEach(itemIndex => {
          newResults[itemIndex] = { error: err.message };
        });
        return newResults;
      });
    } finally {
      setLookingUpItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupIndex);
        return newSet;
      });
    }
  };
  
  const renderResult = () => {
    if (!result) return null;

    const selectedHsn  = result.selected_hsn;
    const top3         = result.top3_predictions || [];
    const confidence   = result.selected_confidence || 0;
    const routing      = result.routing || 'human_review';
    const isAuto       = routing === 'auto';
    const confPct      = n => `${Math.round((n || 0) * 100)}%`;
    const confColor    = c => c >= 0.92 ? '#22c55e' : c >= 0.70 ? '#f59e0b' : '#ef4444';

    if (!selectedHsn && top3.length === 0) {
      return (
        <WarningResult>
          <div style={{ fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.sm }}>
            ⚠️ No HSN code found
          </div>
          <div style={{ marginBottom: theme.spacing.xs }}>
            <strong>Product:</strong> {searchedProduct}
          </div>
          <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary, marginTop: theme.spacing.sm }}>
            Try a more specific product description or include material composition and intended use.
          </div>
        </WarningResult>
      );
    }

    return (
      <SuccessResult>

        {/* ── Header row: HSN + confidence + routing ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <div style={{ background: 'var(--t-card)', borderRadius: 8, padding: '8px 14px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: 'var(--t-text-sub)', marginBottom: 2 }}>HSN CODE</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: 'var(--t-btn-color)', letterSpacing: 1 }}>
              {selectedHsn || '—'}
            </div>
          </div>
          <div style={{ background: 'var(--t-card)', borderRadius: 8, padding: '8px 14px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: 'var(--t-text-sub)', marginBottom: 2 }}>CONFIDENCE</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: confColor(confidence) }}>
              {confPct(confidence)}
            </div>
          </div>
          <div style={{ background: 'var(--t-card)', borderRadius: 8, padding: '8px 14px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: 'var(--t-text-sub)', marginBottom: 2 }}>ROUTING</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: isAuto ? '#22c55e' : '#f59e0b' }}>
              {isAuto ? '✅ Auto-Classified' : '⚠️ Human Review'}
            </div>
          </div>
          <div style={{ background: 'var(--t-card)', borderRadius: 8, padding: '8px 14px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: 'var(--t-text-sub)', marginBottom: 2 }}>PIPELINE</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>
              {result.pipeline_duration_ms || '—'}ms
              {result.candidates_retrieved ? ` · ${result.candidates_retrieved} candidates` : ''}
            </div>
          </div>
        </div>

        {/* ── Language detection ── */}
        {result.detected_language && result.detected_language !== 'en' && (
          <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginBottom: 10 }}>
            🌐 Language detected: <strong style={{ color: 'var(--t-text-sub)' }}>{result.detected_language.toUpperCase()}</strong> — XLM-RoBERTa multilingual normalisation applied
          </div>
        )}

        {/* ── SCOMET / Trade remedy / Country alerts ── */}
        {result.scomet_flag && (
          <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#fca5a5' }}>
            🚨 <strong>SCOMET CONTROLLED:</strong> This item may require a DGFT export licence. Verify against SCOMET Schedule before shipment.
          </div>
        )}
        {result.trade_remedy_alert && (
          <div style={{ background: '#431407', border: '1px solid #9a3412', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#fed7aa' }}>
            ⚠️ <strong>TRADE REMEDY ALERT:</strong> Anti-dumping / safeguard duties may apply. Check CBIC notifications.
          </div>
        )}
        {(result.restricted_countries || []).map((ra, i) => (
          <div key={i} style={{ background: '#1c1917', border: '1px solid #78350f', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#fde68a' }}>
            🌍 <strong>COUNTRY RESTRICTION ({ra.country}):</strong> {ra.note}
          </div>
        ))}

        {/* ── Top-3 predictions ── */}
        {top3.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 4 }}>
              Top-3 Predictions
            </div>
            {top3.map((pred, i) => {
              const c = pred.confidence || 0;
              const bc = confColor(c);
              return (
                <div key={i} style={{
                  background: i === 0 ? 'var(--t-card-elevated)' : 'var(--t-card)',
                  border: `1px solid ${i === 0 ? 'rgba(59,130,246,0.3)' : 'var(--t-border)'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-sub)' }}>#{i + 1}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--t-btn-color)', letterSpacing: 1 }}>
                      {pred.hsn_code}
                    </span>
                    <span style={{ background: bc + '20', color: bc, border: `1px solid ${bc}`, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                      {confPct(c)}
                    </span>
                    {pred.gri_rule && (
                      <span style={{ fontSize: 10, color: 'var(--t-text-sub)', background: 'var(--t-bg-dark)', padding: '1px 6px', borderRadius: 3 }}>
                        {pred.gri_rule}
                      </span>
                    )}
                    {pred.scomet_controlled && (
                      <span style={{ fontSize: 10, color: '#fca5a5', background: '#450a0a', padding: '1px 6px', borderRadius: 3 }}>SCOMET</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t-text-sub)', lineHeight: 1.5 }}>{pred.reasoning}</div>
                  {pred.scomet_note && (
                    <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 4, fontStyle: 'italic' }}>{pred.scomet_note}</div>
                  )}
                  {pred.trade_remedy_note && (
                    <div style={{ fontSize: 11, color: '#fed7aa', marginTop: 4, fontStyle: 'italic' }}>{pred.trade_remedy_note}</div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── Classification notes ── */}
        {result.classification_notes && (
          <div style={{ fontSize: 12, color: 'var(--t-text-sub)', marginTop: 8, borderTop: '1px solid var(--t-border)', paddingTop: 8 }}>
            <strong style={{ color: 'var(--t-text-sub)' }}>Notes:</strong> {result.classification_notes}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ fontSize: 11, color: 'var(--t-text-sub)', marginTop: 10, borderTop: '1px solid var(--t-border)', paddingTop: 8 }}>
          ITC(HS) 2012 · {result.candidates_retrieved || 0} candidates via pgvector / PostgreSQL FTS ·
          GPT-4o-mini chain-of-thought · SOP HSN-003
        </div>

      </SuccessResult>
    );
  };
  
  return (
    <PanelContainer>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <PageTitle style={{ margin: 0 }}>
          HSN Classification Engine
        </PageTitle>
        {onPageChange && (
          <button
            onClick={() => onPageChange('document')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid var(--t-border)',
              borderRadius: 6, padding: '6px 12px', fontSize: 13,
              color: 'var(--t-text-sub)', cursor: 'pointer',
            }}
          >
            ← Document Management
          </button>
        )}
      </div>

      {/* Display grouped items from all documents */}
      {groupedItems && groupedItems.length > 0 && (
        <ExtractedItemsSection>
          <ExtractedItemsTitle>
            <span>
              📋 Extracted Items
              ({groupedItems.reduce((sum, g) => sum + g.quantity, 0)} items, {groupedItems.length} unique from {extractedDocuments.length} document(s))
            </span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <LookupButton
                onClick={lookupSelected}
                disabled={selectedItems.size === 0}
                style={{ background: selectedItems.size > 0 ? theme.colors.primary.main : theme.colors.ui.border }}
              >
                🔍 Lookup Selected ({selectedItems.size})
              </LookupButton>
              <button
                onClick={() => {
                  console.log('[HSCodePanel] 🔄 Clearing all cached results...');
                  setItemResults({});
                  alert('Cached results cleared! Now select items and click Lookup.');
                }}
                style={{
                  padding: '8px 16px',
                  background: theme.colors.status.warning,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🔄 Clear Cache
              </button>
              {onClearAll && (
                <ClearButton onClick={onClearAll}>Clear All</ClearButton>
              )}
            </div>
          </ExtractedItemsTitle>

          <ItemsTable>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedItems.size === groupedItems.length && groupedItems.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>#</th>
                <th>Document</th>
                <th>Quantity</th>
                <th>Product Description</th>
                <th>HSN/HS Code</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {groupedItems.map((group, groupIndex) => {
                // Get HSN result from first item in the group
                const hsnResult = itemResults[group.itemIndices[0]];
                const isLooking = lookingUpItems.has(groupIndex);
                const isSelected = selectedItems.has(groupIndex);

                return (
                  <tr key={groupIndex} style={{ background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(groupIndex)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>{groupIndex + 1}</td>
                    <td style={{ fontSize: '12px', color: theme.colors.text.secondary }}>
                      {group.documentName}
                    </td>
                    <td>
                      <span style={{
                        fontWeight: theme.typography.fontWeight.bold,
                        color: group.quantity > 1 ? theme.colors.primary.main : theme.colors.text.secondary,
                        background: group.quantity > 1 ? `${theme.colors.primary.light}20` : 'transparent',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        {group.quantity}
                      </span>
                    </td>
                    <td>{group.description}</td>
                    <td>
                      {overrideRowIdx === groupIndex ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={overrideInput}
                            onChange={e => setOverrideInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveRowOverride(groupIndex); if (e.key === 'Escape') { setOverrideRowIdx(null); setOverrideInput(''); } }}
                            placeholder="HSN code"
                            maxLength={10}
                            style={{
                              width: 100, padding: '3px 7px', fontSize: 12,
                              fontFamily: 'monospace', fontWeight: 700,
                              background: '#0c1a3a', border: '1px solid #3b82f6',
                              borderRadius: 4, color: '#93c5fd', outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => saveRowOverride(groupIndex)}
                            style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >✓</button>
                          <button
                            onClick={() => { setOverrideRowIdx(null); setOverrideInput(''); }}
                            style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 4, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
                          >✕</button>
                        </div>
                      ) : isLooking ? (
                        <span>🔄 Looking up...</span>
                      ) : (hsnResult?.selected_hsn || hsnResult?.hs_code) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <HSCodeBadge>{hsnResult.selected_hsn || hsnResult.hs_code}</HSCodeBadge>
                          {hsnResult?.source === 'manual' && <span style={{ fontSize: 10, color: '#a5b4fc' }}>manual</span>}
                          <button
                            onClick={() => { setOverrideRowIdx(groupIndex); setOverrideInput(hsnResult.selected_hsn || hsnResult.hs_code || ''); }}
                            title="Override HSN code"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}
                          >✏️</button>
                        </div>
                      ) : hsnResult?.error ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: theme.colors.status.error }}>Error</span>
                          <button
                            onClick={() => { setOverrideRowIdx(groupIndex); setOverrideInput(''); }}
                            title="Enter HSN manually"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}
                          >✏️</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: theme.colors.text.tertiary }}>-</span>
                          <button
                            onClick={() => { setOverrideRowIdx(groupIndex); setOverrideInput(''); }}
                            title="Enter HSN manually"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}
                          >✏️</button>
                        </div>
                      )}
                    </td>
                    <td>
                      {(hsnResult?.selected_confidence || hsnResult?.confidence)
                        ? `${Math.round((hsnResult.selected_confidence || hsnResult.confidence) * 100)}%`
                        : hsnResult?.source === 'manual' ? 'Manual' : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ItemsTable>
        </ExtractedItemsSection>
      )}

      {/* ── Manual HSN Entry ── */}
      <div style={{
        background: '#0c1222', border: '1px solid #1e3a5f',
        borderRadius: 12, padding: 24, marginBottom: 8,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#60a5fa', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✏️ Manual HSN Code Entry
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
              HSN Code
            </div>
            <input
              value={manualHsnCode}
              onChange={e => setManualHsnCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveManualEntry()}
              placeholder="e.g. 84713010"
              maxLength={10}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0a1628', border: '1px solid #3b82f6',
                borderRadius: 6, color: '#93c5fd',
                padding: '9px 12px', fontSize: 15,
                fontFamily: 'monospace', fontWeight: 700,
                letterSpacing: '0.1em', outline: 'none',
              }}
            />
          </div>
          <button
            onClick={saveManualEntry}
            disabled={!manualHsnCode.trim()}
            style={{
              background: manualHsnCode.trim() ? 'linear-gradient(135deg, #1d4ed8, #6366f1)' : '#1e293b',
              color: manualHsnCode.trim() ? 'white' : '#475569',
              border: 'none', borderRadius: 6,
              padding: '9px 20px', fontSize: 13, fontWeight: 700,
              cursor: manualHsnCode.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            Save &amp; Use
          </button>
        </div>

        {manualSaveMsg && (
          <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 10 }}>✓ {manualSaveMsg}</div>
        )}

        {/* Saved manual entries */}
        {savedManualEntries.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Saved Codes ({savedManualEntries.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {savedManualEntries.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: '#0a1628', border: '1px solid #1e3a5f',
                    borderRadius: 8, padding: '10px 14px',
                  }}
                >
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 800, fontSize: 16,
                    color: '#60a5fa', letterSpacing: '0.1em', flex: 1,
                  }}>
                    {entry.hsn_code}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>{entry.timestamp}</span>
                  <button
                    onClick={() => setSavedManualEntries(prev => prev.filter(e => e.id !== entry.id))}
                    title="Remove"
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0 }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ContentGrid>
        <MainSection>
          <PanelTitle>Product Description</PanelTitle>
        
        <TextArea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Enter detailed product description (e.g., 'Electronic computer components for data processing')"
        />
        
        <LookupButton onClick={() => lookupHSCode()} disabled={loading} loading={loading}>
          {loading ? 'Processing...' : '🔍 Lookup HSN Code'}
        </LookupButton>

        <ResultSection>
          {result ? (
            <ResultContent>
              {renderResult()}
            </ResultContent>
          ) : (
            <EmptyResult>
              Enter a product description above and click Lookup HSN Code to see the best match and top alternatives.
            </EmptyResult>
          )}
        </ResultSection>
      </MainSection>
      
      <SideSection>
        <SampleProductsTitle>Sample Products</SampleProductsTitle>
        
        <InfoBox>
          <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing.sm }}>
            Try these sample products to test the HS code lookup:
          </div>
          
          {sampleProducts.map((product, index) => (
            <SampleProductButton
              key={index}
              onClick={() => handleSampleProduct(product)}
              disabled={loading}
            >
              Try: {product}
            </SampleProductButton>
          ))}
        </InfoBox>
        
        <InfoBox>
          <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary }}>
            <strong>Tips for better HS code classification:</strong>
            <ul style={{ marginTop: theme.spacing.xs, paddingLeft: theme.spacing.md }}>
              <li>Provide detailed product descriptions</li>
              <li>Include material composition</li>
              <li>Specify intended use or function</li>
              <li>Mention any special features</li>
            </ul>
          </div>
        </InfoBox>
      </SideSection>
      </ContentGrid>
    </PanelContainer>
  );
};

export default HSCodePanel;
