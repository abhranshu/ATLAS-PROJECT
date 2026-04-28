import { useEffect, useState } from 'react';
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

const tc = (s: number) => s >= 70 ? '#2EA043' : s >= 40 ? '#E3A008' : '#FF4444';

export default function TrustAnalysis() {
  const [breakdown, setBreakdown] = useState<TrustBreakdownItem[]>([]);
  const [overview, setOverview] = useState<TrustOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      trustService.getBreakdown(),
      trustService.getOverview()
    ])
      .then(([breakdownRes, overviewRes]) => {
        setBreakdown((breakdownRes.data.data || breakdownRes.data || []) as TrustBreakdownItem[]);
        setOverview(overviewRes.data);
      })
      .catch((err) => {
        console.error("Failed to load trust analysis:", err);
        setError("Failed to load trust analysis");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Topbar title="Trust Analysis" subtitle="Fleet-wide trust overview" />
      <div className="page-content">
        {error && <div className="error-state" style={{ padding: 24, textAlign: 'center', color: '#FF4444' }}>{error}</div>}

        {/* Summary Cards */}
        <div className="stat-grid">
          <div className="stat-card stat-card--success">
            <p className="stat-label">High Trust (≥70)</p>
            <h3 className="stat-value stat-value--success">{overview?.highTrust ?? 0}</h3>
          </div>
          <div className="stat-card stat-card--warning">
            <p className="stat-label">Medium Trust (40–69)</p>
            <h3 className="stat-value stat-value--warning">{overview?.mediumTrust ?? 0}</h3>
          </div>
          <div className="stat-card stat-card--critical">
            <p className="stat-label">Low Trust (&lt;40)</p>
            <h3 className="stat-value stat-value--critical">{overview?.lowTrust ?? 0}</h3>
          </div>
          <div className="stat-card stat-card--warning">
            <p className="stat-label">Fleet Avg Score</p>
            <h3 className="stat-value stat-value--warning">{overview?.fleetAvgScore ?? 0}%</h3>
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
                      <span style={{ color: tc(item.score), fontSize: 20, fontWeight: 700 }}>{item.score}</span>
                    </div>
                  </div>
                  <div style={{ height: 10, background: '#30363D', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      width: `${item.score}%`, height: '100%',
                      background: tc(item.score), borderRadius: 99,
                      transition: 'width 0.8s ease',
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
