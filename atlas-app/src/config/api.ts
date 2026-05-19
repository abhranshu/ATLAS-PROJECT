// ─────────────────────────────────────────────
// API Configuration — update BASE_URL to match your backend
// ─────────────────────────────────────────────

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const API_ENDPOINTS = {
  // Dashboard / SOC Overview
  dashboard: {
    overview: '/dashboard/overview',
    systemHealth: '/dashboard/system-health',
    geoDistribution: '/dashboard/geo-distribution',
    simulateAttack: '/dashboard/simulate-attack',
    cycleStatus: '/dashboard/cycle-status',
  },
  // IoT Devices
  devices: {
    list: '/devices',
    detail: (id: string) => `/devices/${id}`,
    trustAnalysis: (id: string) => `/devices/${id}/trust-analysis`,
    isolate: (id: string) => `/devices/${id}/isolate`,
    create: '/devices',
    update: (id: string) => `/devices/${id}`,
    remove: (id: string) => `/devices/${id}`,
    resetTrust: (id: string) => `/devices/${id}/reset-trust`,
  },
  // Trust Analysis
  trust: {
    overview: '/trust/overview',
    timeline: '/trust/timeline',
    breakdown: '/trust/breakdown',
  },
  // Incidents
  incidents: {
    overview: '/incidents/overview',
    list: '/incidents',
    detail: (id: string) => `/incidents/${id}`,
    logs: '/incidents/logs',
    clearLogs: '/incidents/logs/clear',
  },
  // Network
  network: {
    map: '/network/map',
    nodes: '/network/nodes',
    connections: '/network/connections',
  },
  servers: {
    list: '/servers',
    create: '/servers',
    update: (id: string) => `/servers/${id}`,
    remove: (id: string) => `/servers/${id}`,
  },
  // Auth
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
  },
};
