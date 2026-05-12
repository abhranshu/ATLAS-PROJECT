import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../components/Topbar';
import { deviceService, networkService, serverService } from '../services';
import './NetworkMap.css';

interface NodeData {
  id: string;
  label: string;
  type: string;
  trustScore: number;
  status: string;
  x: number;
  y: number;
  serverId?: string | null;
}

interface EdgeData {
  from: string;
  to: string;
  threat: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  type: string;
}

const nodeColor = (score: number) => (score >= 80 ? '#00FF00' : score >= 40 ? '#FFA500' : '#FF4444');
const LOCAL_POSITIONS_KEY = 'atlas_network_node_positions_v1';
const clamp = (v: number) => Math.max(2, Math.min(98, v));

export default function NetworkMap() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [serverForm, setServerForm] = useState({ name: '', location: '', x: 50, y: 50 });
  const [deviceForm, setDeviceForm] = useState({ name: '', type: 'sensor', serverId: '' });
  const [selectedServerId, setSelectedServerId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [connectSourceServerId, setConnectSourceServerId] = useState<string | null>(null);
  const [disconnectMode, setDisconnectMode] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const servers = useMemo(() => nodes.filter((n) => n.type === 'server'), [nodes]);
  const devices = useMemo(() => nodes.filter((n) => n.type !== 'server'), [nodes]);

  const loadLocalPositions = (): Record<string, { x: number; y: number }> => {
    try {
      const raw = localStorage.getItem(LOCAL_POSITIONS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveLocalPosition = (id: string, x: number, y: number) => {
    const map = loadLocalPositions();
    map[id] = { x, y };
    localStorage.setItem(LOCAL_POSITIONS_KEY, JSON.stringify(map));
  };

  const loadMap = () => {
    setErrorMsg(null);
    networkService
      .getMap()
      .then((res) => {
        const localPositions = loadLocalPositions();
        const mapNodes = res.data.nodes ?? [];
        const hydrated = mapNodes.map((n: NodeData) => {
          if (n.type === 'server') return n;
          const local = localPositions[n.id];
          return local ? { ...n, x: local.x, y: local.y } : n;
        });
        setNodes(hydrated);
        setEdges(res.data.edges ?? []);
      })
      .catch((err) => {
        console.error('Failed to load map:', err);
        setErrorMsg('Failed to load network map data.');
      });
  };

  useEffect(() => {
    loadMap();
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const el = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsMapFullscreen(Boolean(el && mapContainerRef.current && el === mapContainerRef.current));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const current = nodes.find((n) => n.id === id);
    if (current) setDragStartPos({ x: current.x, y: current.y });
    setDragNodeId(id);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragNodeId || !svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    setNodes((prev) => prev.map((n) => (n.id === dragNodeId ? { ...n, x: clamp(cursorPt.x), y: clamp(cursorPt.y) } : n)));
  };

  const handlePointerUp = async () => {
    if (!dragNodeId) return;
    const dragged = nodes.find((n) => n.id === dragNodeId);
    const draggedStart = dragStartPos;

    setDragNodeId(null);
    setDragStartPos(null);

    if (!dragged || !draggedStart) return;
    const moved = Math.abs(draggedStart.x - dragged.x) > 0.2 || Math.abs(draggedStart.y - dragged.y) > 0.2;
    if (!moved) return;

    try {
      if (dragged.type === 'server') {
        await serverService.updateServer(dragged.id, { x: dragged.x, y: dragged.y });
      } else {
        saveLocalPosition(dragged.id, dragged.x, dragged.y);
      }
    } catch (err) {
      console.error('Failed to persist node move:', err);
      setErrorMsg('Failed to save node position.');
      loadMap();
    }
  };

  const handleNodeClick = async (e: React.MouseEvent, node: NodeData) => {
    e.stopPropagation();
    setContextMenu(null);

    if (disconnectMode) {
      if (node.type === 'server') return;
      if (!node.serverId) {
        setErrorMsg('This IoT node is not linked to a server.');
        return;
      }
      try {
        setBusy(true);
        setErrorMsg(null);
        await deviceService.updateDevice(node.id, { serverId: '' });
        setDisconnectMode(false);
        loadMap();
      } catch (err) {
        console.error('Failed to disconnect IoT from server:', err);
        setErrorMsg('Failed to disconnect IoT from server.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!connectSourceServerId) {
      if (node.type === 'server') {
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, type: 'server' });
      }
      return;
    }

    if (node.type === 'server') {
      setConnectSourceServerId(node.id);
      return;
    }

    if (node.serverId === connectSourceServerId) {
      setConnectSourceServerId(null);
      return;
    }

    try {
      setBusy(true);
      await deviceService.updateDevice(node.id, { serverId: connectSourceServerId });
      setConnectSourceServerId(null);
      loadMap();
    } catch (err) {
      console.error('Failed to connect IoT to server:', err);
      setErrorMsg('Failed to connect selected IoT to server.');
    } finally {
      setBusy(false);
    }
  };

  const handleNodeContextMenu = (e: React.MouseEvent, node: NodeData) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, type: node.type });
  };

  const handleCreateServer = async () => {
    if (!serverForm.name.trim()) return;
    try {
      setBusy(true);
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
      setErrorMsg('Failed to create server.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDevice = async () => {
    if (!deviceForm.name.trim()) return;
    try {
      setBusy(true);
      await deviceService.createDevice({
        name: deviceForm.name.trim(),
        type: deviceForm.type,
        serverId: deviceForm.serverId || undefined,
      });
      setDeviceForm((prev) => ({ ...prev, name: '', serverId: '' }));
      loadMap();
    } catch (err) {
      console.error('Failed to create IoT device:', err);
      setErrorMsg('Failed to create IoT device.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSelectedServer = async () => {
    if (!selectedServerId) return;
    if (!window.confirm('Delete this server? Assigned devices will become unassigned.')) return;
    try {
      setBusy(true);
      await serverService.deleteServer(selectedServerId);
      setSelectedServerId('');
      loadMap();
    } catch (err) {
      console.error('Failed to delete server:', err);
      setErrorMsg('Failed to delete server.');
    } finally {
      setBusy(false);
    }
  };

  const handleAssignDevice = async () => {
    if (!selectedDeviceId || !selectedServerId) return;
    try {
      setBusy(true);
      await deviceService.updateDevice(selectedDeviceId, { serverId: selectedServerId });
      loadMap();
    } catch (err) {
      console.error('Failed to assign device to server:', err);
      setErrorMsg('Failed to assign device.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectDevice = async () => {
    if (!selectedDeviceId) return;
    try {
      setBusy(true);
      setErrorMsg(null);
      await deviceService.updateDevice(selectedDeviceId, { serverId: '' });
      loadMap();
    } catch (err) {
      console.error('Failed to disconnect device from server:', err);
      setErrorMsg('Failed to disconnect IoT.');
    } finally {
      setBusy(false);
    }
  };

  const handleContextDisconnectDevice = async () => {
    if (!contextMenu || contextMenu.type === 'server') return;
    const dev = nodes.find((n) => n.id === contextMenu.nodeId);
    if (!dev?.serverId) return;
    try {
      setBusy(true);
      setErrorMsg(null);
      await deviceService.updateDevice(contextMenu.nodeId, { serverId: '' });
      setContextMenu(null);
      loadMap();
    } catch (err) {
      console.error('Failed to disconnect device from server:', err);
      setErrorMsg('Failed to disconnect IoT.');
    } finally {
      setBusy(false);
      setContextMenu(null);
    }
  };

  const toggleMapFullscreen = async () => {
    const container = mapContainerRef.current;
    if (!container) return;
    const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
    const fsEl = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    const htmlEl = container as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    try {
      setErrorMsg(null);
      if (!fsEl) {
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (htmlEl.webkitRequestFullscreen) await htmlEl.webkitRequestFullscreen();
      } else if (document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    } catch (err) {
      console.error('Fullscreen request failed:', err);
      setErrorMsg('Fullscreen is not available or was blocked.');
    }
  };

  const quickCreateIoT = async (serverId: string) => {
    const name = window.prompt('Enter new IoT device name:');
    if (!name || !name.trim()) return;
    try {
      setBusy(true);
      await deviceService.createDevice({ name: name.trim(), type: 'sensor', serverId });
      loadMap();
    } catch (err) {
      console.error('Failed to create IoT device:', err);
      setErrorMsg('Failed to create IoT device.');
    } finally {
      setBusy(false);
    }
  };

  const handleContextAction = async (action: 'delete' | 'add-device' | 'connect-mode') => {
    if (!contextMenu) return;
    try {
      setBusy(true);
      if (action === 'delete') {
        if (contextMenu.type === 'server') {
          if (!window.confirm('Delete this server? Assigned devices will become unassigned.')) return;
          await serverService.deleteServer(contextMenu.nodeId);
        } else {
          if (!window.confirm('Delete this device?')) return;
          await deviceService.deleteDevice(contextMenu.nodeId);
        }
      }
      if (action === 'add-device' && contextMenu.type === 'server') {
        await quickCreateIoT(contextMenu.nodeId);
      }
      if (action === 'connect-mode' && contextMenu.type === 'server') {
        setDisconnectMode(false);
        setConnectSourceServerId(contextMenu.nodeId);
      }
      setContextMenu(null);
      loadMap();
    } catch (err) {
      console.error('Context menu action failed:', err);
      setErrorMsg('Action failed. Try again.');
    } finally {
      setBusy(false);
      setContextMenu(null);
    }
  };

  const resetLocalLayout = () => {
    localStorage.removeItem(LOCAL_POSITIONS_KEY);
    loadMap();
  };

  const allNodesCount = nodes.length;
  const linkedNodesCount = edges.length;
  const breachedCount = nodes.filter((n) => n.type !== 'server' && n.trustScore < 40).length;
  const connectStatusText = disconnectMode
    ? 'Disconnect mode: click a connected IoT node to unlink it from its server.'
    : connectSourceServerId
      ? `Connect mode: select IoT to link with ${servers.find((s) => s.id === connectSourceServerId)?.label ?? 'server'}`
      : 'Click CONNECT MODE, choose a server, then click an IoT node. Use DISCONNECT MODE to unlink by clicking a device.';

  return (
    <>
      <Topbar title="NETWORK MAP" subtitle="LIVE TOPOLOGY VIEW" />
      <div className="nm-layout" onClick={() => setContextMenu(null)}>
        <div className="nm-left-sidebar">
          <div className="nm-status-box">
            <div className="nm-status-header">
              <span>STATUS</span>
              <span className="text-green">● ACTIVE</span>
            </div>
            <div className="nm-status-row">
              <span className="nm-label">NODE COUNT</span>
              <span className="nm-val text-green">{allNodesCount}</span>
            </div>
            <div className="nm-status-row">
              <span className="nm-label">ACTIVE LINKS</span>
              <span className="nm-val text-green">{linkedNodesCount}</span>
            </div>
          </div>

          <div className="nm-threat-box">
            <div className="nm-label">THREAT LEVEL</div>
            <div className="nm-threat-val">{breachedCount > 0 ? 'ELEVATED' : 'STABLE'}</div>
            <div className="nm-threat-bars">
              <div className="nm-t-bar bg-green"></div>
              <div className="nm-t-bar bg-green"></div>
              <div className="nm-t-bar bg-orange"></div>
              <div className={`nm-t-bar ${breachedCount > 0 ? 'bg-red pulse-red' : 'bg-gray'}`}></div>
              <div className="nm-t-bar bg-gray"></div>
            </div>
            <div className="nm-threat-sub">
              {breachedCount > 0 ? `${breachedCount} breached IoT node(s) detected` : 'No breached IoT node detected'}
            </div>
          </div>

          <div className="nm-sys-logs">
            <div className="nm-label">MAP_INTERACTIONS</div>
            <div className="nm-log">• Drag any node to reposition</div>
            <div className="nm-log">• Right-click node for quick actions</div>
            <div className="nm-log">• Create server and IoT nodes from panel</div>
            <div className="nm-log">• Connect / Disconnect mode on the map toolbar</div>
            <div className="nm-log">• Server positions persist in backend</div>
          </div>
        </div>

        <div className="nm-canvas-container" ref={mapContainerRef}>
          <div className="nm-canvas-header">
            <h3 className="nm-title">
              NETWORK MAP <span className="nm-badge">LIVE TOPOLOGY VIEW</span>
            </h3>
            <p className="nm-subtitle">
              Visualizing real-time interaction between core assets and edge sensors across all active sectors.
              Drag nodes, create assets, and connect server-to-IoT links.
            </p>
            <div
              className={`nm-connect-hint ${connectSourceServerId ? 'is-active' : ''} ${disconnectMode ? 'is-disconnect' : ''}`}
            >
              {connectStatusText}
            </div>
            {errorMsg && <div className="nm-error">{errorMsg}</div>}
          </div>

          <svg
            ref={svgRef}
            className="nm-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={handlePointerMove}
            onPointerUp={() => void handlePointerUp()}
            onPointerLeave={() => void handlePointerUp()}
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(null);
            }}
          >
            {edges.map((e, i) => {
              const from = nodes.find((n) => n.id === e.from);
              const to = nodes.find((n) => n.id === e.to);
              if (!from || !to) return null;
              return (
                <line
                  key={`${e.from}-${e.to}-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={e.threat ? '#FF4444' : '#00FF00'}
                  strokeWidth={e.threat ? 0.3 : 0.15}
                  strokeDasharray={e.threat ? '0.8,0.8' : undefined}
                  opacity={e.threat ? 0.9 : 0.5}
                />
              );
            })}

            {nodes.map((node) => {
              const isServer = node.type === 'server';
              const color = isServer ? '#00FF00' : nodeColor(node.trustScore);
              const isBreached = node.type !== 'server' && node.trustScore < 40;
              const isConnectSource = connectSourceServerId === node.id;
              const isLinkedTarget = Boolean(connectSourceServerId && !isServer && node.serverId === connectSourceServerId);
              const isDisconnectTarget = Boolean(disconnectMode && !isServer && node.serverId);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  className="nm-node-group"
                  onPointerDown={(e) => handlePointerDown(e, node.id)}
                  onContextMenu={(e) => handleNodeContextMenu(e, node)}
                  onClick={(e) => void handleNodeClick(e, node)}
                >
                  <circle r={isServer ? 8 : 6} fill={color} opacity={0.1} style={{ filter: 'blur(3px)' }} />
                  <rect
                    x={isServer ? -5 : -3.5}
                    y={isServer ? -5 : -3.5}
                    width={isServer ? 10 : 7}
                    height={isServer ? 10 : 7}
                    rx={1.5}
                    fill="#0B0F19"
                    stroke={
                      isDisconnectTarget
                        ? '#FB923C'
                        : isConnectSource || isLinkedTarget
                          ? '#67E8F9'
                          : color
                    }
                    strokeWidth={
                      isDisconnectTarget || isConnectSource || isLinkedTarget ? 0.45 : isServer ? 0.4 : 0.2
                    }
                  />
                  {isServer ? (
                    <>
                      <rect x="-2" y="-2" width="4" height="1" fill={color} />
                      <rect x="-2" y="1" width="4" height="1" fill={color} />
                    </>
                  ) : (
                    <circle cx="0" cy="0" r="1" fill={color} />
                  )}
                  {isBreached && (
                    <g transform="translate(-8, -4)">
                      <rect x="-6" y="-2" width="12" height="3" rx="0.5" fill="#FF4444" opacity="0.8" />
                      <text x="0" y="0" textAnchor="middle" fill="#fff" fontSize="1.5" fontWeight="bold">
                        BREACH DETECTED
                      </text>
                    </g>
                  )}
                  <text y={isServer ? 8 : 6} textAnchor="middle" fill="#8B949E" fontSize="2.5" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="nm-canvas-controls">
            <button
              className="nm-tool-btn"
              onClick={() => {
                setDisconnectMode(false);
                setConnectSourceServerId((prev) => (prev ? null : servers[0]?.id ?? null));
              }}
              disabled={!connectSourceServerId && servers.length === 0}
            >
              {connectSourceServerId ? 'EXIT CONNECT' : 'CONNECT MODE'}
            </button>
            <button
              className={`nm-tool-btn ${disconnectMode ? 'is-disconnect-active' : ''}`}
              onClick={() => {
                setConnectSourceServerId(null);
                setDisconnectMode((d) => !d);
              }}
            >
              {disconnectMode ? 'EXIT DISCONNECT' : 'DISCONNECT MODE'}
            </button>
            <button className="nm-tool-btn" onClick={() => void toggleMapFullscreen()}>
              {isMapFullscreen ? 'EXIT FULL SCREEN' : 'FULL SCREEN'}
            </button>
            <button className="nm-tool-btn" onClick={resetLocalLayout}>RESET IOT LAYOUT</button>
            <button className="nm-tool-btn" onClick={loadMap}>REFRESH</button>
          </div>
        </div>

        <div className="nm-right-sidebar">
          <div className="nm-label" style={{ marginBottom: 16 }}>≡ FLEET SUMMARY</div>
          <div className="fleet-stat">
            <div className="f-row">
              <span className="f-name">Servers</span>
              <span className="f-val">{servers.length}</span>
            </div>
            <div className="f-bar-wrap"><div className="f-bar bg-green" style={{ width: `${Math.min(100, servers.length * 10)}%` }}></div></div>
            <div className="f-status">CORE NODES</div>
          </div>
          <div className="fleet-stat">
            <div className="f-row">
              <span className="f-name">IoT Nodes</span>
              <span className="f-val">{devices.length}</span>
            </div>
            <div className="f-bar-wrap"><div className="f-bar bg-orange" style={{ width: `${Math.min(100, devices.length * 5)}%` }}></div></div>
            <div className="f-status">EDGE NODES</div>
          </div>
          <div className="fleet-stat">
            <div className="f-row">
              <span className="f-name">Connected Links</span>
              <span className="f-val">{edges.length}</span>
            </div>
            <div className="f-bar-wrap"><div className="f-bar bg-green" style={{ width: `${Math.min(100, edges.length * 6)}%` }}></div></div>
            <div className="f-status">ACTIVE LINKS</div>
          </div>

          <div className="nm-label nm-section-title">CREATE SERVER</div>
          <input className="search-input" placeholder="Server Name" value={serverForm.name} onChange={(e) => setServerForm((s) => ({ ...s, name: e.target.value }))} />
          <input className="search-input" placeholder="Location" value={serverForm.location} onChange={(e) => setServerForm((s) => ({ ...s, location: e.target.value }))} />
          <div className="nm-input-row">
            <input className="search-input" type="number" min={0} max={100} placeholder="X" value={serverForm.x} onChange={(e) => setServerForm((s) => ({ ...s, x: Number(e.target.value) }))} />
            <input className="search-input" type="number" min={0} max={100} placeholder="Y" value={serverForm.y} onChange={(e) => setServerForm((s) => ({ ...s, y: Number(e.target.value) }))} />
          </div>
          <button className="btn-countermeasures nm-btn-light" onClick={() => void handleCreateServer()} disabled={busy}>
            + CREATE SERVER
          </button>

          <div className="nm-label nm-section-title">CREATE IOT NODE</div>
          <input className="search-input" placeholder="Device Name" value={deviceForm.name} onChange={(e) => setDeviceForm((s) => ({ ...s, name: e.target.value }))} />
          <input className="search-input" placeholder="Device Type (sensor/camera/gateway)" value={deviceForm.type} onChange={(e) => setDeviceForm((s) => ({ ...s, type: e.target.value || 'sensor' }))} />
          <select className="search-input" value={deviceForm.serverId} onChange={(e) => setDeviceForm((s) => ({ ...s, serverId: e.target.value }))}>
            <option value="">Unassigned</option>
            {servers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn-countermeasures nm-btn-light" onClick={() => void handleCreateDevice()} disabled={busy}>
            + CREATE IOT NODE
          </button>

          <div className="nm-label nm-section-title">CONNECT / MANAGE LINKS</div>
          <select className="search-input" value={selectedServerId} onChange={(e) => setSelectedServerId(e.target.value)}>
            <option value="">Select server</option>
            {servers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className="search-input" value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)}>
            <option value="">Select IoT device</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <div className="nm-action-row">
            <button className="btn-countermeasures nm-btn-light" onClick={() => void handleAssignDevice()} disabled={busy}>CONNECT</button>
            <button className="btn-countermeasures nm-btn-light" onClick={() => void handleDisconnectDevice()} disabled={busy}>DISCONNECT</button>
          </div>
          <button className="btn-countermeasures nm-btn-danger" onClick={() => void handleDeleteSelectedServer()} disabled={busy}>
            DELETE SERVER
          </button>
        </div>
      </div>

      {contextMenu && (
        <div className="nm-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button className="nm-context-item danger" onClick={() => void handleContextAction('delete')}>
            Delete {contextMenu.type === 'server' ? 'Server' : 'Device'}
          </button>
          {contextMenu.type === 'server' && (
            <>
              <button className="nm-context-item success" onClick={() => void handleContextAction('add-device')}>+ Add IoT Device</button>
              <button className="nm-context-item" onClick={() => void handleContextAction('connect-mode')}>Start Connect Mode</button>
            </>
          )}
          {contextMenu.type !== 'server' && nodes.find((n) => n.id === contextMenu.nodeId)?.serverId && (
            <button className="nm-context-item" style={{ color: '#FB923C' }} onClick={() => void handleContextDisconnectDevice()}>
              Disconnect from server
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
          margin-bottom: 8px;
        }
      `}</style>
    </>
  );
}
