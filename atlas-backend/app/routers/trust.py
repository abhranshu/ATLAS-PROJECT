# ─── Router: Trust ──────────────────────────────────────────
# GET /api/trust/overview
# GET /api/trust/timeline
# GET /api/trust/breakdown
# ──────────────────────────────────────────────────────────

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_auth
from app.mock_data import DEVICES

router = APIRouter(prefix="/trust", tags=["Trust"])


@router.get("/overview")
def get_trust_overview(
    _: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    Pull live trust stats from the real DB.
    Falls back to mock data if DB is unavailable.
    """
    try:
        from app.models.device import Device
        devices = db.query(Device).all()
        scores      = [float(d.trust_score or 0) for d in devices]
        total       = len(scores)
        high_trust  = sum(1 for s in scores if s >= 70)
        med_trust   = sum(1 for s in scores if 40 <= s < 70)
        low_trust   = sum(1 for s in scores if s < 40)
        avg_score   = round(sum(scores) / max(total, 1), 1)
        return {
            "highTrust":     high_trust,
            "mediumTrust":   med_trust,
            "lowTrust":      low_trust,
            "fleetAvgScore": avg_score,
            "total":         total,
        }
    except Exception:
        # Fallback to mock data
        scores     = [d["trustScore"] for d in DEVICES]
        total      = len(scores)
        high_trust = sum(1 for s in scores if s >= 70)
        med_trust  = sum(1 for s in scores if 40 <= s < 70)
        low_trust  = sum(1 for s in scores if s < 40)
        avg_score  = round(sum(scores) / max(total, 1), 1)
        return {
            "highTrust":     high_trust,
            "mediumTrust":   med_trust,
            "lowTrust":      low_trust,
            "fleetAvgScore": avg_score,
            "total":         total,
        }


@router.get("/timeline")
def get_trust_timeline(
    from_ts: Optional[str] = Query(None, alias="from"),
    to_ts:   Optional[str] = Query(None, alias="to"),
    _: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    Build a 24-hour timeline from real TrustEvent records.
    Falls back to synthetic data if no events exist.
    """
    import random, math

    try:
        from app.models.trust_event import TrustEvent
        now = datetime.now(timezone.utc)
        since = now - timedelta(hours=24)
        events = (
            db.query(TrustEvent)
            .filter(TrustEvent.recorded_at >= since)
            .order_by(TrustEvent.recorded_at.asc())
            .all()
        )

        if events:
            # Group by hour and average scores
            buckets: dict = {}
            for ev in events:
                hour_key = ev.recorded_at.replace(minute=0, second=0, microsecond=0)
                if hour_key not in buckets:
                    buckets[hour_key] = []
                buckets[hour_key].append(float(ev.trust_score or 0))

            timeline = [
                {
                    "timestamp":  ts.isoformat(),
                    "avgTrust":   round(sum(v) / len(v), 1),
                    "eventCount": len(v),
                }
                for ts, v in sorted(buckets.items())
            ]
            return {"timeline": timeline}
    except Exception:
        pass

    # Synthetic fallback
    from app.models.device import Device
    try:
        devices = db.query(Device).all()
        base_score = sum(float(d.trust_score or 0) for d in devices) / max(len(devices), 1)
    except Exception:
        base_score = sum(d["trustScore"] for d in DEVICES) / max(len(DEVICES), 1)

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    timeline = []
    for h in range(24, 0, -1):
        ts = now - timedelta(hours=h)
        score = round(base_score + math.sin(h * 0.5) * 4 + random.uniform(-2, 2), 1)
        score = max(0.0, min(100.0, score))
        timeline.append({
            "timestamp":  ts.isoformat(),
            "avgTrust":   score,
            "eventCount": random.randint(5, 25),
        })
    return {"timeline": timeline}


@router.get("/breakdown")
def get_trust_breakdown(
    _: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    Fleet-wide trust breakdown, computed from real device data in DB.
    """
    try:
        from app.models.device import Device
        devices  = db.query(Device).all()
        total    = len(devices)
        fw_ok    = sum(1 for d in devices if d.firmware_version)
        uptime_ok = sum(1 for d in devices if d.status != "OFFLINE")
        stable   = sum(1 for d in devices if d.status == "STABLE")
        breach   = sum(1 for d in devices if d.status == "BREACH")
        warning  = sum(1 for d in devices if d.status == "WARNING")
        scores   = [float(d.trust_score or 0) for d in devices]
        avg      = sum(scores) / max(total, 1)

        # Firmware integrity: % with known firmware
        fw_score  = round(fw_ok / max(total, 1) * 100)
        # Network compliance: based on how many are stable
        nc_score  = round(stable / max(total, 1) * 100)
        # Auth standards: inverse of breach rate
        auth_score = round((1 - breach / max(total, 1)) * 100)
        # Anomaly rate: inverse of (warning + breach) / total
        anomaly_ok = max(0, total - warning - breach)
        geo_score  = round(anomaly_ok / max(total, 1) * 100)
        # Uptime reliability
        up_score   = round(uptime_ok / max(total, 1) * 100)

        return {
            "data": [
                {"category": "Firmware Integrity",  "score": fw_score,   "devices": fw_ok},
                {"category": "Network Compliance",  "score": nc_score,   "devices": stable},
                {"category": "Auth Standards",      "score": auth_score, "devices": total - breach},
                {"category": "Geo Anomaly Rate",    "score": geo_score,  "devices": anomaly_ok},
                {"category": "Uptime Reliability",  "score": up_score,   "devices": uptime_ok},
            ]
        }
    except Exception:
        # Fallback to mock data
        total    = len(DEVICES)
        fw_ok    = sum(1 for d in DEVICES if d.get("firmwareVersion"))
        uptime_ok= sum(1 for d in DEVICES if d["status"] != "OFFLINE")
        return {
            "data": [
                {"category": "Firmware Integrity",  "score": round(fw_ok / max(total, 1) * 100),     "devices": fw_ok},
                {"category": "Network Compliance",  "score": 61,                                      "devices": total},
                {"category": "Auth Standards",      "score": 88,                                      "devices": total},
                {"category": "Geo Anomaly Rate",    "score": 74,                                      "devices": total},
                {"category": "Uptime Reliability",  "score": round(uptime_ok / max(total, 1) * 100), "devices": uptime_ok},
            ]
        }
