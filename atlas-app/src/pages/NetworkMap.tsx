import { useEffect, useState, useRef } from 'react';
import Topbar from '../components/Topbar';
import { deviceService, networkService, serverService } from '../services';
import './NetworkMap.css';

interface NodeData { id: string; label: string; type: string; trustScore: number; status: string; x: number; y: number; }
interface EdgeData { from: string; to: string; threat: boolean; }

const nodeColor = (score: number) => score >= 80 ? '#00FF00' : score >= 40 ? '#FFA500' : '#FF4444';

export default function NetworkMap() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [servers, setServers] = useState<NodeData[]>([]);
  const [devices, setDevices] = useState<NodeData[]>([]);
  const [serverForm, setServerForm] = useState({ name: '', location: '', x: 50, y: 50 });
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string, type: string, action: 'context' | 'click' } | null>(null);
  
  // Dragging state
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const loadMap = () => {
    networkService.getMap()
      .then(res => {
        const mapNodes = res.data.nodes ?? [];
        setNodes(mapNodes);
        setEdges(res.data.edges ?? []);
        setServers(mapNodes.filter((n: NodeData) => n.type === 'server'));
        setDevices(mapNodes.filter((n: NodeData) => n.type !== 'server'));
      })
      .catch((err) => {
        console.error("Failed to load map:", err);
      });
  };

  useEffect(() => {
    loadMap();
  }, []);

  // --- Dragging Handlers ---
  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragNodeId(id);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragNodeId || !svgRef.current) return;
    
    // Map screen coordinates back to SVG viewbox coordinates (0-100)
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    setNodes(prev => prev.map(n => 
      n.id === dragNodeId ? { ...n, x: cursorPt.x, y: cursorPt.y } : n
    ));
  };

  const handlePointerUp = () => {
    setDragNodeId(null);
  };

  const closeMenu = () => setContextMenu(null);

  const handleNodeContextMenu = (e: React.MouseEvent, node: NodeData) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, type: node.type, action: 'context' });
  };

  const handleNodeClick = (e: React.MouseEvent, node: NodeData) => {
    e.stopPropagation();
    if (node.type === 'server') {
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, type: 'server', action: 'click' });
    }
  };

  const handleCreateServer = async () => {
    if (!serverForm.name.trim()) return;
    try {
      await serverService.createServer({
        name: serverForm.name.trim(),
        location: serverForm.location.trim() || undefined,
        x: Number(serverForm.x),
        y: Number(serverForm.y),
      });
      setServerForm({ name: '', location: '', x: 50, y: 50 });
      loadMap();
    } catch (err) {
      console.error('Failed to create server:', err);
    }
  };

  const handleDeleteServer = async () => {
    if (!selectedServerId) return;
    if (!window.confirm('Delete this server? Assigned devices will become unassigned.')) return;
    try {
      await serverService.deleteServer(selectedServerId);
      setSelectedServerId('');
      loadMap();
    } catch (err) {
      console.error('Failed to delete server:', err);
    }
  };

  const handleAssignDevice = async () => {
    if (!selectedDeviceId || !selectedServerId) return;
    try {
      await deviceService.updateDevice(selectedDeviceId, { serverId: selectedServerId });
      loadMap();
    } catch (err) {
      console.error('Failed to assign device to server:', err);
    }
  };

  return (
    <>
      <Topbar title="NETWORK MAP" subtitle="LIVE TOPOLOGY VIEW" />
      <div className="nm-layout">
        
        {/* Left Inner Sidebar */}
        <div className="nm-left-sidebar">
          <div className="nm-status-box">
            <div className="nm-status-header">
              <span>STATUS</span>
              <span className="text-green">● ACTIVE</span>
            </div>
            <div className="nm-status-row">
              <span className="nm-label">NODE THROUGHPUT</span>
              <span className="nm-val text-green">12.4 GB/S</span>
            </div>
            <div className="nm-status-row">
              <span className="nm-label">LATENCY</span>
              <span className="nm-val text-green">0.4 MS</span>
            </div>
          </div>
          
          <div className="nm-threat-box">
            <div className="nm-label">THREAT LEVEL</div>
            <div className="nm-threat-val">ELEVATED</div>
            <div className="nm-threat-bars">
              <div className="nm-t-bar bg-green"></div>
              <div className="nm-t-bar bg-green"></div>
              <div className="nm-t-bar bg-orange"></div>
              <div className="nm-t-bar bg-red pulse-red"></div>
              <div className="nm-t-bar bg-gray"></div>
            </div>
            <div className="nm-threat-sub">ANOMALOUS ACTIVITY DETECTED IN NODE_X7</div>
          </div>
          
          <div className="nm-sys-logs">
            <div className="nm-label">SYSTEM_LOGS</div>
            <div className="nm-log">[14:22:01] NODE_04 CONNECTED</div>
            <div className="nm-log">[14:22:04] ENCRYPTION HANDSHAKE OK</div>
            <div className="nm-log text-orange">[14:22:15] WARN: PKT_LOSS AT GATEWAY_1</div>
            <div className="nm-log text-red">[14:23:45] BREACH DETECTED: NODE_X7</div>
            <div className="nm-log">[14:23:59] FIREWALL_X RE-ROUTING...</div>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="nm-canvas-container">
          <div className="nm-canvas-header">
            <h3 className="nm-title">NETWORK MAP <span className="nm-badge">LIVE TOPOLOGY VIEW</span></h3>
            <p className="nm-subtitle">Visualizing real-time interaction between core assets and edge sensors across all active sectors. Drag nodes to interact.</p>
          </div>
          
          <svg 
            ref={svgRef}
            className="nm-svg"
            viewBox="0 0 100 100" 
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={closeMenu}
          >
            {/* Draw Edges */}
            {edges.map((e, i) => {
              const from = nodes.find(n => n.id === e.from);
              const to   = nodes.find(n => n.id === e.to);
              if (!from || !to) return null;
              return (
                <line key={i}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={e.threat ? '#FF4444' : '#00FF00'}
                  strokeWidth={e.threat ? 0.3 : 0.15}
                  strokeDasharray={e.threat ? '0.8,0.8' : undefined}
                  opacity={e.threat ? 0.9 : 0.5}
                />
              );
            })}
            
            {/* Draw Nodes */}
            {nodes.map(node => {
              const isServer = node.type === 'server';
              const color = isServer ? '#00FF00' : nodeColor(node.trustScore);
              const isBreached = node.trustScore < 40;
              
              return (
                <g key={node.id} 
                   transform={`translate(${node.x},${node.y})`}
                   className="nm-node-group"
                   onPointerDown={(e) => handlePointerDown(e, node.id)}
                   onContextMenu={(e) => handleNodeContextMenu(e, node)}
                   onClick={(e) => handleNodeClick(e, node)}
                >
                  {/* Outer Glow */}
                  <circle r={isServer ? 8 : 6} fill={color} opacity={0.1} style={{ filter: 'blur(3px)' }} />
                  
                  {/* Node Box */}
                  <rect x={isServer ? -5 : -3.5} y={isServer ? -5 : -3.5} 
                        width={isServer ? 10 : 7} height={isServer ? 10 : 7} 
                        rx={1.5} fill="#0B0F19" stroke={color} strokeWidth={isServer ? 0.4 : 0.2} />
                        
                  {/* Icon Placeholder (simplified) */}
                  {isServer ? (
                    <>
                      <rect x="-2" y="-2" width="4" height="1" fill={color} />
                      <rect x="-2" y="1" width="4" height="1" fill={color} />
                    </>
                  ) : (
                    <circle cx="0" cy="0" r="1" fill={color} />
                  )}
                  
                  {/* Breach Warning Bubble */}
                  {isBreached && (
                    <g transform="translate(-8, -4)">
                       <rect x="-6" y="-2" width="12" height="3" rx="0.5" fill="#FF4444" opacity="0.8" />
                       <text x="0" y="0" textAnchor="middle" fill="#fff" fontSize="1.5" fontWeight="bold">BREACH DETECTED</text>
                    </g>
                  )}

                  {/* Label */}
                  <text y={isServer ? 8 : 6} textAnchor="middle" fill="#8B949E" fontSize="2.5" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right Inner Sidebar */}
        <div className="nm-right-sidebar">
          <div className="nm-label" style={{marginBottom: 16}}>≡ FLEET SUMMARY</div>
          
          <div className="fleet-stat">
            <div className="f-row"><span className="f-name">Gateways</span><span className="f-val">12/12</span></div>
            <div className="f-bar-wrap"><div className="f-bar bg-green" style={{width: '100%'}}></div></div>
            <div className="f-status">SECURE</div>
          </div>
          
          <div className="fleet-stat">
            <div className="f-row"><span className="f-name">Edge Routers</span><span className="f-val text-red">01/04</span></div>
            <div className="f-bar-wrap"><div className="f-bar bg-red" style={{width: '25%'}}></div></div>
            <div className="f-status text-red">BREACHED</div>
          </div>
          
          <div className="fleet-stat">
            <div className="f-row"><span className="f-name">Surveillance Cam</span><span className="f-val text-orange">28/32</span></div>
            <div className="f-bar-wrap"><div className="f-bar bg-orange" style={{width: '87%'}}></div></div>
            <div className="f-status text-orange">DEGRADED</div>
          </div>
          
          <div className="fleet-stat">
            <div className="f-row"><span className="f-name">Env Sensors</span><span className="f-val">114/114</span></div>
            <div className="f-bar-wrap"><div className="f-bar bg-green" style={{width: '100%'}}></div></div>
            <div className="f-status">SECURE</div>
          </div>
          
          <div className="nm-label" style={{marginTop: 32, marginBottom: 12}}>CURRENT SECTOR MAP</div>
          <div className="nm-sector-map">
            {/* Cyberpunk Map Placeholder */}
            <div className="nm-map-grid"></div>
            <span className="nm-map-loc">LOC: [SECTOR_G7]</span>
          </div>
          
          <button className="btn-countermeasures">
            ● DEPLOY COUNTERMEASURES
          </button>

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #30363D' }}>
            <div className="nm-label" style={{ marginBottom: 8 }}>CREATE SERVER</div>
            <input className="search-input" placeholder="Server Name" value={serverForm.name} onChange={(e) => setServerForm((s) => ({ ...s, name: e.target.value }))} />
            <input className="search-input" placeholder="Location" value={serverForm.location} onChange={(e) => setServerForm((s) => ({ ...s, location: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="search-input" type="number" min={0} max={100} placeholder="X" value={serverForm.x} onChange={(e) => setServerForm((s) => ({ ...s, x: Number(e.target.value) }))} />
              <input className="search-input" type="number" min={0} max={100} placeholder="Y" value={serverForm.y} onChange={(e) => setServerForm((s) => ({ ...s, y: Number(e.target.value) }))} />
            </div>
            <button className="btn-countermeasures" style={{ marginTop: 8 }} onClick={handleCreateServer}>
              + CREATE SERVER
            </button>

            <div className="nm-label" style={{ marginTop: 12, marginBottom: 8 }}>ASSIGN DEVICE TO SERVER</div>
            <select className="search-input" value={selectedServerId} onChange={(e) => setSelectedServerId(e.target.value)}>
              <option value="">Select server</option>
              {servers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select className="search-input" value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} style={{ marginTop: 8 }}>
              <option value="">Select IoT device</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-countermeasures" onClick={handleAssignDevice}>ASSIGN</button>
              <button className="btn-countermeasures" onClick={handleDeleteServer} style={{ color: '#FF4444', borderColor: '#FF4444' }}>
                DELETE SERVER
              </button>
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          backgroundColor: '#161B22',
          border: '1px solid #30363D',
          borderRadius: '6px',
          padding: '8px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {contextMenu.action === 'context' && (
            <button 
              style={{ color: '#FF4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', width: '100%', textAlign: 'left', fontSize: '14px', outline: 'none' }}
              onClick={(e) => {
                e.stopPropagation();
                if (contextMenu.type === 'server') {
                  if (window.confirm('Delete this server? Assigned devices will become unassigned.')) {
                    serverService.deleteServer(contextMenu.nodeId).then(loadMap).finally(closeMenu);
                  } else { closeMenu(); }
                } else {
                  if (window.confirm('Delete this device?')) {
                    deviceService.deleteDevice(contextMenu.nodeId).then(loadMap).finally(closeMenu);
                  } else { closeMenu(); }
                }
              }}
            >
              Delete {contextMenu.type === 'server' ? 'Server' : 'Device'}
            </button>
          )}
          {contextMenu.action === 'click' && contextMenu.type === 'server' && (
            <button 
              style={{ color: '#00FF00', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', width: '100%', textAlign: 'left', fontSize: '14px', outline: 'none' }}
              onClick={(e) => {
                e.stopPropagation();
                const name = window.prompt('Enter new IoT device name:');
                if (name && name.trim()) {
                  deviceService.createDevice({ name: name.trim(), type: 'sensor', serverId: contextMenu.nodeId })
                    .then(loadMap)
                    .finally(closeMenu);
                } else {
                  closeMenu();
                }
              }}
            >
              + Add IoT Device
            </button>
          )}
        </div>
      )}

      <style>{`
        .search-input {
          width: 100%;
          background: #161B22;
          border: 1px solid #30363D;
          color: #E6EDF3;
          font-size: 12px;
          border-radius: 6px;
          padding: 8px 10px;
          outline: none;
        }
      `}</style>
    </>
  );
}
