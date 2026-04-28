// ─── Shared Types across the App ─────────────────────────

export type Severity = 'critical' | 'warning' | 'stable' | 'breach';
export type DeviceStatus = 'STABLE' | 'WARNING' | 'BREACH' | 'OFFLINE';

// Dashboard
export interface DashboardOverview {
  criticalThreats: number;
  criticalThreadsDelta: number;
  lowTrustNodes: number;
  lowTrustDelta: number;
  activeDevices: number;
  activeDevicesPercent: number;
  avgTrustScore: number;
  systemHealth: number;
  trustedDevices?: number;
  alerts?: number;
  cyclesRun?: number;
}

// Device
export interface Device {
  id: string;
  name: string;
  type: string;
  location: string;
  trustScore: number;
  status: DeviceStatus;
  lastSeen: string;
  ipAddress: string;
  firmwareVersion: string;
  serverId?: string | null;
}

// Incident / Alert
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  type: string;
  deviceId?: string;
  timestamp: string;
  resolved: boolean;
}

export interface CycleLogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
}

export interface CycleStatus {
  cycleId: string | null;
  state: 'idle' | 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  phase: string;
  targetId: string | null;
  targetName: string | null;
  newScore: number | null;
  cyclesRun: number;
  logs: CycleLogEntry[];
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

// Network Node
export interface NetworkNode {
  id: string;
  label: string;
  type: string;
  trustScore: number;
  status: DeviceStatus;
  x: number;
  y: number;
  serverId?: string | null;
}

export interface ServerNode {
  id: string;
  name: string;
  location?: string | null;
  x: number;
  y: number;
}

// Auth
export interface User {
  id: string;
  username: string;
  role: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
