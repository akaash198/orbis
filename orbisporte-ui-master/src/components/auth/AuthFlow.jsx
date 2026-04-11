/**
 * AuthFlow — Complete redesign per ORBISPORTÉ v1.0 Design Guide
 * Layout: 50/50 split (Brand aside left, Form right) on desktop
 * Colors: Gold palette (#C9A520), Dark backgrounds (#0A0D14 → #161D2C)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const AUTH_KEY = 'orbisporte.auth.email';

const isValidEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v || '').trim());

const parseAuthLocation = () => {
  if (typeof window === 'undefined') return { view: 'login', token: '', email: '' };
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const params   = new URLSearchParams(window.location.search);
  const email    = params.get('email') || localStorage.getItem(AUTH_KEY) || '';
  const token    = params.get('token') || '';

  if (pathname.endsWith('/auth/signup'))          return { view: 'signup',         token, email };
  if (pathname.endsWith('/auth/forgot-password')) return { view: 'forgot-password', token, email };
  if (pathname.endsWith('/auth/reset-password'))  return { view: 'reset-password',  token, email };
  if (pathname.endsWith('/auth/verify-email'))    return { view: 'verify-email',    token, email };
  if (pathname.endsWith('/auth/email-verified'))  return { view: 'email-verified',  token, email };
  return { view: 'login', token, email };
};

const viewToPath = (view, opts = {}) => {
  switch (view) {
    case 'signup':          return '/auth/signup';
    case 'forgot-password': return '/auth/forgot-password';
    case 'reset-password':  return `/auth/reset-password?token=${encodeURIComponent(opts.token || '')}`;
    case 'verify-email':    return `/auth/verify-email${opts.email ? `?email=${encodeURIComponent(opts.email)}` : ''}`;
    case 'email-verified':  return '/auth/email-verified';
    default:                return '/auth/login';
  }
};

const goTo = (view, opts = {}) => {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', viewToPath(view, opts));
};

const splitName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const fmtCountdown = (s) => {
  const n = Math.max(0, Math.floor(s));
  const m = Math.floor(n / 60);
  return `${m}:${String(n % 60).padStart(2, '0')}`;
};

const getPasswordChecks = (pw) => {
  const v = String(pw || '');
  const checks = {
    length:  v.length >= 8,
    upper:   /[A-Z]/.test(v),
    number:  /[0-9]/.test(v),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(v),
  };
  return { checks, score: Object.values(checks).filter(Boolean).length };
};

const getStrengthMeta = (score) => {
  if (score <= 1) return { label: 'Weak',   color: '#E05656' };
  if (score === 2) return { label: 'Fair',   color: '#E8934A' };
  if (score === 3) return { label: 'Good',   color: '#3DBE7E' };
  return              { label: 'Strong', color: '#C9A520' };
};

const normalizeError = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((i) => i.msg || String(i)).join(', ');
  if (typeof detail === 'string') return detail;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.code === 'ERR_NETWORK' || (!err.response && err.request)) return 'Connection failed. Try again.';
  return err.message || fallback;
};

// ── Design tokens (inline, from guide) ───────────────────────────────────────
const C = {
  bgPage:    '#0A0D14',
  bgPanel:   '#111620',
  bgSurface: '#161D2C',
  bgOverlay: '#1C2438',
  bgInset:   '#0D1020',

  borderSubtle:  '#1E2638',
  borderDefault: '#273047',
  borderStrong:  '#344060',
  borderAccent:  '#C9A520',

  gold:      '#C9A520',
  goldLight: '#E8C84A',
  goldHover: '#A88A18',
  goldMuted: 'rgba(201,165,32,0.10)',
  goldBorder:'rgba(201,165,32,0.28)',
  goldGlow:  'rgba(201,165,32,0.25)',

  textPrimary:   '#E2E8F5',
  textSecondary: '#8B97AE',
  textTertiary:  '#4A5A72',
  textInverse:   '#0A0D14',

  success:       '#3DBE7E',
  successDim:    'rgba(61,190,126,0.12)',
  successBorder: 'rgba(61,190,126,0.28)',
  successText:   '#5AD49A',

  error:         '#E05656',
  errorDim:      'rgba(224,86,86,0.12)',
  errorBorder:   'rgba(224,86,86,0.28)',
  errorText:     '#F07070',

  warning:       '#E8934A',
  warningDim:    'rgba(232,147,74,0.12)',
  warningBorder: 'rgba(232,147,74,0.28)',
  warningText:   '#F5A96A',

  info:          '#6BBCD4',
  infoDim:       'rgba(107,188,212,0.12)',
  infoBorder:    'rgba(107,188,212,0.28)',
  infoText:      '#8DD4EC',
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function Btn({ children, onClick, type = 'button', loading = false, disabled = false, variant = 'primary', fullWidth = false, size = 'md' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold border transition-all duration-150 cursor-pointer select-none';
  const sz = size === 'lg' ? 'h-12 px-6 text-[15px]' : size === 'sm' ? 'h-8 px-4 text-[12px]' : 'h-10 px-5 text-[14px]';
  const v = {
    primary:   `bg-[${C.gold}] text-[${C.textInverse}] border-[${C.gold}] hover:bg-[${C.goldLight}] hover:border-[${C.goldLight}] active:bg-[${C.goldHover}]`,
    secondary: `bg-transparent text-[${C.goldLight}] border-[${C.goldBorder}] hover:bg-[${C.goldMuted}]`,
    ghost:     `bg-transparent text-[${C.textSecondary}] border-transparent hover:bg-white/[0.04] hover:text-[${C.textPrimary}]`,
    danger:    `bg-[${C.errorDim}] text-[${C.errorText}] border-[${C.errorBorder}] hover:bg-[rgba(224,86,86,0.20)]`,
  };
  const dis = disabled || loading ? 'opacity-40 cursor-not-allowed pointer-events-none' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sz} ${fullWidth ? 'w-full' : ''} ${dis}`}
      style={
        variant === 'primary'
          ? { background: C.gold, color: C.textInverse, borderColor: C.gold }
          : variant === 'secondary'
          ? { background: 'transparent', color: C.goldLight, borderColor: C.goldBorder }
          : variant === 'ghost'
          ? { background: 'transparent', color: C.textSecondary, borderColor: 'transparent' }
          : { background: C.errorDim, color: C.errorText, borderColor: C.errorBorder }
      }
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}

function FormInput({ label, type = 'text', placeholder, value, onChange, error, hint, required = false, rightElement }) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <div>
      {label && (
        <label className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold" style={{ color: C.textSecondary }}>
          {label}
          {required && <span style={{ color: C.errorText }}>*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-lg border bg-[#0D1020] text-[15px] outline-none transition-all duration-150 placeholder:text-[#4A5A72]"
          style={{
            height: '44px',
            padding: rightElement ? '0 44px 0 16px' : '0 16px',
            color: C.textPrimary,
            borderColor: hasError ? C.error : focused ? C.gold : C.borderDefault,
            boxShadow: hasError
              ? `0 0 0 3px rgba(224,86,86,0.15)`
              : focused
              ? `0 0 0 3px ${C.goldGlow}`
              : 'none',
            background: focused ? `rgba(201,165,32,0.03)` : C.bgInset,
          }}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightElement}</div>
        )}
      </div>
      {hint && !error && <p className="mt-1.5 text-[11px]" style={{ color: C.textTertiary }}>{hint}</p>}
      {error && (
        <p className="mt-1.5 text-[11px]" style={{ color: C.errorText }}>
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordInput({ label, value, onChange, placeholder, error, hint, required = true }) {
  const [visible, setVisible] = useState(false);
  return (
    <FormInput
      label={label}
      type={visible ? 'text' : 'password'}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      error={error}
      hint={hint}
      required={required}
      rightElement={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          style={{ color: C.textTertiary }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.textSecondary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textTertiary)}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

function AlertBox({ variant = 'error', children }) {
  const cfg = {
    error:   { bg: C.errorDim,   border: C.errorBorder,   leftBorder: C.error,   text: C.errorText   },
    success: { bg: C.successDim, border: C.successBorder, leftBorder: C.success, text: C.successText },
    warning: { bg: C.warningDim, border: C.warningBorder, leftBorder: C.warning, text: C.warningText },
    info:    { bg: C.infoDim,    border: C.infoBorder,    leftBorder: C.info,    text: C.infoText    },
  };
  const c = cfg[variant] || cfg.error;
  return (
    <div
      className="flex items-start gap-3 rounded-lg p-3 text-[13px]"
      style={{ background: c.bg, borderLeft: `3px solid ${c.leftBorder}`, border: `1px solid ${c.border}`, color: c.text }}
    >
      {children}
    </div>
  );
}

function Checkbox({ label, checked, onChange, error }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-[13px]" style={{ color: C.textSecondary }}>
        <div className="relative mt-0.5 flex-shrink-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="h-4 w-4 cursor-pointer appearance-none rounded border transition-all"
            style={{
              borderColor: checked ? C.gold : C.borderDefault,
              background: checked ? C.gold : C.bgInset,
            }}
          />
          {checked && (
            <svg
              className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-[#0A0D14]"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="leading-relaxed">{label}</span>
      </label>
      {error && <p className="mt-1 text-[11px]" style={{ color: C.errorText }}>{error}</p>}
    </div>
  );
}

// ── Brand aside features ──────────────────────────────────────────────────────
const FEATURES = [
  { icon: ShieldCheck,  text: 'Real-time compliance monitoring' },
  { icon: Zap,          text: 'AI-powered document insights'    },
  { icon: TrendingUp,   text: 'Risk-managed trade workflows'    },
  { icon: Truck,        text: '24/7 live shipment tracking'     },
];

// ── Auth Shell: 50/50 split layout per guide ──────────────────────────────────
function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen" style={{ background: C.bgPage }}>
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* ── Left: Brand Aside (hidden on mobile) ── */}
        <aside
          className="relative hidden overflow-hidden lg:flex lg:flex-col"
          style={{
            background: `radial-gradient(circle at top left, rgba(201,165,32,0.10), transparent 32%), linear-gradient(180deg, ${C.bgPanel} 0%, ${C.bgInset} 100%)`,
            borderRight: `1px solid ${C.borderSubtle}`,
          }}
        >
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(107,188,212,0.06),transparent_36%)]" />

          <div className="relative flex flex-1 flex-col justify-center gap-10 p-10 xl:p-12">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: C.gold }}>
                <Globe className="h-6 w-6" style={{ color: C.textInverse }} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.20em]" style={{ color: C.textTertiary }}>
                  Enterprise Platform
                </p>
                <p className="text-[20px] font-bold" style={{ color: C.textPrimary }}>
                  ORBISPORT<span style={{ color: C.gold }}>É</span>
                </p>
              </div>
            </div>

            {/* Value proposition */}
            <div className="max-w-sm space-y-6">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px]"
                style={{ background: C.goldMuted, border: `1px solid ${C.goldBorder}`, color: C.goldLight }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI-Powered Customs Operations</span>
              </div>

              <h1
                className="text-[38px] font-bold leading-[1.1] tracking-tight"
                style={{ color: C.textPrimary }}
              >
                Secure access to the{' '}
                <span style={{ color: C.gold }}>customs</span>{' '}
                control tower.
              </h1>

              <p className="text-[15px] leading-relaxed" style={{ color: C.textSecondary }}>
                A focused onboarding experience for trade teams, compliance operators, and platform administrators.
              </p>
            </div>

            {/* Feature checklist */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${C.borderSubtle}`,
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: C.gold }} aria-hidden="true" />
                  <span className="text-[13px] font-medium" style={{ color: C.textPrimary }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px]" style={{ color: C.textTertiary }}>
              <span>© 2024 Orbisporté</span>
              <span>Built for enterprise customs operations</span>
            </div>
          </div>
        </aside>

        {/* ── Right: Form ── */}
        <main className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-[560px]">
            {/* Mobile logo */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: C.gold }}>
                <Globe className="h-5 w-5" style={{ color: C.textInverse }} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.20em]" style={{ color: C.textTertiary }}>
                  Orbisporté
                </p>
                <p className="text-[14px] font-semibold" style={{ color: C.textPrimary }}>
                  Trade operations platform
                </p>
              </div>
            </div>

            {/* Card */}
            <div
              className="w-full overflow-hidden rounded-2xl"
              style={{
                background: C.bgSurface,
                border: `1px solid ${C.borderSubtle}`,
                boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              }}
            >
              <div className="p-6 sm:p-8">
                {/* Card header */}
                <div className="mb-5">
                  <div
                    className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                    style={{ background: C.infoDim, border: `1px solid ${C.infoBorder}`, color: C.infoText }}
                  >
                    <Lock className="h-3 w-3" />
                    Secure onboarding
                  </div>
                  <h2 className="text-[24px] font-bold tracking-tight" style={{ color: C.textPrimary }}>
                    {title}
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: C.textSecondary }}>
                    {subtitle}
                  </p>
                </div>

                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Footer links ──────────────────────────────────────────────────────────────
function FooterLinks({ onLinkClick }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t pt-6 text-[12px]"
      style={{ borderColor: `${C.borderSubtle}60`, color: C.textTertiary }}>
      <a href="/terms" onClick={onLinkClick} className="transition-colors hover:underline"
        style={{ color: C.textTertiary }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.goldLight)}
        onMouseLeave={(e) => (e.currentTarget.style.color = C.textTertiary)}>
        Terms of Service
      </a>
      <span aria-hidden="true" className="opacity-40">•</span>
      <a href="/privacy" onClick={onLinkClick} className="transition-colors hover:underline"
        style={{ color: C.textTertiary }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.goldLight)}
        onMouseLeave={(e) => (e.currentTarget.style.color = C.textTertiary)}>
        Privacy Policy
      </a>
    </div>
  );
}

// ── Login Page ────────────────────────────────────────────────────────────────
function LoginPage({ onLogin, navigate, toast, prefilledEmail }) {
  const [email,    setEmail]    = useState(prefilledEmail || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(localStorage.getItem(AUTH_KEY)));
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => { if (prefilledEmail) setEmail(prefilledEmail); }, [prefilledEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your username or email address'); return; }
    setLoading(true);
    setError('');
    try {
      await onLogin({ user_name: email.trim().toLowerCase(), password });
      if (remember) localStorage.setItem(AUTH_KEY, email.trim().toLowerCase());
      else localStorage.removeItem(AUTH_KEY);
      toast({ title: 'Signed in', description: 'Welcome back to Orbisporté.', variant: 'success' });
      navigate('/');
    } catch (err) {
      setError(normalizeError(err, 'Invalid username, email, or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in to your account"
      subtitle="Use your username or the email address tied to your Orbisporté workspace."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <AlertBox variant="error">{error}</AlertBox>}

        <FormInput
          label="Username or Email"
          type="text"
          placeholder="testuser or your@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="You can sign in with either your username or email."
          required
        />
        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />

        {/* Remember + forgot */}
        <div className="flex items-center justify-between gap-4">
          <Checkbox
            label="Remember me"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <button
            type="button"
            onClick={() => navigate('forgot-password', { email })}
            className="text-[13px] font-medium transition-colors hover:underline"
            style={{ color: C.gold }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.goldLight)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.gold)}
          >
            Forgot password?
          </button>
        </div>

        <Btn type="submit" loading={loading} fullWidth size="lg" variant="primary">
          Sign In to Orbisporté
        </Btn>

        {/* Divider */}
        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: `${C.borderDefault}60` }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textTertiary }}>or</span>
          <div className="h-px flex-1" style={{ background: `${C.borderDefault}60` }} />
        </div>

        {/* Switch to signup */}
        <button
          type="button"
          onClick={() => navigate('signup')}
          className="group flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[13px] font-medium transition-all duration-150"
          style={{ borderColor: C.borderDefault, color: C.textSecondary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.goldBorder;
            e.currentTarget.style.color = C.goldLight;
            e.currentTarget.style.background = C.goldMuted;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.borderDefault;
            e.currentTarget.style.color = C.textSecondary;
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Don&apos;t have an account?{' '}
          <span style={{ color: C.goldLight }}>Create one</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </button>
      </form>

      <div className="mt-6">
        <FooterLinks onLinkClick={(e) => { e.preventDefault(); toast({ title: 'Documentation', description: 'Terms and privacy pages coming soon.', variant: 'info' }); }} />
      </div>
    </AuthShell>
  );
}

// ── Signup Page ───────────────────────────────────────────────────────────────
function SignupPage({ onSignup, navigate, toast, prefilledEmail }) {
  const [form, setForm] = useState({
    fullName: '', companyName: '', email: prefilledEmail || '',
    password: '', confirmPassword: '', acceptTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (prefilledEmail) setForm((f) => ({ ...f, email: prefilledEmail }));
  }, [prefilledEmail]);

  const pwMeta = useMemo(() => {
    const { checks, score } = getPasswordChecks(form.password);
    return { checks, score, strength: getStrengthMeta(score) };
  }, [form.password]);

  const set = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: v }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.acceptTerms) { setError('You must accept the Terms to continue'); return; }
    if (!isValidEmail(form.email)) { setError('Please enter a valid email address'); return; }
    if (form.password.length < 8 || pwMeta.score < 4) { setError("Password doesn't meet all requirements"); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords don't match"); return; }

    const { firstName, lastName } = splitName(form.fullName);
    setLoading(true);
    setError('');

    try {
      await onSignup({
        first_name: firstName, last_name: lastName,
        user_name:    form.email.trim().toLowerCase(),
        email_id:     form.email.trim().toLowerCase(),
        password:     form.password,
        mobile_number: null,
        role:          'importer',
        location:      form.companyName || null,
        company_name:  form.companyName || null,
      });
      localStorage.setItem(AUTH_KEY, form.email.trim().toLowerCase());
      toast({ title: 'Account created', description: 'Your workspace is ready.', variant: 'success' });
      navigate('email-verified');
    } catch (err) {
      setError(normalizeError(err, 'Failed to create account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up access for compliance, operations, and customs automation."
    >
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        {error && <AlertBox variant="error">{error}</AlertBox>}

        <div className="grid grid-cols-2 gap-3">
          <FormInput label="Full Name"     placeholder="John Doe"           value={form.fullName}     onChange={set('fullName')}     required />
          <FormInput label="Company Name"  placeholder="Acme Imports Ltd."  value={form.companyName}  onChange={set('companyName')}  required />
        </div>
        <FormInput
          label="Email Address"
          type="email"
          placeholder="your@company.com"
          value={form.email}
          onChange={set('email')}
          hint={form.email && isValidEmail(form.email) ? '✓ Email looks valid' : 'Use your work email'}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <PasswordInput
            label="Create Password"
            value={form.password}
            onChange={set('password')}
            placeholder="Create password"
          />
          <PasswordInput
            label="Confirm Password"
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            placeholder="Repeat password"
            error={form.confirmPassword && form.confirmPassword !== form.password ? "Mismatch" : ''}
          />
        </div>

        {/* Password strength - highly compact */}
        {form.password && (
          <div
            className="space-y-2 rounded-xl p-2.5"
            style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.borderSubtle}` }}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: pwMeta.strength.color }}>Strength: <strong>{pwMeta.strength.label}</strong></span>
              <div className="h-1 w-24 rounded-full overflow-hidden" style={{ background: C.borderDefault }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${(pwMeta.score / 4) * 100}%`, background: pwMeta.strength.color }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]" style={{ color: C.textSecondary }}>
              {[
                ['length',  '8+ chars'],
                ['upper',   'Uppercase'],
                ['number',  'Number'],
                ['special', 'Symbol'],
              ].map(([k, label]) => (
                <div key={k} className="flex items-center gap-1">
                  {pwMeta.checks[k]
                    ? <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: C.success }} />
                    : <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[11px] font-bold" style={{ color: C.error }}>×</span>
                  }
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Checkbox
          label={
            <span>
              I agree to the Orbisporté{' '}
              <a href="/terms" style={{ color: C.gold }}>Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" style={{ color: C.gold }}>Privacy Policy</a>
            </span>
          }
          checked={form.acceptTerms}
          onChange={set('acceptTerms')}
          error={error === 'You must accept the Terms to continue' ? error : ''}
        />

        <Btn type="submit" loading={loading} fullWidth size="lg" variant="primary">
          Create Account
        </Btn>

        <button
          type="button"
          onClick={() => navigate('login')}
          className="flex w-full items-center justify-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ color: C.textSecondary }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.goldLight)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Already have an account? Sign in
        </button>
      </form>

      <div className="mt-4">
        <FooterLinks onLinkClick={(e) => { e.preventDefault(); toast({ title: 'Documentation', description: 'Legal pages coming soon.', variant: 'info' }); }} />
      </div>
    </AuthShell>
  );
}

// ── Forgot Password ───────────────────────────────────────────────────────────
function ForgotPasswordPage({ navigate, toast, prefilledEmail }) {
  const [email,    setEmail]    = useState(prefilledEmail || '');
  const [loading,  setLoading]  = useState(false);
  const [sentTo,   setSentTo]   = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => { if (prefilledEmail) setEmail(prefilledEmail); }, [prefilledEmail]);

  useEffect(() => {
    if (!sentTo || resendIn <= 0) return;
    const t = window.setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(t);
  }, [sentTo, resendIn]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'error' });
      return;
    }
    setLoading(true);
    await new Promise((r) => window.setTimeout(r, 900));
    setSentTo(email.trim().toLowerCase());
    setResendIn(60);
    localStorage.setItem(AUTH_KEY, email.trim().toLowerCase());
    toast({ title: 'Reset link sent', description: `We sent a reset link to ${email}.`, variant: 'success' });
    setLoading(false);
  };

  return (
    <AuthShell
      title={sentTo ? 'Check your email' : 'Recover your account'}
      subtitle={sentTo ? `We sent a reset link to ${sentTo}. It expires in 24 hours.` : 'Enter the email address associated with your account.'}
    >
      {!sentTo ? (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <FormInput
            label="Email Address"
            type="email"
            placeholder="your@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Btn type="submit" loading={loading} fullWidth size="lg" variant="primary">
            Send Reset Link
          </Btn>
          <button
            type="button"
            onClick={() => navigate('login', { email })}
            className="flex w-full items-center justify-center gap-2 text-[13px] font-medium transition-colors"
            style={{ color: C.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.goldLight)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to sign in
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <AlertBox variant="success">Reset link sent — check your inbox and spam folder.</AlertBox>
          <div
            className="flex items-center gap-4 rounded-xl p-4"
            style={{ background: C.bgOverlay, border: `1px solid ${C.borderSubtle}` }}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: C.successDim }}>
              <Mail className="h-6 w-6" style={{ color: C.success }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: C.textPrimary }}>Check your inbox</p>
              <p className="text-[12px]" style={{ color: C.textSecondary }}>{sentTo}</p>
            </div>
          </div>
          <Btn
            variant="secondary"
            fullWidth
            disabled={resendIn > 0 || loading}
            onClick={async () => {
              setLoading(true);
              await new Promise((r) => window.setTimeout(r, 700));
              setResendIn(60);
              toast({ title: 'Link resent', description: `Another link was sent to ${sentTo}.`, variant: 'success' });
              setLoading(false);
            }}
          >
            {resendIn > 0 ? `Resend in ${fmtCountdown(resendIn)}` : 'Resend Reset Link'}
          </Btn>
          <button
            type="button"
            onClick={() => navigate('login', { email: sentTo })}
            className="flex w-full items-center justify-center text-[13px] font-medium transition-colors"
            style={{ color: C.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.goldLight)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
          >
            Return to sign in
          </button>
        </div>
      )}
    </AuthShell>
  );
}

// ── Reset Password ────────────────────────────────────────────────────────────
function ResetPasswordPage({ navigate, toast, token }) {
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [expired,         setExpired]         = useState(false);
  const [secondsLeft,     setSecondsLeft]     = useState(24 * 60 * 60);

  const pwMeta = useMemo(() => {
    const { checks, score } = getPasswordChecks(password);
    return { checks, score, strength: getStrengthMeta(score) };
  }, [password]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setSecondsLeft((n) => { if (n <= 1) { window.clearInterval(t); setExpired(true); return 0; } return n - 1; });
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (expired)          { toast({ title: 'Link expired',      description: 'Request a new reset link.',         variant: 'error' }); return; }
    if (!token)           { toast({ title: 'Missing token',     description: 'The reset link is invalid.',        variant: 'error' }); return; }
    if (pwMeta.score < 4) { toast({ title: 'Weak password',     description: 'Meet all password requirements.',   variant: 'warning' }); return; }
    if (password !== confirmPassword) { toast({ title: 'Mismatch', description: 'Passwords do not match.',        variant: 'error' }); return; }

    setLoading(true);
    await new Promise((r) => window.setTimeout(r, 1000));
    toast({ title: 'Password updated', description: 'Sign in with your new password.', variant: 'success' });
    window.setTimeout(() => navigate('login'), 1800);
    setLoading(false);
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle={expired ? 'This reset link has expired. Request a new one.' : `This link expires in: ${fmtCountdown(secondsLeft)}`}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {expired  && <AlertBox variant="warning">Your reset link has expired. Please request a new one.</AlertBox>}
        {!token   && <AlertBox variant="error">Missing reset token in the URL.</AlertBox>}
        <PasswordInput label="New Password"     value={password}        onChange={(e) => setPassword(e.target.value)}        placeholder="Create a secure password" />
        <PasswordInput label="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
          error={confirmPassword && confirmPassword !== password ? "Passwords don't match" : ''} />
        <Btn type="submit" loading={loading} fullWidth size="lg" variant="primary">
          Reset Password
        </Btn>
        <button type="button" onClick={() => navigate('login')}
          className="flex w-full items-center justify-center gap-2 text-[13px] font-medium transition-colors"
          style={{ color: C.textSecondary }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.goldLight)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Return to sign in
        </button>
      </form>
    </AuthShell>
  );
}

// ── Verify Email ──────────────────────────────────────────────────────────────
function VerifyEmailPage({ navigate, toast, email: init }) {
  const [email,    setEmail]    = useState(init || localStorage.getItem(AUTH_KEY) || '');
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendIn]);

  return (
    <AuthShell
      title="Check your email"
      subtitle={email ? `We sent a verification link to ${email}.` : 'We sent a verification link to your email address.'}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-xl p-4"
          style={{ background: C.bgOverlay, border: `1px solid ${C.borderSubtle}` }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: C.infoDim }}>
            <Mail className="h-6 w-6" style={{ color: C.info }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: C.textPrimary }}>Verification required</p>
            <p className="text-[12px]" style={{ color: C.textSecondary }}>Click the link in your email to activate your account.</p>
          </div>
        </div>
        <AlertBox variant="info">Link expires in 24 hours.</AlertBox>
        <Btn variant="secondary" fullWidth disabled={resendIn > 0}
          onClick={() => { setResendIn(30); toast({ title: 'Email sent', description: `Resent to ${email}.`, variant: 'success' }); }}>
          {resendIn > 0 ? `Resend in ${fmtCountdown(resendIn)}` : 'Resend Verification Email'}
        </Btn>
        <button type="button" onClick={() => navigate('email-verified')}
          className="flex w-full items-center justify-center gap-2 text-[13px] font-medium transition-colors"
          style={{ color: C.textSecondary }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.goldLight)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}>
          I&apos;ve verified my email
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </AuthShell>
  );
}

// ── Email Verified ────────────────────────────────────────────────────────────
function EmailVerifiedPage({ navigate }) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) { navigate('/'); return; }
    const t = window.setInterval(() => setCountdown((n) => n - 1), 1000);
    return () => window.clearInterval(t);
  }, [countdown, navigate]);

  return (
    <AuthShell title="Email verified!" subtitle="Your account is confirmed. Redirecting to your dashboard...">
      <div className="space-y-6 text-center">
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: C.successDim, border: `2px solid ${C.successBorder}`, boxShadow: '0 0 40px rgba(61,190,126,0.25)' }}
        >
          <CheckCircle2 className="h-10 w-10" style={{ color: C.success }} />
        </div>
        <AlertBox variant="success">Your email is confirmed. You can now start using Orbisporté.</AlertBox>
        <Btn variant="primary" fullWidth size="lg" onClick={() => navigate('/')}>
          {countdown > 0 ? `Redirecting in ${countdown}…` : 'Go to Dashboard'}
        </Btn>
      </div>
    </AuthShell>
  );
}

// ── Main AuthFlow router ──────────────────────────────────────────────────────
function AuthFlow({ onLogin, onSignup, toast }) {
  const [locationState, setLocationState] = useState(parseAuthLocation);

  useEffect(() => {
    const sync = () => setLocationState(parseAuthLocation());
    window.addEventListener('popstate', sync);
    window.addEventListener('auth:navigate', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('auth:navigate', sync); };
  }, []);

  const navigate = (view, opts = {}) => {
    if (view === '/') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new Event('auth:navigate'));
      return;
    }
    goTo(view, opts);
    setLocationState({ view, token: opts.token || '', email: opts.email || '' });
    window.dispatchEvent(new Event('auth:navigate'));
  };

  const shared = { navigate, toast, prefilledEmail: locationState.email };

  switch (locationState.view) {
    case 'signup':          return <SignupPage         {...shared} onSignup={onSignup} />;
    case 'forgot-password': return <ForgotPasswordPage {...shared} />;
    case 'reset-password':  return <ResetPasswordPage  {...shared} token={locationState.token} />;
    case 'verify-email':    return <VerifyEmailPage     {...shared} email={locationState.email} />;
    case 'email-verified':  return <EmailVerifiedPage   navigate={navigate} />;
    default:                return <LoginPage           {...shared} onLogin={onLogin} />;
  }
}

export default AuthFlow;
