import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Activity, Database, Swords, Network } from 'lucide-react';
import { dashboardService } from '../services';
import type { DashboardOverview } from '../types';
import './Sidebar.css';

const navItems = [
  { to: '/', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/incidents', icon: <AlertTriangle size={16} />, label: 'Alerts', badge: 11 },
  { to: '/trust', icon: <Activity size={16} />, label: 'Analytics' },
  { to: '/inventory', icon: <Database size={16} />, label: 'Database' },
  { to: '/network', icon: <Network size={16} />, label: 'Network Map' },
];

export default function Sidebar() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    const fetchOverview = () => {
      dashboardService.getOverview()
        .then(res => setOverview(res.data))
        .catch(err => console.error("Failed to load telemetry for sidebar", err));
    };
    
    fetchOverview();
    
    const intervalId = setInterval(fetchOverview, 8000);
    const onRefresh = () => setTimeout(fetchOverview, 500);
    
    window.addEventListener('atlas-network-refresh', onRefresh);
    window.addEventListener('atlas-cycle-status', onRefresh);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('atlas-network-refresh', onRefresh);
      window.removeEventListener('atlas-cycle-status', onRefresh);
    };
  }, []);

  const anomalyRate = overview 
    ? (((overview.breachedDevices ?? 0) + (overview.warningDevices ?? 0)) / Math.max(overview.activeDevices ?? 1, 1) * 100).toFixed(1)
    : "14.3";

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Swords size={18} color="#fff" />
          </div>
          <div className="sidebar-logo-text">
            <h1 className="sidebar-title">ATLAS-TDI</h1>
            <p className="sidebar-subtitle">STRATCOM • SECTOR-7G</p>
          </div>
        </div>
        <div className="sidebar-status-active">
          <span className="dot-green"></span> ACTIVE
        </div>
      </div>

      <div className="sidebar-section-title">NAVIGATION</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
            }
          >
            <div className="nav-item-left">
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.label === 'Alerts' ? (
              <span className="nav-badge">{overview?.alerts ?? item.badge}</span>
            ) : item.badge && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-section-title mt-4">LIVE TELEMETRY</div>
      <div className="telemetry-list">
        <div className="telemetry-row">
          <span className="tel-label">Active Devices</span>
          <span className="tel-val text-blue">{overview?.activeDevices ?? 7}</span>
        </div>
        <div className="telemetry-row">
          <span className="tel-label">Trusted</span>
          <span className="tel-val text-green">{overview?.trustedDevices ?? 6}</span>
        </div>
        <div className="telemetry-row">
          <span className="tel-label">Anomaly Rate</span>
          <span className="tel-val text-orange">{overview ? anomalyRate + '%' : '14.3%'}</span>
        </div>
        <div className="telemetry-row">
          <span className="tel-label">Avg Trust</span>
          <span className="tel-val">{overview?.avgTrustScore ?? 86.3}</span>
        </div>
        <div className="telemetry-row">
          <span className="tel-label">Cycles Run</span>
          <span className="tel-val text-blue">{overview?.cyclesRun ?? 4}</span>
        </div>
      </div>

      <div className="threat-level-box">
        <div className="threat-title">THREAT LEVEL</div>
        <div className="threat-status">ELEVATED</div>
      </div>

      <div className="sidebar-footer">
        <div className="supabase-status">
          <span className="dot-green"></span> SUPABASE ONLINE
        </div>
        
        <div className="operator-profile">
          <div className="op-avatar"></div>
          <div className="op-details">
            <div className="op-name">OPERATOR_09</div>
            <div className="op-clearance">LEVEL 4 CLEARANCE</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
