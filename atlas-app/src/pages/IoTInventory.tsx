import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { deviceService, serverService } from '../services';
import type { Device, DeviceStatus, ServerNode } from '../types';
import '../components/Layout.css';



const statusBadgeClass = (s: DeviceStatus) =>
  s === 'STABLE' ? 'badge--success' : s === 'WARNING' ? 'badge--warning' : 'badge--critical';

const trustColor = (score: number) =>
  score >= 70 ? 'success' : score >= 40 ? 'warning' : 'critical';

export default function IoTInventory() {
  const [searchParams] = useSearchParams();
  const filterStatus = searchParams.get('status');
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [servers, setServers] = useState<ServerNode[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'sensor',
    location: '',
    ipAddress: '',
    firmwareVersion: '',
    status: 'STABLE',
    trustScore: 90,
    serverId: '',
  });

  const loadDevices = () => {
    setLoading(true);
    deviceService.getDevices({ page, search: search || undefined, status: filterStatus || undefined })
      .then(res => setDevices(res.data.data ?? res.data))
      .catch((err) => {
        console.error("Failed to load inventory:", err);
        setError("Failed to load inventory");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDevices();
  }, [page, search, filterStatus]);

  useEffect(() => {
    serverService.getServers()
      .then((res) => setServers(res.data.data ?? []))
      .catch((err) => console.error('Failed to load servers:', err));
  }, []);

  const filtered = devices.filter(d =>
    d.id.toLowerCase().includes(search.toLowerCase()) ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.location.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm({
      name: '',
      type: 'sensor',
      location: '',
      ipAddress: '',
      firmwareVersion: '',
      status: 'STABLE',
      trustScore: 90,
      serverId: '',
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.type.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type.trim(),
        location: form.location.trim() || undefined,
        ipAddress: form.ipAddress.trim() || undefined,
        firmwareVersion: form.firmwareVersion.trim() || undefined,
        status: form.status,
        trustScore: Number(form.trustScore),
        serverId: form.serverId || null,
      };
      if (editingId) {
        await deviceService.updateDevice(editingId, payload);
      } else {
        await deviceService.createDevice(payload);
      }
      resetForm();
      loadDevices();
    } catch (err) {
      console.error('Failed to save device:', err);
      setError('Failed to save device');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (device: Device) => {
    setEditingId(device.id);
    setForm({
      name: device.name,
      type: device.type,
      location: device.location ?? '',
      ipAddress: device.ipAddress ?? '',
      firmwareVersion: device.firmwareVersion ?? '',
      status: device.status,
      trustScore: device.trustScore,
      serverId: device.serverId ?? '',
    });
  };

  const handleDelete = async (deviceId: string) => {
    if (!window.confirm('Delete this IoT device?')) return;
    try {
      await deviceService.deleteDevice(deviceId);
      loadDevices();
    } catch (err) {
      console.error('Failed to delete device:', err);
      setError('Failed to delete device');
    }
  };

  return (
    <>
      <Topbar title="IoT Inventory" subtitle="All registered devices" />
      <div className="page-content">
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <input
            className="search-input"
            placeholder="Search device ID, name or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn-export" style={{ width: 'auto', padding: '8px 20px' }}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ margin: 0, marginBottom: 12, color: '#E6EDF3' }}>{editingId ? 'Update IoT Device' : 'Add IoT Device'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 10 }}>
            <input className="search-input" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className="search-input" placeholder="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
            <input className="search-input" placeholder="Location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            <input className="search-input" placeholder="IP Address" value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} />
            <input className="search-input" placeholder="Firmware" value={form.firmwareVersion} onChange={(e) => setForm((f) => ({ ...f, firmwareVersion: e.target.value }))} />
            <select className="search-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="STABLE">STABLE</option>
              <option value="WARNING">WARNING</option>
              <option value="BREACH">BREACH</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>
            <input className="search-input" type="number" min={0} max={100} placeholder="Trust Score" value={form.trustScore} onChange={(e) => setForm((f) => ({ ...f, trustScore: Number(e.target.value) }))} />
            <select className="search-input" value={form.serverId} onChange={(e) => setForm((f) => ({ ...f, serverId: e.target.value }))}>
              <option value="">Unassigned Server</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>{server.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn-export" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update Device' : 'Add Device'}
            </button>
            {editingId && (
              <button className="btn-export" onClick={resetForm} style={{ background: '#21262D' }}>
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="panel">
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div className="loading-state">Loading devices…</div>
            ) : error ? (
              <div className="error-state" style={{ padding: 24, textAlign: 'center', color: '#FF4444' }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e' }}>No devices found.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Device ID</th><th>Name</th><th>Type</th>
                    <th>Location</th><th>IP Address</th>
                    <th>Firmware</th><th>Trust Score</th>
                    <th>Status</th><th>Server</th><th>Last Seen</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const tc = trustColor(d.trustScore);
                    return (
                      <tr key={d.id} style={{ cursor: 'pointer' }}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>#{d.id}</td>
                        <td>{d.name}</td>
                        <td style={{ color: '#8B949E' }}>{d.type}</td>
                        <td style={{ color: '#8B949E' }}>{d.location}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#8B949E' }}>{d.ipAddress}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#8B949E' }}>{d.firmwareVersion}</td>
                        <td>
                          <div className="trust-bar-wrap">
                            <div className="trust-bar">
                              <div className={`trust-bar-fill trust-bar-fill--${tc}`}
                                   style={{ width: `${d.trustScore}%` }} />
                            </div>
                            <span className={`stat-value--${tc}`} style={{ fontSize: 12, fontWeight: 700 }}>
                              {d.trustScore}
                            </span>
                          </div>
                        </td>
                        <td><span className={`badge ${statusBadgeClass(d.status)}`}>{d.status}</span></td>
                        <td style={{ color: '#8B949E' }}>{servers.find((s) => s.id === d.serverId)?.name ?? '—'}</td>
                        <td style={{ color: '#8B949E' }}>{d.lastSeen}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="page-btn" onClick={() => handleEdit(d)}>Edit</button>
                            <button className="page-btn" onClick={() => handleDelete(d.id)} style={{ color: '#FF4444' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="table-footer">
            <span style={{ color: '#8B949E', fontSize: 11 }}>{filtered.length} devices shown</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
              <span style={{ color: '#8B949E', fontSize: 12, alignSelf: 'center' }}>Page {page}</span>
              <button className="page-btn" onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .search-input {
          background: #161B22; border: 1px solid #30363D; color: #E6EDF3;
          font-size: 12px; border-radius: 6px; padding: 8px 12px; width: 280px;
          outline: none;
        }
        .search-input:focus { border-color: #388bff; }
        .table-footer {
          padding: 12px 16px; border-top: 1px solid #30363D;
          display: flex; align-items: center; justify-content: space-between;
        }
        .page-btn {
          background: #21262D; border: 1px solid #30363D; color: #E6EDF3;
          padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;
        }
        .page-btn:hover { background: #30363D; }
        .page-btn:disabled { opacity: 0.4; cursor: default; }
        .btn-export { width: auto !important; }
      `}</style>
    </>
  );
}
