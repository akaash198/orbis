import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Calculator, 
  ShieldCheck, 
  AlertTriangle, 
  FileSearch, 
  ArrowRight,
  TrendingDown,
  Globe,
  Zap,
  Info,
  CheckCircle2,
  Lock,
  RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import M04DutyCalculatorPage from './M04DutyCalculatorPage';
import M05BOEFilingPage from './M05BOEFilingPage';
import TradeFraudPanel from '../panels/TradeFraudPanel';
import RiskScoringPanel from '../panels/RiskScoringPanel';

// --- MOCK DATA FOR EACH PAGE ---

const HS_CODE_MOCK = [
  { id: 1, code: '8471.30.10', description: 'Laptop computers, weight < 10kg', rate: '0%', confidence: 98 },
  { id: 2, code: '8471.30.90', description: 'Other portable digital automatic data processing machines', rate: '0%', confidence: 92 },
  { id: 3, code: '8517.13.00', description: 'Smartphones and other wireless network devices', rate: '15%', confidence: 85 },
];

const COMPLIANCE_MOCK = [
  { id: 1, type: 'Valuation', status: 'Passed', details: 'Value matches historical average (+/- 2%)', confidence: 99 },
  { id: 2, type: 'Certificate of Origin', status: 'Warning', details: 'Signature verification pending from issuing authority', confidence: 74 },
  { id: 3, type: 'HS Classification', status: 'Passed', details: 'Auto-classified with high confidence level', confidence: 91 },
];

export function FeaturePage({ pageId, onNavigate, navParams }) {
  const [query, setQuery] = useState('');
  const [calculating, setCalculating] = useState(false);

  // Constants based on pageId
  const config = useMemo(() => {
    switch (pageId) {
      case 'hs-codes':
        return {
          title: 'HS Code Lookup & AI Classification',
          description: 'Instantly classify products across global harmonized systems with 99% accuracy using our Orbis-AI engine.',
          icon: <FileSearch className="h-6 w-6 text-[#E8C84A]" />,
          stats: [
            { label: 'Total Lookups', value: '1,204' },
            { label: 'AI Accuracy', value: '99.4%' },
            { label: 'Auto-Classified', value: '84%' },
          ],
        };
      case 'duty-calculator':
        return {
          title: 'Intelligent Duty & Tax Calculator',
          description: 'Navigate complex global tax regimes. Get precise landed cost calculations including BCD, SWS, and IGST for any shipment.',
          icon: <Calculator className="h-6 w-6 text-[#E8C84A]" />,
          stats: [
            { label: 'Calculations', value: '432' },
            { label: 'Average Savings', value: '12.4%' },
            { label: 'Regimes Sync', value: 'Active' },
          ],
        };
      case 'boe-filing':
        return {
          title: 'Bill of Entry (BoE) Smart Filing',
          description: 'Digitize and submit customs declarations to ICEGATE and other global portals in seconds. Minimize manual entry errors.',
          icon: <Zap className="h-6 w-6 text-[#E8C84A]" />,
          stats: [
            { label: 'Filed Today', value: '18' },
            { label: 'Avg Process Time', value: '12s' },
            { label: 'Success Rate', value: '100%' },
          ],
        };
      case 'shipment-tracking':
        return {
          title: 'Real-Time Milestone Tracking',
          description: 'Unified visibility across air, sea, and courier shipments. Track from port of origin to the final delivery warehouse.',
          icon: <Globe className="h-6 w-6 text-[#E8C84A]" />,
          stats: [
            { label: 'Active Shipments', value: '84' },
            { label: 'Deliveries Today', value: '12' },
            { label: 'Delay Index', value: 'Low' },
          ],
        };
      case 'fraud-detection':
        return {
          title: 'Advanced Fraud Detection & Anti-Money Laundering',
          description: 'Proactive detection of pricing anomalies, shell companies, and circuitous routing patterns using network analysis.',
          icon: <ShieldCheck className="h-6 w-6 text-[#E8C84A]" />,
          stats: [
            { label: 'Risk Flags', value: '5' },
            { label: 'Critical', value: '1' },
            { label: 'Network Scan', value: 'Complete' },
          ],
        };
      case 'compliance':
        return {
          title: 'Regulatory Compliance & Audit Trail',
          description: 'Ensure every shipment adheres to the latest FTA rules, anti-dumping duties, and trade policy updates automatically.',
          icon: <Lock className="h-6 w-6 text-[#E8C84A]" />,
          stats: [
            { label: 'Pass Rate', value: '98.2%' },
            { label: 'Audit Ready', value: 'Yes' },
            { label: 'Daily Scans', value: '1,200+' },
          ],
        };
      default:
        return {
          title: 'Trade Operations',
          description: 'Manage your global trade workflow with AI-powered tools.',
          icon: <Globe className="h-6 w-6 text-[#E8C84A]" />,
          stats: [],
        };
    }
  }, [pageId]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[#1E2638] bg-gradient-to-br from-[#161D2C] via-[#0D1020] to-[#161D2C] p-8 shadow-[var(--shadow-card)] sm:p-10">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#E8C84A]/05 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#E8C84A]/05 blur-3xl" />
        
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E8C84A]/30 bg-[#E8C84A]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#E8C84A]">
              <div className="h-1.5 w-1.5 rounded-full bg-[#E8C84A] shadow-[0_0_8px_#E8C84A]" />
              {pageId.replace('-', ' ')}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#273047] bg-[#0D1020] shadow-inner">
                {config.icon}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#E2E8F5] sm:text-4xl">{config.title}</h1>
            </div>
            <p className="text-lg leading-relaxed text-[#8B97AE]">{config.description}</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />}>Refresh Data</Button>
            <Button variant="primary" icon={<Zap className="h-4 w-4" />}>Run AI Audit</Button>
          </div>
        </div>
      </section>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {config.stats.map((stat) => (
          <Card key={stat.label} hover className="p-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A5A72]">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-[#E2E8F5]">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Main Work Area */}
        <div className="space-y-8 lg:col-span-8">
          {pageId === 'hs-codes' && (
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-[#1E2638]/60 bg-[#111620]">
                <CardTitle>HS Code Discovery</CardTitle>
                <CardDescription>Search by product description or part numbers to find the correct harmonized code.</CardDescription>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A5A72]" />
                    <Input 
                      className="pl-10" 
                      placeholder="e.g. Lithium-ion batteries for electric vehicles..." 
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setCalculating(true)} loading={calculating}>Search Classification</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left">
                  <thead className="bg-[#0D1020] text-[10px] font-bold uppercase tracking-widest text-[#4A5A72]">
                    <tr>
                      <th className="px-6 py-4">HS Code</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-center">Confidence</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2638]">
                    {HS_CODE_MOCK.map((item) => (
                      <tr key={item.id} className="group hover:bg-[#1C2438]/40 transition-colors">
                        <td className="px-6 py-5 font-mono text-[14px] font-bold text-[#E8C84A]">{item.code}</td>
                        <td className="px-6 py-5">
                          <p className="text-[14px] font-medium text-[#E2E8F5]">{item.description}</p>
                          <p className="text-[12px] text-[#4A5A72]">Duty Rate: {item.rate}</p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-[11px] font-bold text-[#5AD49A]">{item.confidence}%</span>
                            <div className="h-1 w-16 overflow-hidden rounded-full bg-[#1E2638]">
                              <div className="h-full bg-[#3DBE7E]" style={{ width: `${item.confidence}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            icon={<ArrowRight className="h-4 w-4" />}
                            onClick={() => onNavigate?.('duty-calculator', { hsnCode: item.code, goodsDesc: item.description })}
                          >
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
              {/* Quick Action: Go to Duty Calculator */}
              <div className="p-4 border-t border-[#1E2638]/60 bg-[#0D1020]">
                <Button 
                  variant="secondary" 
                  className="w-full"
                  icon={<Calculator className="h-4 w-4" />}
                  onClick={() => onNavigate?.('duty-calculator')}
                >
                  Go to Duty Calculator
                </Button>
              </div>
            </Card>
          )}

          {pageId === 'duty-calculator' && (
            <M04DutyCalculatorPage
              onNavigate={onNavigate}
              initialHsnCode={navParams?.hsnCode}
              initialGoodsDesc={navParams?.goodsDesc}
              initialDocumentId={navParams?.documentId}
            />
          )}

          {pageId === 'boe-filing' && (
            <M05BOEFilingPage
              onNavigate={onNavigate}
              boeData={navParams?.boeData}
            />
          )}

          {pageId === 'fraud-detection' && (
            <TradeFraudPanel
              autoFilingId={navParams?.filingId}
            />
          )}

          {pageId === 'risk-scoring' && (
            <RiskScoringPanel />
          )}

          {pageId === 'compliance' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Automatic Verification Status</CardTitle>
                  <CardDescription>Real-time compliance checks across our multi-vector risk engine.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {COMPLIANCE_MOCK.map((check) => (
                    <div key={check.id} className="flex items-center gap-4 rounded-xl border border-[#1E2638] bg-[#111620] p-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${check.status === 'Passed' ? 'bg-[#3DBE7E]/10 text-[#3DBE7E]' : 'bg-[#E8934A]/10 text-[#E8934A]'}`}>
                        {check.status === 'Passed' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-[#E2E8F5]">{check.type}</p>
                          <Badge variant={check.status === 'Passed' ? 'success' : 'warning'}>{check.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-[#8B97AE] truncate">{check.details}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A5A72]">Score</p>
                        <p className="text-sm font-bold text-[#E2E8F5]">{check.confidence}%</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-[#161D2C] to-[#0D1020]">
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8C84A]/10 text-[#E8C84A] mb-4">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold text-[#E2E8F5]">Proactive Compliance Monitoring</h3>
                  <p className="mt-2 max-w-md text-sm text-[#8B97AE]">Our systems are scanning 14,000+ regulatory updates daily. You will be notified instantly of any policy changes affecting your active trades.</p>
                  <Button variant="secondary" className="mt-6">View Audit Trail</Button>
                </div>
              </Card>
            </div>
          )}

          {!['hs-codes', 'duty-calculator', 'boe-filing', 'fraud-detection', 'compliance'].includes(pageId) && (
             <Card className="py-20 text-center">
               <CardContent>
                 <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1E2638] text-[#4A5A72] mb-4">
                   <Zap className="h-8 w-8" />
                 </div>
                 <h2 className="text-xl font-bold text-[#E2E8F5]">{config.title} Content</h2>
                 <p className="mt-2 text-[#8B97AE]">We are integrating this operational module with the Orbis-AI core. Check back for real-time data soon.</p>
                 <Button variant="secondary" className="mt-8" onClick={() => window.history.back()}>Go Back</Button>
               </CardContent>
             </Card>
          )}
        </div>

        {/* Sidebar / Tools */}
        <div className="space-y-6 lg:col-span-4">
          <Card hover>
            <CardHeader>
              <CardTitle className="text-base">Intelligence Hub</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-[#0D1020] p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 shrink-0 text-[#E8C84A] mt-0.5" />
                  <div>
                    <p className="text-[13px] font-bold text-[#E2E8F5]">AI Classification Active</p>
                    <p className="mt-1 text-[12px] text-[#8B97AE] leading-relaxed">Our models are currently synced with the March 2024 Harmonized System updates.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                 <Button variant="secondary" className="w-full justify-start" icon={<ArrowRight className="h-4 w-4" />}>View Documentation</Button>
                 <Button variant="secondary" className="w-full justify-start" icon={<ArrowRight className="h-4 w-4" />}>Integration API</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#111620] border-[#E8C84A]/20">
             <CardHeader>
               <CardTitle className="text-base text-[#E8C84A]">Support & Guidance</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <p className="text-[12px] text-[#8B97AE]">Need assistance with a complex classification or duty dispute?</p>
               <Button className="w-full" icon={<Zap className="h-4 w-4" />}>Connect with Agent</Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default FeaturePage;
