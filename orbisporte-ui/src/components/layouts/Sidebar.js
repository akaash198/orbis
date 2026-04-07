/**
 * Sidebar Component
 *
 * Navigation sidebar for the application.
 * VERSION 5.0 - Added dropdown support for menu items
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';

console.log('[Sidebar] VERSION 5.0 - Dropdown support added');

const SidebarWrapper = styled.div`
  width: ${props => props.$collapsed ? '72px' : '280px'};
  transition: all ${theme.transitions.normal} cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 1px solid rgba(201, 165, 32, 0.25);
  height: 100%;
  background: ${theme.colors.ui.sidebar};
  backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.sidebar};
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 70px;
  bottom: 0;
  z-index: ${theme.zIndex.sidebar};
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(ellipse at 10% 15%, rgba(201, 165, 32, 0.18) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 40%, rgba(6, 182, 212, 0.14) 0%, transparent 40%),
      radial-gradient(ellipse at 30% 75%, rgba(139, 92, 246, 0.12) 0%, transparent 45%),
      radial-gradient(ellipse at 90% 90%, rgba(16, 185, 129, 0.10) 0%, transparent 40%);
    z-index: 0;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(201, 165, 32, 0.6), rgba(6, 182, 212, 0.6), rgba(139, 92, 246, 0.4), transparent);
    z-index: 1;
    pointer-events: none;
  }
`;

const SidebarHeader = styled.div`
  padding: ${theme.spacing.lg}px;
  font-weight: ${theme.typography.fontWeight.bold};
  color: ${theme.colors.text.sidebarPrimary};
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 200px;

  .logo {
    font-size: ${theme.typography.fontSize['3xl']};
    filter: drop-shadow(0 4px 12px rgba(201, 165, 32, 0.5));
    margin-bottom: ${theme.spacing.sm}px;
  }

  .title {
    font-size: ${theme.typography.fontSize.md};
    letter-spacing: 0.05em;
    font-weight: ${theme.typography.fontWeight.extrabold};
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    line-height: 1.2;
  }
`;

const FloatingGlobe = styled.div`
  font-size: 48px;
  filter: drop-shadow(0 0 20px rgba(201, 165, 32, 0.6));
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
`;

const SidebarContent = styled.div`
  flex: 1;
  padding: ${theme.spacing.sm}px 0;
  padding-bottom: ${theme.spacing.md}px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 2;

  /* Custom scrollbar for sidebar */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin: ${theme.spacing.md}px 0;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);

    &:hover {
      background: rgba(255, 255, 255, 0.4);
    }
  }
`;

const MenuSection = styled.div`
  margin-bottom: 0;
`;

const MenuItem = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  padding: 12px 16px;
  margin: 4px 16px;
  background: ${props => props.$active ? theme.colors.ui.sidebarActive : 'transparent'};
  color: ${props => props.$active ? theme.colors.text.sidebarPrimary : theme.colors.text.sidebarSecondary};
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${props => props.$active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all ${theme.transitions.normal};
  position: relative;
  z-index: 1;
  box-shadow: ${props => props.$active ? theme.shadows.glowBlue : 'none'};

  .icon {
    font-size: 20px;
    min-width: 24px;
    text-align: center;
    transition: transform ${theme.transitions.normal};
  }

  .label {
    opacity: ${props => props.$collapsed ? 0 : 1};
    transform: translateX(${props => props.$collapsed ? '10px' : '0'});
    transition: all ${theme.transitions.normal};
    flex: 1;
  }

  .dropdown-arrow {
    font-size: 12px;
    transition: transform ${theme.transitions.normal};
    transform: ${props => props.$expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
    opacity: ${props => props.$collapsed ? 0 : 1};
  }

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, ${theme.colors.primary.main}, ${theme.colors.primary.cyan});
    border-radius: 0 4px 4px 0;
    opacity: ${props => props.$active ? 1 : 0};
    transition: opacity ${theme.transitions.fast};
  }

  &:hover {
    background: ${props => props.$active ? theme.colors.ui.sidebarActive : theme.colors.ui.sidebarHover};
    color: ${theme.colors.text.sidebarPrimary};
    transform: translateX(5px);

    .icon {
      transform: scale(1.1);
    }

    &::before {
      opacity: 1;
    }
  }

  &:active {
    transform: translateX(2px);
  }
`;

const SubMenuContainer = styled.div`
  max-height: ${props => props.$expanded ? '1000px' : '0'};
  overflow: hidden;
  transition: max-height ${theme.transitions.normal} ease-in-out;
  margin-bottom: ${props => props.$expanded ? '4px' : '0'};
`;

const SubMenuItem = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  padding: 8px 16px 8px 56px;
  margin: 2px 16px;
  background: ${props => props.$active ? 'rgba(201, 165, 32, 0.15)' : 'transparent'};
  color: ${props => props.$active ? theme.colors.text.sidebarPrimary : theme.colors.text.sidebarSecondary};
  border-radius: ${theme.radius.sm}px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${props => props.$active ? theme.typography.fontWeight.medium : theme.typography.fontWeight.normal};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all ${theme.transitions.fast};
  position: relative;

  &:hover {
    background: rgba(201, 165, 32, 0.2);
    color: ${theme.colors.text.sidebarPrimary};
    transform: translateX(3px);
  }

  &:active {
    transform: translateX(1px);
  }
`;

const CollapseButton = styled.button`
  margin: ${theme.spacing.sm}px ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.md}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: rgba(201, 165, 32, 0.2);
  color: ${theme.colors.text.sidebarPrimary};
  border: 2px solid rgba(201, 165, 32, 0.4);
  border-radius: ${theme.radius.lg}px;
  box-shadow: ${theme.shadows.sm};
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all ${theme.transitions.normal} ${theme.transitions.easing.default};
  z-index: 2;
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.bold};
  transform: ${theme.transforms.button3D};
  flex-shrink: 0;

  /* 3D shimmer effect */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.6s;
  }

  &:hover {
    background: rgba(201, 165, 32, 0.3);
    border-color: ${theme.colors.primary.light};
    color: ${theme.colors.text.sidebarPrimary};
    transform: ${theme.transforms.buttonHover3D};
    box-shadow: ${theme.shadows.md}, ${theme.shadows.glowBlue};

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: ${theme.transforms.buttonActive3D};
  }
`;

const Sidebar = ({ active, onSelect, collapsed, setCollapsed }) => {
  const [expandedMenus, setExpandedMenus] = useState({});

  const items = [
    { key: 'dashboard', label: 'Control Tower (Dashboard)', icon: '📊' },
    { key: 'data-intake', label: 'Data Ingestion', icon: '📥' },
    { key: 'document', label: 'Document Management', icon: '📄' },
    { key: 'hsn-eccn', label: 'HSN/ECCN Engine', icon: '🔍' },
    {
      key: 'duty',
      label: 'Duty Engine',
      icon: '💰',
      hasDropdown: true,
      subItems: [
        { key: 'duty-cif', label: 'CIF' },
        { key: 'duty-av', label: 'Assessable Value (AV)' },
        { key: 'duty-bcd', label: 'Basic Customs Duty (BCD)' },
        { key: 'duty-sws', label: 'Social Welfare Surcharge (SWS)' },
        { key: 'duty-add', label: 'Anti-Dumping Duty (ADD)' },
        { key: 'duty-safeguard', label: 'Safeguard Duty' },
        { key: 'duty-cvd', label: 'Countervailing Duty (CVD)' },
        { key: 'duty-igst-base', label: 'IGST Base' },
        { key: 'duty-integrated-gst', label: 'Integrated GST' },
        { key: 'duty-total', label: 'Total Duty Payable' },
      ]
    },
    { key: 'boe', label: 'BoE Filing', icon: '📋' },
    {
      key: 'integration-filing',
      label: 'Integration & Filing',
      icon: '🔗',
      hasDropdown: true,
      subItems: [
        { key: 'integration-icegate', label: 'ICEGATE' },
        { key: 'integration-esanchit', label: 'eSANCHIT' },
        { key: 'integration-dgft', label: 'DGFT' },
        { key: 'integration-swift', label: 'SWIFT Portal' },
        { key: 'integration-banks', label: 'Banks / CHAs' },
        { key: 'integration-global', label: 'Global Customs' },
        { key: 'integration-erp', label: 'ERP / SAP / Workday / ServiceNow / CargoWise' },
        { key: 'integration-shipping', label: 'Shipping Lines' },
      ]
    },
    { key: 'clearance-decision', label: 'Clearance Decision', icon: '⚖️' },
    { key: 'trade-fraud', label: 'Trade Fraud Engine', icon: '🛡️' },
    { key: 'risk-scoring', label: 'Risk Scoring Engine', icon: '⚠️' },
    { key: 'compliance', label: 'Compliance Engine', icon: '✅' },
    { key: 'regulatory-tariff', label: 'Regulatory & Tariff', icon: '📚' },
    {
      key: 'shipment-tracking',
      label: 'Shipment Tracking',
      icon: '📦',
      hasDropdown: true,
      subItems: [
        { key: 'shipment-cargo', label: 'Cargo Information (Air / Sea / Land)' },
        { key: 'shipment-flight', label: 'Flight Status & AWB (Tracking Number)' },
        { key: 'shipment-container', label: 'Container Voyage Tracking' },
        { key: 'shipment-truck', label: 'Truck & Rail Updates' },
        { key: 'shipment-map', label: 'Live Tracking Map' },
      ]
    },
    {
      key: 'instant-alerts',
      label: 'Instant Alerts',
      icon: '🔔',
      hasDropdown: true,
      subItems: [
        { key: 'alerts-sms', label: 'SMS / Email' },
        { key: 'alerts-customs', label: 'Customs & Duty Estimates' },
        { key: 'alerts-history', label: 'History & Reports' },
        { key: 'alerts-control', label: 'Control Tower' },
        { key: 'alerts-ai', label: 'AI Governance & Monitoring' },
      ]
    },
    { key: 'customs-estimates', label: 'Customs Estimates', icon: '📊' },
    { key: 'history-reports', label: 'History & Reports', icon: '📈' },
    { key: 'ai-governance', label: 'AI Governance', icon: '🤖' },
    { key: 'invoice-duty', label: 'Invoice → Duty', icon: '🧾' },
    { key: 'customs', label: 'Customs Declaration', icon: '🌐' },
    { key: 'notifications', label: 'Notification Tracking', icon: '📢' },
    { key: 'qa', label: 'Q&A System', icon: '💬' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const handleItemClick = (itemKey, hasDropdown) => {
    if (hasDropdown) {
      // Toggle dropdown
      setExpandedMenus(prev => ({
        ...prev,
        [itemKey]: !prev[itemKey]
      }));
    } else {
      // Navigate to page
      onSelect(itemKey);
    }
  };

  const handleSubItemClick = (subItemKey) => {
    onSelect(subItemKey);
  };
  
  return (
    <SidebarWrapper $collapsed={collapsed} className="animate-slide-in-left">
      <SidebarHeader $collapsed={collapsed}>
        {!collapsed && (
          <>
            <FloatingGlobe>🌐</FloatingGlobe>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              textAlign: 'center'
            }}>
              <div style={{
                fontWeight: 900,
                letterSpacing: '0.08em',
                fontSize: '26px',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                lineHeight: '1.3',
                background: 'linear-gradient(135deg, #C9A520, #6BBCD4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 10px rgba(201, 165, 32, 0.5))',
                marginBottom: '4px'
              }}>
                ORBISPORTÉ
              </div>
            </div>
          </>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        <MenuSection>
          {items.map((item, index) => (
            <div key={item.key}>
              <MenuItem
                onClick={() => handleItemClick(item.key, item.hasDropdown)}
                $active={active === item.key}
                $collapsed={collapsed}
                $expanded={expandedMenus[item.key]}
                style={{
                  animationDelay: `${index * 0.1}s`
                }}
                className="animate-fade-in"
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
                {item.hasDropdown && (
                  <span className="dropdown-arrow">▼</span>
                )}
              </MenuItem>
              {item.hasDropdown && item.subItems && (
                <SubMenuContainer $expanded={expandedMenus[item.key] && !collapsed}>
                  {item.subItems.map((subItem) => (
                    <SubMenuItem
                      key={subItem.key}
                      onClick={() => handleSubItemClick(subItem.key)}
                      $active={active === subItem.key}
                    >
                      {subItem.label}
                    </SubMenuItem>
                  ))}
                </SubMenuContainer>
              )}
            </div>
          ))}
        </MenuSection>
      </SidebarContent>
      
      <CollapseButton onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? '→' : '←'}
      </CollapseButton>
    </SidebarWrapper>
  );
};

export default Sidebar;
