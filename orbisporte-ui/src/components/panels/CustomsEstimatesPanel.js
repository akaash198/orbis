/**
 * Customs Estimates Panel Component
 *
 * Advanced customs duty and tax estimation system.
 */

import React from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';

const PanelContainer = styled.div`
  padding: ${theme.spacing.xl}px;
  max-width: 1400px;
  margin: 0 auto;
  height: 100vh;
  overflow-y: auto;
`;

const PanelHeader = styled.div`
  margin-bottom: ${theme.spacing.xl}px;

  h1 {
    font-size: ${theme.typography.fontSize.xxl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    margin: 0 0 ${theme.spacing.sm}px 0;
  }

  p {
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.fontSize.lg};
    margin: 0;
  }
`;

const Card = styled.div`
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.xl}px;
  box-shadow: ${theme.shadows.sm};
`;

const ComingSoonBadge = styled.div`
  display: inline-block;
  background: ${theme.colors.primary.gradient};
  color: ${theme.colors.primary.contrast};
  padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
  border-radius: ${theme.radius.full}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  margin-bottom: ${theme.spacing.xl}px;
`;

const CustomsEstimatesPanel = () => {
  return (
    <PanelContainer>
      <PanelHeader>
        <h1>📊 Customs Estimates</h1>
        <p>Accurate customs duty, tax, and fee estimation for import/export.</p>
      </PanelHeader>

      <ComingSoonBadge>Coming Soon</ComingSoonBadge>

      <Card>
        <h3 style={{ color: theme.colors.text.primary, marginBottom: theme.spacing.md + 'px' }}>
          Features
        </h3>
        <ul style={{ color: theme.colors.text.secondary, lineHeight: 1.8 }}>
          <li>Multi-country Duty Estimation</li>
          <li>VAT/GST Calculation</li>
          <li>Anti-dumping Duty Assessment</li>
          <li>FTA Benefit Analysis</li>
          <li>Total Landed Cost Calculation</li>
          <li>What-if Scenario Planning</li>
        </ul>
      </Card>
    </PanelContainer>
  );
};

export default CustomsEstimatesPanel;
