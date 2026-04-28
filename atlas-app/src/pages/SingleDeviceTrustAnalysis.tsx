import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Wifi, Cpu, MapPin } from 'lucide-react';
import Topbar from '../components/Topbar';
import { deviceService } from '../services';
import type { Device } from '../types';
import '../components/Layout.css';

interface ShapExplanation { 
  feature: string; 
  shap_value: number; 
  impact: string; 
}

const formatFeatureName = (name: string) => {
  return name.replace(/_/g, ' ').replace('MI dir', 'Directional').replace('H L5', 'Host').replace('weight', 'Weight').replace('mean', 'Mean').replace('variance', 'Variance');
};

const impactColor = (impact: string, value: number) => {
  if (value > 0) return '#2EA043'; // Positive impact (increases trust/decreases anomaly score)
  if (impact === 'high') return '#FF4444';
  if (impact === 'medium') return '#E3A008';
  return '#8B949E';
};

export default function SingleDeviceTrustAnalysis() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [explanations, setExplanations] = useState<ShapExplanation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    Promise.all([
      deviceService.getDevice(deviceId),
      deviceService.getTrustAnalysis(deviceId),
    ])
      .then(([devRes, trustRes]) => {
        setDevice(devRes.data);
        setExplanations(trustRes.data.explanations ?? []);
      })
      .catch((error) => {
        console.error("Error loading ML data:", error);
      })
      .finally(() => setLoading(false));
  }, [deviceId]);

  if (loading) return <div className="loading-state">Loading AI Trust Analysis…</div>;

  const overallScore = device?.trustScore ?? 0;
  const isSafe = overallScore >= 70;

  return (
    <>
      <Topbar title="AI Trust Analysis" subtitle={`Device #${deviceId}`} />
      <div className="page-content">
        {/* Back */}
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#aa3bff', cursor: 'pointer', fontSize: 13 }}>
          <ArrowLeft size={15} /> Back to Inventory
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, marginTop: 16 }}>
          {/* Device Info Card */}
          <div>
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header"><h2 className="panel-title">Device Info</h2></div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoRow icon={<Cpu size={14} />}     label="Name"     value={device?.name} />
                <InfoRow icon={<ShieldAlert size={14}/>} label="Type"  value={device?.type} />
                <InfoRow icon={<Wifi size={14} />}    label="IP"       value={device?.ipAddress} mono />
                <InfoRow icon={<MapPin size={14} />}  label="Location" value={device?.location} />
              </div>
            </div>

            {/* Overall Score Gauge */}
            <div className="panel">
              <div className="panel-header"><h2 className="panel-title">Current Trust Score</h2></div>
              <div className="panel-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64, fontWeight: 700, color: isSafe ? '#2EA043' : '#FF4444', lineHeight: 1 }}>
                  {overallScore}
                </div>
                <div style={{ fontSize: 11, color: '#8B949E', marginTop: 4 }}>dynamically adjusted by Isolation Forest</div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ height: 8, background: '#30363D', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${overallScore}%`, height: '100%', background: isSafe ? '#2EA043' : '#FF4444', borderRadius: 99, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Machine Learning SHAP Explanation */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Live ML Feature Analysis (SHAP)</h2>
              <p style={{ fontSize: 13, color: '#8B949E', marginTop: 8 }}>
                This shows exactly which network properties caused the anomaly score to change. Negative SHAP values lower the trust score.
              </p>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {explanations.length === 0 ? (
                <div style={{ color: '#8b949e', fontStyle: 'italic' }}>No baseline anomaly data collected yet.</div>
              ) : (
                explanations.slice(0, 8).map(exp => {
                  const safeName = formatFeatureName(exp.feature);
                  const color = impactColor(exp.impact, exp.shap_value);
                  // Normalize bar width for visual display
                  const barWidth = Math.min(100, Math.max(5, Math.abs(exp.shap_value) * 150)); 
                  
                  return (
                    <div key={exp.feature}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#E6EDF3', fontSize: 13, fontWeight: 600 }}>{safeName}</span>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ color: '#8B949E', fontSize: 11, textTransform: 'uppercase' }}>{exp.impact} impact</span>
                          <span style={{ color, fontSize: 16, fontWeight: 700 }}>
                            {exp.shap_value > 0 ? '+' : ''}{exp.shap_value.toFixed(4)}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: '#30363D', borderRadius: 99, overflow: 'hidden', display: 'flex', justifyContent: exp.shap_value < 0 ? 'flex-start' : 'flex-end' }}>
                        <div style={{ width: `${barWidth}%`, height: '100%', background: color, borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: '#8B949E' }}>{icon}</span>
      <span style={{ color: '#8B949E', fontSize: 11, width: 70 }}>{label}</span>
      <span style={{ color: '#E6EDF3', fontSize: 12, fontFamily: mono ? 'monospace' : undefined }}>{value ?? '—'}</span>
    </div>
  );
}
