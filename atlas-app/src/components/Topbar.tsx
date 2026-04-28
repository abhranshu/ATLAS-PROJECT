import { useEffect, useState } from 'react';
import { Play, RotateCcw, Power } from 'lucide-react';
import { dashboardService, deviceService } from '../services';
import type { CycleStatus, Device } from '../types';
import './Topbar.css';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedAttackType, setSelectedAttackType] = useState<string>('Botnet Recruitment');
  const [running, setRunning] = useState(false);
  const [cyclesRun, setCyclesRun] = useState(0);

  useEffect(() => {
    deviceService.getDevices({ limit: 100 })
      .then((res) => {
        const list = res.data.data ?? res.data ?? [];
        setDevices(list);
        const savedDeviceId = localStorage.getItem('atlas_selected_device_id');
        const preferredDeviceId = savedDeviceId && list.some((d: Device) => d.id === savedDeviceId)
          ? savedDeviceId
          : list[0]?.id ?? '';
        setSelectedDeviceId(preferredDeviceId);
      })
      .catch((err) => {
        console.error('Failed to load device list:', err);
      });
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) return;
    localStorage.setItem('atlas_selected_device_id', selectedDeviceId);
  }, [selectedDeviceId]);

  useEffect(() => {
    const pollCycleStatus = () => {
      dashboardService.getCycleStatus()
        .then((res) => {
          const status: CycleStatus = res.data;
          setRunning(status.state === 'queued' || status.state === 'running');
          setCyclesRun(status.cyclesRun ?? 0);
          window.dispatchEvent(new CustomEvent('atlas-cycle-status', { detail: status }));
        })
        .catch((err) => {
          console.error('Failed to fetch cycle status:', err);
        });
    };

    pollCycleStatus();
    const timer = window.setInterval(pollCycleStatus, 1200);
    return () => window.clearInterval(timer);
  }, []);

  const handleRunCycle = async () => {
    if (running || !selectedDeviceId) return;
    setRunning(true);
    try {
      const response = await dashboardService.simulateAttack({ 
        deviceId: selectedDeviceId,
        attackType: selectedAttackType
      });
      const status: CycleStatus | undefined = response.data?.status;
      if (status) {
        window.dispatchEvent(new CustomEvent('atlas-cycle-status', { detail: status }));
      }
    } catch (err) {
      console.error('Failed to run cycle:', err);
      setRunning(false);
    }
  };

  return (
    <div className="topbar-container">
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-title-group">
            <h2 className="topbar-title">{title}</h2>
            <span className="topbar-subtitle">{subtitle || "Adaptive Trust & Drift Intelligence - Indian Army IoT"}</span>
          </div>
        </div>

        <div className="topbar-right">
          <select
            className="topbar-dropdown"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            {devices.length === 0 ? (
              <option value="">Loading devices...</option>
            ) : (
              devices.map((device) => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))
            )}
          </select>
          <select
            className="topbar-dropdown"
            value={selectedAttackType}
            onChange={(e) => setSelectedAttackType(e.target.value)}
            style={{ marginLeft: '8px' }}
          >
            <option value="Botnet Recruitment">Botnet Recruitment</option>
            <option value="Credential Attacks">Credential Attacks</option>
            <option value="Exploiting Vulnerabilities">Exploiting Vulnerabilities</option>
            <option value="Man-in-the-Middle (MITM)">Man-in-the-Middle (MITM)</option>
            <option value="Data Exfiltration">Data Exfiltration</option>
          </select>
          <button 
            className="btn-run-cycle" 
            onClick={handleRunCycle}
            disabled={running || !selectedDeviceId}
            style={{ opacity: running ? 0.7 : 1, cursor: running ? 'wait' : 'pointer' }}
          >
            <Play size={14} fill="currentColor" /> {running ? 'RUNNING...' : 'RUN CYCLE'}
          </button>
          <button className="btn-icon btn-refresh" onClick={() => window.location.reload()}>
            <RotateCcw size={16} />
          </button>
          <button className="btn-icon btn-power">
            <Power size={16} />
          </button>
        </div>
      </header>
      <div className="topbar-subbanner">
        <span>CLASSIFICATION: TOP SECRET</span>
        <span className="separator">♦</span>
        <span>AUTHORIZED PERSONNEL ONLY</span>
        <span className="separator">♦</span>
        <span>CYCLES: {cyclesRun}</span>
        <span className="separator">♦</span>
        <span>भारतीय सेना - Indian Army</span>
      </div>
    </div>
  );
}
