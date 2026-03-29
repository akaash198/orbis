/**
 * Collapsible Component
 * 
 * A reusable collapsible/accordion component that can show/hide content.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';

const CollapsibleWrapper = styled.div`
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  margin-top: ${theme.spacing.sm}px;
  overflow: hidden;
`;

const CollapsibleHeader = styled.div`
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: ${theme.colors.ui.sidebar};
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color ${theme.transitions.fast};

  &:hover {
    background-color: ${theme.colors.ui.hover};
  }
`;

const Title = styled.div`
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.text.primary};
`;

const ToggleText = styled.div`
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.text.secondary};
`;

const CollapsibleContent = styled.div`
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  border-top: ${props => props.isOpen ? `1px solid ${theme.colors.ui.border}` : 'none'};
  display: ${props => props.isOpen ? 'block' : 'none'};
`;

const Collapsible = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <CollapsibleWrapper>
      <CollapsibleHeader onClick={() => setOpen(!open)}>
        <Title>{title}</Title>
        <ToggleText>{open ? 'Hide' : 'Show'}</ToggleText>
      </CollapsibleHeader>
      <CollapsibleContent isOpen={open}>
        {children}
      </CollapsibleContent>
    </CollapsibleWrapper>
  );
};

export default Collapsible;
