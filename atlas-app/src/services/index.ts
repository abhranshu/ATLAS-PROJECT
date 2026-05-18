import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/api';

// ─── Dashboard ────────────────────────────────────────────
export const dashboardService = {
  getOverview: () => apiClient.get(API_ENDPOINTS.dashboard.overview),
  getSystemHealth: () => apiClient.get(API_ENDPOINTS.dashboard.systemHealth),
  getGeoDistribution: () => apiClient.get(API_ENDPOINTS.dashboard.geoDistribution),
  simulateAttack: (payload?: { deviceId?: string; attackType?: string }) => apiClient.post(API_ENDPOINTS.dashboard.simulateAttack, payload ?? {}),
  getCycleStatus: () => apiClient.get(API_ENDPOINTS.dashboard.cycleStatus),
};

// ─── Devices ──────────────────────────────────────────────
export const deviceService = {
  getDevices: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    apiClient.get(API_ENDPOINTS.devices.list, { params }),
  getDevice: (id: string) => apiClient.get(API_ENDPOINTS.devices.detail(id)),
  getTrustAnalysis: (id: string) => apiClient.get(API_ENDPOINTS.devices.trustAnalysis(id)),
  isolateDevice: (id: string) => apiClient.post(API_ENDPOINTS.devices.isolate(id)),
  createDevice: (payload: {
    name: string;
    type: string;
    location?: string;
    ipAddress?: string;
    firmwareVersion?: string;
    serverId?: string | null;
    trustScore?: number;
    status?: string;
  }) => apiClient.post(API_ENDPOINTS.devices.create, payload),
  updateDevice: (id: string, payload: {
    name?: string;
    type?: string;
    location?: string;
    ipAddress?: string;
    firmwareVersion?: string;
    serverId?: string | null;
    trustScore?: number;
    status?: string;
  }) => apiClient.patch(API_ENDPOINTS.devices.update(id), payload),
  deleteDevice: (id: string) => apiClient.delete(API_ENDPOINTS.devices.remove(id)),
  resetTrustScore: (id: string) => apiClient.post(API_ENDPOINTS.devices.resetTrust(id)),
};

// ─── Trust ────────────────────────────────────────────────
export const trustService = {
  getOverview: () => apiClient.get(API_ENDPOINTS.trust.overview),
  getTimeline: (params?: { from?: string; to?: string }) =>
    apiClient.get(API_ENDPOINTS.trust.timeline, { params }),
  getBreakdown: () => apiClient.get(API_ENDPOINTS.trust.breakdown),
};

// ─── Incidents ────────────────────────────────────────────
export const incidentService = {
  getOverview: () => apiClient.get(API_ENDPOINTS.incidents.overview),
  getIncidents: (params?: { page?: number; limit?: number; severity?: string }) =>
    apiClient.get(API_ENDPOINTS.incidents.list, { params }),
  getIncident: (id: string) => apiClient.get(API_ENDPOINTS.incidents.detail(id)),
  getLogs: (params?: { page?: number; limit?: number }) =>
    apiClient.get(API_ENDPOINTS.incidents.logs, { params }),
};

// ─── Telemetry ────────────────────────────────────────────
export const telemetryService = {
  ingest: (payload: { device_id: string; packet_count: number; entropy: number; ip_diversity: number }) => 
    apiClient.post('/telemetry/ingest', payload),
};

// ─── Network ──────────────────────────────────────────────
export const networkService = {
  getMap: () => apiClient.get(API_ENDPOINTS.network.map),
  getNodes: () => apiClient.get(API_ENDPOINTS.network.nodes),
  getConnections: () => apiClient.get(API_ENDPOINTS.network.connections),
};

export const serverService = {
  getServers: () => apiClient.get(API_ENDPOINTS.servers.list),
  createServer: (payload: { name: string; location?: string; x?: number; y?: number }) =>
    apiClient.post(API_ENDPOINTS.servers.create, payload),
  updateServer: (id: string, payload: { name?: string; location?: string; x?: number; y?: number }) =>
    apiClient.patch(API_ENDPOINTS.servers.update(id), payload),
  deleteServer: (id: string) => apiClient.delete(API_ENDPOINTS.servers.remove(id)),
};

// ─── Auth ─────────────────────────────────────────────────
export const authService = {
  login: (credentials: { username: string; password: string }) =>
    apiClient.post(API_ENDPOINTS.auth.login, credentials),
  logout: () => apiClient.post(API_ENDPOINTS.auth.logout),
  getMe: () => apiClient.get(API_ENDPOINTS.auth.me),
};
