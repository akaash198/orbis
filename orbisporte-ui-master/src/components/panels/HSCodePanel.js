/**
 * HSCodePanel Component
 * 
 * Panel for looking up HS codes for products.
 * Uses PostgreSQL FTS + OpenAI embeddings + GPT-4o-mini for classification.
 */

import React, { useState } from 'react';
import { hsCodeService } from '../../services/api';

const HSCodePanel = ({ extractedDocuments = [], onClearAll, onPageChange, onNavigate, initialHsnCode, initialDescription, navigationKey, initialDocumentId }) => {
  const [text, setText] = useState(initialDescription || '');
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
  
  // State for handling initial HSN from navigation
  const [pendingHsnCode, setPendingHsnCode] = useState(initialHsnCode || '');
  const [pendingDescription, setPendingDescription] = useState(initialDescription || '');
  const [editHsnCode, setEditHsnCode] = useState(initialHsnCode || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [autoSearched, setAutoSearched] = useState(false);
  const [currentDocumentId, setCurrentDocumentId] = useState(initialDocumentId || null);
  const [useDetailedMode, setUseDetailedMode] = useState(false);
  
  // HSN Code Registry (persisted to localStorage)
  const [hsnRegistry, setHsnRegistry] = useState(() => {
    try {
      const saved = localStorage.getItem('hsn_code_registry');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Check if there's a pending HSN code to display
  const hasPendingHsn = pendingHsnCode && pendingHsnCode.trim() !== '';

  // Update pending HSN and document context when initial props change
  // (triggered each time the user navigates here from Document Manager / Data Intake)
  React.useEffect(() => {
    // Always sync the document ID from navigation so Save to Registry carries it forward
    setCurrentDocumentId(initialDocumentId || null);

    // Reset transient UI states
    setAutoSearched(false);
    setResult(null);
    setSaveMessage('');
    setIsEditing(false);

    if (initialHsnCode && initialHsnCode.trim()) {
      // HSN already provided from document — display without re-searching
      setPendingHsnCode(initialHsnCode.trim());
      setEditHsnCode(initialHsnCode.trim());
      setPendingDescription(initialDescription || '');
      if (initialDescription && initialDescription.trim()) {
        setText(initialDescription.trim());
      }
      setResult({
        selected_hsn: initialHsnCode.trim(),
        selected_confidence: 1.0,
        top3_predictions: [{ hsn_code: initialHsnCode.trim(), description: initialDescription || 'From document', confidence: 1.0 }],
        routing: 'from_document',
        pipeline_duration_ms: 0,
      });
      setAutoSearched(true);
    } else if (initialDescription && initialDescription.trim()) {
      // Only description provided — auto-search for the HSN
      setText(initialDescription.trim());
      performSearch(initialDescription.trim());
    } else {
      setText('');
    }
  }, [initialHsnCode, initialDescription, navigationKey, initialDocumentId]);

  // Perform the search using the backend API
  const performSearch = async (searchText) => {
    if (!searchText || !searchText.trim()) return;
    
    setLoading(true);
    setSearchedProduct(searchText.trim());
    
    try {
      // Use fast mode by default (<100ms), detailed mode for GPT reasoning
      const response = useDetailedMode 
        ? await hsCodeService.lookupHSCodeDetailed(searchText.trim())
        : await hsCodeService.lookupHSCode(searchText.trim());
      setResult(response);
      
      // If we found an HSN, set it as pending
      if (response.selected_hsn) {
        setPendingHsnCode(response.selected_hsn);
        setEditHsnCode(response.selected_hsn);
        setPendingDescription(searchText.trim());
      }
    } catch (err) {
      console.error('HS code lookup error:', err);
      setResult({
        selected_hsn: null,
        top3_predictions: [],
        error: err.message || 'Search failed'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle save to registry
  const handleSaveToRegistry = () => {
    const code = editHsnCode.trim();
    if (!code) return;
    
    const newEntry = {
      id: Date.now(),
      hsn_code: code,
      description: pendingDescription || searchedProduct || text || '',
      source: currentDocumentId ? 'document' : 'manual',
      document_id: currentDocumentId,
      created_at: new Date().toISOString(),
    };
    
    setHsnRegistry(prev => {
      // Check if already exists
      const exists = prev.some(e => e.hsn_code === code);
      if (exists) {
        setSaveMessage('✓ HSN Code already in registry!');
        setTimeout(() => setSaveMessage(''), 3000);
        return prev;
      }
      return [newEntry, ...prev];
    });
    
    setSaveMessage('✓ HSN Code saved to registry!');
    setTimeout(() => setSaveMessage(''), 3000);
    
    // Navigate to Duty Calculator with the saved HSN code
    if (onNavigate) {
      onNavigate('duty-calculator', { hsnCode: code, goodsDesc: pendingDescription || searchedProduct || text, documentId: currentDocumentId });
    }
  };

  // Handle edit
  const handleEdit = () => {
    setEditHsnCode(pendingHsnCode);
    setIsEditing(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditHsnCode(pendingHsnCode);
    setIsEditing(false);
  };

  // Handle update code after edit
  const handleUpdateCode = () => {
    setPendingHsnCode(editHsnCode.trim());
    setIsEditing(false);
  };

  // Persist registry to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('hsn_code_registry', JSON.stringify(hsnRegistry));
    } catch (e) {
      console.warn('Failed to save HSN registry:', e);
    }
  }, [hsnRegistry]);

  // Add entry to HSN registry
  const addToRegistry = (entry) => {
    const newEntry = {
      id: Date.now(),
      hsn_code: entry.hsn_code,
      description: entry.description || '',
      source: entry.source || 'manual',
      document_id: entry.document_id || null,
      created_at: new Date().toISOString(),
    };
    setHsnRegistry(prev => {
      const exists = prev.some(e => e.hsn_code === entry.hsn_code);
      if (exists) return prev;
      return [newEntry, ...prev];
    });
  };

  // Remove entry from registry
  const removeFromRegistry = (id) => {
    setHsnRegistry(prev => prev.filter(e => e.id !== id));
  };

  // Clear entire registry
  const clearRegistry = () => {
    if (window.confirm('Clear all HSN codes from registry?')) {
      setHsnRegistry([]);
    }
  };

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
    setSearchedProduct(searchText.trim());
    
    try {
      const response = useDetailedMode 
        ? await hsCodeService.lookupHSCodeDetailed(searchText.trim())
        : await hsCodeService.lookupHSCode(searchText.trim());
      setResult(response);
      
      // If we found an HSN, set it as pending
      if (response.selected_hsn) {
        setPendingHsnCode(response.selected_hsn);
        setEditHsnCode(response.selected_hsn);
        setPendingDescription(searchText.trim());
      }
    } catch (err) {
      console.error('HS code lookup error:', err);
      setResult({
        selected_hsn: null,
        top3_predictions: [],
        error: err.message || 'Search failed'
      });
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
    addToRegistry({ hsn_code: code, description: '' });
    setManualHsnCode('');
    setManualSaveMsg('Saved!');
    setTimeout(() => setManualSaveMsg(''), 3000);
    
    // Navigate to Duty Calculator with the saved HSN code
    if (onNavigate) {
      onNavigate('duty-calculator', { hsnCode: code });
    }
  };

  // Group items by document and description to show quantity
  const groupedItems = React.useMemo(() => {
    const groups = [];
    const groupMap = new Map();

    extractedDocuments.forEach((doc) => {
      doc.items.forEach((item, itemIndex) => {
        const description = (item.product_description || item.description || item.name || 'N/A').trim();
        const documentName = item.documentName || doc.name || 'Unknown';

        const groupKey = `${documentName}|||${description}`;

        if (groupMap.has(groupKey)) {
          const existingGroup = groupMap.get(groupKey);
          existingGroup.quantity += 1;
          existingGroup.itemIndices.push(existingGroup.allItemsCount);
          existingGroup.allItemsCount += 1;
        } else {
          const newGroup = {
            groupKey,
            documentName,
            description,
            quantity: 1,
            itemIndices: [groups.reduce((sum, g) => sum + g.quantity, 0)],
            allItemsCount: groups.reduce((sum, g) => sum + g.quantity, 0) + 1,
            originalItem: item
          };
          groupMap.set(groupKey, newGroup);
          groups.push(newGroup);
        }
      });
    });

    return groups;
  }, [extractedDocuments]);

  // Auto-select all items when new documents are added
  React.useEffect(() => {
    if (groupedItems && groupedItems.length > 0) {
      const allIndices = groupedItems.map((_, idx) => idx);
      setSelectedItems(new Set(allIndices));
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
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(groupedItems.map((_, idx) => idx)));
    }
  };

  // Lookup selected grouped items
  const lookupSelected = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to lookup');
      return;
    }

    for (const groupIndex of selectedItems) {
      const group = groupedItems[groupIndex];
      const description = group.description;

      const hasResult = group.itemIndices.some(idx => {
        const res = itemResults[idx];
        return res && res.hs_code && res.hs_code !== '0000.00.00';
      });

      if (description && !hasResult) {
        await lookupGroupHSCode(groupIndex, description, group.itemIndices);
      }
    }
  };

  // Lookup HSN code for a grouped item
  const lookupGroupHSCode = async (groupIndex, productDescription, itemIndices) => {
    if (!productDescription || !productDescription.trim()) return;

    setLookingUpItems(prev => new Set(prev).add(groupIndex));

    try {
      const response = await hsCodeService.lookupHSCode(productDescription);
      setItemResults(prev => {
        const newResults = { ...prev };
        itemIndices.forEach(itemIndex => {
          newResults[itemIndex] = response;
        });
        return newResults;
      });
    } catch (err) {
      console.error(`HS code lookup error for group ${groupIndex}:`, err);
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
    const isFromDoc    = routing === 'from_document';
    const confPct      = n => `${Math.round((n || 0) * 100)}%`;
    const confColor    = c => c >= 0.92 ? '#22c55e' : c >= 0.70 ? '#f59e0b' : '#ef4444';

    if (result.error) {
      return (
        <div style={{ 
          background: 'rgba(240,112,112,0.08)', 
          border: '1px solid rgba(240,112,112,0.2)', 
          borderRadius: 8, 
          padding: 16, 
          color: '#F07070',
          marginBottom: 16 
        }}>
          <strong>Error:</strong> {result.error}
        </div>
      );
    }

    if (!selectedHsn && top3.length === 0) {
      return (
        <div style={{ 
          background: 'rgba(201,165,32,0.08)', 
          border: '1px solid rgba(201,165,32,0.2)', 
          borderRadius: 8, 
          padding: 16, 
          color: '#E8C84A',
          marginBottom: 16 
        }}>
          <strong>No HSN code found</strong>
          <div style={{ marginTop: 8, fontSize: 12, color: '#8B97AE' }}>
            Try a more specific product description or include material composition and intended use.
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Header row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <div style={{ background: '#161D2C', borderRadius: 8, padding: '8px 14px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: '#8B97AE', marginBottom: 2 }}>HSN CODE</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#E8C84A', letterSpacing: 1 }}>
              {selectedHsn || '—'}
            </div>
          </div>
          <div style={{ background: '#161D2C', borderRadius: 8, padding: '8px 14px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: '#8B97AE', marginBottom: 2 }}>CONFIDENCE</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: confColor(confidence) }}>
              {confPct(confidence)}
            </div>
          </div>
          <div style={{ background: '#161D2C', borderRadius: 8, padding: '8px 14px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: '#8B97AE', marginBottom: 2 }}>ROUTING</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: isFromDoc ? '#22c55e' : isAuto ? '#22c55e' : '#f59e0b' }}>
              {isFromDoc ? 'From Document' : isAuto ? 'Auto-Classified' : 'Human Review'}
            </div>
          </div>
          <div style={{ background: '#161D2C', borderRadius: 8, padding: '8px 14px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: '#8B97AE', marginBottom: 2 }}>PIPELINE</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>
              {result.pipeline_duration_ms || '—'}ms
              {result.candidates_retrieved ? ` · ${result.candidates_retrieved} candidates` : ''}
            </div>
          </div>
        </div>

        {/* Save to Registry Button */}
        {selectedHsn && (
          <div style={{ 
            background: 'rgba(61,190,126,0.1)', 
            border: '1px solid rgba(61,190,126,0.3)', 
            borderRadius: 8, 
            padding: '12px 16px', 
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#3DBE7E', marginBottom: 2 }}>
                💾 Ready to Save
              </div>
              <div style={{ fontSize: 11, color: '#8B97AE' }}>
                Save this HSN code to your registry for future use
              </div>
            </div>
            <button
              onClick={() => {
                setPendingHsnCode(selectedHsn);
                setEditHsnCode(selectedHsn);
                setPendingDescription(searchedProduct || text);
                setIsEditing(false);
                handleSaveToRegistry();
              }}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #3DBE7E, #2a9d5c)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              💾 Save to Registry
            </button>
          </div>
        )}

        {/* Alerts */}
        {result.scomet_flag && (
          <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#fca5a5' }}>
            <strong>SCOMET CONTROLLED:</strong> May require DGFT export licence.
          </div>
        )}
        {result.trade_remedy_alert && (
          <div style={{ background: '#431407', border: '1px solid #9a3412', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#fed7aa' }}>
            <strong>TRADE REMEDY ALERT:</strong> Anti-dumping / safeguard duties may apply.
          </div>
        )}

        {/* Top-3 predictions */}
        {top3.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8B97AE', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 4 }}>
              Top-3 Predictions
            </div>
            {top3.map((pred, i) => {
              const c = pred.confidence || 0;
              const bc = confColor(c);
              return (
                <div key={i} style={{
                  background: i === 0 ? '#1C2438' : '#161D2C',
                  border: `1px solid ${i === 0 ? 'rgba(201,165,32,0.3)' : '#273047'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 8,
                }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8B97AE' }}>#{i + 1}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#E8C84A', letterSpacing: 1 }}>
                      {pred.hsn_code}
                    </span>
                    <span style={{ background: bc + '20', color: bc, border: `1px solid ${bc}`, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                      {confPct(c)}
                    </span>
                    {pred.gri_rule && (
                      <span style={{ fontSize: 10, color: '#8B97AE', background: '#0D1020', padding: '1px 6px', borderRadius: 3 }}>
                        {pred.gri_rule}
                      </span>
                    )}
                    {i > 0 && (
                      <button
                        onClick={() => {
                          setPendingHsnCode(pred.hsn_code);
                          setEditHsnCode(pred.hsn_code);
                          setPendingDescription(searchedProduct || text);
                          setIsEditing(false);
                          handleSaveToRegistry();
                        }}
                        style={{
                          marginLeft: 'auto',
                          padding: '4px 10px',
                          background: 'rgba(61,190,126,0.1)',
                          color: '#3DBE7E',
                          border: '1px solid rgba(61,190,126,0.3)',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        💾 Save
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#8B97AE', lineHeight: 1.5 }}>{pred.reasoning}</div>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };
  
  return (
    <div style={{ 
      padding: 32, 
      minHeight: '100vh', 
      background: '#0D1020',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: 32, 
          fontWeight: 700, 
          color: '#E2E8F5',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ fontSize: 36 }}>🔍</span>
          HSN Classification Engine
        </h1>
        {onPageChange && (
          <button
            onClick={() => onPageChange('document')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid #273047',
              borderRadius: 6, padding: '6px 12px', fontSize: 13,
              color: '#8B97AE', cursor: 'pointer',
            }}
          >
            ← Document Management
          </button>
        )}
      </div>

      {/* Display grouped items from all documents */}
      {groupedItems && groupedItems.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(201,165,32,0.08) 0%, #161D2C 100%)',
            border: '2px solid #C9A520',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#C9A520' }}>
                📋 Extracted Items ({groupedItems.reduce((sum, g) => sum + g.quantity, 0)} items)
              </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={lookupSelected}
                disabled={selectedItems.size === 0}
                style={{
                  padding: '8px 16px',
                  background: selectedItems.size > 0 ? '#C9A520' : '#273047',
                  color: selectedItems.size > 0 ? '#0A0D14' : '#4A5A72',
                  border: 'none',
                  borderRadius: 6,
                  cursor: selectedItems.size > 0 ? 'pointer' : 'not-allowed',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                🔍 Lookup Selected ({selectedItems.size})
              </button>
              <button
                onClick={() => {
                  setItemResults({});
                }}
                style={{
                  padding: '8px 16px',
                  background: '#E8934A',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                🔄 Clear Cache
              </button>
              {onClearAll && (
                <button
                  onClick={onClearAll}
                  style={{
                    padding: '8px 16px',
                    background: '#E05656',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #C9A520, #A88A18)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                  <input type="checkbox" checked={selectedItems.size === groupedItems.length} onChange={toggleSelectAll} />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'white' }}>#</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'white' }}>Document</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'white' }}>Qty</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'white' }}>Product Description</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'white' }}>HSN/HS Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'white' }}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {groupedItems.map((group, groupIndex) => {
                const hsnResult = itemResults[group.itemIndices[0]];
                const isLooking = lookingUpItems.has(groupIndex);
                const isSelected = selectedItems.has(groupIndex);

                return (
                  <tr key={groupIndex} style={{ background: isSelected ? 'rgba(201, 165, 32, 0.1)' : 'transparent', borderBottom: '1px solid #273047' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleItemSelection(groupIndex)} />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{groupIndex + 1}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#8B97AE' }}>{group.documentName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        fontWeight: 700,
                        color: group.quantity > 1 ? '#C9A520' : '#8B97AE',
                        background: group.quantity > 1 ? 'rgba(201,165,32,0.1)' : 'transparent',
                        padding: '4px 8px',
                        borderRadius: 4,
                      }}>
                        {group.quantity}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{group.description}</td>
                    <td style={{ padding: '12px 16px' }}>
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
                          <button onClick={() => saveRowOverride(groupIndex)} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                          <button onClick={() => { setOverrideRowIdx(null); setOverrideInput(''); }} style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 4, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : isLooking ? (
                        <span>🔄 Looking up...</span>
                      ) : (hsnResult?.selected_hsn || hsnResult?.hs_code) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ 
                            display: 'inline-block', padding: '4px 10px',
                            background: 'linear-gradient(135deg, #3DBE7E, #2a9d5c)',
                            color: 'white', borderRadius: 4, fontWeight: 700, fontSize: 13,
                          }}>
                            {hsnResult.selected_hsn || hsnResult.hs_code}
                          </span>
                          {hsnResult?.source === 'manual' && <span style={{ fontSize: 10, color: '#a5b4fc' }}>manual</span>}
                          <button onClick={() => { setOverrideRowIdx(groupIndex); setOverrideInput(hsnResult.selected_hsn || hsnResult.hs_code || ''); }} title="Override" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                        </div>
                      ) : hsnResult?.error ? (
                        <span style={{ color: '#F07070' }}>Error</span>
                      ) : (
                        <span style={{ color: '#4A5A72' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {(hsnResult?.selected_confidence || hsnResult?.confidence)
                        ? `${Math.round((hsnResult.selected_confidence || hsnResult.confidence) * 100)}%`
                        : hsnResult?.source === 'manual' ? 'Manual' : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* HSN Code Result Banner - Shown when we have a result from search or document */}
      {hasPendingHsn && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(61,190,126,0.15) 0%, rgba(61,190,126,0.05) 100%)',
          border: '2px solid rgba(61,190,126,0.5)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 10,
                background: 'linear-gradient(135deg, #3DBE7E, #2a9d5c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24
              }}>
                🏷️
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#3DBE7E' }}>
                  {initialHsnCode ? 'HSN Code from Document' : 'HSN Code Found'}
                </div>
                <div style={{ fontSize: 12, color: '#8B97AE', marginTop: 2 }}>
                  {result?.selected_confidence ? `Confidence: ${Math.round(result.selected_confidence * 100)}%` : 'Review, edit if needed, and save to registry'}
                </div>
              </div>
            </div>
            {saveMessage && (
              <div style={{ 
                padding: '8px 16px', background: 'rgba(61,190,126,0.2)', 
                borderRadius: 6, color: '#3DBE7E', fontWeight: 600, fontSize: 13 
              }}>
                {saveMessage}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                HSN Code
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editHsnCode}
                  onChange={(e) => setEditHsnCode(e.target.value)}
                  maxLength={10}
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#0a1628', border: '2px solid #3DBE7E',
                    borderRadius: 6, color: '#3DBE7E',
                    padding: '10px 14px', fontSize: 18,
                    fontFamily: 'monospace', fontWeight: 700,
                    letterSpacing: '0.1em', outline: 'none',
                  }}
                />
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: '#0a1628', border: '1px solid rgba(61,190,126,0.3)',
                  borderRadius: 6, padding: '10px 14px',
                }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 800, fontSize: 20,
                    color: '#3DBE7E', letterSpacing: '0.1em',
                  }}>
                    {pendingHsnCode}
                  </span>
                </div>
              )}
            </div>
            
            {pendingDescription && (
              <div style={{ flex: '2 1 400px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Product Description
                </div>
                <div style={{
                  background: '#0a1628', border: '1px solid rgba(61,190,126,0.3)',
                  borderRadius: 6, padding: '10px 14px',
                  color: '#E2E8F5', fontSize: 13,
                }}>
                  {pendingDescription}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            {isEditing ? (
              <>
                <button
                  onClick={handleUpdateCode}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #3DBE7E, #2a9d5c)',
                    color: 'white', border: 'none', borderRadius: 6,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ✓ Update Code
                </button>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    color: '#8B97AE', border: '1px solid #1e3a5f', borderRadius: 6,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveToRegistry}
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #3DBE7E, #2a9d5c)',
                    color: 'white', border: 'none', borderRadius: 6,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  💾 Save to Registry
                </button>
                <button
                  onClick={handleEdit}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    color: '#E8C84A', border: '1px solid rgba(201,165,32,0.4)', borderRadius: 6,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  ✏️ Edit Code
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual HSN Entry */}
      <div style={{
        background: '#0c1222', border: '1px solid #1e3a5f',
        borderRadius: 12, padding: 24, marginBottom: 24,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#E8C84A', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#E2E8F5', marginBottom: 16 }}>Product Description</h2>
          
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter detailed product description (e.g., 'Electronic computer components for data processing')"
            style={{
              width: '100%', minHeight: 120, padding: 16,
              border: '1px solid #273047', borderRadius: 8,
              background: '#0D1020', color: '#E2E8F5',
              fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          
          <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => lookupHSCode()}
              disabled={loading || !text.trim()}
              style={{
                flex: 1, padding: '12px 20px',
                background: loading || !text.trim() ? '#273047' : '#C9A520',
                color: loading || !text.trim() ? '#4A5A72' : '#0A0D14',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '⚡ Processing...' : '⚡ ' + (useDetailedMode ? 'Detailed Search' : 'Fast Search')}
            </button>
            
            <button
              onClick={() => setUseDetailedMode(!useDetailedMode)}
              style={{
                padding: '10px 16px',
                background: useDetailedMode ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)',
                color: useDetailedMode ? '#a78bfa' : '#8B97AE',
                border: useDetailedMode ? '1px solid rgba(139,92,246,0.5)' : '1px solid #273047',
                borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
              title={useDetailedMode ? 'Using GPT-4o-mini for detailed reasoning (slower)' : 'Using PostgreSQL FTS (fast, <100ms)'}
            >
              {useDetailedMode ? '🧠 Detailed Mode' : '🚀 Fast Mode'}
            </button>
          </div>

          <div style={{
            marginTop: 12, fontSize: 11, color: '#4A5A72',
          }}>
            {useDetailedMode 
              ? '🧠 GPT-4o-mini reasoning — More accurate but takes 2-5 seconds'
              : '🚀 PostgreSQL FTS — Instant results (<100ms)'}
          </div>

          <div style={{
            marginTop: 24, border: '1px solid #273047', borderRadius: 8,
            background: '#161D2C', padding: 16, minHeight: 200,
          }}>
            {result ? (
              renderResult()
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#4A5A72' }}>
                Enter a product description above and click Lookup HSN Code to see results.
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F5', marginBottom: 12 }}>Sample Products</h3>
          
          <div style={{
            background: '#161D2C', border: '1px solid #273047',
            borderRadius: 10, padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, color: '#8B97AE', marginBottom: 12 }}>
              Try these sample products:
            </div>
            {sampleProducts.map((product, index) => (
              <button
                key={index}
                onClick={() => handleSampleProduct(product)}
                disabled={loading}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px',
                  background: '#0D1020', color: '#E2E8F5',
                  border: '1px solid #273047', borderRadius: 6,
                  cursor: 'pointer', marginBottom: 6, fontSize: 13,
                  transition: 'all 0.15s',
                }}
              >
                Try: {product}
              </button>
            ))}
          </div>

          {/* HSN Code Registry */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#E8C84A' }}>
                🗂️ HSN Code Registry
              </div>
              {hsnRegistry.length > 0 && (
                <button
                  onClick={clearRegistry}
                  style={{
                    fontSize: 10, color: '#ef4444', background: 'transparent',
                    border: '1px solid #ef444440', borderRadius: 4, padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
              {hsnRegistry.length} code{hsnRegistry.length !== 1 ? 's' : ''} selected
            </div>
            
            {hsnRegistry.length === 0 ? (
              <div style={{
                padding: 32, background: '#0a1628', border: '1px solid #1e3a5f',
                borderRadius: 8, textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  No HSN codes selected yet.<br/>
                  Use "Use this HSN Code" from documents<br/>to populate this registry.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {hsnRegistry.map(entry => (
                  <div
                    key={entry.id}
                    style={{
                      background: '#0a1628', border: '1px solid #1e3a5f',
                      borderRadius: 8, padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontFamily: 'monospace', fontWeight: 800, fontSize: 16,
                          color: '#E8C84A', letterSpacing: '0.08em', marginBottom: 4,
                        }}>
                          {entry.hsn_code}
                        </div>
                        {entry.description && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, lineHeight: 1.4 }}>
                            {entry.description.length > 60 ? entry.description.slice(0, 60) + '...' : entry.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#475569' }}>
                          <span style={{
                            background: entry.source === 'document' ? '#166534' : '#1d4ed8',
                            color: entry.source === 'document' ? '#4ade80' : '#93c5fd',
                            padding: '2px 6px', borderRadius: 3,
                          }}>
                            {entry.source}
                          </span>
                          <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromRegistry(entry.id)}
                        title="Remove from registry"
                        style={{
                          background: 'transparent', border: 'none', color: '#ef4444',
                          cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1,
                        }}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HSCodePanel;
