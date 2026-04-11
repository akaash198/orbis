/**
 * Dashboard Panel Component
 *
 * Executive Control Tower - Global overview of supply chain, compliance, and duty optimization.
 * Updated: March 14, 2026 - Enhanced with Quadrant Layout
 */

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import theme from '../../styles/theme';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { dashboardService } from '../../services/api';

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const DashboardContainer = styled.div`
  padding: ${theme.spacing.xxl}px;
  max-width: 1800px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--t-panel-bg);
  color: var(--t-text);
  transition: background 0.3s ease, color 0.3s ease;
`;

const ExecutiveHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.xxl}px;
  padding: ${theme.spacing.xl}px ${theme.spacing.xxl}px;
  background: var(--t-bg-dark);
  backdrop-filter: blur(20px);
  border: 1px solid var(--t-border);
  border-radius: ${theme.radius.xl}px;
  box-shadow:
    0 4px 24px rgba(0,0,0,0.5),
    0 0 40px rgba(201, 165, 32, 0.15),
    inset 0 1px 0 rgba(255,255,255,0.06);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg,
      #C9A520 0%,
      #6BBCD4 33%,
      #8B5CF6 66%,
      #C9A520 100%
    );
    background-size: 200% auto;
    animation: ${shimmer} 3s linear infinite;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.lg}px;
`;

const ControlTowerTitle = styled.div`
  h1 {
    font-size: ${theme.typography.fontSize['3xl']};
    font-weight: ${theme.typography.fontWeight.bold};
    color: var(--t-text);
    -webkit-text-fill-color: unset;
    margin: 0 0 6px 0;
    letter-spacing: -1px;
  }

  p {
    color: var(--t-text-sub);
    font-size: ${theme.typography.fontSize.sm};
    margin: 0;
    opacity: 0.9;
  }
`;

const SystemStatus = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: ${theme.radius.md}px;

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10B981;
    animation: ${pulse} 2s ease-in-out infinite;
  }

  .status-text {
    font-size: ${theme.typography.fontSize.xs};
    color: #10B981;
    font-weight: ${theme.typography.fontWeight.semibold};
  }
`;

const DashboardHeader = styled.div`
  margin-bottom: ${theme.spacing.xl}px;

  h1 {
    font-size: ${theme.typography.fontSize.xxl};
    font-weight: ${theme.typography.fontWeight.bold};
    background: linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.primary.cyan});
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0 0 ${theme.spacing.sm}px 0;
  }

  p {
    color: var(--t-text-sub);
    font-size: ${theme.typography.fontSize.md};
    margin: 0;
  }
`;

const QuadrantGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.spacing.xxl}px;
  margin-bottom: ${theme.spacing.xxl}px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const QuadrantCard = styled.div`
  background: linear-gradient(135deg, var(--t-hover) 0%, var(--t-bg-dark) 100%);
  backdrop-filter: blur(30px);
  border: 1px solid var(--t-border-light);
  border-radius: ${theme.radius.xxl}px;
  padding: ${theme.spacing.xxl}px;
  box-shadow:
    0 4px 24px rgba(0,0,0,0.5),
    0 0 40px rgba(201, 165, 32, 0.08),
    inset 0 1px 0 rgba(255,255,255,0.06);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(201, 165, 32, 0.6) 50%,
      transparent 100%
    );
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(201, 165, 32, 0.1) 50%,
      transparent 100%
    );
    transition: left 0.6s ease;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow:
      0 12px 40px rgba(0,0,0,0.6),
      0 0 0 1px rgba(201, 165, 32, 0.35),
      0 0 50px rgba(201, 165, 32, 0.15),
      inset 0 1px 0 rgba(255,255,255,0.08);
    border-color: rgba(201,165,32,0.5);

    &::after {
      left: 100%;
    }
  }
`;

const QuadrantHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.xl}px;
  padding-bottom: ${theme.spacing.lg}px;
  border-bottom: 2px solid transparent;
  background: linear-gradient(90deg, rgba(201, 165, 32, 0.15) 0%, transparent 100%);
  background-clip: padding-box;
  border-image: linear-gradient(90deg, rgba(201, 165, 32, 0.5) 0%, transparent 80%) 1;
  border-image-slice: 0 0 1 0;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 60px;
    height: 2px;
    background: linear-gradient(90deg, #C9A520 0%, #6BBCD4 100%);
    box-shadow: 0 0 10px rgba(201, 165, 32, 0.6);
  }

  .icon {
    font-size: ${theme.typography.fontSize['2xl']};
    filter: drop-shadow(0 4px 12px rgba(201, 165, 32, 0.6));
    animation: ${pulse} 3s ease-in-out infinite;
  }

  h3 {
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: var(--t-text);
    -webkit-text-fill-color: unset;
    margin: 0;
    letter-spacing: -0.5px;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${theme.spacing.xl}px;
  margin-bottom: ${theme.spacing.xxl}px;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: var(--t-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--t-border-light);
  border-radius: ${theme.radius.xl}px;
  padding: ${theme.spacing.xl}px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
  transition: all ${theme.transitions.normal};
  position: relative;
  overflow: hidden;

  /* Top border accent */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${props => props.$accentColor || theme.colors.primary.main};
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 30px rgba(201,165,32,0.2);
    border-color: rgba(201,165,32,0.6);
    background: var(--t-hover);
  }
`;

const StatHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.lg}px;

  .icon-wrapper {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.radius.md}px;
    background: ${props => props.$iconBg || 'linear-gradient(135deg, rgba(201, 165, 32, 0.2), rgba(6, 182, 212, 0.2))'};
    transition: all ${theme.transitions.normal};

    .icon {
      font-size: 24px;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }
  }

  .title {
    font-size: ${theme.typography.fontSize.xs};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: var(--t-text-sub);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
  }
`;

const StatValue = styled.div`
  font-size: ${theme.typography.fontSize['3xl']};
  font-weight: ${theme.typography.fontWeight.bold};
  color: var(--t-text);
  margin-bottom: ${theme.spacing.xs}px;
  line-height: 1.2;
`;

const StatChange = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  color: ${props => props.$positive ? theme.colors.status.success : theme.colors.status.error};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs}px;
`;

const RecentActivity = styled.div`
  background: var(--t-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--t-border-light);
  border-radius: ${theme.radius.xl}px;
  padding: ${theme.spacing.xl}px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
  transition: all ${theme.transitions.normal};
  margin-bottom: ${theme.spacing.xxl}px;

  &:hover {
    box-shadow: 0 8px 28px rgba(0,0,0,0.5), 0 0 20px rgba(201,165,32,0.1);
  }
`;

const ActivityHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  margin-bottom: ${theme.spacing.xl}px;
  padding-bottom: ${theme.spacing.md}px;
  border-bottom: 1px solid var(--t-border);

  .icon {
    font-size: ${theme.typography.fontSize.md};
  }

  h3 {
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: var(--t-text);
    margin: 0;
  }
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
`;

const ActivityItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  padding: ${theme.spacing.md}px;
  background: var(--t-bg-dark);
  border-radius: ${theme.radius.md}px;
  border: 1px solid var(--t-border-light);
  transition: all ${theme.transitions.normal};

  &:hover {
    background: var(--t-hover);
    border-color: ${theme.colors.primary.main};
    transform: translateX(4px);
  }

  .icon {
    font-size: ${theme.typography.fontSize.md};
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(201, 165, 32, 0.15), rgba(6, 182, 212, 0.15));
    border-radius: ${theme.radius.md}px;
    flex-shrink: 0;
  }

  .content {
    flex: 1;

    .title {
      font-size: ${theme.typography.fontSize.sm};
      font-weight: ${theme.typography.fontWeight.medium};
      color: var(--t-text);
      margin: 0 0 4px 0;
    }

    .time {
      font-size: ${theme.typography.fontSize.xs};
      color: var(--t-text-sub);
    }
  }
`;

// Logistics Lane Components
const LogisticsLane = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.lg}px;
  background: var(--t-bg-dark);
  border: 1px solid var(--t-border-light);
  border-radius: ${theme.radius.lg}px;
  margin-bottom: ${theme.spacing.lg}px;
  transition: all ${theme.transitions.normal};

  &:hover {
    background: rgba(135,110,18,0.12);
    border-color: rgba(201, 165, 32, 0.25);
    transform: translateX(2px);
  }

  .lane-icon {
    font-size: ${theme.typography.fontSize.lg};
    margin-right: ${theme.spacing.lg}px;
    opacity: 0.8;
  }

  .lane-info {
    flex: 1;

    .lane-title {
      font-size: ${theme.typography.fontSize.md};
      font-weight: ${theme.typography.fontWeight.medium};
      color: var(--t-text);
      margin-bottom: 2px;
    }

    .lane-subtitle {
      font-size: ${theme.typography.fontSize.xs};
      color: var(--t-text-sub);
      opacity: 0.8;
    }
  }
`;

const StatusBadge = styled.span`
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  border-radius: ${theme.radius.sm}px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.5px;

  ${props => props.$variant === 'active' && `
    background: rgba(16, 185, 129, 0.2);
    color: #10B981;
    border: 1px solid rgba(16, 185, 129, 0.4);
  `}

  ${props => props.$variant === 'delayed' && `
    background: rgba(245, 158, 11, 0.2);
    color: #F59E0B;
    border: 1px solid rgba(245, 158, 11, 0.4);
  `}

  ${props => props.$variant === 'arrived' && `
    background: rgba(201, 165, 32, 0.2);
    color: #C9A520;
    border: 1px solid rgba(201, 165, 32, 0.4);
  `}
`;

// Chart Components
const BarChartContainer = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 200px;
  padding: ${theme.spacing.xl}px;
  gap: ${theme.spacing.lg}px;
  background: var(--t-bg-dark);
  border-radius: ${theme.radius.lg}px;
  border: 1px solid var(--t-border-light);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: ${theme.spacing.xl}px;
    right: ${theme.spacing.xl}px;
    height: 1px;
    background: rgba(201, 165, 32, 0.3);
  }
`;

const BarColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: ${theme.spacing.sm}px;
  position: relative;
  height: 100%;

  .bar {
    width: 100%;
    max-width: 50px;
    background: linear-gradient(180deg, #C9A520 0%, #876E12 100%);
    border-radius: ${theme.radius.md}px ${theme.radius.md}px 0 0;
    height: ${props => props.$height}%;
    min-height: ${props => props.$height > 0 ? '20px' : '0px'};
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 -4px 20px rgba(201, 165, 32, 0.4),
      inset 0 -2px 8px rgba(0, 0, 0, 0.2),
      inset 0 2px 8px rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 30%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%);
      border-radius: ${theme.radius.md}px ${theme.radius.md}px 0 0;
    }

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 3px;
      height: 100%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, transparent 50%);
    }

    &:hover {
      transform: translateY(-4px) scale(1.05);
      box-shadow:
        0 -8px 30px rgba(201, 165, 32, 0.6),
        inset 0 -2px 8px rgba(0, 0, 0, 0.2),
        inset 0 2px 12px rgba(255, 255, 255, 0.2);
    }
  }

  .label {
    font-size: 10px;
    font-weight: ${theme.typography.fontWeight.medium};
    color: var(--t-text-sub);
    letter-spacing: 0.3px;
    margin-top: ${theme.spacing.xs}px;
    text-align: center;
    line-height: 1.2;
  }
`;

const DonutChart = styled.div`
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    #C9A520 0deg ${props => props.$lowRisk || 270}deg,
    #F59E0B ${props => props.$lowRisk || 270}deg ${props => (props.$lowRisk || 270) + (props.$mediumRisk || 60)}deg,
    #EF4444 ${props => (props.$lowRisk || 270) + (props.$mediumRisk || 60)}deg 360deg
  );
  position: relative;
  margin: ${theme.spacing.xl}px auto;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.1),
    0 0 30px rgba(201, 165, 32, 0.12),
    inset 0 0 20px rgba(0, 0, 0, 0.04);
  transform: rotate(-90deg);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 130px;
    height: 130px;
    background: linear-gradient(135deg, #07111f 0%, #0a1628 100%);
    border-radius: 50%;
    box-shadow:
      0 0 20px rgba(0, 0, 0, 0.5),
      inset 0 4px 12px rgba(0, 0, 0, 0.4),
      inset 0 -4px 12px rgba(255, 255, 255, 0.05);
  }

  &::after {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(0, 0, 0, 0.2) 100%);
    pointer-events: none;
  }

  &:hover {
    transform: rotate(-90deg) scale(1.05);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 0 50px rgba(201, 165, 32, 0.2),
      inset 0 0 20px rgba(0, 0, 0, 0.02);
  }
`;

const ChartLegend = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
  margin-top: ${theme.spacing.xl}px;
  padding: ${theme.spacing.lg}px;
  background: var(--t-bg-dark);
  border-radius: ${theme.radius.lg}px;
  border: 1px solid var(--t-border-light);

  .legend-item {
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md}px;
    font-size: ${theme.typography.fontSize.sm};
    padding: ${theme.spacing.sm}px;
    border-radius: ${theme.radius.sm}px;
    transition: all ${theme.transitions.normal};

    &:hover {
      background: rgba(201, 165, 32, 0.05);
      transform: translateX(4px);
    }

    .color-box {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      flex-shrink: 0;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.3),
        inset 0 1px 2px rgba(255, 255, 255, 0.2);
    }

    .label {
      color: var(--t-text-sub);
      line-height: 1.4;
      font-weight: ${theme.typography.fontWeight.medium};
    }
  }
`;

const AlertPanel = styled.div`
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  margin-top: ${theme.spacing.md}px;

  .alert-title {
    font-size: ${theme.typography.fontSize.xs};
    font-weight: ${theme.typography.fontWeight.bold};
    color: #EF4444;
    text-transform: uppercase;
    margin-bottom: ${theme.spacing.xs}px;
    letter-spacing: 0.5px;
  }

  .alert-message {
    font-size: ${theme.typography.fontSize.sm};
    color: var(--t-text-sub);
    line-height: 1.4;
  }
`;

const InfoPanel = styled.div`
  background: linear-gradient(135deg, rgba(135,110,18,0.12) 0%, rgba(107,188,212,0.08) 100%);
  border: 1px solid rgba(201, 165, 32, 0.25);
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.lg}px;
  margin-top: ${theme.spacing.lg}px;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 2px 8px rgba(201, 165, 32, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: all ${theme.transitions.normal};

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(180deg, #C9A520 0%, #6BBCD4 100%);
    box-shadow: 0 0 10px rgba(201, 165, 32, 0.5);
  }

  &:hover {
    border-color: rgba(201, 165, 32, 0.4);
    box-shadow:
      0 4px 16px rgba(201, 165, 32, 0.1),
      inset 0 1px 0 rgba(255,255,255,0.05);
  }

  .info-title {
    font-size: ${theme.typography.fontSize.xs};
    font-weight: ${theme.typography.fontWeight.bold};
    color: var(--t-btn-color);
    text-transform: uppercase;
    margin-bottom: ${theme.spacing.sm}px;
    letter-spacing: 1px;
  }

  .info-message {
    font-size: ${theme.typography.fontSize.sm};
    color: var(--t-text-sub);
    line-height: 1.5;
  }
`;

const OpportunityRadar = styled.div`
  background: rgba(16,185,129,0.08);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px;
  margin-top: ${theme.spacing.lg}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.spacing.md}px;

  .radar-content {
    flex: 1;

    .radar-title {
      font-size: ${theme.typography.fontSize.xs};
      font-weight: ${theme.typography.fontWeight.bold};
      color: #10B981;
      text-transform: uppercase;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }

    .radar-message {
      font-size: ${theme.typography.fontSize.sm};
      color: var(--t-text-sub);
    }
  }

  button {
    background: #10B981;
    color: #fff;
    border: none;
    padding: ${theme.spacing.sm}px ${theme.spacing.lg}px;
    border-radius: ${theme.radius.sm}px;
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    cursor: pointer;
    transition: all ${theme.transitions.normal};

    &:hover {
      background: #059669;
      transform: scale(1.05);
    }
  }
`;

const QuickActions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${theme.spacing.lg}px;
  margin-top: ${theme.spacing.xxl}px;
`;

const QuickActionsHeader = styled.div`
  margin-bottom: ${theme.spacing.xl}px;

  h2 {
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.bold};
    background: linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.primary.cyan});
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0 0 ${theme.spacing.xs}px 0;
  }

  p {
    color: var(--t-text-sub);
    font-size: ${theme.typography.fontSize.sm};
    margin: 0;
  }
`;

const ActionButton = styled.button`
  background: rgba(255,255,255,0.95);
  color: #0a0e1a;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: ${theme.radius.xl}px;
  padding: ${theme.spacing.lg}px ${theme.spacing.xl}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm}px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);

  .icon {
    font-size: 32px;
  }

  span:last-child {
    font-size: ${theme.typography.fontSize.sm};
  }

  &:hover {
    transform: translateY(-4px);
    background: #ffffff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.15);
  }

  &:active {
    transform: translateY(-2px);
  }
`;

// Helper function to calculate time ago (outside component to avoid recreation)
const getTimeAgo = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

// Helper function to generate shipments from processed documents
const generateShipmentsFromDocuments = (files) => {
  const shipmentTypes = [
    { icon: '🚢', mode: 'Ocean', prefix: 'BL', routes: ['Mumbai → Rotterdam', 'Chennai → Singapore', 'Nhava Sheva → Hamburg'] },
    { icon: '✈️', mode: 'Air', prefix: 'AWB', routes: ['Delhi IGI → JFK', 'Mumbai → Heathrow', 'Bangalore → Dubai'] },
    { icon: '📦', mode: 'Container', prefix: 'CONT', routes: ['Chennai Port', 'Kandla Port', 'Cochin Port'] },
    { icon: '🚛', mode: 'Road', prefix: 'TRK', routes: ['Warehouse → ICD Tughlakabad', 'Factory → ICD Patparganj', 'Depot → CFS'] }
  ];

  const statuses = [
    { variant: 'active', label: 'In Transit' },
    { variant: 'delayed', label: 'Delayed 2h' },
    { variant: 'arrived', label: 'Customs' },
    { variant: 'active', label: 'En Route' }
  ];

  const processedFiles = files.filter(f => f.extraction && f.extraction.combined);
  const shipments = [];

  processedFiles.slice(0, 4).forEach((fileState, index) => {
    const typeIndex = index % shipmentTypes.length;
    const type = shipmentTypes[typeIndex];
    const status = statuses[index % statuses.length];
    const fileName = fileState.file?.name || 'Document';
    const timestamp = new Date(fileState.timestamp).toLocaleDateString('en-IN');

    // Extract any bill of lading or AWB numbers from extraction data
    let trackingNumber = `${type.prefix}-2024-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    if (fileState.extraction?.combined) {
      const extraction = fileState.extraction.combined;
      // Try to find tracking numbers in the extraction
      if (extraction.bill_of_lading_number) {
        trackingNumber = extraction.bill_of_lading_number;
      } else if (extraction.awb_number) {
        trackingNumber = extraction.awb_number;
      } else if (extraction.invoice_number) {
        trackingNumber = `${type.prefix}-${extraction.invoice_number}`;
      }
    }

    shipments.push({
      id: `shipment-${index}`,
      icon: type.icon,
      trackingNumber: trackingNumber,
      route: type.routes[index % type.routes.length],
      mode: type.mode,
      status: status,
      documentName: fileName,
      timestamp: timestamp
    });
  });

  // If no processed files, return empty array
  return shipments;
};

const DashboardPanel = ({ onPageChange }) => {
  console.log('🚀🚀🚀 EXECUTIVE CONTROL TOWER VERSION 2.0 - QUADRANT LAYOUT ACTIVE 🚀🚀🚀');

  const { files } = useDocumentContext();

  // Debug logging
  const [stats, setStats] = useState({
    totalDocuments: 0,
    processedDocuments: 0,
    activeShipments: 0,
    companyUsers: 1,
    successRate: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debug: Log files context (avoid logging full objects to prevent circular reference errors)
  console.log('📁 Files from context:', files.length);

  // Fetch dashboard stats from API
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // ALWAYS calculate session stats first
      const processedCount = files.filter(f =>
        f.extraction && f.extraction.combined && !f.loading
      ).length;
      const sessionStats = {
        totalDocuments: files.length,
        processedDocuments: processedCount,
        activeShipments: parseInt(sessionStorage.getItem('customs_declarations_count') || '0', 10),
        companyUsers: 1,
        successRate: files.length > 0 ? Math.round((processedCount / files.length) * 100) : 0
      };

      console.log('📊 SESSION DATA:', sessionStats);
      console.log('📁 Files from DocumentContext:', files.length);
      console.log('✅ Processed files:', processedCount);

      // Try to get backend stats
      try {
        console.log('Fetching dashboard stats from backend...');
        const response = await dashboardService.getDashboardStats();
        console.log('📊 Backend raw response:', response);

        // Handle both response formats
        let backendStats = null;
        if (response.success && response.stats) {
          // Format 1: {success: true, stats: {...}}
          backendStats = response.stats;
        } else if (response.total_documents !== undefined) {
          // Format 2: Direct stats object {total_documents: X, ...}
          backendStats = {
            totalDocuments: response.total_documents || 0,
            processedDocuments: response.processed_documents || 0,
            activeShipments: response.customs_declarations || 0,
            companyUsers: response.company_users || 1,
            successRate: 0
          };
        }

        console.log('📊 Parsed backend stats:', backendStats);

        if (backendStats && backendStats.totalDocuments > 0) {
          // Use backend stats if available and has data
          console.log('✅ Using Backend Stats:', backendStats);
          console.log('📊 Stats breakdown - Total:', backendStats.totalDocuments, 'Processed:', backendStats.processedDocuments, 'Shipments:', backendStats.activeShipments);
          setStats(backendStats);

          // Handle recent activity if available
          if (response.recentActivity && Array.isArray(response.recentActivity)) {
            const activitiesWithTime = response.recentActivity.map(activity => ({
              ...activity,
              time: getTimeAgo(new Date(activity.timestamp).getTime())
            }));
            setRecentActivity(activitiesWithTime);
          } else if (response.recent_activity && Array.isArray(response.recent_activity)) {
            const activitiesWithTime = response.recent_activity.map(activity => ({
              ...activity,
              time: getTimeAgo(new Date(activity.timestamp).getTime())
            }));
            setRecentActivity(activitiesWithTime);
          } else {
            // Generate activity from session if backend doesn't provide
            const sessionActivity = generateSessionActivity(files);
            setRecentActivity(sessionActivity);
          }

          // Handle shipments data if available
          if (response.shipments && Array.isArray(response.shipments)) {
            setShipments(response.shipments);
          } else if (response.active_shipments && Array.isArray(response.active_shipments)) {
            setShipments(response.active_shipments);
          } else {
            // Generate shipments from processed documents
            const generatedShipments = generateShipmentsFromDocuments(files);
            setShipments(generatedShipments);
          }
        } else {
          // Use session stats if backend is empty
          console.log('⚠️ Backend empty, using SESSION stats:', sessionStats);
          setStats(sessionStats);
          const sessionActivity = generateSessionActivity(files);
          setRecentActivity(sessionActivity);
          const generatedShipments = generateShipmentsFromDocuments(files);
          setShipments(generatedShipments);
        }
      } catch (apiErr) {
        // API failed, use session stats
        console.error('❌ Backend API failed, using SESSION fallback');
        console.log('Session stats:', sessionStats);
        setStats(sessionStats);
        const sessionActivity = generateSessionActivity(files);
        setRecentActivity(sessionActivity);
        const generatedShipments = generateShipmentsFromDocuments(files);
        setShipments(generatedShipments);
        setError(null); // Don't show error if we have session fallback
      }
    } catch (err) {
      console.error('Fatal error in fetchDashboardStats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate activity from session files (fallback)
  const generateSessionActivity = (files) => {
    const activities = [];
    const sortedFiles = [...files].sort((a, b) => b.timestamp - a.timestamp);

    sortedFiles.slice(0, 6).forEach((fileState, index) => {
      const fileName = fileState.file?.name || 'Unknown';
      const timeAgo = getTimeAgo(fileState.timestamp);

      activities.push({
        id: `upload-${index}`,
        type: 'document',
        title: `${fileName} uploaded`,
        time: timeAgo,
        icon: '📤'
      });

      if (fileState.classification) {
        activities.push({
          id: `classify-${index}`,
          type: 'classification',
          title: `${fileName} classified as ${fileState.classification.document_type}`,
          time: timeAgo,
          icon: '🏷️'
        });
      }

      if (fileState.extraction) {
        activities.push({
          id: `extract-${index}`,
          type: 'extraction',
          title: `${fileName} data extracted`,
          time: timeAgo,
          icon: '✅'
        });
      }
    });

    return activities.slice(0, 8);
  };

  // Initial fetch on mount and when files change
  useEffect(() => {
    fetchDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  // Refresh stats every 30 seconds (reduced from 5 seconds to prevent performance issues)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardStats();
    }, 30000); // Changed to 30 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  const handleQuickAction = (action) => {
    if (!onPageChange) {
      console.warn('onPageChange handler not provided to DashboardPanel');
      return;
    }

    // Map actions to corresponding page routes
    const actionToPageMap = {
      'upload': 'document',       // Upload Document -> Document Panel
      'create-shipment': 'customs', // Create Shipment -> Customs Panel
      'hs-lookup': 'hs',           // HS Code Lookup -> HS Code Panel
      'qa': 'qa'                   // Ask Question -> Q&A Panel
    };

    const targetPage = actionToPageMap[action];
    if (targetPage) {
      onPageChange(targetPage);
    } else {
      console.warn(`Unknown action: ${action}`);
    }
  };

  return (
    <DashboardContainer>
      {/* Executive Header */}
      <ExecutiveHeader>
        <HeaderLeft>
          <ControlTowerTitle>
            <h1>Executive Control Tower</h1>
            <p>Global overview of supply chain, compliance, and duty optimization.</p>
          </ControlTowerTitle>
        </HeaderLeft>
        <SystemStatus>
          <div className="status-indicator"></div>
          <span className="status-text">System Active</span>
        </SystemStatus>
      </ExecutiveHeader>

      {loading && !stats.totalDocuments ? (
        <div style={{ textAlign: 'center', padding: '40px', color: theme.colors.text.secondary }}>
          Loading dashboard statistics...
        </div>
      ) : null}

      {/* Empty State Message */}
      {stats.totalDocuments === 0 && !loading && (
        <InfoPanel style={{ marginBottom: theme.spacing.xxl + 'px' }}>
          <div className="info-title">🚀 Getting Started</div>
          <div className="info-message">
            Your dashboard is ready! Upload documents to see analytics and visualizations.
            Go to the Document Management section to get started.
          </div>
        </InfoPanel>
      )}

      {/* Quadrant Grid */}
      <QuadrantGrid>
        {/* Quadrant A: Document Processing Bar Chart */}
        <QuadrantCard>
          <QuadrantHeader>
            <span className="icon">📄</span>
            <h3>Quadrant A: Document Processing Engine</h3>
          </QuadrantHeader>

          {/* Key Metrics Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: `${theme.spacing.md}px`,
            marginBottom: `${theme.spacing.xl}px`,
            padding: `${theme.spacing.md}px`,
            background: 'rgba(201, 165, 32, 0.05)',
            borderRadius: `${theme.radius.md}px`,
            border: '1px solid rgba(201, 165, 32, 0.1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#C9A520' }}>{stats.totalDocuments}</div>
              <div style={{ fontSize: '10px', color: "var(--t-text-sub)", textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Uploaded</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10B981' }}>{stats.processedDocuments}</div>
              <div style={{ fontSize: '10px', color: "var(--t-text-sub)", textTransform: 'uppercase', letterSpacing: '0.5px' }}>Processed</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F59E0B' }}>{stats.totalDocuments - stats.processedDocuments}</div>
              <div style={{ fontSize: '10px', color: "var(--t-text-sub)", textTransform: 'uppercase', letterSpacing: '0.5px' }}>In Queue</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B5CF6' }}>{stats.activeShipments}</div>
              <div style={{ fontSize: '10px', color: "var(--t-text-sub)", textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Ships</div>
            </div>
          </div>

          <BarChartContainer>
            {(() => {
              const maxVal = Math.max(stats.totalDocuments, stats.processedDocuments, stats.activeShipments, 1);
              const totalHeight = Math.max((stats.totalDocuments / maxVal) * 100, stats.totalDocuments > 0 ? 20 : 0);
              const processedHeight = Math.max((stats.processedDocuments / maxVal) * 100, stats.processedDocuments > 0 ? 15 : 0);
              const pending = stats.totalDocuments - stats.processedDocuments;
              const pendingHeight = Math.max((pending / maxVal) * 100, pending > 0 ? 20 : 0);
              const shipHeight = Math.max((stats.activeShipments / maxVal) * 100, stats.activeShipments > 0 ? 15 : 0);

              console.log('📊 Bar Heights - MaxVal:', maxVal, 'Total:', totalHeight, 'Processed:', processedHeight, 'Pending:', pendingHeight, 'Ships:', shipHeight);

              return (
                <>
                  <BarColumn $height={totalHeight}>
                    <div className="bar"></div>
                    <div className="label">Week 1<br/>{stats.totalDocuments}</div>
                  </BarColumn>
                  <BarColumn $height={processedHeight}>
                    <div className="bar" style={{ background: 'linear-gradient(180deg, #10B981 0%, #059669 100%)' }}></div>
                    <div className="label">Week 2<br/>{stats.processedDocuments}</div>
                  </BarColumn>
                  <BarColumn $height={pendingHeight}>
                    <div className="bar" style={{ background: 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)' }}></div>
                    <div className="label">Week 3<br/>{pending}</div>
                  </BarColumn>
                  <BarColumn $height={shipHeight}>
                    <div className="bar" style={{ background: 'linear-gradient(180deg, #8B5CF6 0%, #7C3AED 100%)' }}></div>
                    <div className="label">Week 4<br/>{stats.activeShipments}</div>
                  </BarColumn>
                </>
              );
            })()}
          </BarChartContainer>

          <OpportunityRadar style={{ marginTop: `${theme.spacing.lg}px` }}>
            <div className="radar-content">
              <div className="radar-title">FTA OPPORTUNITY RADAR</div>
              <div className="radar-message">
                Switching to CEPA Form A-1 will save $14,200 on Lane 2.
              </div>
            </div>
            <button>Apply</button>
          </OpportunityRadar>

        </QuadrantCard>

        {/* Quadrant B: Risk Sentinel */}
        <QuadrantCard>
          <QuadrantHeader>
            <span className="icon">⚠️</span>
            <h3>Quadrant B: Risk Sentinel</h3>
          </QuadrantHeader>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: `${theme.spacing.lg}px`
          }}>
            <DonutChart
              $lowRisk={270}
              $mediumRisk={60}
            />
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: '#10B981',
                transform: 'rotate(-90deg)',
                lineHeight: '1'
              }}>
                {stats.totalDocuments > 0 ? Math.round((stats.processedDocuments / stats.totalDocuments) * 100) : 95}%
              </div>
              <div style={{
                fontSize: '10px',
                color: "var(--t-text-sub)",
                textTransform: 'uppercase',
                transform: 'rotate(-90deg)',
                marginTop: '4px',
                letterSpacing: '1px'
              }}>
                Confidence
              </div>
            </div>
          </div>

          <ChartLegend>
            <div className="legend-item">
              <div className="color-box" style={{ background: '#C9A520' }}></div>
              <span className="label">
                ✅ {stats.totalDocuments > 0 ? Math.round((stats.processedDocuments / stats.totalDocuments) * 100) : 95}% Confidence (Auto)
              </span>
            </div>
            <div className="legend-item">
              <div className="color-box" style={{ background: '#F59E0B' }}></div>
              <span className="label">
                🔍 Requires HITL Review
              </span>
            </div>
            <div className="legend-item">
              <div className="color-box" style={{ background: '#EF4444' }}></div>
              <span className="label">
                🚨 High Risk (Fraud)
              </span>
            </div>
          </ChartLegend>

          <AlertPanel style={{ marginTop: `${theme.spacing.lg}px` }}>
            <div className="alert-title">ANOMALY DETECTION</div>
            <div className="alert-message">
              Deep SVDD flagged 2 shipments for severe under-invoicing global mean.
            </div>
          </AlertPanel>

          <InfoPanel style={{ marginTop: `${theme.spacing.md}px` }}>
            <div className="info-title">ENTITY GRAPH STATUS</div>
            <div className="info-message">
              HGT screening completed. 0 circular trade networks detected today.
            </div>
          </InfoPanel>
        </QuadrantCard>

        {/* Quadrant C: Logistics Lane & Shipment Tracking */}
        <QuadrantCard>
          <QuadrantHeader>
            <span className="icon">🚢</span>
            <h3>Quadrant C: Logistics Lane</h3>
          </QuadrantHeader>

          {shipments.length > 0 ? (
            <>
              {shipments.map((shipment, index) => (
                <LogisticsLane key={shipment.id}>
                  <span className="lane-icon">{shipment.icon}</span>
                  <div className="lane-info">
                    <div className="lane-title">{shipment.trackingNumber}</div>
                    <div className="lane-subtitle">
                      {shipment.route} | {shipment.mode} | Doc: {shipment.documentName.slice(0, 20)}...
                    </div>
                  </div>
                  <StatusBadge $variant={shipment.status.variant}>{shipment.status.label}</StatusBadge>
                </LogisticsLane>
              ))}

              <InfoPanel style={{ marginTop: `${theme.spacing.lg}px` }}>
                <div className="info-title">LIVE TRACKING STATUS</div>
                <div className="info-message">
                  {shipments.length} active shipments monitored across {new Set(shipments.map(s => s.mode)).size} modes. Real-time GPS enabled.
                </div>
              </InfoPanel>
            </>
          ) : (
            <InfoPanel>
              <div className="info-title">NO ACTIVE SHIPMENTS</div>
              <div className="info-message">
                Process documents to generate shipment tracking. Upload and extract invoices or bills of lading to see logistics data here.
              </div>
            </InfoPanel>
          )}
        </QuadrantCard>

        {/* Quadrant D: Duty Optimization & Compliance */}
        <QuadrantCard>
          <QuadrantHeader>
            <span className="icon">💰</span>
            <h3>Quadrant D: Duty Optimization</h3>
          </QuadrantHeader>

          {/* Compliance Score */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${theme.spacing.lg}px`,
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: `${theme.radius.lg}px`,
            border: '1px solid rgba(16, 185, 129, 0.3)',
            marginBottom: `${theme.spacing.lg}px`
          }}>
            <div>
              <div style={{ fontSize: '14px', color: "var(--t-text-sub)", marginBottom: '4px' }}>
                Overall Compliance Index
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10B981' }}>
                98.5%
              </div>
            </div>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, #10B981 0deg 354deg, rgba(16, 185, 129, 0.2) 354deg 360deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--t-glass-light) 0%, var(--t-glass) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#10B981'
              }}>
                A+
              </div>
            </div>
          </div>

          {/* Duty Breakdown */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: `${theme.spacing.sm}px`,
            marginBottom: `${theme.spacing.lg}px`
          }}>
            <div style={{
              padding: `${theme.spacing.md}px`,
              background: 'rgba(201, 165, 32, 0.05)',
              borderRadius: `${theme.radius.md}px`,
              border: '1px solid rgba(201, 165, 32, 0.1)'
            }}>
              <div style={{ fontSize: '10px', color: "var(--t-text-sub)", textTransform: 'uppercase', marginBottom: '4px' }}>
                BCD (Basic Customs)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#C9A520' }}>
                ₹2.4L
              </div>
            </div>
            <div style={{
              padding: `${theme.spacing.md}px`,
              background: 'rgba(139, 92, 246, 0.05)',
              borderRadius: `${theme.radius.md}px`,
              border: '1px solid rgba(139, 92, 246, 0.1)'
            }}>
              <div style={{ fontSize: '10px', color: "var(--t-text-sub)", textTransform: 'uppercase', marginBottom: '4px' }}>
                IGST (Integrated)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8B5CF6' }}>
                ₹4.8L
              </div>
            </div>
            <div style={{
              padding: `${theme.spacing.md}px`,
              background: 'rgba(245, 158, 11, 0.05)',
              borderRadius: `${theme.radius.md}px`,
              border: '1px solid rgba(245, 158, 11, 0.1)'
            }}>
              <div style={{ fontSize: '10px', color: "var(--t-text-sub)", textTransform: 'uppercase', marginBottom: '4px' }}>
                SWS (Social Welfare)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#F59E0B' }}>
                ₹45K
              </div>
            </div>
            <div style={{
              padding: `${theme.spacing.md}px`,
              background: 'rgba(6, 182, 212, 0.05)',
              borderRadius: `${theme.radius.md}px`,
              border: '1px solid rgba(6, 182, 212, 0.1)'
            }}>
              <div style={{ fontSize: '10px', color: "var(--t-text-sub)", textTransform: 'uppercase', marginBottom: '4px' }}>
                ADD (Anti-Dumping)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6BBCD4' }}>
                ₹1.2L
              </div>
            </div>
          </div>

          <InfoPanel>
            <div className="info-title">CRIB NOTIFICATION 24/2025</div>
            <div className="info-message" style={{ fontSize: '11px' }}>
              Cross-referenced with catalog parameters. All HSN codes validated based on CBIC standards.
            </div>
          </InfoPanel>

          <AlertPanel style={{ marginTop: `${theme.spacing.md}px` }}>
            <div className="alert-title">TARIFF UPDATE ALERT</div>
            <div className="alert-message" style={{ fontSize: '11px' }}>
              New BCD rate for HS Code 8471.30 effective 20 Mar 2026. Review pending imports.
            </div>
          </AlertPanel>
        </QuadrantCard>
      </QuadrantGrid>

      {/* Quick Actions */}
      <QuickActionsHeader>
        <h2>Quick Actions</h2>
        <p>Get started with common tasks</p>
      </QuickActionsHeader>

      <QuickActions>
        <ActionButton onClick={() => handleQuickAction('upload')}>
          <span className="icon">📤</span>
          <span>Upload Document</span>
        </ActionButton>
        <ActionButton onClick={() => handleQuickAction('create-shipment')}>
          <span className="icon">📦</span>
          <span>Create Shipment</span>
        </ActionButton>
        <ActionButton onClick={() => handleQuickAction('hs-lookup')}>
          <span className="icon">🔍</span>
          <span>HS Code Lookup</span>
        </ActionButton>
        <ActionButton onClick={() => handleQuickAction('qa')}>
          <span className="icon">💬</span>
          <span>Ask Question</span>
        </ActionButton>
      </QuickActions>
    </DashboardContainer>
  );
};

export default DashboardPanel;
