from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.device import Device
from app.models.server import Server

router = APIRouter(prefix="/network", tags=["Network"])

def _device_to_node(device: Device, idx: int) -> dict:
    return {
        "id": str(device.id),
        "label": device.name,
        "type": device.type,
        "trustScore": float(device.trust_score or 0.0),
        "status": device.status,
        "x": float(20 + (idx % 8) * 10),
        "y": float(20 + (idx // 8) * 14),
        "serverId": str(device.server_id) if device.server_id else None,
    }


@router.get("/nodes")
def get_nodes(_: dict = Depends(require_auth), db: Session = Depends(get_db)):
    devices = db.query(Device).order_by(Device.created_at.asc()).all()
    servers = db.query(Server).order_by(Server.created_at.asc()).all()
    server_nodes = [
        {
            "id": str(s.id),
            "label": s.name,
            "type": "server",
            "trustScore": 100.0,
            "status": "STABLE",
            "x": float(s.x),
            "y": float(s.y),
        }
        for s in servers
    ]
    return server_nodes + [_device_to_node(d, i) for i, d in enumerate(devices)]


@router.get("/connections")
def get_connections(_: dict = Depends(require_auth), db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    return [
        {
            "from": str(device.server_id),
            "to": str(device.id),
            "threat": float(device.trust_score or 0.0) < 40,
        }
        for device in devices
        if device.server_id
    ]


@router.get("/map")
def get_network_map(_: dict = Depends(require_auth), db: Session = Depends(get_db)):
    devices = db.query(Device).order_by(Device.created_at.asc()).all()
    servers = db.query(Server).order_by(Server.created_at.asc()).all()

    nodes = [
        {
            "id": str(s.id),
            "label": s.name,
            "type": "server",
            "trustScore": 100.0,
            "status": "STABLE",
            "x": float(s.x),
            "y": float(s.y),
        }
        for s in servers
    ]
    nodes.extend([_device_to_node(d, i) for i, d in enumerate(devices)])

    edges = [
        {"from": str(d.server_id), "to": str(d.id), "threat": float(d.trust_score or 0.0) < 40}
        for d in devices
        if d.server_id
    ]
    return {"nodes": nodes, "edges": edges}
