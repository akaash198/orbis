/**
 * Shipment Tracking Panel Component
 *
 * Real-time shipment tracking and logistics management.
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

const SubItemBadge = styled.div`
  display: inline-block;
  background: ${theme.colors.primary.gradient};
  color: ${theme.colors.primary.contrast};
  padding: ${theme.spacing.xs}px ${theme.spacing.md}px;
  border-radius: ${theme.radius.full}px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  margin-left: ${theme.spacing.md}px;
  margin-top: ${theme.spacing.sm}px;
`;

const ShipmentTrackingPanel = ({ activeSubItem = 'shipment-tracking' }) => {
  const subItemNames = {
    'shipment-tracking': 'Shipment Tracking',
    'shipment-cargo': 'Cargo Information (Air / Sea / Land)',
    'shipment-flight': 'Flight Status & AWB (Tracking Number)',
    'shipment-container': 'Container Voyage Tracking',
    'shipment-truck': 'Truck & Rail Updates',
    'shipment-map': 'Live Tracking Map',
  };
  return (
    <PanelContainer>
      <PanelHeader>
        <h1>
          📦 Shipment Tracking
          {activeSubItem !== 'shipment-tracking' && (
            <SubItemBadge>{subItemNames[activeSubItem]}</SubItemBadge>
          )}
        </h1>
        <p>Real-time tracking and monitoring of shipments across carriers.</p>
      </PanelHeader>

      <ComingSoonBadge>Coming Soon</ComingSoonBadge>

      <Card>
        <h3 style={{ color: theme.colors.text.primary, marginBottom: theme.spacing.md + 'px' }}>
          Features
        </h3>
        <ul style={{ color: theme.colors.text.secondary, lineHeight: 1.8 }}>
          <li>Multi-carrier Shipment Tracking</li>
          <li>Real-time Location Updates</li>
          <li>Estimated Delivery Dates</li>
          <li>Customs Clearance Status</li>
          <li>Exception & Delay Alerts</li>
          <li>Shipment History & Analytics</li>
        </ul>
      </Card>
    </PanelContainer>
  );
};

export default ShipmentTrackingPanel;
