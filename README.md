# ATLAS-TDI — Adaptive Trust & Drift Intelligence for IoT Networks

## Quick Start
```bash
cd atlas-app
npm install
npm run dev        # http://localhost:5173
```

## Connecting to Your Backend
Set your backend URL in `.env`:
```
VITE_API_BASE_URL=http://localhost:8000/api
```

## Project Structure
```
src/
├── config/
│   └── api.ts              ← API endpoints config (change BASE_URL here)
├── services/
│   ├── apiClient.ts        ← Axios instance with JWT interceptor
│   └── index.ts            ← All service functions per domain
├── types/
│   └── index.ts            ← TypeScript types for all entities
├── components/
│   ├── Layout.tsx / .css   ← Root shell + shared utility CSS
│   ├── Sidebar.tsx / .css  ← Navigation sidebar
│   └── Topbar.tsx / .css   ← Header bar
└── pages/
    ├── SOCDashboard.tsx              ← / (ATLAS-TDI Dashboard)
    ├── IoTInventory.tsx              ← /inventory
    ├── SingleDeviceTrustAnalysis.tsx ← /inventory/:deviceId/trust
    ├── TrustAnalysis.tsx             ← /trust
    ├── IncidentOverview.tsx          ← /incidents
    ├── IncidentLogs.tsx              ← /incidents/logs
    └── NetworkMap.tsx                ← /network
```

## Backend API Contract
All pages make real API calls and **fall back to mock data** when the backend isn't running.

| Method | Endpoint | Page |
|--------|----------|------|
| GET | `/api/dashboard/overview` | ATLAS-TDI Dashboard |
| GET | `/api/devices?page=&search=` | IoT Inventory |
| GET | `/api/devices/:id` | Single Device |
| GET | `/api/devices/:id/trust-analysis` | Device Trust |
| POST | `/api/devices/:id/isolate` | Isolate Action |
| GET | `/api/trust/breakdown` | Trust Analysis |
| GET | `/api/incidents?severity=` | Incident Overview |
| GET | `/api/incidents/logs?page=` | Incident Logs |
| GET | `/api/network/map` | Network Map |
| POST | `/api/auth/login` | Auth |

## Auth
JWT token stored in `localStorage` as `atlas_token`.  
The Axios interceptor automatically attaches it to every request.  
On 401, the user is redirected to `/login`.

## Stitch Assets
Original Stitch screenshots and HTML references are saved in:
- `stitch/screenshots/` — PNG previews of all 7 screens
- `stitch/html/`        — Generated HTML from Stitch
