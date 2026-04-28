from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.mock_data import DEVICES
from app.models.device import Device
from app.models.server import Server


def seed_initial_data(db: Session) -> None:
    if db.query(Device).count() > 0:
        return

    default_server = Server(name="Primary SOC Server", location="HQ Data Center", x=50.0, y=50.0)
    db.add(default_server)
    db.flush()

    for entry in DEVICES:
        device = Device(
            id=UUID(entry["id"]),
            name=entry["name"],
            type=entry["type"],
            location=entry.get("location"),
            ip_address=entry.get("ipAddress"),
            firmware_version=entry.get("firmwareVersion"),
            status=entry.get("status", "STABLE"),
            trust_score=float(entry.get("trustScore", 90.0)),
            is_isolated=bool(entry.get("isIsolated", False)),
            last_seen=datetime.fromisoformat(entry["lastSeen"]) if entry.get("lastSeen") else None,
            server_id=default_server.id,
        )
        db.add(device)

    db.commit()
