import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import { incidentService } from '../services';
import type { Incident } from '../types';
import '../components/Layout.css';

interface LogEntry { id: string; timestamp: string; level: 'CRITICAL' | 'WARNING' | 'INFO'; device?: string; message: string; }


const levelColor = { CRITICAL: '#FF4444', WARNING: '#E3A008', INFO: '#2EA043' };
const levelBg = { CRITICAL: 'rgba(255,68,68,0.06)', WARNING: 'rgba(227,160,8,0.06)', INFO: 'rgba(46,160,67,0.04)' };

export default function IncidentLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toLogEntry = (incident: Incident): LogEntry => ({
    id: incident.id,
    timestamp: incident.timestamp,
    level: incident.severity === 'critical' || incident.severity === 'breach' ? 'CRITICAL' : incident.severity === 'warning' ? 'WARNING' : 'INFO',
    device: incident.deviceId,
    message: incident.description || incident.title,
  });

  useEffect(() => {
    incidentService.getLogs({ limit: 50 })
      .then((res) => {
        const rows = (res.data.data ?? res.data ?? []) as Incident[];
        setLogs(rows.map(toLogEntry));
      })
      .catch((err) => {
        console.error("Failed to load logs:", err);
        setError("Failed to load logs");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs
    .filter(l => levelFilter === 'ALL' || l.level === levelFilter)
    .filter(l => !search || l.message.toLowerCase().includes(search.toLowerCase()) || (l.device ?? '').toLowerCase().includes(search.toLowerCase()));

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all logs?')) return;
    try {
      setLoading(true);
      await incidentService.clearLogs();
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
      alert('Failed to clear logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Incident Logs" subtitle="Full audit trail" />
      <div className="page-content">
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="search-input" placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
          {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map(f => (
            <button key={f} onClick={() => setLevelFilter(f)}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #30363D', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: levelFilter === f ? (f === 'CRITICAL' ? '#FF4444' : f === 'WARNING' ? '#E3A008' : f === 'INFO' ? '#2EA043' : '#388bff') : '#161B22',
                color: levelFilter === f ? 'white' : '#8B949E' }}>
              {f}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={handleClearLogs} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #FF4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#FF4444', color: 'white' }}>
            Clear All Logs
          </button>
        </div>

        {/* Log Table */}
        <div className="panel">
          {loading ? <div className="loading-state">Loading logs…</div> : error ? (
            <div className="error-state" style={{ padding: 24, textAlign: 'center', color: '#FF4444' }}>{error}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Timestamp</th><th>Level</th><th>Device</th><th>Message</th></tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#8b949e' }}>No logs found.</td></tr>
                  ) : (
                    filtered.map(log => (
                      <tr key={log.id} style={{ background: levelBg[log.level] }}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#8B949E', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                        <td>
                          <span style={{ color: levelColor[log.level], fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>
                            {log.level}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#388bff' }}>{log.device ?? '—'}</td>
                        <td style={{ fontSize: 12, color: '#E6EDF3' }}>{log.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #30363D', color: '#8B949E', fontSize: 11 }}>
            {filtered.length} log entries
          </div>
        </div>
      </div>

      <style>{`
        .search-input { background: #161B22; border: 1px solid #30363D; color: #E6EDF3; font-size: 12px; border-radius: 6px; padding: 8px 12px; width: 260px; outline: none; }
        .search-input:focus { border-color: #388bff; }
      `}</style>
    </>
  );
}
