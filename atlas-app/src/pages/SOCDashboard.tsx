import { useEffect, useState } from 'react';
import { Settings2, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { dashboardService, deviceService, telemetryService } from '../services';
import type { CycleStatus, DashboardOverview } from '../types';
import './SOCDashboard.css';

// ── Empty states for when backend fails or is loading ─────────
const EMPTY_OVERVIEW: DashboardOverview = {
  criticalThreats: 0,
  criticalThreadsDelta: 0,
  lowTrustNodes: 0,
  lowTrustDelta: 0,
  activeDevices: 7,
  activeDevicesPercent: 100,
  avgTrustScore: 86.3,
  systemHealth: 94,
};

export default function SOCDashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<DashboardOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus | null>(null);

  // Manual ML form state
  const [telemetryForm, setTelemetryForm] = useState({ device_id: '', packet_count: 200, entropy: 3.5, ip_diversity: 2 });
  const [telemetryResult, setTelemetryResult] = useState<any>(null);
  const [allDevices, setAllDevices] = useState<any[]>([]);
  const [isScoring, setIsScoring] = useState(false);

  // Simulate Attack form state
  const [attackForm, setAttackForm] = useState({ deviceId: '', attackType: 'Botnet Recruitment' });
  const [attackResult, setAttackResult] = useState<any>(null);
  const [isAttacking, setIsAttacking] = useState(false);

  const ATTACK_TYPES = [
    'Botnet Recruitment',
    'DDoS Amplification',
    'Man-in-the-Middle',
    'Firmware Injection',
    'Credential Brute-Force',
    'Data Exfiltration',
  ];

  useEffect(() => {
    deviceService.getDevices({ limit: 100 }).then(res => setAllDevices(res.data.data || res.data)).catch(console.error);
  }, []);

  const handleIngest = async () => {
    if (!telemetryForm.device_id) return alert('Select a device first');
    setIsScoring(true);
    setTelemetryResult(null);
    try {
      const res = await telemetryService.ingest(telemetryForm);
      setTelemetryResult(res.data);
      dashboardService.getOverview().then(r => setOverview(r.data));
      window.dispatchEvent(new CustomEvent('atlas-network-refresh'));
    } catch (err) {
      console.error(err);
      alert('Error scoring telemetry: The ML analysis may have timed out. Please try again.');
    } finally {
      setIsScoring(false);
    }
  };

  const handleSimulateAttack = async () => {
    setIsAttacking(true);
    setAttackResult(null);
    try {
      const res = await dashboardService.simulateAttack({
        deviceId:   attackForm.deviceId || undefined,
        attackType: attackForm.attackType,
      });
      setAttackResult(res.data);
      // Immediately refresh dashboard stats and fire cross-page refresh event
      dashboardService.getOverview().then(r => setOverview(r.data));
      window.dispatchEvent(new CustomEvent('atlas-network-refresh'));
      window.dispatchEvent(new CustomEvent('atlas-cycle-status', { detail: { phase: 'Completed', logs: [] } }));
    } catch (err: any) {
      console.error(err);
      alert(`Attack simulation failed: ${err?.response?.data?.detail ?? err.message}`);
    } finally {
      setIsAttacking(false);
    }
  };

  useEffect(() => {
    dashboardService.getOverview()
      .then(res => setOverview(res.data))
      .catch((err) => {
        console.error('Dashboard error:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onCycleStatus = (event: Event) => {
      const customEvent = event as CustomEvent<CycleStatus>;
      setCycleStatus(customEvent.detail);
      dashboardService.getOverview()
        .then((res) => setOverview(res.data))
        .catch((err) => console.error('Dashboard refresh error:', err));
    };

    window.addEventListener('atlas-cycle-status', onCycleStatus);
    return () => window.removeEventListener('atlas-cycle-status', onCycleStatus);
  }, []);

  const logs = cycleStatus?.logs ?? [];

  return (
    <>
      <Topbar title="COMMAND CENTER" />
      <div className="dashboard-container">
        
        {/* --- NETWORK OVERVIEW --- */}
        <section>
          <div className="section-header">
            <h3 className="section-title">NETWORK OVERVIEW</h3>
            <span className="badge-live">LIVE</span>
          </div>
          <div className="overview-grid">
            <div className="cc-card cc-card-blue" onClick={() => navigate('/inventory')} style={{ cursor: 'pointer' }}>
              <h4 className="cc-card-title">TOTAL DEVICES</h4>
              <p className="cc-card-val val-blue">{overview.activeDevices}</p>
              <p className="cc-card-sub">Click to show all</p>
            </div>
            <div className="cc-card cc-card-green" onClick={() => navigate('/inventory?status=STABLE')} style={{ cursor: 'pointer' }}>
              <h4 className="cc-card-title">TRUSTED</h4>
              <p className="cc-card-val val-green">{overview.trustedDevices ?? 0}</p>
              <p className="cc-card-sub">Score ≥ 70</p>
            </div>
            <div className="cc-card cc-card-orange" onClick={() => navigate('/inventory?status=WARNING')} style={{ cursor: 'pointer' }}>
              <h4 className="cc-card-title">SUSPICIOUS</h4>
              <p className="cc-card-val val-orange">{overview.warningDevices ?? 0}</p>
              <p className="cc-card-sub">Score 40–69</p>
            </div>
            <div className="cc-card cc-card-red" onClick={() => navigate('/inventory?status=BREACH')} style={{ cursor: 'pointer' }}>
              <h4 className="cc-card-title">BREACHED</h4>
              <p className="cc-card-val val-red">{overview.breachedDevices ?? overview.criticalThreats}</p>
              <p className="cc-card-sub">Score &lt; 40</p>
            </div>
            <div className="cc-card" onClick={() => navigate('/trust')} style={{ cursor: 'pointer' }}>
              <h4 className="cc-card-title">AVG TRUST</h4>
              <p className="cc-card-val" style={{
                color: overview.avgTrustScore >= 70 ? '#00E676'
                     : overview.avgTrustScore >= 40 ? '#FFD600'
                     : '#FF4444',
                transition: 'color 0.5s ease',
              }}>
                {overview.avgTrustScore}
              </p>
              <p className="cc-card-sub">Fleet avg score</p>
            </div>
          </div>
        </section>


        {/* --- LIVE SYSTEM LOGS --- */}
        <section>
          <div className="section-header">
            <h3 className="section-title">LIVE SYSTEM LOGS</h3>
            <span className="badge-monitor">MONITOR</span>
          </div>
          <div className="logs-panel">
            <div className="logs-header">
              <span>● ATLAS-TDI - LIVE_SYSTEM_LOGS</span>
              <span style={{ color: '#4A5568' }}>
                {cycleStatus?.phase ?? (loading ? 'INITIALIZING' : 'IDLE')} <span style={{ color: '#ff4444' }}>●</span><span style={{ color: '#e3a008' }}>●</span><span style={{ color: '#00ff00' }}>●</span>
              </span>
            </div>
            <div className="logs-content">
              {logs.length === 0 ? (
                <div>
                  <span className="log-time">[SYSTEM]</span>{' '}
                  <span className="log-blue">~ Waiting for run cycle events...</span>
                </div>
              ) : (
                logs.slice(0, 10).map((log) => (
                  <div key={log.id}>
                    <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    <span className={log.level === 'CRITICAL' ? 'log-orange' : log.level === 'DETECT' ? 'log-yellow' : log.level === 'TRUST' ? 'log-yellow' : log.level === 'ERROR' ? 'log-orange' : log.level === 'PHASE' ? 'log-blue' : 'log-green'}>
                      {log.level === 'PHASE' ? '~' : log.level === 'DETECT' ? '!' : log.level === 'TRUST' ? 'T' : log.level === 'ERROR' ? 'X' : '√'} [{log.level}] {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* --- SIMULATE ATTACK --- */}
        <section>
          <div className="param-panel" style={{ border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(255,68,68,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="param-header">
                <div className="param-icon" style={{ background: 'rgba(255,68,68,0.15)', color: '#FF4444' }}>⚡</div>
                <div>
                  <h4 className="param-title" style={{ color: '#FF4444' }}>SIMULATE ATTACK</h4>
                  <p className="param-sub">Drops trust score to BREACH level in real database — updates network map &amp; analytics</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#FF4444', marginBottom: 4, fontWeight: 'bold' }}>TARGET DEVICE</label>
                <select
                  value={attackForm.deviceId}
                  onChange={e => setAttackForm(f => ({ ...f, deviceId: e.target.value }))}
                  style={{ width: '100%', background: '#161B22', border: '1px solid rgba(255,68,68,0.4)', color: '#E6EDF3', padding: '8px 12px', borderRadius: 4 }}
                >
                  <option value="">Auto-select (first STABLE device)</option>
                  {allDevices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.status} ({Math.round(d.trustScore ?? 0)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#FF4444', marginBottom: 4, fontWeight: 'bold' }}>ATTACK TYPE</label>
                <select
                  value={attackForm.attackType}
                  onChange={e => setAttackForm(f => ({ ...f, attackType: e.target.value }))}
                  style={{ width: '100%', background: '#161B22', border: '1px solid rgba(255,68,68,0.4)', color: '#E6EDF3', padding: '8px 12px', borderRadius: 4 }}
                >
                  {ATTACK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 24, padding: '16px 0', borderTop: '1px solid rgba(255,68,68,0.2)' }}>
              <button
                onClick={() => void handleSimulateAttack()}
                disabled={isAttacking}
                style={{ background: isAttacking ? '#8B0000' : '#CC0000', color: 'white', border: 'none', padding: '10px 28px', borderRadius: 6, fontWeight: 'bold', cursor: isAttacking ? 'not-allowed' : 'pointer', letterSpacing: '0.05em', fontSize: 13 }}
              >
                {isAttacking ? '⚡ DEPLOYING EXPLOIT...' : '⚡ LAUNCH ATTACK'}
              </button>

              {attackResult && (
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: 'rgba(255,68,68,0.08)', padding: '10px 18px', borderRadius: 6, border: '1px solid rgba(255,68,68,0.3)' }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#8B949E', display: 'block' }}>TARGET</span>
                    <strong style={{ color: '#FF4444', fontSize: 14 }}>{attackResult.target_name}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#8B949E', display: 'block' }}>TRUST SCORE</span>
                    <strong style={{ color: '#FF4444', fontSize: 20 }}>{attackResult.new_score?.toFixed(1)} / 100</strong>
                  </div>
                  <div style={{ background: '#FF4444', color: 'white', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>
                    BREACH
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* --- MANUAL PARAMETER INPUT --- */}
        <section>
          <div className="param-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="param-header">
                <div className="param-icon"><Settings2 size={24} /></div>
                <div>
                  <h4 className="param-title">MANUAL PARAMETER INPUT</h4>
                  <p className="param-sub">Set exact feature values - ML model scores YOUR inputs</p>
                </div>
              </div>
              <ChevronUp size={20} color="#4A5568" />
            </div>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#8B949E', marginBottom: 4, fontWeight: 'bold' }}>TARGET DEVICE</label>
                <select className="search-input" value={telemetryForm.device_id} onChange={e => setTelemetryForm(f => ({ ...f, device_id: e.target.value }))} style={{ width: '100%', background: '#161B22', border: '1px solid #30363D', color: '#E6EDF3', padding: '8px 12px', borderRadius: 4 }}>
                  <option value="">Select a device...</option>
                  {allDevices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.ipAddress})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#8B949E', marginBottom: 4, fontWeight: 'bold' }}>PACKET COUNT (10s)</label>
                <input type="number" value={telemetryForm.packet_count} onChange={e => setTelemetryForm(f => ({ ...f, packet_count: Number(e.target.value) }))} style={{ width: '100%', background: '#161B22', border: '1px solid #30363D', color: '#E6EDF3', padding: '8px 12px', borderRadius: 4 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#8B949E', marginBottom: 4, fontWeight: 'bold' }}>ENTROPY</label>
                <input type="number" step="0.1" value={telemetryForm.entropy} onChange={e => setTelemetryForm(f => ({ ...f, entropy: Number(e.target.value) }))} style={{ width: '100%', background: '#161B22', border: '1px solid #30363D', color: '#E6EDF3', padding: '8px 12px', borderRadius: 4 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#8B949E', marginBottom: 4, fontWeight: 'bold' }}>IP DIVERSITY</label>
                <input type="number" value={telemetryForm.ip_diversity} onChange={e => setTelemetryForm(f => ({ ...f, ip_diversity: Number(e.target.value) }))} style={{ width: '100%', background: '#161B22', border: '1px solid #30363D', color: '#E6EDF3', padding: '8px 12px', borderRadius: 4 }} />
              </div>
            </div>
            
            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 24, padding: '16px 0', borderTop: '1px solid #30363D' }}>
              <button onClick={handleIngest} disabled={isScoring} style={{ background: isScoring ? '#1F6FEB' : '#388bff', color: 'white', border: 'none', padding: '8px 24px', borderRadius: 6, fontWeight: 'bold', cursor: isScoring ? 'not-allowed' : 'pointer', opacity: isScoring ? 0.7 : 1 }}>
                {isScoring ? 'EVALUATING (TAKES ~25s)...' : 'EVALUATE PARAMETERS'}
              </button>
              
              {telemetryResult && (
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 16px', borderRadius: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#8B949E', display: 'block' }}>TRUST SCORE</span>
                    <strong style={{ color: telemetryResult.trustScore < 40 ? '#FF4444' : telemetryResult.trustScore < 70 ? '#FFD600' : '#00E676', fontSize: 20 }}>{telemetryResult.trustScore.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#8B949E', display: 'block' }}>NEW STATUS</span>
                    <strong style={{ color: telemetryResult.trustScore < 40 ? '#FF4444' : telemetryResult.trustScore < 70 ? '#FFD600' : '#00E676', fontSize: 16 }}>{telemetryResult.status}</strong>
                  </div>
                  {telemetryResult.isAnomaly && (
                    <div style={{ background: '#FF4444', color: 'white', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>
                      ANOMALY DETECTED
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
