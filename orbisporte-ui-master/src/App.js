import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginUser, logoutUser, signupUser, validateToken } from './store/authSlice';
import { Layout } from './components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Badge } from './components/ui/Badge';
import { ToastProvider, useToast } from './components/ui';
import AuthFlow from './components/auth/AuthFlow';
import FeaturePage from './components/features/FeaturePage';

const Dashboard = lazy(() =>
  import('./components/features/Dashboard').then((module) => ({ default: module.Dashboard }))
);

const DocumentUpload = lazy(() =>
  import('./components/features/DocumentUpload').then((module) => ({ default: module.DocumentUpload }))
);

const HSCodePanel = lazy(() =>
  import('./components/panels/HSCodePanel').then((module) => ({ default: module.default }))
);

const DataIntakePage = lazy(() =>
  import('./components/features/DataIntakePage').then((module) => ({ default: module.DataIntakePage }))
);

const M02ExtractionPage = lazy(() =>
  import('./components/features/M02ExtractionPage').then((module) => ({ default: module.M02ExtractionPage }))
);

function LoginScreen({ onLogin, onSwitchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onLogin({ user_name: email, password });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4 shadow-glow-lg">
            <span className="text-3xl">🌐</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">ORBISPORTÉ</h1>
          <p className="text-text-secondary mt-2">AI-Powered Customs Platform</p>
        </div>

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-center">Welcome Back</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" loading={loading}>
                Sign In
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-text-secondary text-sm">
                Don't have an account?{' '}
                <button 
                  onClick={onSwitchToSignup}
                  className="text-primary-400 hover:underline"
                >
                  Sign up
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-text-muted">
            By signing in, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}

function SignupScreen({ onSignup, onBack }) {
  const [formData, setFormData] = useState({
    user_name: '',
    email: '',
    password: '',
    company_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSignup(formData);
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4 shadow-glow-lg">
            <span className="text-3xl">🌐</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">ORBISPORTÉ</h1>
          <p className="text-text-secondary mt-2">Create your account</p>
        </div>

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-center">Sign Up</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Enter your name"
                value={formData.user_name}
                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <Input
                label="Company Name"
                placeholder="Enter company name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
              {error && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" loading={loading}>
                Create Account
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-text-secondary text-sm">
                Already have an account?{' '}
                <button onClick={onBack} className="text-primary-400 hover:underline">
                  Sign in
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

void LoginScreen;
void SignupScreen;

function PlaceholderPage({ title, description }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="info">Coming Soon</Badge>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          <p className="text-text-secondary mt-1">{description}</p>
        </div>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-glass flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚧</span>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Coming Soon</h3>
          <p className="text-text-secondary">This module is under development</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PageLoadingState({ label }) {
  return (
    <Card className="animate-pulse" role="status" aria-live="polite" aria-label={label}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-4 w-1/2 rounded bg-surface-subtle" />
        <div className="h-4 w-3/4 rounded bg-surface-subtle" />
        <div className="h-32 rounded-2xl bg-surface-subtle" />
      </CardContent>
    </Card>
  );
}

function AppContent() {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [activePage, setActivePage] = useState('dashboard');
  const [navParams, setNavParams] = useState({});

  const handleNavigate = (page, params = {}) => {
    setActivePage(page);
    setNavParams(params);
  };
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const prefetch = () => {
      void import('./components/features/Dashboard');
      void import('./components/features/DocumentUpload');
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(prefetch, { timeout: 1500 });
      return () => window.cancelIdleCallback(handle);
    }

    const timer = window.setTimeout(prefetch, 300);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let cancelled = false;

    const validateSession = async () => {
      try {
        await dispatch(validateToken()).unwrap();
      } catch (_) {
        if (cancelled) return;
        dispatch(logoutUser());
        toast({
          title: 'Session expired',
          description: 'Please sign in again.',
          variant: 'error',
        });
      }
    };

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isAuthenticated, toast]);

  useEffect(() => {
    const handleTokenExpired = () => {
      dispatch(logoutUser());
      toast({
        title: 'Session expired',
        description: 'Please sign in again.',
        variant: 'error',
      });
    };

    window.addEventListener('tokenExpired', handleTokenExpired);
    return () => {
      window.removeEventListener('tokenExpired', handleTokenExpired);
    };
  }, [dispatch, toast]);

  const handleLogin = async (credentials) => {
    try {
      await dispatch(loginUser(credentials)).unwrap();
      toast({
        title: 'Signed in',
        description: 'Your session is ready.',
        variant: 'success',
      });
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/');
      }
    } catch (error) {
      toast({
        title: 'Login failed',
        description: error.message || 'Please check your credentials and try again.',
        variant: 'error',
        duration: 7000,
      });
      throw error;
    }
  };

  const handleSignup = async (formData) => {
    try {
      await dispatch(signupUser(formData)).unwrap();
      toast({
        title: 'Account ready',
        description: 'Your account is ready to use.',
        variant: 'success',
      });
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/');
      }
    } catch (error) {
      toast({
        title: 'Signup failed',
        description: error.message || 'Please check the form and try again.',
        variant: 'error',
      });
      throw error;
    }
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    toast({
      title: 'Signed out',
      description: 'Your session has been closed.',
      variant: 'default',
    });
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/auth/login');
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'data-intake':
        return <DataIntakePage onNavigate={handleNavigate} />;
      case 'm02-extraction':
        return <M02ExtractionPage onNavigate={handleNavigate} initialDocumentId={navParams?.documentId} autoExtract={navParams?.autoExtract} />;
      case 'documents':
      case 'documents-upload':
        return <DocumentUpload onNavigate={handleNavigate} initialDocumentId={navParams.documentId} />;
      case 'hs-codes':
        return <HSCodePanel onPageChange={handleNavigate} onNavigate={handleNavigate} initialHsnCode={navParams.hsnCode} initialDescription={navParams.goodsDesc} navigationKey={navParams.navigationKey} initialDocumentId={navParams.documentId} />;
      case 'duty-calculator':
        return <FeaturePage pageId="duty-calculator" onNavigate={handleNavigate} navParams={navParams} />;
      case 'boe-filing':
        return <FeaturePage pageId="boe-filing" onNavigate={handleNavigate} navParams={navParams} />;
      case 'shipment-tracking':
        return <FeaturePage pageId="shipment-tracking" />;
      case 'fraud-detection':
        return <FeaturePage pageId="fraud-detection" />;
      case 'risk-scoring':
        return <FeaturePage pageId="risk-scoring" />;
      case 'compliance':
        return <FeaturePage pageId="compliance" />;
      case 'ai-governance':
        return (
          <PlaceholderPage 
            title="AI Governance" 
            description="Monitor AI model performance"
          />
        );
      case 'alerts':
        return (
          <PlaceholderPage 
            title="Alerts" 
            description="Customs and duty alerts"
          />
        );
      case 'notifications':
        return (
          <PlaceholderPage
            title="Notification Tracking"
            description="Track customs notices and rate updates"
          />
        );
      case 'qa':
        return (
          <PlaceholderPage 
            title="Q&A Assistant" 
            description="Ask questions about your documents"
          />
        );
      case 'settings':
        return (
          <PlaceholderPage 
            title="Settings" 
            description="Manage your account and preferences"
          />
        );
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  if (!isAuthenticated) {
    return <AuthFlow onLogin={handleLogin} onSignup={handleSignup} toast={toast} />;
  }

  return (
    <Layout
      activeItem={activePage}
      onNavigate={handleNavigate}
      user={user}
      onLogout={handleLogout}
    >
      <Suspense fallback={<PageLoadingState label="Loading page" />}>
        {renderPage()}
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
