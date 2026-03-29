/**
 * M06 — Trade Fraud Detection Engine Panel
 * ==========================================
 * Automatic fraud analysis — no manual data entry.
 * The user selects a completed BoE filing and clicks "Run Fraud Analysis".
 * All transaction data is pulled automatically from M05 (BoE) + M04 (duty).
 *
 * Company: SPECTRA AI PTE. LTD., Singapore
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { m06Service } from '../../services/api';

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeIn   = keyframes`from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}`;
const spinAnim = keyframes`to{transform:rotate(360deg)}`;
const pulseAnim= keyframes`0%,100%{opacity:1}50%{opacity:.5}`;
const fillBar  = keyframes`from{width:0}to{width:var(--w)}`;

// ─── Layout ────────────────────────────────────────────────────────────────────
const Container = styled.div`
  display:flex;flex-direction:column;gap:20px;
  padding:24px;color:var(--t-text);font-family:'Inter',sans-serif;
  background: var(--t-panel-bg);
  min-height:100%;
  animation:${fadeIn} .3s ease;
  transition: background 0.3s ease, color 0.3s ease;
`;
const Header = styled.div`
  display:flex;align-items:center;justify-content:space-between;
  padding-bottom:16px;border-bottom:1px solid var(--t-border);
`;
const Title = styled.h2`
  margin:0;font-size:20px;font-weight:700;
  background:linear-gradient(135deg,#60a5fa 0%,#38bdf8 55%,#22d3ee 100%);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  display:flex;align-items:center;gap:10px;
`;
const Badge = styled.span`
  font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;
  background:${p=>p.bg||'rgba(59,130,246,0.2)'};color:${p=>p.color||'var(--t-btn-color)'};
  letter-spacing:.5px;text-transform:uppercase;-webkit-text-fill-color:unset;
`;
const Card = styled.div`
  background:var(--t-card);border:1px solid var(--t-border);border-radius:12px;
  padding:20px;display:flex;flex-direction:column;gap:14px;
  backdrop-filter:blur(20px);box-shadow:var(--t-card-shadow);
  transition: background 0.3s ease;
`;
const CardTitle = styled.div`
  font-size:12px;font-weight:600;color:var(--t-text-sub);text-transform:uppercase;
  letter-spacing:.8px;display:flex;align-items:center;gap:8px;
`;
const Grid = styled.div`
  display:grid;grid-template-columns:${p=>p.cols||'1fr 1fr'};gap:${p=>p.gap||'16px'};
  @media(max-width:900px){grid-template-columns:1fr}
`;
const Tabs = styled.div`display:flex;gap:4px;border-bottom:1px solid var(--t-border);`;
const Tab  = styled.button`
  padding:8px 16px;font-size:12px;font-weight:600;border:none;background:transparent;
  cursor:pointer;border-bottom:2px solid ${p=>p.active?'#3B82F6':'transparent'};
  color:${p=>p.active?'var(--t-btn-color)':'var(--t-text-sub)'};transition:all .2s;
  &:hover{color:var(--t-text)}
`;

// ─── Filing Picker ─────────────────────────────────────────────────────────────
const FilingList = styled.div`display:flex;flex-direction:column;gap:8px;`;
const FilingRow  = styled.div`
  display:flex;align-items:center;gap:12px;
  padding:14px 16px;border-radius:10px;cursor:pointer;
  border:2px solid ${p=>p.selected?'#3B82F6':'var(--t-border)'};
  background:${p=>p.selected?'rgba(59,130,246,0.1)':'var(--t-bg-dark)'};
  transition:all .2s;
  &:hover{border-color:rgba(59,130,246,0.5);background:var(--t-hover)}
`;
const FilingRadio = styled.div`
  width:16px;height:16px;border-radius:50%;flex-shrink:0;
  border:2px solid ${p=>p.selected?'#3B82F6':'var(--t-border)'};
  background:${p=>p.selected?'#3B82F6':'transparent'};
  display:flex;align-items:center;justify-content:center;
  &::after{
    content:'';display:${p=>p.selected?'block':'none'};
    width:6px;height:6px;border-radius:50%;background:#fff;
  }
`;
const FilingInfo = styled.div`flex:1;`;
const FilingTitle= styled.div`font-size:13px;font-weight:600;color:var(--t-text);`;
const FilingMeta = styled.div`font-size:11px;color:var(--t-text-sub);margin-top:3px;display:flex;gap:10px;flex-wrap:wrap;`;
const FilingValue= styled.div`
  font-size:13px;font-weight:700;color:var(--t-btn-color);
  white-space:nowrap;
`;

// ─── Run button ────────────────────────────────────────────────────────────────
const RunBtn = styled.button`
  display:flex;align-items:center;justify-content:center;gap:10px;
  padding:14px 32px;border-radius:10px;border:none;font-size:15px;font-weight:700;
  cursor:pointer;transition:all .2s;width:100%;
  background:${p=>p.disabled?'var(--t-btn-dis-bg)':'linear-gradient(135deg,#3B82F6,#2563EB)'};
  color:${p=>p.disabled?'var(--t-text-dis)':'#fff'};
  box-shadow:${p=>p.disabled?'none':'0 4px 20px rgba(59,130,246,0.3)'};
  &:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 24px rgba(59,130,246,0.4)}
  &:disabled{cursor:not-allowed}
`;

// ─── Misc ──────────────────────────────────────────────────────────────────────
const Spinner  = styled.div`
  width:${p=>p.size||20}px;height:${p=>p.size||20}px;border-radius:50%;
  border:2px solid rgba(59,130,246,0.2);border-top-color:#3B82F6;
  animation:${spinAnim} .8s linear infinite;flex-shrink:0;
`;
const Pulsing  = styled.div`animation:${pulseAnim} 1.5s ease infinite;color:var(--t-text-sub);font-size:13px;`;
const Alert    = styled.div`
  padding:12px 16px;border-radius:8px;font-size:13px;
  background:${p=>p.type==='error'?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)'};
  border:1px solid ${p=>p.type==='error'?'rgba(239,68,68,0.3)':'rgba(16,185,129,0.3)'};
  color:${p=>p.type==='error'?'#f87171':'#34d399'};
`;
const EmptyState = styled.div`
  text-align:center;padding:40px;color:var(--t-text-sub);font-size:13px;
  display:flex;flex-direction:column;align-items:center;gap:10px;
`;

// ─── Score ─────────────────────────────────────────────────────────────────────
const ScoreRing = styled.div`
  width:130px;height:130px;border-radius:50%;margin:0 auto;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  border:7px solid ${p=>_riskColor(p.level)};
  background:${p=>_riskColor(p.level)}18;
`;
const ScoreNum  = styled.div`font-size:36px;font-weight:800;color:${p=>_riskColor(p.level)};`;
const RiskLbl   = styled.div`font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${p=>_riskColor(p.level)};`;
const RiskBadge = styled.span`
  font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;
  background:${p=>_riskColor(p.level)}25;color:${p=>_riskColor(p.level)};
`;

function _riskColor(level) {
  return level==='CRITICAL'?'#f87171':level==='HIGH_RISK'?'#fbbf24':level==='SUSPICIOUS'?'#f59e0b':'#34d399';
}

// ─── Sub-score bars ────────────────────────────────────────────────────────────
const BarRow  = styled.div`display:flex;align-items:center;gap:10px;`;
const BarName = styled.div`font-size:11px;color:var(--t-text-sub);width:150px;flex-shrink:0;`;
const BarBg   = styled.div`flex:1;background:var(--t-hover-dark);border-radius:4px;height:7px;overflow:hidden;`;
const ResultRoot = styled.div`display:flex;flex-direction:column;gap:16px;animation:${fadeIn} .4s ease;`;
const BarFill = styled.div`
  height:100%;border-radius:4px;background:${p=>p.color||'#3B82F6'};
  --w:${p=>p.pct}%;animation:${fillBar} .8s ease forwards;width:var(--w);
`;
const BarVal  = styled.div`font-size:11px;color:var(--t-text);width:36px;text-align:right;`;

// ─── Flag card ─────────────────────────────────────────────────────────────────
const FlagCard    = styled.div`
  background:${p=>p.score>=70?'rgba(239,68,68,0.08)':p.score>=40?'rgba(245,158,11,0.08)':'rgba(16,185,129,0.08)'};
  border:1px solid ${p=>p.score>=70?'rgba(239,68,68,0.25)':p.score>=40?'rgba(245,158,11,0.25)':'rgba(16,185,129,0.25)'};
  border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:5px;
`;
const FlagTop     = styled.div`display:flex;justify-content:space-between;align-items:center;`;
const FlagType    = styled.div`font-size:12px;font-weight:700;color:var(--t-text);`;
const FlagScore   = styled.div`font-size:18px;font-weight:800;color:${p=>p.score>=70?'#f87171':p.score>=40?'#fbbf24':'#34d399'};`;
const FlagAlgo    = styled.div`font-size:10px;color:var(--t-text-ter);font-style:italic;`;
const FlagEvidence= styled.div`font-size:11px;color:var(--t-text-sub);line-height:1.5;`;

// ─── Case row ──────────────────────────────────────────────────────────────────
const CaseRow   = styled.div`
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 14px;background:var(--t-card);border:1px solid var(--t-border-light);border-radius:8px;
`;
const CaseBadge = styled.span`
  font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;
  background:${p=>p.status==='OPEN'?'rgba(239,68,68,0.2)':p.status==='UNDER_REVIEW'?'rgba(245,158,11,0.2)':p.status==='ESCALATED'?'rgba(168,85,247,0.2)':'rgba(16,185,129,0.2)'};
  color:${p=>p.status==='OPEN'?'#f87171':p.status==='UNDER_REVIEW'?'#fbbf24':p.status==='ESCALATED'?'#c084fc':'#34d399'};
`;
const SmallBtn  = styled.button`
  padding:4px 10px;border-radius:6px;border:${p=>p.danger?'none':'1px solid var(--t-border)'};
  font-size:11px;font-weight:600;cursor:pointer;background:${p=>p.danger?'rgba(239,68,68,0.8)':'transparent'};
  color:${p=>p.danger?'#ffffff':'var(--t-text-sub)'};transition:all .2s;&:hover{opacity:.8}
`;

// ─── Constants ────────────────────────────────────────────────────────────────
const FRAUD_DISPLAY = {
  UNDER_INVOICING:'Under-Invoicing', OVER_INVOICING:'Over-Invoicing',
  HSN_MANIPULATION:'HSN Manipulation', MISDECLARATION:'Misdeclaration of Goods',
  SHELL_COMPANY_NETWORK:'Shell Company Network',
  COUNTRY_OF_ORIGIN_FRAUD:'Country of Origin Fraud',
  TRANSSHIPMENT_ROUTING_FRAUD:'Transshipment Routing Fraud',
  DUPLICATE_INVOICING:'Duplicate Invoicing',
  BENFORD_LAW_VIOLATION:"Benford's Law Violation",
  SPLIT_SHIPMENT_FRAUD:'Split Shipment Fraud',
  FREIGHT_INSURANCE_MANIPULATION:'Freight/Insurance Manipulation',
  RELATED_PARTY_PRICING:'Related-Party Pricing Abuse',
  SUDDEN_TRADE_PATTERN_CHANGE:'Sudden Trade Pattern Change',
  FTA_MISUSE:'FTA Benefit Misuse',
  RESTRICTED_ORIGIN:'Restricted Origin',
};

const SCORE_META = [
  { key:'ecod',      label:'ECOD — Value Anomaly',    color:'#3B82F6' },
  { key:'hclnet',    label:'HCLNet — Network Graph',  color:'#a78bfa' },
  { key:'hsn',       label:'HSN Manipulation',        color:'#fbbf24' },
  { key:'benford',   label:"Benford's Law",            color:'#f59e0b' },
  { key:'routing',   label:'Routing Anomaly',          color:'#f87171' },
  { key:'duplicate', label:'Duplicate Invoice',        color:'#fb923c' },
  { key:'temporal',  label:'Temporal Change',          color:'#34d399' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function TradeFraudPanel() {
  const [tab, setTab]             = useState('analyse');
  const [filings, setFilings]     = useState([]);
  const [filingsLoading, setFilingsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');
  const [cases, setCases]         = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [history, setHistory]     = useState([]);

  // load filings on mount
  useEffect(() => { loadFilings(); }, []);

  useEffect(() => {
    if (tab === 'cases')   loadCases();
    if (tab === 'history') loadHistory();
  }, [tab]); // eslint-disable-line

  const loadFilings = async () => {
    setFilingsLoading(true);
    try {
      const data = await m06Service.getRecentFilings(20);
      setFilings(data.filings || []);
    } catch { setFilings([]); }
    finally { setFilingsLoading(false); }
  };

  const loadCases   = async () => {
    setCasesLoading(true);
    try { const d = await m06Service.getCases(null,50); setCases(d.cases||[]); }
    catch { setCases([]); } finally { setCasesLoading(false); }
  };

  const loadHistory = async () => {
    try { const d = await m06Service.getHistory(30); setHistory(d.analyses||[]); }
    catch { setHistory([]); }
  };

  const handleRun = async () => {
    if (!selectedId) return;
    setError(''); setResult(null); setRunning(true);
    try {
      const data = await m06Service.analyseAuto(selectedId);
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Analysis failed');
    } finally { setRunning(false); }
  };

  const handleCaseAction = async (caseId, action, status) => {
    try { await m06Service.updateCase(caseId,{status,action}); await loadCases(); } catch {}
  };

  const selectedFiling = filings.find(f => f.filing_id === selectedId);

  return (
    <Container>
      <Header>
        <Title>
          🔍 Trade Fraud Detection Engine
          <Badge bg="rgba(59,130,246,0.15)" color="var(--t-btn-color)">M06</Badge>
          <Badge bg="rgba(16,185,129,0.1)"  color="#34d399">HCLNet</Badge>
          <Badge bg="rgba(6,182,212,0.1)"   color="var(--t-btn-color)">ECOD</Badge>
        </Title>
      </Header>

      <Tabs>
        {[['analyse','Analyse'],['cases','Investigation Cases'],['history','History']]
          .map(([k,l]) => <Tab key={k} active={tab===k} onClick={()=>setTab(k)}>{l}</Tab>)}
      </Tabs>

      {/* ── Analyse tab ── */}
      {tab === 'analyse' && (
        <>
          {/* Step 1: Filing picker */}
          <Card>
            <CardTitle>
              Step 1 — Select a completed BoE filing
              <SmallBtn onClick={loadFilings} style={{marginLeft:'auto'}}>
                {filingsLoading
                  ? <Spinner size={12} style={{display:'inline-block'}}/>
                  : '↺ Refresh'}
              </SmallBtn>
            </CardTitle>

            {filingsLoading && (
              <Pulsing>Loading BoE filings from M05...</Pulsing>
            )}

            {!filingsLoading && filings.length === 0 && (
              <EmptyState>
                <span style={{fontSize:32}}>📄</span>
                <div>No BoE filings found.</div>
                <div style={{fontSize:12}}>Complete a Bill of Entry in the BoE Filing panel first.</div>
              </EmptyState>
            )}

            {!filingsLoading && filings.length > 0 && (
              <FilingList>
                {filings.map(f => (
                  <FilingRow
                    key={f.filing_id}
                    selected={selectedId === f.filing_id}
                    onClick={() => { setSelectedId(f.filing_id); setResult(null); setError(''); }}
                  >
                    <FilingRadio selected={selectedId === f.filing_id} />
                    <FilingInfo>
                      <FilingTitle>
                        {f.importer_name || f.importer_iec || `Filing #${f.filing_id}`}
                      </FilingTitle>
                      <FilingMeta>
                        <span>HSN: <b style={{color:'var(--t-text)'}}>{f.hsn_code || '—'}</b></span>
                        <span>COO: <b style={{color:'var(--t-text)'}}>{f.country_of_origin || '—'}</b></span>
                        <span>Port: <b style={{color:'var(--t-text)'}}>{f.port_of_import || '—'}</b></span>
                        <span>{new Date(f.created_at).toLocaleDateString()}</span>
                        <StatusPip status={f.icegate_status}>{f.icegate_status || f.filing_status}</StatusPip>
                      </FilingMeta>
                      {f.description_of_goods && (
                        <div style={{fontSize:11,color:'var(--t-text-sub)',marginTop:3}}>
                          {String(f.description_of_goods).slice(0,80)}
                        </div>
                      )}
                    </FilingInfo>
                    {f.custom_value_inr && (
                      <FilingValue>
                        ₹{Number(f.custom_value_inr).toLocaleString('en-IN')}
                      </FilingValue>
                    )}
                  </FilingRow>
                ))}
              </FilingList>
            )}
          </Card>

          {/* Step 2: Run button */}
          <Card style={{gap:10}}>
            <CardTitle>Step 2 — Run Fraud Analysis</CardTitle>

            {selectedFiling ? (
              <div style={{fontSize:12,color:'var(--t-text-sub)',padding:'8px 12px',
                background:'rgba(59,130,246,0.08)',borderRadius:8,
                border:'1px solid rgba(59,130,246,0.2)'}}>
                Selected: <b style={{color:'var(--t-text)'}}>
                  {selectedFiling.importer_name || selectedFiling.importer_iec || `Filing #${selectedFiling.filing_id}`}
                </b>
                {' · '}Filing #{selectedFiling.filing_id}
                {' · '}Data will be pulled automatically from M05 BoE + M04 Duty records
              </div>
            ) : (
              <div style={{fontSize:12,color:'var(--t-text-sub)'}}>
                ← Select a filing above to enable analysis
              </div>
            )}

            <RunBtn onClick={handleRun} disabled={!selectedId || running}>
              {running
                ? <><Spinner size={18}/> Analysing — ECOD · HCLNet · PrefixSpan · Benford · Routing...</>
                : <>🔍 Run Fraud Analysis</>
              }
            </RunBtn>
          </Card>

          {error && <Alert type="error">{error}</Alert>}

          {/* Results */}
          {result && !running && <AnalysisResult result={result} />}
        </>
      )}

      {/* ── Cases tab ── */}
      {tab === 'cases' && (
        <Card>
          <CardTitle>
            ⚖️ Investigation Cases
            <SmallBtn onClick={loadCases} style={{marginLeft:'auto'}}>
              {casesLoading ? <Spinner size={12} style={{display:'inline-block'}}/> : '↺ Refresh'}
            </SmallBtn>
          </CardTitle>
          {casesLoading ? <Pulsing>Loading...</Pulsing>
            : cases.length === 0
              ? <EmptyState><span style={{fontSize:32}}>📁</span><div>No investigation cases.</div></EmptyState>
              : cases.map(c => (
                  <CaseRow key={c.id}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--t-text)'}}>
                        {c.importer_name || c.importer_iec || 'Unknown'}
                      </div>
                      <div style={{fontSize:11,color:'var(--t-text-sub)',marginTop:2}}>
                        IEC: {c.importer_iec} · Score: {parseFloat(c.composite_score||0).toFixed(1)} · {c.risk_level}
                        {' · '}{new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <CaseBadge status={c.status}>{c.status}</CaseBadge>
                    {c.status === 'OPEN' && (
                      <div style={{display:'flex',gap:6}}>
                        <SmallBtn onClick={()=>handleCaseAction(c.id,'WARN','UNDER_REVIEW')}>Review</SmallBtn>
                        <SmallBtn danger onClick={()=>handleCaseAction(c.id,'DETAIN','ESCALATED')}>Escalate</SmallBtn>
                      </div>
                    )}
                  </CaseRow>
                ))
          }
        </Card>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <Card>
          <CardTitle>📜 Analysis History</CardTitle>
          {history.length === 0
            ? <EmptyState><span style={{fontSize:32}}>🕐</span><div>No analyses yet.</div></EmptyState>
            : history.map(h => (
                <div key={h.analysis_uuid} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'10px 0',borderBottom:'1px solid var(--t-border)',fontSize:12}}>
                  <div>
                    <div style={{color:'var(--t-text)',fontWeight:600}}>
                      {h.importer_name || h.importer_iec || 'Unknown'}
                    </div>
                    <div style={{color:'var(--t-text-sub)',marginTop:2}}>
                      {new Date(h.created_at).toLocaleString()}
                      {' · '}{h.fraud_types_count || 0} fraud type(s)
                    </div>
                  </div>
                  <RiskBadge level={h.risk_level}>
                    {parseFloat(h.composite_score||0).toFixed(1)} — {h.risk_level}
                  </RiskBadge>
                </div>
              ))
          }
        </Card>
      )}
    </Container>
  );
}

// ─── StatusPip ────────────────────────────────────────────────────────────────
const StatusPip = styled.span`
  font-size:10px;padding:1px 7px;border-radius:8px;font-weight:600;
  background:${p=>p.status==='ACCEPTED'?'rgba(16,185,129,0.15)':
    p.status==='NOT_SUBMITTED'||p.status==='DRAFT'?'var(--t-bg-dark)':
    'rgba(245,158,11,0.15)'};
  color:${p=>p.status==='ACCEPTED'?'#34d399':
    p.status==='NOT_SUBMITTED'||p.status==='DRAFT'?'var(--t-text-sub)':
    '#fbbf24'};
`;

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Result Component
// ─────────────────────────────────────────────────────────────────────────────
function AnalysisResult({ result }) {
  const {
    composite_score=0, risk_level='CLEAN', fraud_flags=[],
    scores={}, details={}, hclnet={}, recommendation='', case_id,
    model_versions={}, source={},
  } = result;

  const recColor = recommendation==='REFER_TO_DRI'?'#f87171'
    :recommendation==='ASSIGN_TO_SIIB'?'#fbbf24'
    :recommendation==='FLAG_FOR_REVIEW'?'#f59e0b':'#34d399';

  return (
    <ResultRoot>

      {/* Source banner */}
      <div style={{fontSize:12,color:'var(--t-text-sub)',padding:'8px 14px',
        background:'rgba(104,211,145,.05)',borderRadius:8,border:'1px solid rgba(104,211,145,.15)'}}>
        ✅ Data auto-pulled from{' '}
        {source.filing_id ? <b style={{color:'#34d399'}}>M05 BoE Filing #{source.filing_id}</b> : null}
        {source.document_id ? <> + <b style={{color:'#34d399'}}>M02 Document #{source.document_id}</b></> : null}
        {' '}— no manual input required
      </div>

      {/* Score overview */}
      <Grid cols="1fr 1fr 1fr">
        <Card style={{alignItems:'center',gap:8}}>
          <CardTitle>Composite Fraud Score</CardTitle>
          <ScoreRing level={risk_level}>
            <ScoreNum level={risk_level}>{parseFloat(composite_score).toFixed(0)}</ScoreNum>
            <RiskLbl level={risk_level}>{risk_level?.replace(/_/g,' ')}</RiskLbl>
          </ScoreRing>
        </Card>

        <Card>
          <CardTitle>Sub-scores</CardTitle>
          {SCORE_META.map(({key,label,color})=>(
            <BarRow key={key}>
              <BarName>{label}</BarName>
              <BarBg><BarFill pct={Math.min(scores[key]||0,100)} color={color}/></BarBg>
              <BarVal>{(scores[key]||0).toFixed(0)}</BarVal>
            </BarRow>
          ))}
        </Card>

        <Card>
          <CardTitle>Recommendation</CardTitle>
          <div style={{fontSize:14,fontWeight:700,color:recColor,marginTop:2}}>
            {recommendation?.replace(/_/g,' ')}
          </div>
          {case_id && (
            <Alert type="error" style={{fontSize:12,padding:'8px 12px',marginTop:4}}>
              Investigation Case #{case_id} auto-created
            </Alert>
          )}
          <CardTitle style={{marginTop:8}}>HCLNet Network</CardTitle>
          <div style={{fontSize:12,color:'var(--t-text-sub)'}}>
            Score: <b style={{color:'#a78bfa'}}>{(hclnet.score||0).toFixed(1)}</b>
            {' · '}Community: <b>{hclnet.community_size||1}</b> entities
            {' · '}<b style={{color:'#34d399'}}>{hclnet.model_used}</b>
          </div>
          <CardTitle style={{marginTop:8}}>Models Used</CardTitle>
          {Object.entries(model_versions).map(([k,v])=>(
            <div key={k} style={{fontSize:11,color:'var(--t-text-sub)'}}>
              {k}: <span style={{color:'var(--t-text-sub)'}}>{v}</span>
            </div>
          ))}
        </Card>
      </Grid>

      {/* Fraud flags */}
      {fraud_flags.length > 0 ? (
        <Card>
          <CardTitle>🚨 Fraud Flags Detected ({fraud_flags.length})</CardTitle>
          <Grid cols="1fr 1fr">
            {fraud_flags.map((flag,i)=>(
              <FlagCard key={i} score={flag.score}>
                <FlagTop>
                  <FlagType>{FRAUD_DISPLAY[flag.fraud_type]||flag.fraud_type}</FlagType>
                  <FlagScore score={flag.score}>{flag.score?.toFixed(0)}/100</FlagScore>
                </FlagTop>
                <FlagAlgo>{flag.algorithm}</FlagAlgo>
                <FlagEvidence>{flag.evidence}</FlagEvidence>
              </FlagCard>
            ))}
          </Grid>
        </Card>
      ) : (
        <Alert>✅ No fraud flags detected. Transaction appears clean.</Alert>
      )}

      {/* Benford chart (only if enough samples) */}
      {details.benford?.sample_size >= 30 && (
        <Card>
          <CardTitle>
            📊 Benford's Law Analysis
            {details.benford.violated
              ? <Badge bg="rgba(239,68,68,0.15)" color="#f87171">VIOLATED p={details.benford.p_value}</Badge>
              : <Badge bg="rgba(16,185,129,0.1)" color="#34d399">NORMAL</Badge>}
          </CardTitle>
          <div style={{fontSize:11,color:'var(--t-text-sub)',marginBottom:4}}>
            Blue = observed · Grey = Benford expected (first-digit law)
          </div>
          <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
            {[1,2,3,4,5,6,7,8,9].map(d=>{
              const obs=(details.benford.observed_freq?.[d]||0)*100;
              const exp=(details.benford.expected_freq?.[d]||0)*100;
              return (
                <div key={d} style={{flex:1,display:'flex',flexDirection:'column',
                  alignItems:'center',gap:2,height:'100%',justifyContent:'flex-end'}}>
                  <div style={{display:'flex',gap:1,alignItems:'flex-end',
                    height:70,width:'100%',justifyContent:'center'}}>
                    <div style={{flex:1,borderRadius:'3px 3px 0 0',background:'#3B82F6',
                      height:`${Math.min(obs*3,100)}%`,minHeight:obs>0?2:0,
                      transition:'height .5s ease'}} title={`Obs: ${obs.toFixed(1)}%`}/>
                    <div style={{flex:1,borderRadius:'3px 3px 0 0',background:'rgba(255,255,255,0.2)',
                      height:`${Math.min(exp*3,100)}%`,transition:'height .5s ease'}}
                      title={`Exp: ${exp.toFixed(1)}%`}/>
                  </div>
                  <div style={{fontSize:10,color:'var(--t-text-sub)'}}>{d}</div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:'var(--t-text-sub)'}}>{details.benford.evidence}</div>
        </Card>
      )}

      {/* Routing */}
      {details.routing?.is_anomaly && (
        <Card>
          <CardTitle>🌐 Routing Anomaly Detected</CardTitle>
          {(details.routing.evidence||[]).map((ev,i)=>(
            <div key={i} style={{fontSize:12,color:'var(--t-text-sub)',padding:'6px 0',
              borderBottom:i<details.routing.evidence.length-1?'1px solid var(--t-border)':'none'}}>
              {ev}
            </div>
          ))}
          <div style={{fontSize:11,color:'var(--t-text-sub)'}}>
            {details.routing.coo} → {details.routing.country_of_shipment}
            {' · '}{details.routing.hop_distance} routing hop(s)
          </div>
        </Card>
      )}

      {/* HSN patterns */}
      {details.hsn_patterns?.is_anomaly && (
        <Card>
          <CardTitle>🔄 HSN Manipulation Patterns</CardTitle>
          {(details.hsn_patterns.evidence||[]).map((ev,i)=>(
            <div key={i} style={{fontSize:12,color:'#fbbf24',marginBottom:4}}>{ev}</div>
          ))}
          {details.hsn_patterns.frequent_patterns?.slice(0,3).map((p,i)=>(
            <div key={i} style={{fontSize:12,color:'var(--t-text)',fontFamily:'monospace',
              background:'rgba(59,130,246,0.1)',padding:'4px 8px',borderRadius:4}}>
              {p.sequence?.join(' → ')} <span style={{color:'var(--t-text-sub)'}}>(×{p.support} shipments)</span>
            </div>
          ))}
        </Card>
      )}
    </ResultRoot>
  );
}
