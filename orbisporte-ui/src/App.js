import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginUser, logoutUser } from './store/authSlice';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/features/Dashboard';
import { DocumentUpload } from './components/features/DocumentUpload';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Badge } from './components/ui/Badge';

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

function PlaceholderPage({ title, description }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <p className="text-text-secondary mt-1">{description}</p>
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

function App() {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [activePage, setActivePage] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login');

  const handleLogin = async (credentials) => {
    try {
      await dispatch(loginUser(credentials)).unwrap();
    } catch (error) {
      throw error;
    }
  };

  const handleSignup = async (formData) => {
    try {
      setAuthMode('login');
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={setActivePage} />;
      case 'documents':
      case 'documents-upload':
        return <DocumentUpload onNavigate={setActivePage} />;
      case 'hs-codes':
        return (
          <PlaceholderPage 
            title="HS Code Lookup" 
            description="AI-powered HS code classification and search"
          />
        );
      case 'duty-calculator':
        return (
          <PlaceholderPage 
            title="Duty Calculator" 
            description="Calculate import duties and taxes"
          />
        );
      case 'boe-filing':
        return (
          <PlaceholderPage 
            title="BoE Filing" 
            description="File Bill of Entry to ICEGATE"
          />
        );
      case 'shipment-tracking':
        return (
          <PlaceholderPage 
            title="Shipment Tracking" 
            description="Real-time shipment monitoring"
          />
        );
      case 'fraud-detection':
        return (
          <PlaceholderPage 
            title="Fraud Detection" 
            description="AI-powered anomaly detection"
          />
        );
      case 'risk-scoring':
        return (
          <PlaceholderPage 
            title="Risk Scoring" 
            description="Shipment risk assessment"
          />
        );
      case 'compliance':
        return (
          <PlaceholderPage 
            title="Compliance" 
            description="Regulatory compliance checking"
          />
        );
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
        return <Dashboard onNavigate={setActivePage} />;
    }
  };

  if (!isAuthenticated) {
    if (authMode === 'login') {
      return (
        <LoginScreen 
          onLogin={handleLogin} 
          onSwitchToSignup={() => setAuthMode('signup')}
        />
      );
    }
    return (
      <SignupScreen 
        onSignup={handleSignup} 
        onBack={() => setAuthMode('login')}
      />
    );
  }

  return (
    <Layout
      activeItem={activePage}
      onNavigate={setActivePage}
      user={user}
      onLogout={handleLogout}
    >
      {renderPage()}
    </Layout>
  );
}

export default App;