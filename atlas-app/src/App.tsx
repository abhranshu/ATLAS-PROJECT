import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import SOCDashboard from './pages/SOCDashboard';
import IoTInventory from './pages/IoTInventory';
import SingleDeviceTrustAnalysis from './pages/SingleDeviceTrustAnalysis';
import TrustAnalysis from './pages/TrustAnalysis';
import IncidentOverview from './pages/IncidentOverview';
import IncidentLogs from './pages/IncidentLogs';
import NetworkMap from './pages/NetworkMap';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Keep legacy login route but send users to dashboard */}
        <Route path="/login" element={<Navigate to="/" replace />} />

        {/* All pages share the sidebar layout and are directly accessible */}
        <Route element={<Layout />}>
          <Route path="/"          element={<SOCDashboard />} />
          <Route path="/inventory" element={<IoTInventory />} />
          <Route path="/inventory/:deviceId/trust" element={<SingleDeviceTrustAnalysis />} />
          <Route path="/trust"     element={<TrustAnalysis />} />
          <Route path="/incidents" element={<IncidentOverview />} />
          <Route path="/incidents/logs" element={<IncidentLogs />} />
          <Route path="/network"   element={<NetworkMap />} />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
