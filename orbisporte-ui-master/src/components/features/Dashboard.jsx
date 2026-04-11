import React, { useEffect, useState } from 'react';
import { dashboardService } from '../../services/api';
import {
  FileText,
  Truck,
  ShieldCheck,
  Upload,
  Search,
  MessageCircle,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Package,
  Calculator,
  Globe,
  Clock3,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  FileSearch,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from 'recharts';

// ── Data ──────────────────────────────────────────────────────────────────────

const volumeData = [
  { name: 'Mon', processed: 42, pending: 14 },
  { name: 'Tue', processed: 56, pending: 18 },
  { name: 'Wed', processed: 48, pending: 16 },
  { name: 'Thu', processed: 71, pending: 20 },
  { name: 'Fri', processed: 64, pending: 17 },
  { name: 'Sat', processed: 58, pending: 12 },
  { name: 'Sun', processed: 76, pending: 21 },
];

const statusData = [
  { name: 'Processed', value: 68, color: '#3DBE7E' },
  { name: 'Pending',   value: 18, color: '#E8934A' },
  { name: 'Review',    value: 9,  color: '#9A8CE8' },
  { name: 'Failed',    value: 5,  color: '#E05656' },
];

const workflowData = [
  { name: 'Documents', value: 24 },
  { name: 'HS Codes',  value: 16 },
  { name: 'Shipments', value: 12 },
  { name: 'Alerts',    value: 8  },
];

const CHART = {
  grid:      'rgba(39,48,71,0.7)',
  axis:      '#4A5A72',
  gold:      '#C9A520',
  goldSoft:  'rgba(201,165,32,0.14)',
  pending:   '#E8934A',
  pendingSoft:'rgba(232,147,74,0.10)',
};

const recentDocuments = [
  { name: 'Invoice_INV2024_089.pdf',   type: 'Invoice',       status: 'Processed',      tone: 'success', updated: '2 min ago',  amount: 'INR 8.4L'  },
  { name: 'Packing_List_0432.pdf',     type: 'Packing List',  status: 'Pending Review',  tone: 'warning', updated: '12 min ago', amount: 'INR 2.1L'  },
  { name: 'Bill_of_Lading_9912.pdf',   type: 'BoL',           status: 'Validated',       tone: 'info',    updated: '18 min ago', amount: 'INR 14.7L' },
  { name: 'Certificate_of_Origin.pdf', type: 'Certificate',   status: 'Flagged',         tone: 'error',   updated: '41 min ago', amount: 'INR 1.9L'  },
];

const alertsList = [
  { title: 'BCD rate updated for HS 8471.30',       description: 'Effective from March 20, applies to 4 active filings.',   severity: 'medium' },
  { title: 'Potential valuation mismatch',           description: '2 shipments above expected range need review.',             severity: 'high'   },
  { title: 'IGST threshold approaching',             description: 'Quarterly threshold is at 84% of limit.',                  severity: 'low'    },
];

const activities = [
  { icon: '📄', title: 'Invoice_INV2024_089.pdf uploaded',              time: '2 min ago',   type: 'success' },
  { icon: '🏷️', title: 'HS Code 8471.30 classified for Laptop',          time: '5 min ago',   type: 'info'    },
  { icon: '✅', title: 'Duty calculation completed for shipment',         time: '12 min ago',  type: 'success' },
  { icon: '⚠️', title: 'Risk flag: Unusual pricing pattern detected',    time: '1 hour ago',  type: 'warning' },
  { icon: '📋', title: 'BoE submitted to ICEGATE',                       time: '2 hours ago', type: 'success' },
];

// ── Badge variant colors ──────────────────────────────────────────────────────
const BADGE_COLORS = {
  success: { bg: 'rgba(61,190,126,0.12)',  border: 'rgba(61,190,126,0.28)',  text: '#5AD49A'  },
  warning: { bg: 'rgba(232,147,74,0.12)',  border: 'rgba(232,147,74,0.28)',  text: '#F5A96A'  },
  error:   { bg: 'rgba(224,86,86,0.12)',   border: 'rgba(224,86,86,0.28)',   text: '#F07070'  },
  info:    { bg: 'rgba(107,188,212,0.12)', border: 'rgba(107,188,212,0.28)', text: '#8DD4EC'  },
  gold:    { bg: 'rgba(201,165,32,0.10)',  border: 'rgba(201,165,32,0.28)',  text: '#E8C84A'  },
};

// ── Helper Components ─────────────────────────────────────────────────────────

function Badge({ variant = 'gold', children, dot = false }) {
  const c = BADGE_COLORS[variant] || BADGE_COLORS.gold;
  return (
    <span
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap"
    >
      {dot && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.text }} aria-hidden="true" />}
      {children}
    </span>
  );
}

function StatusBadge({ tone, label }) {
  return <Badge variant={tone}>{label}</Badge>;
}

function ProgressBar({ value, variant = 'success' }) {
  const colors = {
    success: '#3DBE7E',
    warning: '#E8934A',
    error:   '#E05656',
    gold:    '#C9A520',
    info:    '#6BBCD4',
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-[#1E2638] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: colors[variant] || colors.success }}
      />
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#273047] bg-[#1C2438] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.30)]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A5A72]">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((e) => (
          <div key={e.dataKey} className="flex items-center gap-2.5 text-[12px]">
            <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
            <span className="text-[#8B97AE]">{e.name}</span>
            <span className="ml-auto font-bold text-[#E2E8F5]">{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, change, trend, accentColor = '#C9A520' }) {
  const isUp   = trend === 'up';
  const isDown = trend === 'down';
  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : null;
  const trendColor = isUp ? '#5AD49A' : isDown ? '#F07070' : '#8B97AE';

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[#1E2638] bg-[#161D2C] p-6 transition-all duration-200 hover:border-[#273047] hover:shadow-[0_8px_24px_rgba(0,0,0,0.22)] hover:-translate-y-0.5 group"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl transition-all"
        style={{ background: accentColor }}
      />

      {/* Ambient glow on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at top right, ${accentColor}08, transparent 50%)` }} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A5A72]">{label}</p>
          <p className="mt-2 text-[26px] font-bold text-[#E2E8F5] tracking-tight font-mono leading-none">{value}</p>
          {change && TrendIcon ? (
            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold" style={{ color: trendColor }}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{change}</span>
            </div>
          ) : null}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200"
          style={{ background: `${accentColor}14`, borderColor: `${accentColor}30`, color: accentColor }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

// ── Quick Action ──────────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-[#1E2638] bg-[#161D2C] p-5 text-left transition-all duration-200 hover:border-[rgba(201,165,32,0.40)] hover:bg-[rgba(201,165,32,0.04)] hover:-translate-y-0.5"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[#273047] bg-[#0D1020] text-[#C9A520] transition-all group-hover:border-[rgba(201,165,32,0.30)] group-hover:shadow-[0_0_12px_rgba(201,165,32,0.15)]">
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </div>
      <p className="text-[13px] font-semibold text-[#E2E8F5]">{title}</p>
      <p className="mt-0.5 text-[11px] text-[#4A5A72] leading-relaxed">{description}</p>
    </button>
  );
}

// ── Activity Item ─────────────────────────────────────────────────────────────
function ActivityItem({ icon, title, time, type }) {
  const colors = {
    success: { bg: 'rgba(61,190,126,0.10)',  border: 'rgba(61,190,126,0.20)',  text: '#3DBE7E' },
    warning: { bg: 'rgba(232,147,74,0.10)',  border: 'rgba(232,147,74,0.20)',  text: '#E8934A' },
    info:    { bg: 'rgba(107,188,212,0.10)', border: 'rgba(107,188,212,0.20)', text: '#6BBCD4' },
    error:   { bg: 'rgba(224,86,86,0.10)',   border: 'rgba(224,86,86,0.20)',   text: '#E05656' },
  };
  const c = colors[type] || colors.info;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#141A28] bg-[#111620] p-4 transition-colors hover:border-[#1E2638] hover:bg-[#161D2C]">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[14px]"
        style={{ background: c.bg, borderColor: c.border }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-[#E2E8F5]">{title}</p>
        <p className="text-[10px] text-[#4A5A72] font-mono">{time}</p>
      </div>
    </div>
  );
}

// ── Alert Item ────────────────────────────────────────────────────────────────
function AlertItem({ title, description, severity }) {
  const colors = {
    high:   { bg: 'rgba(224,86,86,0.08)',    border: 'rgba(224,86,86,0.25)',   badgeTone: 'error'   },
    medium: { bg: 'rgba(232,147,74,0.08)',   border: 'rgba(232,147,74,0.25)',  badgeTone: 'warning' },
    low:    { bg: 'rgba(107,188,212,0.06)',  border: 'rgba(107,188,212,0.20)', badgeTone: 'info'    },
  };
  const c = colors[severity] || colors.low;
  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-[12px] font-semibold text-[#E2E8F5] leading-tight">{title}</p>
        <Badge variant={c.badgeTone}>{severity}</Badge>
      </div>
      <p className="text-[11px] text-[#8B97AE] leading-relaxed">{description}</p>
    </div>
  );
}

// ── Section Card Shell ────────────────────────────────────────────────────────
function SectionCard({ title, description, action, children, className = '' }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#1E2638] bg-[#161D2C] ${className}`}
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#141A28] px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-[#E2E8F5] tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[11px] text-[#4A5A72]">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class SectionErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('Dashboard section error:', error, info?.componentStack?.slice(0, 500)); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-[#1E2638] bg-[#161D2C] p-6 text-center text-[13px] text-[#4A5A72]">
          Chart temporarily unavailable — page is still functional.
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Button ────────────────────────────────────────────────────────────────────
function Button({ children, variant = 'primary', icon, onClick, size = 'md' }) {
  const base = 'inline-flex items-center gap-2 rounded-lg font-semibold transition-all duration-150 cursor-pointer';
  const sz = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-4 text-[13px]';
  const variants = {
    primary:   'bg-[#C9A520] text-[#0A0D14] border border-[#C9A520] hover:bg-[#E8C84A] hover:border-[#E8C84A]',
    secondary: 'bg-transparent text-[#E8C84A] border border-[rgba(201,165,32,0.28)] hover:bg-[rgba(201,165,32,0.08)]',
    ghost:     'bg-transparent text-[#8B97AE] border border-transparent hover:bg-white/[0.04] hover:text-[#E2E8F5]',
  };
  return (
    <button type="button" onClick={onClick} className={`${base} ${sz} ${variants[variant] || variants.primary}`}>
      {icon && icon}
      {children}
    </button>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    dashboardService.getDashboardStats()
      .then(setStats)
      .catch(() => {}); // Silently fall back to mock data on error
  }, []);

  const totalDocs     = stats?.total_documents   ?? 124;
  const processedDocs = stats?.processed_documents ?? 112;

  return (
    <div className="space-y-5">

      {/* ── Page Header ── */}
      <section className="rounded-xl border border-[#1E2638] bg-[#161D2C] p-5 sm:p-6"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(61,190,126,0.28)] bg-[rgba(61,190,126,0.10)] px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3DBE7E] animate-pulse" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-[#5AD49A]">All Systems Operational</span>
            </div>
            <h1 className="text-[28px] font-bold text-[#E2E8F5] tracking-tight">
              Control <span className="text-[#C9A520]">Tower</span>
            </h1>
            <p className="mt-2 max-w-xl text-[14px] text-[#8B97AE]">
              Track document flow, compliance posture, and shipment activity from one operational view.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-[#4A5A72]">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                Last updated 4 minutes ago
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#3DBE7E]" aria-hidden="true" />
                <span className="text-[#5AD49A] font-semibold">98.5%</span> compliance score
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-[#C9A520]" aria-hidden="true" />
                AI engine active
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => onNavigate('documents')}>
              Export Report
            </Button>
          </div>
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText}      label="Total Documents"  value={totalDocs}       change="+12% from last week" trend="up"   accentColor="#C9A520" />
        <StatCard icon={CheckCircle2} label="Processed"        value={processedDocs}    change="+8% from last week"  trend="up"   accentColor="#3DBE7E" />
        <StatCard icon={Truck}         label="Active Shipments" value={18}               change="-2% from yesterday"  trend="down" accentColor="#E8934A" />
        <StatCard icon={ShieldCheck}   label="Compliance Score" value="98.5%"            change="+2.5% last month"   trend="up"   accentColor="#6BBCD4" />
      </section>

      {/* ── Main Grid ── */}
      <SectionErrorBoundary>
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">

          {/* Left column (8/12) */}
          <div className="space-y-5 xl:col-span-8">

            {/* Volume Chart */}
            <SectionCard
              title="Document Processing Volume"
              description="Processed vs pending across the last 7 days"
              action={<Badge variant="info" dot>Weekly trend</Badge>}
            >
              <div className="h-72 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={volumeData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="gradProcessed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.gold} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CHART.gold} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.pending} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={CHART.pending} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="4 8" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false}
                      tick={{ fill: CHART.axis, fontSize: 11, fontWeight: 500 }} tickMargin={10} />
                    <YAxis tickLine={false} axisLine={false}
                      tick={{ fill: CHART.axis, fontSize: 11 }} width={28} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: '#273047', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="processed" name="Processed"
                      stroke={CHART.gold} fill="url(#gradProcessed)" strokeWidth={2.5}
                      dot={false} activeDot={{ r: 5, stroke: '#0A0D14', strokeWidth: 2, fill: CHART.gold }} />
                    <Line type="monotone" dataKey="pending" name="Pending"
                      stroke={CHART.pending} strokeWidth={2} dot={false}
                      activeDot={{ r: 4, stroke: '#0A0D14', strokeWidth: 2, fill: CHART.pending }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center gap-4 border-t border-[#141A28] pt-4">
                <div className="flex items-center gap-2 text-[11px] text-[#8B97AE]">
                  <span className="h-2 w-2 rounded-full bg-[#C9A520]" />Processed <span className="text-[#C9A520] font-semibold">↑ 12%</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#8B97AE]">
                  <span className="h-2 w-2 rounded-full bg-[#E8934A]" />Pending <span className="text-[#5AD49A] font-semibold">↓ 4%</span>
                </div>
                <span className="ml-auto text-[11px] text-[#4A5A72]">Updated 8 min ago</span>
              </div>
            </SectionCard>

            {/* Status + Workflow charts */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

              {/* Donut — Status */}
              <SectionCard
                title="Document Status"
                description="Current distribution of processing states"
                action={<Badge variant="success" dot>Live</Badge>}
              >
                <div className="relative h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RechartsTooltip content={<ChartTooltip />} />
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={106}
                        paddingAngle={4}
                        cornerRadius={8}
                        strokeWidth={0}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[26px] font-bold text-[#E2E8F5]">100%</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A5A72]">Status mix</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {statusData.map((e) => (
                    <div key={e.name} className="flex items-center gap-2 text-[11px] text-[#8B97AE]">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.color }} />
                      <span className="truncate">{e.name}</span>
                      <span className="ml-auto font-semibold text-[#E2E8F5]">{e.value}%</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Bar — Workflow */}
              <SectionCard
                title="Workflow Mix"
                description="Operational split across active modules"
                action={<Badge variant="warning">Today</Badge>}
              >
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workflowData} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E8C84A" />
                          <stop offset="100%" stopColor="#C9A520" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="4 8" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false}
                        tick={{ fill: CHART.axis, fontSize: 11 }} tickMargin={10} />
                      <YAxis tickLine={false} axisLine={false}
                        tick={{ fill: CHART.axis, fontSize: 11 }} width={24} />
                      <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,165,32,0.04)' }} />
                      <Bar dataKey="value" name="Count" radius={[8, 8, 4, 4]} fill="url(#barGrad)" barSize={32}>
                        <LabelList dataKey="value" position="top" fill={CHART.axis} fontSize={11} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            {/* Recent Documents Table */}
            <div
              className="overflow-hidden rounded-xl border border-[#1E2638] bg-[#161D2C]"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
            >
              <div className="flex items-center justify-between border-b border-[#141A28] px-5 py-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#E2E8F5]">Recent Documents</h3>
                  <p className="text-[11px] text-[#4A5A72] mt-0.5">Latest uploads, validation state, and declared value</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('documents')}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#C9A520] hover:text-[#E8C84A] transition-colors"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full table-fixed border-collapse">
                  <thead className="border-b border-[#141A28] bg-[#111620]">
                    <tr>
                      <th className="w-[36%] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em] text-[#4A5A72]">Document</th>
                      <th className="w-[14%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em] text-[#4A5A72]">Type</th>
                      <th className="w-[18%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em] text-[#4A5A72]">Status</th>
                      <th className="w-[14%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em] text-[#4A5A72]">Updated</th>
                      <th className="w-[18%] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.10em] text-[#4A5A72]">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDocuments.map((doc) => (
                      <tr
                        key={doc.name}
                        className="group border-b border-[#141A28] last:border-0 transition-colors hover:bg-[#111620]"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#273047] bg-[#0D1020] text-[#C9A520] group-hover:border-[rgba(201,165,32,0.30)]">
                              <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-[#E2E8F5]">{doc.name}</p>
                              <p className="text-[10px] uppercase tracking-wider text-[#4A5A72]">Review queue</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-[#8B97AE]">{doc.type}</td>
                        <td className="px-4 py-3.5">
                          <StatusBadge tone={doc.tone} label={doc.status} />
                        </td>
                        <td className="px-4 py-3.5 text-[11px] font-mono text-[#4A5A72]">{doc.updated}</td>
                        <td className="px-5 py-3.5 text-right text-[12px] font-bold font-mono text-[#E2E8F5]">{doc.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-3 p-4 md:hidden">
                {recentDocuments.map((doc) => (
                  <div key={doc.name} className="rounded-lg border border-[#273047] bg-[#111620] p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="truncate text-[12px] font-semibold text-[#E2E8F5]">{doc.name}</p>
                      <StatusBadge tone={doc.tone} label={doc.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      <div><p className="text-[#4A5A72]">Type</p><p className="mt-0.5 text-[#8B97AE]">{doc.type}</p></div>
                      <div><p className="text-[#4A5A72]">Updated</p><p className="mt-0.5 text-[#8B97AE]">{doc.updated}</p></div>
                      <div><p className="text-[#4A5A72]">Value</p><p className="mt-0.5 font-mono font-bold text-[#E2E8F5]">{doc.amount}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column (4/12) */}
          <div className="space-y-5 xl:col-span-4">

            {/* Compliance */}
            <SectionCard
              title="Compliance Status"
              description="Live health across validation and duty workflows"
              action={
                <div className="flex items-center gap-1.5 rounded-full border border-[rgba(61,190,126,0.28)] bg-[rgba(61,190,126,0.10)] px-2.5 py-1">
                  <ShieldCheck className="h-3 w-3 text-[#3DBE7E]" />
                  <span className="text-[10px] font-semibold text-[#5AD49A]">Healthy</span>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#8B97AE]">Overall Score</span>
                  <span className="text-[18px] font-bold text-[#5AD49A]">98.5%</span>
                </div>
                <ProgressBar value={98.5} variant="success" />

                <div className="space-y-3 pt-1">
                  {[
                    { label: 'Document Validation', value: 98, variant: 'success' },
                    { label: 'HS Code Accuracy',    value: 95, variant: 'success' },
                    { label: 'Duty Calculation',    value: 92, variant: 'warning' },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[12px] text-[#8B97AE]">{row.label}</span>
                        <Badge variant={row.variant}>{row.value}%</Badge>
                      </div>
                      <ProgressBar value={row.value} variant={row.variant} />
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Alerts */}
            <SectionCard
              title="Active Alerts"
              description="Operational events needing attention"
              action={<Badge variant="error" dot>3 Active</Badge>}
            >
              <div className="space-y-2.5">
                {alertsList.map((a) => (
                  <AlertItem key={a.title} {...a} />
                ))}
              </div>
            </SectionCard>

            {/* Quick Actions */}
            <SectionCard
              title="Quick Actions"
              description="Direct entry points for common workflows"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <QuickAction icon={Upload}         title="Upload Doc"      description="Invoice, BL, AWB"      onClick={() => onNavigate('documents')}          />
                <QuickAction icon={Search}         title="HS Code Lookup"  description="Find correct HS codes" onClick={() => onNavigate('hs-codes')}            />
                <QuickAction icon={Calculator}     title="Duty Calculator" description="Estimate duties"       onClick={() => onNavigate('duty-calculator')}     />
                <QuickAction icon={Package}        title="Track Shipment"  description="Monitor movements"     onClick={() => onNavigate('shipment-tracking')}   />
                <QuickAction icon={Globe}          title="BoE Filing"      description="Submit entry filings"  onClick={() => onNavigate('boe-filing')}          />
                <QuickAction icon={MessageCircle}  title="AI Assistant"    description="Ask questions"         onClick={() => onNavigate('qa')}                  />
              </div>
            </SectionCard>

            {/* Recent Activity */}
            <SectionCard
              title="Recent Activity"
              description="Latest system and user events"
            >
              <div className="space-y-2">
                {activities.map((a) => (
                  <ActivityItem key={a.title} {...a} />
                ))}
              </div>
            </SectionCard>
          </div>

        </section>
      </SectionErrorBoundary>
    </div>
  );
}
