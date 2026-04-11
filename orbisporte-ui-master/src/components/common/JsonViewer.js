import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';

// Highlighting component
const HighlightedText = styled.span`
  background-color: ${theme.colors.status.warningLight};
  color: ${theme.colors.status.warning};
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: ${theme.typography.fontWeight.medium};
`;

const TableViewerContainer = styled.div`
  font-family: ${theme.typography.fontFamily.base};
  font-size: ${theme.typography.fontSize.sm};
  background: var(--t-bg-dark);
  border-radius: ${theme.radius.md}px;
  overflow: auto;
  max-height: 350px;
  position: relative;
  color: ${theme.colors.text.primary};
`;

const CopyButton = styled.button`
  position: absolute;
  top: ${theme.spacing.xs}px;
  right: ${theme.spacing.xs}px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--t-card);
  color: ${theme.colors.text.secondary};
  border: none;
  border-radius: ${theme.radius.sm}px;
  cursor: pointer;
  font-size: ${theme.typography.fontSize.xs};
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  
  &:hover {
    background: var(--t-hover);
    color: ${theme.colors.primary.main};
  }
`;

const ObjectRow = styled.div`
  border-bottom: 1px solid ${theme.colors.ui.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

const Property = styled.div`
  display: flex;
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  cursor: ${props => props.hasChildren ? 'pointer' : 'default'};
  position: relative;
  
  &:hover {
    background: ${props => props.hasChildren ? theme.colors.ui.hover : 'transparent'};
  }
  
  &:before {
    content: ${props => props.hasChildren ? (props.isOpen ? '"▼"' : '"►"') : '""'};
    display: ${props => props.hasChildren ? 'block' : 'none'};
    position: absolute;
    left: 4px;
    color: ${theme.colors.primary.main};
    font-size: 10px;
  }
`;

const PropertyName = styled.div`
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.secondary};
  width: 150px;
  padding-left: ${props => props.indent ? `${props.indent * 12 + 16}px` : '16px'};
  flex-shrink: 0;
  text-transform: capitalize;
`;

const PropertyValue = styled.div`
  color: ${props => {
    if (props.isNull) return '#9ca3af';
    if (props.isBoolean) return theme.colors.status.warning;
    if (props.isNumber) return theme.colors.primary.main;
    return theme.colors.status.success;
  }};
  word-break: break-word;
`;

const ChildrenContainer = styled.div`
  padding-left: ${props => props.indent ? `${props.indent * 4}px` : '0'};
`;

const EmptyObject = styled.div`
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  color: ${theme.colors.text.secondary};
  font-style: italic;
  padding-left: ${props => props.indent ? `${props.indent * 12 + 16}px` : '16px'};
`;

// Search highlighting function (case-insensitive, safe)
const highlightText = (text, searchTerm) => {
  if (!searchTerm || text === undefined || text === null) return text;

  const escaped = searchTerm.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const lowerSearch = searchTerm.toLowerCase();

  // Split text by the search term (case-insensitive)
  const parts = String(text).split(new RegExp(`(${escaped})`, 'i'));

  return parts.map((part, index) => (
    part.toLowerCase().includes(lowerSearch) ? (
      <HighlightedText key={index}>{part}</HighlightedText>
    ) : (
      part
    )
  ));
};

// Recursive search helpers to determine whether a node or any of its children match
const matchesSearch = (value, name, searchTerm) => {
  if (!searchTerm) return true;
  const search = searchTerm.toLowerCase();

  // Check property name
  if (name && String(name).toLowerCase().includes(search)) return true;

  const searchInValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return String(val).toLowerCase().includes(search);
    }
    if (Array.isArray(val)) {
      return val.some(item => searchInValue(item));
    }
    if (typeof val === 'object') {
      return Object.entries(val).some(([k, v]) => {
        if (String(k).toLowerCase().includes(search)) return true;
        return searchInValue(v);
      });
    }
    return false;
  };

  return searchInValue(value);
};

const hasDescendantMatch = (val, searchTerm) => {
  if (!searchTerm || val === null || val === undefined) return false;
  if (typeof val !== 'object') return false;
  if (Array.isArray(val)) return val.some(item => matchesSearch(item, null, searchTerm));
  return Object.values(val).some(v => matchesSearch(v, null, searchTerm));
};

// Component to display a single property
const PropertyRow = ({ name, value, depth = 0, defaultOpen = false, searchTerm = '' }) => {
  // Determine if this branch has a match (used for conditional rendering)
  const branchMatches = matchesSearch(value, name, searchTerm);

  // Hooks must always be called in the same order — declare them before any early returns
  const [isOpen, setIsOpen] = useState(() => {
    return defaultOpen || (searchTerm && hasDescendantMatch(value, searchTerm));
  });

  // Auto-expand parents when search term changes and descendants match
  useEffect(() => {
    if (searchTerm && hasDescendantMatch(value, searchTerm)) {
      setIsOpen(true);
    }
    if (!searchTerm) {
      setIsOpen(defaultOpen);
    }
  }, [searchTerm, defaultOpen, value]);

  // If there's a search term and this branch doesn't match, don't render it
  if (searchTerm && !branchMatches) return null;
  
  // Check value type
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const isEmpty = isObject && Object.keys(value).length === 0;
  
  const formattedName = isArray ? `${name} (${value.length} items)` : name;
  
  // Format primitive values
  const getFormattedValue = () => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    if (isObject) return isArray ? '[Array]' : '{Object}';
    return String(value);
  };
  
  const toggleOpen = () => {
    if (isObject && !isEmpty) {
      setIsOpen(!isOpen);
    }
  };
  
  // Render property and its children if expanded
  return (
    <ObjectRow>
      <Property 
        onClick={toggleOpen} 
        hasChildren={isObject && !isEmpty} 
        isOpen={isOpen}
      >
        <PropertyName indent={depth}>{highlightText(formattedName, searchTerm)}</PropertyName>
        {(!isObject || isEmpty) && (
          <PropertyValue 
            isNull={value === null} 
            isBoolean={typeof value === 'boolean'} 
            isNumber={typeof value === 'number'}
          >
            {highlightText(getFormattedValue(), searchTerm)}
          </PropertyValue>
        )}
      </Property>
      
      {isObject && !isEmpty && isOpen && (
        <ChildrenContainer indent={depth}>
          {isArray ? (
            value.map((item, index) => (
              <PropertyRow 
                key={index}
                name={`Item ${index + 1}`}
                value={item}
                depth={depth + 1}
                searchTerm={searchTerm}
              />
            ))
          ) : (
            Object.entries(value).map(([key, val]) => (
              <PropertyRow 
                key={key}
                name={key.replace(/_/g, ' ')}
                value={val}
                depth={depth + 1}
                searchTerm={searchTerm}
              />
            ))
          )}
        </ChildrenContainer>
      )}
      
      {isObject && isEmpty && isOpen && (
        <EmptyObject>{isArray ? '(empty array)' : '(empty object)'}</EmptyObject>
      )}
    </ObjectRow>
  );
};


// Update the JsonViewer component
const JsonViewer = ({ data, searchTerm = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (!data) return null;

  return (
    <TableViewerContainer>
      <CopyButton onClick={handleCopy} title="Copy full data to clipboard">
        {copied ? '✓' : '📋'}
      </CopyButton>
      
      {Object.entries(data).map(([key, value]) => (
        <PropertyRow 
          key={key} 
          name={key.replace(/_/g, ' ')} 
          value={value}
          defaultOpen={key === 'items'} 
          searchTerm={searchTerm}
        />
      ))}
    </TableViewerContainer>
  );
};

export default JsonViewer;
