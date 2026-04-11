/**
 * MainLayout Component
 *
 * Legacy shell wrapper kept in sync with the redesigned layout system.
 */

import React from 'react';
import { Layout } from '../layout/Layout';

const MainLayout = ({
  children,
  activePage,
  onPageChange,
  user,
  onLogout,
}) => {
  return (
    <Layout
      activeItem={activePage}
      onNavigate={onPageChange}
      user={user}
      onLogout={onLogout}
    >
      {children}
    </Layout>
  );
};

export default MainLayout;
