/**
 * M07 — Risk Score Engine Panel
 * ================================
 * Automatic composite risk scoring — user selects a completed BoE filing
 * and clicks "Run Risk Score". All 12 features are pulled automatically
 * from M02 / M03 / M04 / M05 / M06. TabPFN-2.5 produces a 0–100 score
 * with SHAP-style feature contributions for full audit transparency.
 *
 * Company: SPECTRA AI PTE. LTD., Singapore
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { m07Service } from '../../services/api';

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeIn   = keyframes`from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}`;
const spinAnim = keyframes`to{transform:rotate(360deg)}`;
const fillBar  = keyframes`from{width:0}to{width:var(--w)}`;
const pulseAnim= keyframes`0%,100%{opacity:1}50%{opacity:.45}`;

// ─── Layout ────────────────────────────────────────────────────────────────────
const Container = styled.div`
  display:flex;flex-direction:column;gap:20px;
  padding:24px;color:var(--t-text);font-family:'Inter',sans-serif;
  animation:${fadeIn} .3s ease;
  background: var(--t-panel-bg);
  min-height: 100%;
  transition: background 0.3s ease, color 0.3s ease;
`;
const Header = styled.div`
  display:flex;align-items:center;justify-content:space-between;
  padding-bottom:16px;border-bottom:1px solid var(--t-border);
`;
const Title = styled.h2`
  margin:0;font-size:20px;font-weight:700;
  background:linear-gradient(135deg,#E8C84A 0%,#6BBCD4 55%,#8DD4EC 100%);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  display:flex;align-items:center;gap:10px;
`;
const Badge = styled.span`
  font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;
  background:${p=>p.bg||'var(--t-badge-bg)'};color:${p=>p.color||'var(--t-badge-color)'};
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
const Tabs = styled.div`display:flex;gap:4px;border-bottom:1px solid var(--t-border-light);`;
const Tab  = styled.button`
  padding:8px 16px;font-size:12px;font-weight:600;border:none;background:transparent;
  cursor:pointer;border-bottom:2px solid ${p=>p.active?'#E8C84A':'transparent'};
  color:${p=>p.active?'var(--t-btn-color)':'var(--t-text-sub)'};transition:all .2s;
  &:hover{color:var(--t-text)}
`;

// ─── Filing picker ─────────────────────────────────────────────────────────────
const FilingList = styled.div`display:flex;flex-direction:column;gap:8px;`;
const FilingRow  = styled.div`
  display:flex;align-items:center;gap:12px;
  padding:14px 16px;border-radius:10px;cursor:pointer;
  border:2px solid ${p=>p.selected?'#C9A520':'var(--t-border)'};
  background:${p=>p.selected?'rgba(201,165,32,0.1)':'var(--t-bg-dark)'};
  transition:all .2s;
  &:hover{border-color:rgba(201,165,32,0.4);background:var(--t-hover)}
`;
const FilingRadio = styled.div`
  width:16px;height:16px;border-radius:50%;flex-shrink:0;
  border:2px solid ${p=>p.selected?'#C9A520':'var(--t-border)'};
  background:${p=>p.selected?'#C9A520':'transparent'};
  display:flex;align-items:center;justify-content:center;
  &::after{
    content:'';display:${p=>p.selected?'block':'none'};
    width:6px;height:6px;border-radius:50%;background:#fff;
  }
`;
const FilingInfo = styled.div`flex:1;`;
const FilingName = styled.div`font-size:13px;font-weight:600;color:var(--t-text);`;
const FilingMeta = styled.div`font-size:11px;color:var(--t-text-sub);margin-top:3px;display:flex;gap:10px;flex-wrap:wrap;`;

// ─── Misc ──────────────────────────────────────────────────────────────────────
const Spinner = styled.div`
  width:${p=>p.size||20}px;height:${p=>p.size||20}px;border-radius:50%;
  border:2px solid rgba(201,165,32,0.2);border-top-color:#C9A520;
  animation:${spinAnim} .8s linear infinite;flex-shrink:0;
`;
const Pulsing = styled.div`animation:${pulseAnim} 1.5s ease infinite;color:var(--t-text-sub);font-size:13px;`;
const Alert   = styled.div`
  padding:12px 16px;border-radius:8px;font-size:13px;
  background:${p=>p.type==='error'?'rgba(252,129,129,.1)':'rgba(104,211,145,.1)'};
  border:1px solid ${p=>p.type==='error'?'rgba(252,129,129,.3)':'rgba(104,211,145,.3)'};
  color:${p=>p.type==='error'?'#fc8181':'#68d391'};
`;
const EmptyState = styled.div`
  text-align:center;padding:40px;color:var(--t-text-sub);font-size:13px;
  display:flex;flex-direction:column;align-items:center;gap:10px;
`;
const RunBtn = styled.button`
  padding:12px 32px;border-radius:10px;border:none;cursor:pointer;font-size:14px;font-weight:700;
  background:${p=>p.disabled?'var(--t-hover)':'linear-gradient(135deg,#C9A520,#876E12)'};
  color:${p=>p.disabled?'var(--t-text-ter)':'#fff'};
  transition:all .2s;display:flex;align-items:center;gap:8px;
  &:hover:not(:disabled){background:linear-gradient(135deg,#3b82f6,#876E12);transform:translateY(-1px)}
`;
const StatusPip = styled.span`
  font-size:10px;padding:1px 7px;border-radius:8px;font-weight:600;
  background:${p=>p.status==='ACCEPTED'?'rgba(104,211,145,.15)':
    p.status==='NOT_SUBMITTED'||p.status==='DRAFT'?'rgba(160,174,192,.1)':
    'rgba(246,173,85,.15)'};
  color:${p=>p.status==='ACCEPTED'?'#68d391':
    p.status==='NOT_SUBMITTED'||p.status==='DRAFT'?'var(--t-text-sub)':
    '#f6ad55'};
`;

// ─── Score display ─────────────────────────────────────────────────────────────
const ScoreGauge = styled.div`
  width:140px;height:140px;border-radius:50%;margin:0 auto;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  border:8px solid ${p=>_tierColor(p.tier)};
  background:${p=>_tierColor(p.tier)}18;
`;
const ScoreNum = styled.div`font-size:40px;font-weight:800;color:${p=>_tierColor(p.tier)};line-height:1;`;
const ScoreLbl = styled.div`font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${p=>_tierColor(p.tier)};margin-top:4px;`;
const TierBadge = styled.div`
  display:inline-flex;align-items:center;gap:6px;
  padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;
  background:${p=>_tierColor(p.tier)}20;
  color:${p=>_tierColor(p.tier)};
  border:1px solid ${p=>_tierColor(p.tier)}40;
`;

function _tierColor(tier) {
  return tier==='RED'?'#fc8181':tier==='AMBER'?'#f6ad55':'#68d391';
}

// ─── Feature bars ──────────────────────────────────────────────────────────────
const BarRow  = styled.div`display:flex;align-items:center;gap:10px;margin-bottom:6px;`;
const BarName = styled.div`font-size:11px;color:var(--t-text-sub);width:200px;flex-shrink:0;`;
const BarBg   = styled.div`flex:1;background:var(--t-glass-light);border-radius:4px;height:7px;overflow:hidden;`;
const BarFill = styled.div`
  height:100%;border-radius:4px;
  background:${p=>p.pct>60?'#fc8181':p.pct>25?'#f6ad55':'#68d391'};
  --w:${p=>p.pct}%;animation:${fillBar} .8s ease forwards;width:var(--w);
`;
const BarVal  = styled.div`font-size:11px;color:var(--t-text);width:40px;text-align:right;`;

// ─── Queue row ─────────────────────────────────────────────────────────────────
const QueueRow = styled.div`
  display:flex;align-items:center;gap:12px;padding:14px 16px;
  border-radius:10px;border:1px solid var(--t-border);background:var(--t-card);
  margin-bottom:8px;
`;
const QueueTierDot = styled.div`
  width:10px;height:10px;border-radius:50%;flex-shrink:0;
  background:${p=>_tierColor(p.tier)};
`;
const ResultRoot = styled.div`display:flex;flex-direction:column;gap:16px;animation:${fadeIn} .4s ease;`;

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────
export default function RiskScoringPanel() {
  const [activeTab,    setActiveTab]    = useState('score');
  const [filings,      setFilings]      = useState([]);
  const [loadingList,  setLoadingList]  = useState(true);
  const [selectedId,   setSelectedId]   = useState(null);
  const [running,      setRunning]      = useState(false);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState(null);
  const [queue,        setQueue]        = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [history,      setHistory]      = useState([]);
  const [loadingHist,  setLoadingHist]  = useState(false);

  // Load filing list on mount
  useEffect(() => {
    m07Service.getRecentFilings(20)
      .then(d => setFilings(d.filings || []))
      .catch(() => setFilings([]))
      .finally(() => setLoadingList(false));
  }, []);

  // Load queue / history when tab changes
  useEffect(() => {
    if (activeTab === 'queue' && queue.length === 0) {
      setLoadingQueue(true);
      m07Service.getQueue(null, null, 30)
        .then(d => setQueue(d.items || []))
        .catch(() => {})
        .finally(() => setLoadingQueue(false));
    }
    if (activeTab === 'history' && history.length === 0) {
      setLoadingHist(true);
      m07Service.getHistory(30)
        .then(d => setHistory(d.scores || []))
        .catch(() => {})
        .finally(() => setLoadingHist(false));
    }
  }, [activeTab]);

  const handleRun = useCallback(async () => {
    if (!selectedId || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await m07Service.scoreAuto(selectedId);
      if (!data.success) throw new Error(data.error || 'Scoring failed');
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Scoring failed');
    } finally {
      setRunning(false);
    }
  }, [selectedId, running]);

  return (
    <Container>
      <Header>
        <Title>
          ⚠️ M07 — Risk Score Engine
          <Badge bg="rgba(246,173,85,.15)" color="#f6ad55">TabPFN-2.5</Badge>
        </Title>
        <Badge bg="rgba(104,211,145,.1)" color="#68d391">AUTO-PIPELINE</Badge>
      </Header>

      <Tabs>
        {[
          { key:'score',   label:'Score Shipment' },
          { key:'queue',   label:'Review Queue' },
          { key:'history', label:'History' },
        ].map(t => (
          <Tab key={t.key} active={activeTab===t.key} onClick={()=>setActiveTab(t.key)}>
            {t.label}
          </Tab>
        ))}
      </Tabs>

      {/* ── Tab: Score ───────────────────────────────────────────────────────── */}
      {activeTab === 'score' && (
        <>
          {/* Step 1: Select filing */}
          <Card>
            <CardTitle>Step 1 — Select BoE Filing</CardTitle>
            {loadingList ? (
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <Spinner/><Pulsing>Loading filings…</Pulsing>
              </div>
            ) : filings.length === 0 ? (
              <EmptyState>
                <div style={{fontSize:28}}>📋</div>
                <div>No BoE filings found. Complete a Bill of Entry in M05 first.</div>
              </EmptyState>
            ) : (
              <FilingList>
                {filings.map(f => (
                  <FilingRow
                    key={f.id}
                    selected={selectedId === f.id}
                    onClick={() => { setSelectedId(f.id); setResult(null); setError(null); }}
                  >
                    <FilingRadio selected={selectedId === f.id}/>
                    <FilingInfo>
                      <FilingName>{f.importer_name || `Filing #${f.id}`}</FilingName>
                      <FilingMeta>
                        {f.importer_iec && <span>IEC: {f.importer_iec}</span>}
                        {f.hsn_code     && <span>HSN: {f.hsn_code}</span>}
                        {f.country_of_origin && <span>COO: {f.country_of_origin}</span>}
                        {f.port_of_import    && <span>Port: {f.port_of_import}</span>}
                        {f.cif_value_inr && (
                          <span>CIF: ₹{Number(f.cif_value_inr).toLocaleString('en-IN')}</span>
                        )}
                      </FilingMeta>
                    </FilingInfo>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <StatusPip status={f.status}>{f.status || 'DRAFT'}</StatusPip>
                      {f.created_at && (
                        <div style={{fontSize:10,color:'var(--t-text-sub)',marginTop:3}}>
                          {new Date(f.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </FilingRow>
                ))}
              </FilingList>
            )}
          </Card>

          {/* Step 2: Run */}
          <Card>
            <CardTitle>Step 2 — Run Risk Score</CardTitle>
            <div style={{fontSize:12,color:'var(--t-text-sub)',lineHeight:1.6}}>
              The engine automatically pulls all 12 features from
              {' '}<b style={{color:'var(--t-text-sub)'}}>M02</b> (document completeness),
              {' '}<b style={{color:'var(--t-text-sub)'}}>M03</b> (HSN confidence),
              {' '}<b style={{color:'var(--t-text-sub)'}}>M04</b> (duty anomalies),
              {' '}<b style={{color:'var(--t-text-sub)'}}>M05</b> (compliance history),
              {' '}<b style={{color:'var(--t-text-sub)'}}>M06</b> (fraud score) and computes a
              {' '}<b style={{color:'#f6ad55'}}>TabPFN-2.5</b> composite risk score with
              {' '}SHAP-style feature attributions.
            </div>
            <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
              <RunBtn
                disabled={!selectedId || running}
                onClick={handleRun}
              >
                {running ? <><Spinner size={16}/> Running…</> : '▶ Run Risk Score'}
              </RunBtn>
              {selectedId && !running && (
                <span style={{fontSize:12,color:'#68d391'}}>
                  ✓ Filing #{selectedId} selected
                </span>
              )}
            </div>
            {error && <Alert type="error">⚠ {error}</Alert>}
          </Card>

          {/* Result */}
          {result && <ScoreResult result={result}/>}
        </>
      )}

      {/* ── Tab: Review Queue ────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <Card>
          <CardTitle>Review Queue — AMBER &amp; RED Shipments</CardTitle>
          {loadingQueue ? (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Spinner/><Pulsing>Loading queue…</Pulsing>
            </div>
          ) : queue.length === 0 ? (
            <EmptyState>
              <div style={{fontSize:28}}>✅</div>
              <div>No items in review queue — all shipments are green-cleared.</div>
            </EmptyState>
          ) : (
            queue.map(item => (
              <QueueRow key={item.id}>
                <QueueTierDot tier={item.tier}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--t-text)'}}>
                    {item.importer_name || `Queue #${item.id}`}
                  </div>
                  <div style={{fontSize:11,color:'var(--t-text-sub)',marginTop:3}}>
                    Score: <b style={{color:_tierColor(item.tier)}}>{item.score?.toFixed(0)}</b>
                    {' · '}Action: {item.action?.replace(/_/g,' ')}
                    {' · '}Status: {item.status}
                  </div>
                </div>
                <TierBadge tier={item.tier}>{item.tier}</TierBadge>
                <div style={{fontSize:11,color:'var(--t-text-sub)'}}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                </div>
              </QueueRow>
            ))
          )}
        </Card>
      )}

      {/* ── Tab: History ─────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <Card>
          <CardTitle>Scoring History</CardTitle>
          {loadingHist ? (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Spinner/><Pulsing>Loading history…</Pulsing>
            </div>
          ) : history.length === 0 ? (
            <EmptyState>
              <div style={{fontSize:28}}>📊</div>
              <div>No scoring history yet. Run your first risk score above.</div>
            </EmptyState>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {history.map(h => (
                <div key={h.analysis_uuid} style={{
                  display:'flex',alignItems:'center',gap:12,
                  padding:'12px 14px',borderRadius:8,
                  background:'var(--t-card)',border:'1px solid var(--t-border)',
                }}>
                  <div style={{
                    width:36,height:36,borderRadius:'50%',
                    background:_tierColor(h.tier)+'22',
                    border:`2px solid ${_tierColor(h.tier)}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:12,fontWeight:800,color:_tierColor(h.tier),flexShrink:0,
                  }}>{h.score?.toFixed(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--t-text)'}}>
                      {h.importer_name || 'Unknown Importer'}
                    </div>
                    <div style={{fontSize:11,color:'var(--t-text-sub)',marginTop:2}}>
                      {h.action?.replace(/_/g,' ')}
                      {' · '}{h.model_label}
                      {h.importer_iec ? ` · IEC: ${h.importer_iec}` : ''}
                    </div>
                  </div>
                  <TierBadge tier={h.tier}>{h.tier}</TierBadge>
                  <div style={{fontSize:11,color:'var(--t-text-sub)',flexShrink:0}}>
                    {h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </Container>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Score Result Component
// ─────────────────────────────────────────────────────────────────────────────
function ScoreResult({ result }) {
  const {
    score=0, tier='GREEN', tier_label='', customs_equiv='',
    action='', sla_hours, model='',
    contributions={}, sources=[], features={},
    importer_name, importer_iec, cif_value_inr, country_of_origin,
    filing_id, queue_id,
  } = result;

  // Sort contributions by value desc
  const contribEntries = Object.entries(contributions)
    .map(([k, v]) => ({
      key: k,
      label: typeof v === 'object' ? v.label : k.replace(/_/g,' '),
      contribution: typeof v === 'object' ? v.contribution : v,
      value: typeof v === 'object' ? v.value : features[k],
    }))
    .sort((a,b) => b.contribution - a.contribution);

  const maxContrib = Math.max(...contribEntries.map(e => e.contribution), 1);

  return (
    <ResultRoot>
      {/* Source banner */}
      <div style={{
        fontSize:12,color:'var(--t-text-sub)',padding:'8px 14px',
        background:'rgba(246,173,85,.05)',borderRadius:8,
        border:'1px solid rgba(246,173,85,.15)',
      }}>
        ✅ Features auto-pulled from:{' '}
        {sources.map((s,i) => (
          <span key={s}>
            <b style={{color:'#f6ad55'}}>{s}</b>{i < sources.length-1 ? ', ' : ''}
          </span>
        ))}
        {' '}· Model: <b style={{color:'#f6ad55'}}>{model}</b>
      </div>

      {/* Score overview */}
      <Grid cols="1fr 1fr 1fr">
        <Card style={{alignItems:'center',gap:10}}>
          <CardTitle>Composite Risk Score</CardTitle>
          <ScoreGauge tier={tier}>
            <ScoreNum tier={tier}>{parseFloat(score).toFixed(0)}</ScoreNum>
            <ScoreLbl tier={tier}>/100</ScoreLbl>
          </ScoreGauge>
          <TierBadge tier={tier}>
            {tier === 'GREEN' ? '🟢' : tier === 'AMBER' ? '🟡' : '🔴'}
            {' '}{tier}
          </TierBadge>
        </Card>

        <Card style={{gap:10}}>
          <CardTitle>Routing Decision</CardTitle>
          <div style={{fontSize:20,fontWeight:800,color:'var(--t-text)'}}>
            {action?.replace(/_/g,' ')}
          </div>
          <div style={{fontSize:12,color:'var(--t-text-sub)'}}>{tier_label}</div>
          <div style={{
            fontSize:11,padding:'6px 10px',borderRadius:6,
            background:'rgba(135,110,18,0.08)',border:'1px solid rgba(66,153,225,.2)',
            color:'#90cdf4',
          }}>
            Customs equivalent: {customs_equiv}
          </div>
          {sla_hours && (
            <div style={{fontSize:11,color:'#f6ad55'}}>
              ⏱ {sla_hours}h SLA for officer response
            </div>
          )}
          {queue_id && tier !== 'GREEN' && (
            <div style={{fontSize:11,color:'#68d391'}}>
              ✓ Added to review queue (ID #{queue_id})
            </div>
          )}
        </Card>

        <Card style={{gap:8}}>
          <CardTitle>Shipment Identity</CardTitle>
          {[
            ['Importer', importer_name],
            ['IEC',      importer_iec],
            ['Filing',   filing_id ? `#${filing_id}` : null],
            ['COO',      country_of_origin],
            ['CIF Value', cif_value_inr
              ? `₹${Number(cif_value_inr).toLocaleString('en-IN')}`
              : null],
          ].filter(([,v])=>v).map(([label, val]) => (
            <div key={label} style={{display:'flex',justifyContent:'space-between',
              fontSize:12,borderBottom:'1px solid var(--t-border)',paddingBottom:5}}>
              <span style={{color:'var(--t-text-sub)'}}>{label}</span>
              <span style={{color:'var(--t-text)',fontWeight:600}}>{val}</span>
            </div>
          ))}
        </Card>
      </Grid>

      {/* SHAP-style feature contributions */}
      <Card>
        <CardTitle>🔍 Feature Contributions (SHAP-Style Audit Trail)</CardTitle>
        <div style={{fontSize:11,color:'var(--t-text-sub)',marginBottom:4}}>
          Shows how each of the 12 upstream signals contributed to the final risk score.
          Regulatory-compliant explanation for every scoring decision.
        </div>
        {contribEntries.map(({ key, label, contribution }) => {
          const pct = Math.round((contribution / maxContrib) * 100);
          return (
            <BarRow key={key}>
              <BarName>{label}</BarName>
              <BarBg>
                <BarFill pct={pct} style={{ '--w': `${pct}%` }}/>
              </BarBg>
              <BarVal>{contribution.toFixed(1)}</BarVal>
            </BarRow>
          );
        })}
      </Card>

      {/* Tier explanation */}
      <Grid cols="1fr 1fr 1fr">
        {[
          {
            tier:'GREEN', score:'0–30',
            title:'Green — Auto-Clearance',
            desc:'BoE submitted automatically. No human hold.',
            customs:'Faceless First Check',
            icon:'🟢',
            active: tier === 'GREEN',
          },
          {
            tier:'AMBER', score:'31–60',
            title:'Amber — Review Queue',
            desc:'Assigned to junior officer. 2-hour response SLA.',
            customs:'Second Check / Scrutiny',
            icon:'🟡',
            active: tier === 'AMBER',
          },
          {
            tier:'RED', score:'61–100',
            title:'Red — Investigation',
            desc:'Senior officer + possible physical examination.',
            customs:'Detailed Examination / DRI Referral',
            icon:'🔴',
            active: tier === 'RED',
          },
        ].map(t => (
          <div key={t.tier} style={{
            padding:'14px 16px',borderRadius:10,
            border:`2px solid ${t.active ? _tierColor(t.tier) : 'rgba(201,165,32,0.2)'}`,
            background: t.active ? `${_tierColor(t.tier)}10` : 'var(--t-bg-dark)',
          }}>
            <div style={{fontSize:13,fontWeight:700,color:_tierColor(t.tier),marginBottom:6}}>
              {t.icon} {t.title}
            </div>
            <div style={{fontSize:11,color:'var(--t-text-sub)',marginBottom:6}}>{t.desc}</div>
            <div style={{fontSize:10,color:'var(--t-text-sub)',
              fontStyle:'italic',borderTop:'1px solid var(--t-border)',paddingTop:6}}>
              Customs: {t.customs}
            </div>
            <Badge
              bg={`${_tierColor(t.tier)}20`}
              color={_tierColor(t.tier)}
              style={{marginTop:6,display:'inline-block'}}
            >
              {t.score}
            </Badge>
          </div>
        ))}
      </Grid>
    </ResultRoot>
  );
}
