# ─── Router: Dashboard ─────────────────────────────────────
# GET  /api/dashboard/overview
# GET  /api/dashboard/system-health
# GET  /api/dashboard/geo-distribution
# POST /api/dashboard/simulate-attack
# GET  /api/dashboard/cycle-status
# ──────────────────────────────────────────────────────────

import random
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_auth
from app.mock_data import DEVICES, INCIDENTS
from app.services.cycle_simulator import get_cycle_status, start_cycle
from app.utils.cache import (
    cache_delete,
    CacheKeys,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview")
def get_overview(_: dict = Depends(require_auth), db: Session = Depends(get_db)):
    """Live overview pulled from the real DB with mock-data fallback."""
    try:
        from app.models.device import Device
        from app.models.incident import Incident as IncidentModel

        devices = db.query(Device).all()
        total    = len(devices)
        active   = sum(1 for d in devices if d.status != "OFFLINE")
        critical = db.query(IncidentModel).filter(
            IncidentModel.severity == "critical",
            IncidentModel.resolved.is_(False),
        ).count()
        low_trust = sum(1 for d in devices if float(d.trust_score or 0) < 40)
        trusted   = sum(1 for d in devices if float(d.trust_score or 0) >= 70 and d.status != "OFFLINE")
        scores    = [float(d.trust_score or 0) for d in devices]
        avg_trust = round(sum(scores) / max(total, 1), 1)
        health    = round(active / max(total, 1) * 100, 1)
        warnings  = sum(1 for d in devices if d.status == "WARNING")
        breached  = sum(1 for d in devices if d.status == "BREACH")
        cycle_status = get_cycle_status()
        return {
            "criticalThreats":      critical,
            "criticalThreadsDelta": 0,
            "lowTrustNodes":        low_trust,
            "lowTrustDelta":        0,
            "activeDevices":        active,
            "activeDevicesPercent": round(active / max(total, 1) * 100, 1),
            "avgTrustScore":        avg_trust,
            "systemHealth":         health,
            "trustedDevices":       trusted,
            "warningDevices":       warnings,
            "breachedDevices":      breached,
            "alerts":               critical,
            "cyclesRun":            cycle_status.get("cyclesRun", 0),
        }
    except Exception:
        # Fallback to mock data if DB is unavailable
        total    = len(DEVICES)
        active   = sum(1 for d in DEVICES if d["status"] != "OFFLINE")
        critical = sum(1 for i in INCIDENTS if i["severity"] == "critical" and not i["resolved"])
        low_trust= sum(1 for d in DEVICES if d["trustScore"] < 40)
        trusted  = sum(1 for d in DEVICES if d["trustScore"] >= 70 and d["status"] != "OFFLINE")
        avg_trust= round(sum(d["trustScore"] for d in DEVICES) / max(total, 1), 1)
        health   = round(active / max(total, 1) * 100, 1)
        cycle_status = get_cycle_status()
        return {
            "criticalThreats":      critical,
            "criticalThreadsDelta": 2,
            "lowTrustNodes":        low_trust,
            "lowTrustDelta":        -3,
            "activeDevices":        active,
            "activeDevicesPercent": round(active / max(total, 1) * 100, 1),
            "avgTrustScore":        avg_trust,
            "systemHealth":         health,
            "trustedDevices":       trusted,
            "warningDevices":       0,
            "breachedDevices":      0,
            "alerts":               len([i for i in INCIDENTS if not i["resolved"]]),
            "cyclesRun":            cycle_status.get("cyclesRun", 0),
        }


@router.get("/system-health")
def get_system_health(_: dict = Depends(require_auth)):
    from collections import Counter
    counts = Counter(d["status"] for d in DEVICES)
    return {
        "statusBreakdown": [{"status": k, "count": v} for k, v in counts.items()],
        "timestamp": "now",
    }


@router.get("/geo-distribution")
def get_geo_distribution(_: dict = Depends(require_auth)):
    from collections import defaultdict
    loc_data: dict = defaultdict(lambda: {"count": 0, "scoreSum": 0.0})
    for d in DEVICES:
        loc = d["location"] or "Unknown"
        loc_data[loc]["count"] += 1
        loc_data[loc]["scoreSum"] += d["trustScore"]
    return {
        "locations": [
            {
                "location":      loc,
                "count":         v["count"],
                "avgTrustScore": round(v["scoreSum"] / v["count"], 1),
            }
            for loc, v in loc_data.items()
        ]
    }


class SimulateAttackRequest(BaseModel):
    deviceId:   Optional[str] = None
    attackType: Optional[str] = "Botnet Recruitment"


@router.post("/simulate-attack")
def simulate_attack(
    payload: SimulateAttackRequest,
    _: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    Simulate a cyber-attack on a real DB device:
    1. Drop its trust_score to a critical value (8–22).
    2. Set status → BREACH.
    3. Write a TrustEvent + Incident row to the database.
    4. Invalidate all relevant caches.
    5. Also run the in-memory cycle for live log streaming.
    """
    from app.models.device import Device
    from app.models.incident import Incident as IncidentModel
    from app.models.trust_event import TrustEvent

    # ── 1. Pick target device from DB ─────────────────────
    try:
        if payload.deviceId:
            device = db.query(Device).filter(Device.id == UUID(payload.deviceId)).first()
        else:
            # Prefer a STABLE device; fallback to any
            device = (
                db.query(Device).filter(Device.status == "STABLE").first()
                or db.query(Device).first()
            )
    except Exception:
        device = db.query(Device).first()

    if not device:
        raise HTTPException(status_code=404, detail="No devices found to attack")

    # ── 2. Generate attack score ───────────────────────────
    old_score   = round(float(device.trust_score or 100.0), 1)
    attack_score = round(random.uniform(8.0, 22.0), 1)
    now         = datetime.now(timezone.utc)

    # ── 3. Update device in DB ────────────────────────────
    device.trust_score = attack_score
    device.status      = "BREACH"
    device.last_seen   = now

    # ── 4. Create TrustEvent ──────────────────────────────
    trust_event = TrustEvent(
        device_id    = device.id,
        trust_score  = attack_score,
        anomaly_score= -0.9,
        is_anomaly   = True,
        features     = {"simulated": True, "attackType": payload.attackType or "Botnet Recruitment"},
        shap_values  = {},
        recorded_at  = now,
    )
    db.add(trust_event)

    # ── 5. Create Incident ────────────────────────────────
    incident = IncidentModel(
        title       = f"LIVE ATTACK — {device.name} ({payload.attackType or 'Botnet Recruitment'})",
        description = (
            f"Simulated {payload.attackType or 'Botnet Recruitment'} attack on {device.name}. "
            f"Trust score dropped from {old_score} → {attack_score}. "
            f"Device is now in BREACH status."
        ),
        severity    = "critical",
        type        = "anomaly",
        device_id   = device.id,
    )
    db.add(incident)
    db.commit()

    # ── 6. Bust all relevant caches ───────────────────────
    cache_delete(CacheKeys.DASHBOARD_OVERVIEW)
    cache_delete(CacheKeys.TRUST_OVERVIEW)
    cache_delete(CacheKeys.TRUST_BREAKDOWN)
    cache_delete(CacheKeys.NETWORK_MAP)
    cache_delete(CacheKeys.NETWORK_NODES)
    cache_delete(CacheKeys.NETWORK_CONNECTIONS)
    cache_delete(CacheKeys.DEVICES_LIST)
    cache_delete(CacheKeys.INCIDENTS_OVERVIEW)
    cache_delete(CacheKeys.device_detail(str(device.id)))

    # ── 7. Also fire in-memory cycle for live logs in UI ─
    try:
        start_cycle(payload.deviceId, payload.attackType or "Botnet Recruitment")
    except Exception:
        pass

    return {
        "message":     "Attack simulated successfully",
        "target_id":   str(device.id),
        "target_name": device.name,
        "old_score":   old_score,
        "new_score":   attack_score,
        "status":      "BREACH",
    }


@router.get("/cycle-status")
def cycle_status(_: dict = Depends(require_auth)):
    return get_cycle_status()

