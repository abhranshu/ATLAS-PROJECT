import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import { incidentService } from '../services';
import type { Incident } from '../types';
import IncidentReportModal from '../components/IncidentReportModal';
import '../components/Layout.css';

export default function IncidentOverview() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    incidentService.getIncidents({ limit: 20 })
      .then(res => setIncidents(res.data.data ?? res.data))
      .catch((err) => {
        console.error("Failed to load incidents:", err);
        setError("Failed to load incidents");
      })
      .finally(() => setLoading(false));
  }, []);

  const displayed = incidents.filter(i => filter === 'all' || i.severity === filter);

  const badgeClass = (s: string) =>
    s === 'critical' ? 'badge--critical' : s === 'warning' ? 'badge--warning' : 'badge--success';

  const severityBorderColor = (s: string) =>
    s === 'critical' ? '#FF4444' : s === 'warning' ? '#E3A008' : '#2EA043';

  return (
    <>
      <Topbar title="Incident Overview" subtitle="Active + resolved events — click any incident for a full report" />
      <div className="page-content">
        {/* Summary */}
        <div className="stat-grid">
          <div className="stat-card stat-card--critical">
            <p className="stat-label">Open Critical</p>
            <h3 className="stat-value stat-value--critical">{incidents.filter(i => i.severity === 'critical' && !i.resolved).length}</h3>
          </div>
          <div className="stat-card stat-card--warning">
            <p className="stat-label">Open Warnings</p>
            <h3 className="stat-value stat-value--warning">{incidents.filter(i => i.severity === 'warning' && !i.resolved).length}</h3>
          </div>
          <div className="stat-card stat-card--success">
            <p className="stat-label">Resolved Today</p>
            <h3 className="stat-value stat-value--success">{incidents.filter(i => i.resolved).length}</h3>
          </div>
          <div className="stat-card stat-card--neutral">
            <p className="stat-label">Total Events</p>
            <h3 className="stat-value stat-value--neutral">{incidents.length}</h3>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'critical', 'warning'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #30363D', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === f ? '#388bff' : '#161B22',
                color: filter === f ? 'white' : '#8B949E' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Hint text */}
        <p style={{ color: '#4A5568', fontSize: 11, margin: '4px 0 0 0' }}>
          💡 Click on any incident card below to generate a detailed security report
        </p>

        {/* Events List */}
        <div className="panel">
          {loading ? <div className="loading-state">Loading incidents…</div> : error ? (
            <div className="error-state" style={{ padding: 24, textAlign: 'center', color: '#FF4444' }}>{error}</div>
          ) : (
            <div>
              {displayed.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#8b949e' }}>No incidents found.</div>
              ) : (
                displayed.map(inc => (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    style={{
                      padding: '16px 20px',
                      borderLeft: `3px solid ${severityBorderColor(inc.severity)}`,
                      borderBottom: '1px solid #30363D',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.background = '#1c2128';
                      const hint = (e.currentTarget as HTMLDivElement).querySelector('.report-hint') as HTMLElement;
                      if (hint) hint.style.opacity = '1';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      const hint = (e.currentTarget as HTMLDivElement).querySelector('.report-hint') as HTMLElement;
                      if (hint) hint.style.opacity = '0';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${badgeClass(inc.severity)}`}>{inc.type}</span>
                        {inc.resolved && <span className="badge badge--success">Resolved</span>}
                        <span style={{ color: '#8B949E', fontSize: 10, fontFamily: 'monospace' }}>{inc.id.slice(0, 16)}…</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span
                          className="report-hint"
                          style={{
                            color: '#388bff', fontSize: 11, fontWeight: 600,
                            opacity: 0, transition: 'opacity 0.2s',
                          }}
                        >
                          📄 View Report →
                        </span>
                        <span style={{ color: '#8B949E', fontSize: 11 }}>
                          {new Date(inc.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                    <h4 style={{ color: '#E6EDF3', fontSize: 14, fontWeight: 600, margin: '0 0 4px 0' }}>{inc.title}</h4>
                    <p style={{ color: '#8B949E', fontSize: 12, margin: 0 }}>{inc.description}</p>
                    {inc.deviceId && (
                      <p style={{ color: '#388bff', fontSize: 11, margin: '6px 0 0 0', fontFamily: 'monospace' }}>Device: #{inc.deviceId}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Incident Report Modal */}
      {selectedIncident && (
        <IncidentReportModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </>
  );
}
