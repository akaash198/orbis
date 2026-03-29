/**
 * App.js - Main Application Component
 * 
 * Authentication-enabled application with proper login/logout flow.
 */

import React, { useState, useEffect } from 'react';
import { ThemeProvider } from 'styled-components';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store/store';
import { loginUser, signupUser, logoutUser, updateUser, validateToken } from './store/authSlice';
import { DocumentProvider } from './contexts/DocumentContext';
import MainLayout from './components/layouts/MainLayout';
import DocumentPanel from './components/panels/DocumentPanel';
import CustomsPanel from './components/panels/CustomsPanel';
import HSCodePanel from './components/panels/HSCodePanel';
import QAPanel from './components/panels/QAPanel';
import DashboardPanel from './components/panels/DashboardPanel';
import SettingsPanel from './components/panels/SettingsPanel';
import DutyCalculatorPanel from './components/panels/DutyCalculatorPanel';
import InvoiceDutyPanel from './components/panels/InvoiceDutyPanel';
import BillOfEntryPanel from './components/panels/BillOfEntryPanel';
import NotificationsPanel from './components/panels/NotificationsPanel';
import HSNECCNPanel from './components/panels/HSNECCNPanel';
import IntegrationFilingPanel from './components/panels/IntegrationFilingPanel';
import ClearanceDecisionPanel from './components/panels/ClearanceDecisionPanel';
import TradeFraudPanel from './components/panels/TradeFraudPanel';
import RiskScoringPanel from './components/panels/RiskScoringPanel';
import CompliancePanel from './components/panels/CompliancePanel';
import RegulatoryTariffPanel from './components/panels/RegulatoryTariffPanel';
import ShipmentTrackingPanel from './components/panels/ShipmentTrackingPanel';
import InstantAlertsPanel from './components/panels/InstantAlertsPanel';
import CustomsEstimatesPanel from './components/panels/CustomsEstimatesPanel';
import HistoryReportsPanel from './components/panels/HistoryReportsPanel';
import AIGovernancePanel from './components/panels/AIGovernancePanel';
import DataIntakePanel from './components/panels/DataIntakePanel';
import LoginForm from './components/auth/LoginForm';
import SignupForm from './components/auth/SignupForm';
import OrbisporteLanding from './components/OrbisporteLanding';
import GlobalStyles from './styles/globalStyles';
import theme from './styles/theme';
import { ThemeContextProvider } from './contexts/ThemeContext';

// Main App Content Component (without DocumentContext - will wrap later)
function AppContentInner() {
  const dispatch = useDispatch();
  const { user, isLoading, error, isAuthenticated } = useSelector((state) => state.auth);
  const [activePage, setActivePage] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [showLanding, setShowLanding] = useState(true); // Show landing page by default
  const [tokenValidationAttempted, setTokenValidationAttempted] = useState(false);
  const [extractedDocuments, setExtractedDocuments] = useState([]); // Store all extracted documents with items
  const [pendingDocument, setPendingDocument] = useState(null); // Document passed from DataIntakePanel

  // Version indicator - check console to verify new code is loaded
  console.log('[App] VERSION 3.0 - Multi-document HSN lookup with user selection');

  // Safety mechanism: Force reset isLoading if it stays true for too long (15 seconds)
  // This prevents UI from getting stuck on loading screen indefinitely
  useEffect(() => {
    if (isLoading) {
      console.log('[App] isLoading is true, setting 15-second safety timeout...');
      const safetyTimeout = setTimeout(() => {
        console.error('[App] SAFETY TIMEOUT: isLoading stuck at true for 15 seconds! Force logging out...');
        // Force logout to reset state
        dispatch(logoutUser());
        setShowLanding(true);
        alert('Session timeout. Please log in again.');
      }, 15000); // 15 seconds

      return () => {
        console.log('[App] isLoading reset to false, clearing safety timeout');
        clearTimeout(safetyTimeout);
      };
    }
  }, [isLoading, dispatch]);

  // Function to handle page content based on active tab
  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPanel onPageChange={handlePageChange} />;
      case 'data-intake':
        return <DataIntakePanel onPageChange={handlePageChange} />;
      case 'document':
        return <DocumentPanel onExtractedItems={handleExtractedItems} pendingDocument={pendingDocument} onClearPending={() => setPendingDocument(null)} />;
      case 'invoice-duty':
        return <InvoiceDutyPanel onExtractedItems={handleExtractedItems} />;
      case 'boe':
        return <BillOfEntryPanel />;
      case 'customs':
        return <CustomsPanel />;
      case 'hs':
      case 'hsn-eccn':
        return <HSCodePanel extractedDocuments={extractedDocuments} onClearAll={() => setExtractedDocuments([])} />;

      // Duty Engine and all its sub-items
      case 'duty':
      case 'duty-cif':
      case 'duty-av':
      case 'duty-bcd':
      case 'duty-sws':
      case 'duty-add':
      case 'duty-safeguard':
      case 'duty-cvd':
      case 'duty-igst-base':
      case 'duty-integrated-gst':
      case 'duty-total':
        return <DutyCalculatorPanel activeSubItem={activePage} />;

      // Integration & Filing and all its sub-items
      case 'integration-filing':
      case 'integration-icegate':
      case 'integration-esanchit':
      case 'integration-dgft':
      case 'integration-swift':
      case 'integration-banks':
      case 'integration-global':
      case 'integration-erp':
      case 'integration-shipping':
        return <IntegrationFilingPanel activeSubItem={activePage} />;

      // Shipment Tracking and all its sub-items
      case 'shipment-tracking':
      case 'shipment-cargo':
      case 'shipment-flight':
      case 'shipment-container':
      case 'shipment-truck':
      case 'shipment-map':
        return <ShipmentTrackingPanel activeSubItem={activePage} />;

      // Instant Alerts and all its sub-items
      case 'instant-alerts':
      case 'alerts-sms':
      case 'alerts-customs':
      case 'alerts-history':
      case 'alerts-control':
      case 'alerts-ai':
        return <InstantAlertsPanel activeSubItem={activePage} />;

      case 'notifications':
        return <NotificationsPanel />;
      case 'qa':
        return <QAPanel />;
      case 'settings':
        return <SettingsPanel />;
      case 'clearance-decision':
        return <ClearanceDecisionPanel />;
      case 'trade-fraud':
        return <TradeFraudPanel />;
      case 'risk-scoring':
        return <RiskScoringPanel />;
      case 'compliance':
        return <CompliancePanel />;
      case 'regulatory-tariff':
        return <RegulatoryTariffPanel />;
      case 'customs-estimates':
        return <CustomsEstimatesPanel />;
      case 'history-reports':
        return <HistoryReportsPanel />;
      case 'ai-governance':
        return <AIGovernancePanel />;
      default:
        return <DashboardPanel onPageChange={handlePageChange} />;
    }
  };

  const handlePageChange = async (newPage, extra = null) => {
    setActivePage(newPage);
    if (extra) setPendingDocument(extra);
  };

  const handleExtractedItems = (items, documentName = 'Unnamed Document') => {
    console.log('[App] Extracted items received from', documentName, ':', items.length, 'items');

    // Add new document with its items to the list
    const newDocument = {
      id: Date.now(), // Unique ID
      name: documentName,
      timestamp: new Date().toISOString(),
      items: items.map((item, index) => ({
        ...item,
        documentId: Date.now(),
        documentName: documentName,
        itemIndex: index
      }))
    };

    setExtractedDocuments(prev => [...prev, newDocument]);

    // Navigate to HSN/ECCN panel to show all documents
    setActivePage('hsn-eccn');
  };

  const handleLogin = async (credentials) => {
    // credentials: { user_name, password }
    console.log('[App] handleLogin called with:', { user_name: credentials.user_name });
    try {
      const result = await dispatch(loginUser(credentials)).unwrap();
      console.log('[App] Login successful:', result);
      return result;
    } catch (error) {
      console.error('[App] Login failed:', error);
      // Redux rejectWithValue sends a plain string; wrap it so LoginForm can display it.
      if (typeof error === 'string') {
        throw { message: error, response: null };
      }
      throw error;
    }
  };

  const handleSignup = async (userData) => {
    console.log('[App] handleSignup called with:', userData);
    try {
      // Dispatch signup action
      await dispatch(signupUser(userData)).unwrap();
      console.log('[App] Signup successful');
      // After successful signup, user can login
      setAuthMode('login');
      return { success: true };
    } catch (error) {
      console.error('[App] Signup failed:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    setShowLanding(true); // Return to landing page after logout
    // Note: Files will be cleared when DocumentProvider remounts
  };

  const handleShowLogin = () => {
    setAuthMode('login');
    setShowLanding(false);
  };

  const handleShowSignup = () => {
    setAuthMode('signup');
    setShowLanding(false);
  };

  const handleBackToLanding = () => {
    setShowLanding(true);
  };

  // Effect to validate token ONLY ONCE when app mounts with existing user (from localStorage)
  // This runs silently in background and doesn't block UI
  useEffect(() => {
    // Only run this ONCE on component mount
    if (user && isAuthenticated && !tokenValidationAttempted) {
      console.log('[App] Found existing user on mount, validating token...');
      setTokenValidationAttempted(true);

      const validateOnMount = async () => {
        try {
          await dispatch(validateToken()).unwrap();
          console.log('[App] Token validation successful');
        } catch (error) {
          console.log('[App] Token validation failed, logging out:', error);
          // Token is invalid, logout automatically
          dispatch(logoutUser());
          setShowLanding(true);
        }
      };
      validateOnMount();
    } else if (!user || !isAuthenticated) {
      // User logged out, reset validation flag
      setTokenValidationAttempted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated]); // Run when user or auth status changes

  // Effect to listen for token expiration events
  useEffect(() => {
    const handleTokenExpired = (event) => {
      console.log('[App] Token expired event received:', event.detail);
      dispatch(logoutUser());
      setShowLanding(true);
      setTokenValidationAttempted(false);
      // Show user-friendly message
      alert(event.detail.message || 'Your session has expired. Please log in again.');
    };

    window.addEventListener('tokenExpired', handleTokenExpired);

    return () => {
      window.removeEventListener('tokenExpired', handleTokenExpired);
    };
  }, [dispatch]);

  // Effect to validate token on page visibility change (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && user && isAuthenticated) {
        // User returned to the tab, re-validate token silently
        try {
          await dispatch(validateToken()).unwrap();
          console.log('[App] Token re-validated on tab focus');
        } catch (error) {
          console.log('[App] Token validation failed on tab focus, logging out:', error);
          dispatch(logoutUser());
          setShowLanding(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isAuthenticated, dispatch]);

  // Do NOT replace the login/landing UI with a loading screen while login is in progress.
  // The login form already shows "Signing In..." on its button, which is enough feedback.
  // Showing a blank loading screen here caused the form to unmount, losing error state
  // and making users think nothing was happening (hence needing 5-6 clicks).

  // Show landing page if not logged in and showLanding is true
  if (!user && showLanding) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <OrbisporteLanding onLogin={handleLogin} onSignup={handleSignup} />
      </ThemeProvider>
    );
  }

  // Show authentication forms if user is not logged in and showLanding is false
  if (!user && !showLanding) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        {authMode === 'login' ? (
          <LoginForm 
            onSwitchToSignup={() => setAuthMode('signup')}
            onLogin={handleLogin}
            onBackToLanding={handleBackToLanding}
          />
        ) : (
          <SignupForm 
            onSwitchToLogin={() => setAuthMode('login')}
            onSignup={handleSignup}
            onBackToLanding={handleBackToLanding}
          />
        )}
      </ThemeProvider>
    );
  }

  // Show main application if user is logged in
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <MainLayout
        activePage={activePage}
        onPageChange={handlePageChange}
        user={user}
        onLogout={handleLogout}
        onLogin={handleShowLogin}
        onSignup={handleShowSignup}
      >
        {renderContent()}
      </MainLayout>
    </ThemeProvider>
  );
}

// Wrapper component that provides DocumentContext
function AppContent() {
  const { user } = useSelector((state) => state.auth);

  // Only provide DocumentContext when user is logged in
  // This ensures files are cleared when user logs out
  if (!user) {
    return <AppContentInner />;
  }

  return (
    <DocumentProvider>
      <AppContentInner />
    </DocumentProvider>
  );
}

// Main App Component with Redux Provider
function App() {
  return (
    <ThemeContextProvider>
    <Provider store={store}>
      <PersistGate
        loading={
          <ThemeProvider theme={theme}>
            <GlobalStyles />
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              height: '100vh',
              fontSize: '1.5rem',
              color: theme.colors.text.primary
            }}>
              <div>Loading...</div>
              <div style={{ fontSize: '0.8rem', marginTop: '10px', color: theme.colors.text.secondary }}>
                (PersistGate rehydrating)
              </div>
            </div>
          </ThemeProvider>
        }
        persistor={persistor}
      >
        <AppContent />
      </PersistGate>
    </Provider>
    </ThemeContextProvider>
  );
}

export default App;