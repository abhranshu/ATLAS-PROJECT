# ─── Router: Trust (mock) ─────────────────────────────────
# GET /api/trust/overview
# GET /api/trust/timeline
# GET /api/trust/breakdown
# ──────────────────────────────────────────────────────────

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.middleware.auth import require_auth
from app.mock_data import DEVICES

router = APIRouter(prefix="/trust", tags=["Trust"])


@router.get("/overview")
def get_trust_overview(_: dict = Depends(require_auth)):
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
):
    """Generate a synthetic 24-hour trust score timeline."""
    import random, math
    base_score = sum(d["trustScore"] for d in DEVICES) / max(len(DEVICES), 1)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    timeline = []
    for h in range(24, 0, -1):
        ts = now - timedelta(hours=h)
        # Simulate slight variation
        score = round(base_score + math.sin(h * 0.5) * 4 + random.uniform(-2, 2), 1)
        score = max(0.0, min(100.0, score))
        timeline.append({
            "timestamp":  ts.isoformat(),
            "avgTrust":   score,
            "eventCount": random.randint(5, 25),
        })
    return {"timeline": timeline}


@router.get("/breakdown")
def get_trust_breakdown(_: dict = Depends(require_auth)):
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
