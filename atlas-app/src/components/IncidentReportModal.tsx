import type { Incident } from '../types';

interface IncidentReportModalProps {
  incident: Incident;
  onClose: () => void;
}

function generateReport(inc: Incident) {
  const time = new Date(inc.timestamp);
  const timeStr = time.toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'medium',
  });

  // Try to extract trust score from description (e.g. "Final trust score: 18.0.")
  const scoreMatch = inc.description?.match(/trust score[:\s]+(\d+\.?\d*)/i)
    || inc.description?.match(/(\d+\.?\d*)\s*→\s*(\d+\.?\d*)/);
  const finalScore = scoreMatch ? parseFloat(scoreMatch[scoreMatch.length - 1]) : null;
  const oldScore = scoreMatch && scoreMatch.length >= 3 ? parseFloat(scoreMatch[1]) : null;

  const attackTypeMatch = inc.title?.match(/\(([^)]+)\)/);
  const attackType = attackTypeMatch ? attackTypeMatch[1] : inc.type ?? 'Unknown';

  const deviceMatch = inc.description?.match(/device\s+([\w-]+)/i);
  const deviceName = deviceMatch ? deviceMatch[1] : inc.deviceId ? `#${inc.deviceId.slice(0, 8)}` : 'Unknown Device';

  const locationMatch = inc.description?.match(/at\s+([\w\s]+)\./i);
  const location = locationMatch ? locationMatch[1].trim() : 'Unknown Location';

  const severity = inc.severity?.toUpperCase() ?? 'CRITICAL';

  let trustStatus = 'UNKNOWN';
  let trustColor = '#8B949E';
  if (finalScore !== null) {
    if (finalScore < 40) { trustStatus = 'CRITICAL BREACH'; trustColor = '#FF4444'; }
    else if (finalScore < 70) { trustStatus = 'SUSPICIOUS'; trustColor = '#FFD600'; }
    else { trustStatus = 'HEALTHY'; trustColor = '#00E676'; }
  }

  const nextSteps: { icon: string; step: string; detail: string }[] = [];

  if (inc.severity === 'critical' || inc.severity === 'breach') {
    nextSteps.push({
      icon: '🔒',
      step: 'Isolate the Device Immediately',
      detail: `Go to the IoT Inventory, find ${deviceName}, and click "Isolate" to block it from communicating with other devices. This stops the attack from spreading.`,
    });
    nextSteps.push({
      icon: '🔍',
      step: 'Investigate the Traffic Logs',
      detail: `Check all network traffic from ${deviceName} in the past 24 hours. Look for unusual amounts of data sent to unknown IP addresses — this is a sign of botnet activity.`,
    });
    if (attackType.toLowerCase().includes('botnet')) {
      nextSteps.push({
        icon: '🛡️',
        step: 'Scan for Botnet Malware',
        detail: `Run a full firmware scan on ${deviceName}. Botnet malware often hides in firmware. If infected, wipe and re-flash the device firmware with a clean, verified version.`,
      });
    }
    if (attackType.toLowerCase().includes('ddos')) {
      nextSteps.push({
        icon: '🌐',
        step: 'Enable Rate Limiting',
        detail: `Activate network rate limiting on this device's port to cap outgoing requests. This reduces the DDoS impact on other connected systems.`,
      });
    }
    if (attackType.toLowerCase().includes('brute') || attackType.toLowerCase().includes('credential')) {
      nextSteps.push({
        icon: '🔑',
        step: 'Change All Credentials',
        detail: `Reset all passwords and API keys associated with ${deviceName}. Enable multi-factor authentication if possible.`,
      });
    }
    nextSteps.push({
      icon: '🔄',
      step: 'Reset Trust Score After Fix',
      detail: `Once the device is secured, go to IoT Inventory → Device → "Reset Trust" to restore its trust score to 100 and change status back to STABLE.`,
    });
    nextSteps.push({
      icon: '📋',
      step: 'Document the Incident',
      detail: `Record what happened, when, which device was affected, and what actions were taken. This helps prevent similar attacks in the future.`,
    });
  } else if (inc.severity === 'warning') {
    nextSteps.push({
      icon: '👁️',
      step: 'Monitor Closely',
      detail: `Keep a close eye on ${deviceName}. If its trust score drops below 40, escalate immediately.`,
    });
    nextSteps.push({
      icon: '🔧',
      step: 'Check Device Firmware',
      detail: `Ensure the device is running the latest firmware version. Outdated firmware is a common vulnerability.`,
    });
  }

  return { timeStr, finalScore, oldScore, attackType, deviceName, location, severity, trustStatus, trustColor, nextSteps };
}

export default function IncidentReportModal({ incident, onClose }: IncidentReportModalProps) {
  const r = generateReport(incident);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)', padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0D1117', border: '1px solid #30363D', borderRadius: 12,
          width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,68,68,0.15) 0%, rgba(13,17,23,0) 60%)',
          borderBottom: '1px solid #30363D', padding: '24px 28px', borderRadius: '12px 12px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ background: '#FF4444', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>
                {r.severity}
              </span>
              <span style={{ color: '#8B949E', fontSize: 11, fontFamily: 'monospace' }}>{incident.id.slice(0, 16)}…</span>
            </div>
            <h2 style={{ color: '#E6EDF3', fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              🚨 Security Incident Report
            </h2>
            <p style={{ color: '#8B949E', fontSize: 12, margin: '6px 0 0 0' }}>{incident.title}</p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid #30363D', color: '#8B949E',
            borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
          }}>✕ Close</button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* What Happened */}
          <section>
            <h3 style={{ color: '#388bff', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>
              📌 What Happened?
            </h3>
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8, padding: 16 }}>
              <p style={{ color: '#E6EDF3', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                A <strong style={{ color: '#FF4444' }}>{r.attackType}</strong> attack was detected on device{' '}
                <strong style={{ color: '#388bff' }}>{r.deviceName}</strong> located at{' '}
                <strong style={{ color: '#E6EDF3' }}>{r.location}</strong>.
              </p>
              <p style={{ color: '#8B949E', fontSize: 13, lineHeight: 1.6, margin: '10px 0 0 0' }}>
                {incident.description}
              </p>
            </div>
          </section>

          {/* When */}
          <section>
            <h3 style={{ color: '#388bff', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>
              🕐 When Did This Happen?
            </h3>
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>📅</span>
              <div>
                <div style={{ color: '#E6EDF3', fontSize: 15, fontWeight: 600 }}>{r.timeStr}</div>
                <div style={{ color: '#8B949E', fontSize: 12, marginTop: 4 }}>
                  Incident ID: <span style={{ fontFamily: 'monospace', color: '#388bff' }}>{incident.id}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Trust Score */}
          {r.finalScore !== null && (
            <section>
              <h3 style={{ color: '#388bff', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>
                📉 Trust Score Impact
              </h3>
              <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {r.oldScore !== null && (
                    <>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#8B949E', marginBottom: 4 }}>BEFORE ATTACK</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#00E676' }}>{r.oldScore}</div>
                      </div>
                      <div style={{ fontSize: 24, color: '#FF4444' }}>→</div>
                    </>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8B949E', marginBottom: 4 }}>AFTER ATTACK</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: r.trustColor }}>{r.finalScore}</div>
                  </div>
                  <div style={{
                    background: r.trustColor + '22', border: `1px solid ${r.trustColor}44`,
                    borderRadius: 6, padding: '6px 14px',
                  }}>
                    <div style={{ color: r.trustColor, fontWeight: 700, fontSize: 13 }}>{r.trustStatus}</div>
                  </div>
                </div>
                {/* Trust bar */}
                <div style={{ marginTop: 14, height: 8, background: '#30363D', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${r.finalScore}%`, height: '100%',
                    background: r.finalScore < 40 ? '#FF4444' : r.finalScore < 70 ? '#FFD600' : '#00E676',
                    borderRadius: 99, transition: 'width 0.8s ease',
                  }} />
                </div>
                <p style={{ color: '#8B949E', fontSize: 12, margin: '10px 0 0 0' }}>
                  A score below <strong style={{ color: '#FF4444' }}>40</strong> means the device is critically compromised. 
                  Normal healthy devices score above <strong style={{ color: '#00E676' }}>70</strong>.
                </p>
              </div>
            </section>
          )}

          {/* Next Steps */}
          <section>
            <h3 style={{ color: '#388bff', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>
              ✅ What To Do Next
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {r.nextSteps.map((step, i) => (
                <div key={i} style={{
                  background: '#161B22', border: '1px solid #30363D', borderRadius: 8,
                  padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{step.icon}</span>
                  <div>
                    <div style={{ color: '#E6EDF3', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      Step {i + 1}: {step.step}
                    </div>
                    <div style={{ color: '#8B949E', fontSize: 12, lineHeight: 1.6 }}>{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <div style={{
            background: 'rgba(56,139,255,0.06)', border: '1px solid rgba(56,139,255,0.2)',
            borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <p style={{ color: '#8B949E', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
              This report was automatically generated by <strong style={{ color: '#388bff' }}>ATLAS-TDI</strong> based on real-time anomaly detection and trust scoring. 
              Always verify findings with your security team before taking action.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
