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
  CheckCircle,
  Package,
  Calculator,
  Globe,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';

function StatCard({ icon, label, value, change, trend, color }) {
  return (
    <Card className="group hover:border-border-glow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-secondary mb-1">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {change && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-text-muted'
            }`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {change}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function QuickAction({ icon, title, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card p-4 text-left group hover:border-primary-500/50"
    >
      <div className="w-10 h-10 rounded-lg bg-primary-500/15 flex items-center justify-center text-primary-400 mb-3 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h4 className="font-medium text-text-primary mb-1">{title}</h4>
      <p className="text-xs text-text-secondary">{description}</p>
    </button>
  );
}

function ActivityItem({ icon, title, time, type }) {
  const typeStyles = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    info: 'bg-primary-500/15 text-primary-400',
    error: 'bg-error/15 text-error',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeStyles[type]}`}>
        <span className="text-sm">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{title}</p>
        <p className="text-xs text-text-muted">{time}</p>
      </div>
    </div>
  );
}

function AlertItem({ title, description, severity }) {
  const severityColors = {
    high: 'border-error/50 bg-error/10',
    medium: 'border-warning/50 bg-warning/10',
    low: 'border-primary-500/50 bg-primary-500/10',
  };

  const severityBadges = {
    high: 'error',
    medium: 'warning',
    low: 'info',
  };

  return (
    <div className={`p-3 rounded-lg border ${severityColors[severity]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        </div>
        <Badge variant={severityBadges[severity]}>{severity}</Badge>
      </div>
    </div>
  );
}

export function Dashboard({ onNavigate }) {
  const stats = {
    documents: 24,
    processed: 22,
    shipments: 8,
    compliance: 98.5,
  };

  const activities = [
    { icon: '📄', title: 'Invoice_INV2024_089.pdf uploaded', time: '2 min ago', type: 'success' },
    { icon: '🏷️', title: 'HS Code 8471.30 classified for Laptop', time: '5 min ago', type: 'info' },
    { icon: '✅', title: 'Duty calculation completed for shipment', time: '12 min ago', type: 'success' },
    { icon: '⚠️', title: 'Risk flag: Unusual pricing pattern detected', time: '1 hour ago', type: 'warning' },
    { icon: '📋', title: 'BoE submitted to ICEGATE', time: '2 hours ago', type: 'success' },
  ];

  const alerts = [
    { title: 'BCD Rate Update', description: 'New rate for HS 8471.30 effective Mar 20', severity: 'medium' },
    { title: 'IGST Threshold', description: 'Crossed ₹50L threshold for quarter', severity: 'low' },
    { title: 'Fraud Alert', description: '2 shipments flagged for review', severity: 'high' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Control Tower</h1>
          <p className="text-text-secondary mt-1">Welcome back! Here's your operations overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>System Active</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5 text-primary-400" />}
          label="Total Documents"
          value={stats.documents}
          change="+12%"
          trend="up"
          color="bg-primary-500/15"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-success" />}
          label="Processed"
          value={stats.processed}
          change="92%"
          trend="up"
          color="bg-success/15"
        />
        <StatCard
          icon={<Truck className="w-5 h-5 text-warning" />}
          label="Active Shipments"
          value={stats.shipments}
          change="+3"
          trend="up"
          color="bg-warning/15"
        />
        <StatCard
          icon={<ShieldCheck className="w-5 h-5 text-accent-400" />}
          label="Compliance Score"
          value={`${stats.compliance}%`}
          change="+2.5%"
          trend="up"
          color="bg-accent-500/15"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <QuickAction
                  icon={<Upload className="w-5 h-5" />}
                  title="Upload Document"
                  description="Upload invoices, BL, AWB"
                  onClick={() => onNavigate('documents')}
                />
                <QuickAction
                  icon={<Search className="w-5 h-5" />}
                  title="HS Code Lookup"
                  description="Find correct HS codes"
                  onClick={() => onNavigate('hs-codes')}
                />
                <QuickAction
                  icon={<Calculator className="w-5 h-5" />}
                  title="Duty Calculator"
                  description="Calculate import duties"
                  onClick={() => onNavigate('duty-calculator')}
                />
                <QuickAction
                  icon={<Package className="w-5 h-5" />}
                  title="Track Shipment"
                  description="Real-time tracking"
                  onClick={() => onNavigate('shipment-tracking')}
                />
                <QuickAction
                  icon={<Globe className="w-5 h-5" />}
                  title="BoE Filing"
                  description="File Bill of Entry"
                  onClick={() => onNavigate('boe-filing')}
                />
                <QuickAction
                  icon={<MessageCircle className="w-5 h-5" />}
                  title="Ask Questions"
                  description="AI assistant help"
                  onClick={() => onNavigate('qa')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right">
                View All
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {activities.map((activity, index) => (
                <ActivityItem key={index} {...activity} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Overall Score</span>
                <span className="text-lg font-bold text-success">98.5%</span>
              </div>
              <Progress value={98.5} variant="success" />
              
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Document Validation</span>
                  <Badge variant="success">98%</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">HS Code Accuracy</span>
                  <Badge variant="success">95%</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Duty Calculation</span>
                  <Badge variant="warning">92%</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert, index) => (
                <AlertItem key={index} {...alert} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Duty Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-primary-500/10">
                <span className="text-sm text-text-secondary">BCD</span>
                <span className="text-sm font-medium text-primary-400">₹2.4L</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/10">
                <span className="text-sm text-text-secondary">IGST</span>
                <span className="text-sm font-medium text-purple-400">₹4.8L</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-warning/10">
                <span className="text-sm text-text-secondary">SWS</span>
                <span className="text-sm font-medium text-warning">₹45K</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-accent-500/10">
                <span className="text-sm text-text-secondary">ADD</span>
                <span className="text-sm font-medium text-accent-400">₹1.2L</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}