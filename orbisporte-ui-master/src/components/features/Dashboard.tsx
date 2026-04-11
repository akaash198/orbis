import React from 'react';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

type Trend = 'up' | 'down' | 'neutral';
type Severity = 'high' | 'medium' | 'low';
type ActivityType = 'success' | 'warning' | 'info' | 'error';

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: string;
  trend?: Trend;
  color: string;
};

type QuickActionProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
};

type ActivityItemProps = {
  icon: string;
  title: string;
  time: string;
  type: ActivityType;
};

type AlertItemProps = {
  title: string;
  description: string;
  severity: Severity;
};

type ChartCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

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
  { name: 'Processed', value: 68, color: '#10B981' },
  { name: 'Pending', value: 18, color: '#F59E0B' },
  { name: 'Review', value: 9, color: '#C9A520' },
  { name: 'Failed', value: 5, color: '#EF4444' },
];

const workflowData = [
  { name: 'Documents', value: 24 },
  { name: 'HS Codes', value: 16 },
  { name: 'Shipments', value: 12 },
  { name: 'Alerts', value: 8 },
];

const chartColors = {
  processed: '#876E12',
  processedSoft: 'rgba(135, 110, 18, 0.14)',
  pending: '#F59E0B',
  review: '#8B5CF6',
  failed: '#EF4444',
  grid: 'rgba(148, 163, 184, 0.18)',
  axis: '#64748B',
};

type LegendItem = {
  label: string;
  color: string;
  value?: string;
};

const recentDocuments = [
  { name: 'Invoice_INV2024_089.pdf', type: 'Invoice', status: 'Processed', statusTone: 'success', updated: '2 min ago', amount: 'INR 8.4L' },
  { name: 'Packing_List_0432.pdf', type: 'Packing List', status: 'Pending Review', statusTone: 'warning', updated: '12 min ago', amount: 'INR 2.1L' },
  { name: 'Bill_of_Lading_9912.pdf', type: 'BoL', status: 'Validated', statusTone: 'info', updated: '18 min ago', amount: 'INR 14.7L' },
  { name: 'Certificate_of_Origin.pdf', type: 'Certificate', status: 'Flagged', statusTone: 'error', updated: '41 min ago', amount: 'INR 1.9L' },
] as const;

const alerts = [
  { title: 'BCD rate updated for HS 8471.30', description: 'Effective from March 20, applies to 4 active filings.', severity: 'medium' as Severity },
  { title: 'Potential valuation mismatch', description: '2 shipments above expected range need review.', severity: 'high' as Severity },
  { title: 'IGST threshold approaching', description: 'Quarterly threshold is at 84% of limit.', severity: 'low' as Severity },
];

const activities = [
  { icon: '📄', title: 'Invoice_INV2024_089.pdf uploaded', time: '2 min ago', type: 'success' as ActivityType },
  { icon: '🏷️', title: 'HS Code 8471.30 classified for Laptop', time: '5 min ago', type: 'info' as ActivityType },
  { icon: '✅', title: 'Duty calculation completed for shipment', time: '12 min ago', type: 'success' as ActivityType },
  { icon: '⚠️', title: 'Risk flag: Unusual pricing pattern detected', time: '1 hour ago', type: 'warning' as ActivityType },
  { icon: '📋', title: 'BoE submitted to ICEGATE', time: '2 hours ago', type: 'success' as ActivityType },
];

function StatCard({ icon, label, value, change, trend, color }: StatCardProps) {
  const trendIcon =
    trend === 'up' ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> :
    trend === 'down' ? <TrendingDown className="h-4 w-4" aria-hidden="true" /> :
    null;

  return (
    <Card hover className="group relative overflow-hidden border-slate-200 bg-white p-5 shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,165,32,0.05),transparent_42%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-label font-medium text-text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
          {change ? (
            <div className={`mt-2 flex items-center gap-1 text-sm ${trend === 'down' ? 'text-error' : 'text-success'}`}>
              {trendIcon}
              <span>{change}</span>
            </div>
          ) : null}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function QuickAction({ icon, title, description, onClick }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-70" />
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-brand shadow-sm transition-transform group-hover:scale-105">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      <p className="mt-1 text-body-sm text-text-secondary">{description}</p>
    </button>
  );
}

function ActivityItem({ icon, title, time, type }: ActivityItemProps) {
  const typeStyles = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    info: 'bg-slate-50 text-brand',
    error: 'bg-error/15 text-error',
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 ${typeStyles[type]}`}>
        <span className="text-sm" aria-hidden="true">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{time}</p>
      </div>
    </div>
  );
}

function AlertItem({ title, description, severity }: AlertItemProps) {
  const severityColors = {
    high: 'border-error/50 bg-error/10',
    medium: 'border-warning/50 bg-warning/10',
    low: 'border-slate-200 bg-slate-50',
  };

  const severityBadges = {
    high: 'error',
    medium: 'warning',
    low: 'info',
  } as const;

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${severityColors[severity]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
        </div>
        <Badge variant={severityBadges[severity]}>{severity}</Badge>
      </div>
    </div>
  );
}

function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
        >
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
          {item.value ? <span className="text-slate-400">{item.value}</span> : null}
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, description, children, action }: ChartCardProps) {
  return (
    <Card hover className="overflow-hidden border-slate-200 bg-white p-0 shadow-sm">
      <CardHeader className="border-b border-slate-100/80 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="px-4 py-4 sm:px-6">{children}</CardContent>
    </Card>
  );
}

function CustomChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; color: string; name: string; value: string | number }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="font-medium text-slate-700">{entry.name}</span>
            <span className="ml-auto font-semibold text-slate-950">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const stats = {
    documents: 124,
    processed: 112,
    shipments: 18,
    compliance: 98.5,
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-tiny font-semibold text-success">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                System Active
              </div>
              <h1 className="bg-gradient-to-r from-text-primary via-slate-700 to-brand bg-clip-text text-3xl font-semibold tracking-[-0.03em] text-transparent sm:text-4xl">
                Control Tower
              </h1>
              <p className="mt-3 max-w-2xl text-body text-text-secondary">
                Track document flow, compliance posture, and shipment activity from one operational view.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-body-sm text-text-tertiary">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Last updated 4 minutes ago
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                  98.5% compliance score
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                icon={<Download className="h-4 w-4" />}
                onClick={() => onNavigate('documents')}
              >
                Export Report
              </Button>
            </div>
          </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FileText className="h-5 w-5 text-brand" />}
          label="Total Documents"
          value={stats.documents}
          change="+12% from last week"
          trend="up"
          color="bg-slate-50 text-brand"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
          label="Processed"
          value={stats.processed}
          change="+8% from last week"
          trend="up"
          color="bg-success/15"
        />
        <StatCard
          icon={<Truck className="h-5 w-5 text-warning" />}
          label="Active Shipments"
          value={stats.shipments}
          change="-2% from yesterday"
          trend="down"
          color="bg-warning/15"
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5 text-brand" />}
          label="Compliance Score"
          value={`${stats.compliance}%`}
          change="+2.5% from last month"
          trend="up"
          color="bg-slate-50 text-brand"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <ChartCard
            title="Document Processing Volume"
            description="Processed versus pending documents across the last 7 days."
            action={
              <Badge variant="info" dot>
                Weekly trend
              </Badge>
            }
          >
            <div className="h-80 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <ComposedChart data={volumeData} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="processedStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={chartColors.processed} />
                      <stop offset="100%" stopColor="#0EA5E9" />
                    </linearGradient>
                    <linearGradient id="processedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.processedSoft} />
                      <stop offset="100%" stopColor="rgba(135, 110, 18, 0)" />
                    </linearGradient>
                    <linearGradient id="pendingStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={chartColors.pending} />
                      <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 8" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartColors.axis, fontSize: 12, fontWeight: 500 }}
                    tickMargin={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartColors.axis, fontSize: 12, fontWeight: 500 }}
                    width={32}
                  />
                  <RechartsTooltip content={<CustomChartTooltip />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area
                    type="monotone"
                    dataKey="processed"
                    name="Processed"
                    stroke="url(#processedStroke)"
                    fill="url(#processedFill)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: chartColors.processed }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pending"
                    name="Pending"
                    stroke="url(#pendingStroke)"
                    strokeWidth={2.75}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: chartColors.pending }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <ChartLegend
                items={[
                  { label: 'Processed', color: chartColors.processed, value: 'up 12%' },
                  { label: 'Pending', color: chartColors.pending, value: 'down 4%' },
                ]}
              />
              <p className="text-xs font-medium text-slate-400">Updated 8 min ago</p>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="Document Status"
              description="Current distribution of processing states."
              action={<Badge variant="success" dot>Live</Badge>}
            >
              <div className="relative h-72 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <defs>
                      <linearGradient id="statusProcessed" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#E8C84A" />
                        <stop offset="100%" stopColor={chartColors.processed} />
                      </linearGradient>
                      <linearGradient id="statusPending" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FBBF24" />
                        <stop offset="100%" stopColor={chartColors.pending} />
                      </linearGradient>
                      <linearGradient id="statusReview" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" />
                        <stop offset="100%" stopColor={chartColors.review} />
                      </linearGradient>
                      <linearGradient id="statusFailed" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#F87171" />
                        <stop offset="100%" stopColor={chartColors.failed} />
                      </linearGradient>
                    </defs>
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={74}
                      outerRadius={114}
                      paddingAngle={4}
                      cornerRadius={10}
                      stroke="#fff"
                      strokeWidth={2}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {statusData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            index === 0 ? 'url(#statusProcessed)' :
                            index === 1 ? 'url(#statusPending)' :
                            index === 2 ? 'url(#statusReview)' :
                            'url(#statusFailed)'
                          }
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-semibold tracking-tight text-slate-950">100%</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status mix</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ChartLegend
                  items={statusData.map((entry) => ({
                    label: entry.name,
                    color: entry.color,
                    value: `${entry.value}%`,
                  }))}
                />
              </div>
            </ChartCard>

            <ChartCard
              title="Workflow Mix"
              description="Operational split across the most active modules."
              action={<Badge variant="warning">Today</Badge>}
            >
              <div className="h-72 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={workflowData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="workflowFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E8C84A" />
                        <stop offset="100%" stopColor={chartColors.processed} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 8" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartColors.axis, fontSize: 12, fontWeight: 500 }}
                      tickMargin={12}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartColors.axis, fontSize: 12, fontWeight: 500 }}
                      width={32}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(135, 110, 18, 0.04)' }} />
                    <Bar dataKey="value" name="Count" radius={[12, 12, 8, 8]} fill="url(#workflowFill)" barSize={36}>
                      <LabelList dataKey="value" position="top" fill="#64748B" fontSize={12} fontWeight={600} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ChartLegend
                  items={workflowData.map((entry, index) => ({
                    label: entry.name,
                    color: [chartColors.processed, chartColors.pending, chartColors.review, chartColors.failed][index],
                    value: `${entry.value}`,
                  }))}
                />
              </div>
            </ChartCard>
          </div>

          <Card hover className="p-0">
            <CardHeader className="border-b border-slate-100/80 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Recent Documents</CardTitle>
                  <CardDescription className="mt-1">Latest uploads, validation state, and declared value.</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowRight className="h-4 w-4" />}
                  iconPosition="right"
                  onClick={() => onNavigate('documents')}
                >
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 px-4 py-4 md:hidden">
                {recentDocuments.map((doc) => (
                  <div key={doc.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">{doc.name}</p>
                        <p className="mt-1 text-xs text-text-tertiary">Orbisporte review queue</p>
                      </div>
                      <Badge variant={doc.statusTone as any}>{doc.status}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-text-tertiary">Type</p>
                        <p className="mt-1 text-text-secondary">{doc.type}</p>
                      </div>
                      <div>
                        <p className="text-text-tertiary">Updated</p>
                        <p className="mt-1 text-text-secondary">{doc.updated}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-text-tertiary">Declared Value</p>
                        <p className="mt-1 text-text-secondary">{doc.amount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-hidden md:block">
                <table className="w-full table-fixed divide-y divide-white/8">
                  <thead className="bg-white/[0.03]">
                    <tr>
                      <th className="w-[36%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Document</th>
                      <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Type</th>
                      <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Status</th>
                      <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Updated</th>
                      <th className="w-[18%] px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Declared Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {recentDocuments.map((doc) => (
                      <tr key={doc.name} className="transition-colors hover:bg-white/[0.04]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-brand shadow-sm">
                              <FileSearch className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text-primary">{doc.name}</p>
                              <p className="text-xs text-text-tertiary">Orbisporte review queue</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-secondary">{doc.type}</td>
                        <td className="px-4 py-4 align-middle whitespace-nowrap">
                          <Badge variant={doc.statusTone} className="whitespace-nowrap px-3 py-1.5 text-[11px] leading-none">
                            {doc.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-secondary">{doc.updated}</td>
                        <td className="px-5 py-4 text-right text-sm font-medium text-text-primary">{doc.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Card hover className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                Compliance Status
              </CardTitle>
              <CardDescription>Live health across validation and duty workflows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Overall Score</span>
                <span className="text-lg font-semibold text-success">98.5%</span>
              </div>
              <Progress value={98.5} variant="success" showLabel />
              <div className="space-y-3 pt-2">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Document Validation</span>
                    <Badge variant="success">98%</Badge>
                  </div>
                  <Progress value={98} variant="success" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">HS Code Accuracy</span>
                    <Badge variant="success">95%</Badge>
                  </div>
                  <Progress value={95} variant="success" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Duty Calculation</span>
                    <Badge variant="warning">92%</Badge>
                  </div>
                  <Progress value={92} variant="warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                Alerts
              </CardTitle>
              <CardDescription>Operational events needing attention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert) => (
                <AlertItem key={alert.title} {...alert} />
              ))}
            </CardContent>
          </Card>

          <Card hover className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Direct entry points for common workflows.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction icon={<Upload className="h-5 w-5" />} title="Upload Document" description="Invoices, BL, AWB" onClick={() => onNavigate('documents')} />
                <QuickAction icon={<Search className="h-5 w-5" />} title="HS Code Lookup" description="Find correct HS codes" onClick={() => onNavigate('hs-codes')} />
                <QuickAction icon={<Calculator className="h-5 w-5" />} title="Duty Calculator" description="Estimate duties" onClick={() => onNavigate('duty-calculator')} />
                <QuickAction icon={<Package className="h-5 w-5" />} title="Track Shipment" description="Monitor movements" onClick={() => onNavigate('shipment-tracking')} />
                <QuickAction icon={<Globe className="h-5 w-5" />} title="BoE Filing" description="Submit entry filings" onClick={() => onNavigate('boe-filing')} />
                <QuickAction icon={<MessageCircle className="h-5 w-5" />} title="Ask Questions" description="AI assistant help" onClick={() => onNavigate('qa')} />
              </div>
            </CardContent>
          </Card>

          <Card hover className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest system and user events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activities.map((activity) => (
                <ActivityItem key={activity.title} {...activity} />
              ))}
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle>Duty Summary</CardTitle>
              <CardDescription>High-level duties by category.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <span className="text-sm text-text-secondary">BCD</span>
                <span className="text-sm font-semibold text-brand">INR 2.4L</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <span className="text-sm text-text-secondary">IGST</span>
                <span className="text-sm font-semibold text-brand">INR 4.8L</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <span className="text-sm text-text-secondary">SWS</span>
                <span className="text-sm font-semibold text-warning">INR 45K</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <span className="text-sm text-text-secondary">ADD</span>
                <span className="text-sm font-semibold text-brand">INR 1.2L</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
