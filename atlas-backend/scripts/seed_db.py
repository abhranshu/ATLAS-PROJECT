"""
scripts/seed_db.py
──────────────────
Seeds the Atlas database with:
- 1 admin user  (username: admin  / password: atlas123)
- 1 analyst user (username: analyst / password: atlas123)
- 10 sample devices (mix of types and trust scores)
- 5 sample incidents

Run from the atlas-backend/ directory:
    python scripts/seed_db.py
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from app.database import SessionLocal, engine, Base
import app.models  # noqa: F401 — ensures all tables are registered

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed():
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        from app.models.user     import User
        from app.models.device   import Device
        from app.models.incident import Incident

        # ── Users ─────────────────────────────────────────
        if not db.query(User).first():
            print("  → Seeding users...")
            db.add_all([
                User(
                    username="admin",
                    hashed_password=pwd_context.hash("atlas123"),
                    role="admin",
                    avatar_url=None,
                ),
                User(
                    username="analyst",
                    hashed_password=pwd_context.hash("atlas123"),
                    role="analyst",
                    avatar_url=None,
                ),
            ])
            db.commit()
            print("     ✅ Users created")

        # ── Devices ───────────────────────────────────────
        if not db.query(Device).first():
            print("  → Seeding devices...")
            now = datetime.now(timezone.utc)
            device_seeds = [
                ("Gateway-01",      "gateway", "Server Room A", "192.168.1.1",  "v3.2.1", "STABLE",  92.4),
                ("TempSensor-02",   "sensor",  "Floor 1 - Lab", "192.168.1.10", "v1.1.0", "STABLE",  85.1),
                ("CamNode-03",      "camera",  "Entrance",      "192.168.1.20", "v2.0.3", "WARNING", 58.7),
                ("Gateway-04",      "gateway", "Server Room B", "192.168.2.1",  "v3.2.1", "STABLE",  91.0),
                ("Actuator-05",     "actuator","Floor 2 - HVAC","192.168.2.15", "v1.0.5", "BREACH",  22.3),
                ("TempSensor-06",   "sensor",  "Floor 2 - Lab", "192.168.2.16", "v1.1.0", "STABLE",  88.9),
                ("SmartLock-07",    "lock",    "Main Entrance", "192.168.3.5",  "v2.3.0", "WARNING", 49.2),
                ("CamNode-08",      "camera",  "Parking Lot",   "192.168.3.10", "v2.0.3", "OFFLINE", 0.0),
                ("EnergyMeter-09",  "meter",   "Basement",      "192.168.3.20", "v1.2.1", "STABLE",  77.4),
                ("Actuator-10",     "actuator","Floor 1 - HVAC","192.168.1.30", None,     "WARNING", 55.0),
            ]
            devices = []
            for name, dtype, location, ip, fw, status, trust in device_seeds:
                d = Device(
                    name=name, type=dtype, location=location,
                    ip_address=ip, firmware_version=fw,
                    status=status, trust_score=trust,
                    is_isolated=(status == "OFFLINE"),
                    last_seen=now - timedelta(minutes=2),
                )
                devices.append(d)
            db.add_all(devices)
            db.commit()
            db.refresh(devices[0])
            print("     ✅ Devices created")

            # ── Incidents ─────────────────────────────────
            print("  → Seeding incidents...")
            actuator = db.query(Device).filter(Device.name == "Actuator-05").first()
            cam      = db.query(Device).filter(Device.name == "CamNode-08").first()
            lock     = db.query(Device).filter(Device.name == "SmartLock-07").first()

            db.add_all([
                Incident(
                    title="Critical trust drop — Actuator-05",
                    description="Trust score dropped to 22.3 after anomalous packet burst detected.",
                    severity="critical", type="anomaly",
                    device_id=actuator.id if actuator else None,
                    resolved=False,
                ),
                Incident(
                    title="Camera offline — CamNode-08",
                    description="Device has not reported telemetry for >30 minutes.",
                    severity="warning", type="connectivity",
                    device_id=cam.id if cam else None,
                    resolved=False,
                ),
                Incident(
                    title="Suspicious auth attempts — SmartLock-07",
                    description="15 failed authentication attempts detected in 2-minute window.",
                    severity="warning", type="auth_failure",
                    device_id=lock.id if lock else None,
                    resolved=False,
                ),
                Incident(
                    title="Firmware mismatch resolved — TempSensor-02",
                    description="Device firmware updated to v1.1.0. Trust score recovered.",
                    severity="stable", type="firmware",
                    device_id=None,
                    resolved=True,
                ),
                Incident(
                    title="Port scan detected from 192.168.5.99",
                    description="External IP scanned 432 ports in 90 seconds. Blocked by firewall.",
                    severity="critical", type="port_scan",
                    device_id=None,
                    resolved=True,
                ),
            ])
            db.commit()
            print("     ✅ Incidents created")

        print("\n🎉 Seed complete! Login: admin / atlas123")

    finally:
        db.close()


if __name__ == "__main__":
    print("🌱 Seeding Atlas database...")
    seed()
