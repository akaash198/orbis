/**
 * Header Component
 * 
 * Application header with title and description.
 */

import React from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';

const HeaderContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  padding: 0 ${theme.spacing.xxl}px;
  background: linear-gradient(160deg, #04060f 0%, #060d1f 50%, #050b18 100%);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(201, 165, 32, 0.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: ${theme.zIndex.navbar};
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  transition: all ${theme.transitions.normal};
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 0% 50%, rgba(201, 165, 32, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.10) 0%, transparent 50%),
      radial-gradient(ellipse at 100% 50%, rgba(139, 92, 246, 0.10) 0%, transparent 50%);
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(201, 165, 32, 0.6), rgba(6, 182, 212, 0.6), rgba(139, 92, 246, 0.4), transparent);
    pointer-events: none;
  }
`;

const ContentWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  position: relative;
  z-index: 2;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
`;

const TitleSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h1`
  margin: 0;
  font-family: ${theme.typography.fontFamily.main};
  font-size: ${theme.typography.fontSize.xl};
  font-weight: ${theme.typography.fontWeight.bold};
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.primary.cyan});
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  filter: drop-shadow(0 0 15px rgba(201, 165, 32, 0.5));
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const Subtitle = styled.div`
  color: #ffffff;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
`;

const HeaderActions = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${theme.spacing.md}px;
`;

const AuthButtons = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
`;

const AuthButton = styled.button`
  background: ${props => props.primary ? theme.colors.primary.gradient : theme.colors.ui.card};
  color: ${theme.colors.text.primary};
  border: 1px solid ${props => props.primary ? 'transparent' : theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  padding: 10px 24px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  box-shadow: ${theme.shadows.button};

  &:hover {
    background: ${props => props.primary ? theme.colors.primary.gradient3D : theme.colors.ui.hover};
    transform: translateY(-2px);
    box-shadow: ${props => props.primary ? theme.shadows.glowBlue : theme.shadows.md};
    border-color: ${props => props.primary ? 'transparent' : theme.colors.primary.main};
  }

  &:active {
    transform: translateY(0);
  }
`;

const RightBrand = styled.div`
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: ${theme.typography.fontWeight.bold};
  font-size: ${theme.typography.fontSize.sm};
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: ${theme.radius.md}px;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(6px);
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs}px;
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: ${theme.radius.pill}px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: ${theme.colors.primary.contrast};
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.medium};
  
  .status-dot {
    width: 6px;
    height: 6px;
    background: ${theme.colors.status.success};
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: ${theme.radius.md}px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
`;

const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${theme.colors.primary.gradient};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.primary.contrast};
  font-weight: ${theme.typography.fontWeight.bold};
  font-size: ${theme.typography.fontSize.sm};
`;

const LogoutButton = styled.button`
  background: ${theme.colors.status.errorGradient};
  color: #FFFFFF;
  border: none;
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.md}px ${theme.spacing.xl}px;
  font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal} ${theme.transitions.easing.default};
  box-shadow: ${theme.shadows.button};
  transform: ${theme.transforms.button3D};
  position: relative;
  z-index: 2;

  &:hover {
    background: ${theme.colors.status.error};
    transform: ${theme.transforms.buttonHover3D};
    box-shadow: ${theme.shadows.buttonHover};
  }

  &:active {
    transform: ${theme.transforms.buttonActive3D};
    box-shadow: ${theme.shadows.buttonActive};
  }
`;

const Logo = styled.img`
  height: 80px;
  object-fit: contain;
  filter: drop-shadow(${theme.shadows.md});
  transition: all ${theme.transitions.normal};
  position: relative;
  z-index: 2;

  &:hover {
    filter: drop-shadow(${theme.shadows.lg});
    transform: scale(1.05);
  }
`;

const ThemeToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: ${theme.radius.md}px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.10);
  color: #ffffff;
  cursor: pointer;
  font-size: 18px;
  transition: all ${theme.transitions.normal};
  backdrop-filter: blur(8px);
  flex-shrink: 0;

  &:hover {
    background: rgba(255,255,255,0.20);
    border-color: rgba(255,255,255,0.30);
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const Header = ({ user, onLogout, onLogin, onSignup }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <HeaderContainer className="animate-fade-in">
      <ContentWrapper>
        <LeftSection>
          <TitleSection>
            <Subtitle style={{ fontSize: '16px', fontWeight: 600 }}>
              The AI-Driven Global Trade Automation & Customs Platform
            </Subtitle>
            <Subtitle style={{ fontSize: '11px', opacity: 0.85, marginTop: '6px' }}>
              (A product of SPECTRA AI PTE. LTD., Singapore)
            </Subtitle>
          </TitleSection>
        </LeftSection>

        <HeaderActions>
          <ThemeToggle
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </ThemeToggle>

          {user ? (
            <LogoutButton onClick={onLogout}>
              Sign Out
            </LogoutButton>
          ) : (
            <AuthButtons>
              <AuthButton onClick={onLogin}>
                Login
              </AuthButton>
              <AuthButton primary onClick={onSignup}>
                Sign Up
              </AuthButton>
            </AuthButtons>
          )}
        </HeaderActions>
      </ContentWrapper>
    </HeaderContainer>
  );
};

export default Header;
