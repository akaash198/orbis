/**
 * MainLayout Component
 * 
 * The main layout of the application, including sidebar and content area.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import Sidebar from './Sidebar';
import Header from './Header';

const LayoutWrapper = styled.div`
  height: 100vh;
  display: flex;
  overflow: hidden;
  position: relative;
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: ${props => props.$sidebarCollapsed ? '72px' : '280px'};
  margin-top: 70px;
  overflow: hidden;
  background: ${props => props.theme.colors.ui.background};
  position: relative;
  transition: margin-left ${props => props.theme.transitions.normal};
`;

const PageContent = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${props => props.theme.spacing.xxl}px;
  position: relative;
  z-index: 1;
`;

const MainLayout = ({ children, activePage, onPageChange, user, onLogout, onLogin, onSignup }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <LayoutWrapper>
      <Header user={user} onLogout={onLogout} onLogin={onLogin} onSignup={onSignup} />
      <Sidebar
        active={activePage}
        onSelect={onPageChange}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      <ContentArea $sidebarCollapsed={sidebarCollapsed}>
        <PageContent>{children}</PageContent>
      </ContentArea>
    </LayoutWrapper>
  );
};

export default MainLayout;
