import { useCallback, useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import { trustService } from '../services';
import '../components/Layout.css';

interface TrustBreakdownItem {
  category: string;
  score: number;
  devices: number;
}

interface TrustOverview {
  highTrust: number;
  mediumTrust: number;
  lowTrust: number;
  fleetAvgScore: number;
}

// 3-tier color helpers (matches NetworkMap)
const tc       = (s: number) => s >= 70 ? '#00E676' : s >= 40 ? '#FFD600' : '#FF4444';
const avgCard  = (s: number) => s >= 70 ? 'stat-card--success'     : s >= 40 ? 'stat-card--warning'     : 'stat-card--critical';
const avgVal   = (s: number) => s >= 70 ? 'stat-value--success'    : s >= 40 ? 'stat-value--warning'    : 'stat-value--critical';

export default function TrustAnalysis() {
  const [breakdown, setBreakdown] = useState<TrustBreakdownItem[]>([]);
  const [overview,  setOverview]  = useState<TrustOverview | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(() => {
    Promise.all([
      trustService.getBreakdown(),
      trustService.getOverview(),
    ])
      .then(([bdRes, ovRes]) => {
        setBreakdown((bdRes.data.data || bdRes.data || []) as TrustBreakdownItem[]);
        setOverview(ovRes.data);
        setLastUpdate(new Date());
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load trust analysis:', err);
        setError('Failed to load trust analysis');
      })
      .finally(() => setLoading(false));
  }, []);

  // Initial load + 8-second auto-refresh polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Immediate refresh on attack simulation events
  useEffect(() => {
    const onAttack = () => setTimeout(fetchData, 800);
    window.addEventListener('atlas-network-refresh', onAttack);
    window.addEventListener('atlas-cycle-status',   onAttack);
    return () => {
      window.removeEventListener('atlas-network-refresh', onAttack);
      window.removeEventListener('atlas-cycle-status',   onAttack);
    };
  }, [fetchData]);

  const avg = overview?.fleetAvgScore ?? 0;

  return (
    <>
      <Topbar title="Trust Analysis" subtitle="Fleet-wide trust overview" />
      <div className="page-content">
        {error && (
          <div className="error-state" style={{ padding: 24, textAlign: 'center', color: '#FF4444' }}>
            {error}
          </div>
        )}

        {/* Live refresh indicator */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, fontSize: 11, color: '#4A5568', gap: 12 }}>
          <span style={{ color: '#00E676' }}>● AUTO-REFRESH 8s</span>
          <span>LAST UPDATE: {lastUpdate.toLocaleTimeString()}</span>
        </div>

        {/* Summary Cards */}
        <div className="stat-grid">
          <div className="stat-card stat-card--success">
            <p className="stat-label">Healthy (≥70)</p>
            <h3 className="stat-value stat-value--success">{overview?.highTrust ?? 0}</h3>
          </div>
          <div className="stat-card stat-card--warning">
            <p className="stat-label">Suspicious (40–69)</p>
            <h3 className="stat-value stat-value--warning">{overview?.mediumTrust ?? 0}</h3>
          </div>
          <div className="stat-card stat-card--critical">
            <p className="stat-label">Breached (&lt;40)</p>
            <h3 className="stat-value stat-value--critical">{overview?.lowTrust ?? 0}</h3>
          </div>
          <div className={`stat-card ${avgCard(avg)}`}>
            <p className="stat-label">Fleet Avg Score</p>
            <h3 className={`stat-value ${avgVal(avg)}`} style={{ transition: 'color 0.5s ease' }}>
              {avg}%
            </h3>
          </div>
        </div>

        {/* Factor Breakdown */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Trust Factor Breakdown — Fleet</h2>
          </div>
          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : (
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {breakdown.map(item => (
                <div key={item.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#E6EDF3', fontSize: 14, fontWeight: 600 }}>{item.category}</span>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <span style={{ color: '#8B949E', fontSize: 11 }}>{item.devices.toLocaleString()} devices</span>
                      <span style={{ color: tc(item.score), fontSize: 20, fontWeight: 700, transition: 'color 0.5s ease' }}>
                        {item.score}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 10, background: '#30363D', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      width: `${item.score}%`,
                      height: '100%',
                      background: tc(item.score),
                      borderRadius: 99,
                      transition: 'width 0.8s ease, background 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
