# ─── Router: Dashboard (mock) ─────────────────────────────
# GET /api/dashboard/overview
# GET /api/dashboard/system-health
# GET /api/dashboard/geo-distribution
# ──────────────────────────────────────────────────────────

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import require_auth
from app.mock_data import DEVICES, INCIDENTS
from app.services.cycle_simulator import get_cycle_status, start_cycle

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview")
def get_overview(_: dict = Depends(require_auth)):
    total    = len(DEVICES)
    active   = sum(1 for d in DEVICES if d["status"] != "OFFLINE")
    critical = sum(1 for i in INCIDENTS if i["severity"] == "critical" and not i["resolved"])
    low_trust= sum(1 for d in DEVICES if d["trustScore"] < 40)
    trusted  = sum(1 for d in DEVICES if d["trustScore"] >= 80 and d["status"] != "OFFLINE")
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
    deviceId: Optional[str] = None
    attackType: Optional[str] = "Botnet Recruitment"


@router.post("/simulate-attack")
def simulate_attack(payload: SimulateAttackRequest, _: dict = Depends(require_auth)):
    try:
        status = start_cycle(payload.deviceId, payload.attackType)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "Run cycle started", "status": status}


@router.get("/cycle-status")
def cycle_status(_: dict = Depends(require_auth)):
    return get_cycle_status()

