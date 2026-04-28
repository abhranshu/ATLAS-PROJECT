"""
mock_data.py — In-memory mock data store.
Replaces PostgreSQL for local development without a running database.
"""
from datetime import datetime, timezone, timedelta
import uuid, math, random

random.seed(42)

# ── Devices ──────────────────────────────────────────────────────────────────
_TYPES     = ["gateway", "camera", "sensor", "thermostat", "controller", "hub"]
_LOCATIONS = ["Floor 1", "Floor 2", "Server Room", "Lobby", "Warehouse", "External"]
_STATUSES  = ["STABLE", "WARNING", "BREACH", "OFFLINE"]

def _make_device(idx: int) -> dict:
    did   = str(uuid.UUID(int=idx + 1))
    dtype = _TYPES[idx % len(_TYPES)]
    score = round(random.uniform(30, 98), 1)
    if score < 40:
        status = "BREACH"
    elif score < 60:
        status = "WARNING"
    else:
        status = "STABLE" if idx % 7 != 0 else "OFFLINE"
    return {
        "id":              did,
        "name":            f"{dtype.capitalize()}-{idx+1:03d}",
        "type":            dtype,
        "location":        _LOCATIONS[idx % len(_LOCATIONS)],
        "ipAddress":       f"192.168.{(idx // 50) + 1}.{(idx % 50) + 10}",
        "firmwareVersion": f"v{(idx % 5) + 1}.{idx % 10}.0" if idx % 6 != 0 else None,
        "status":          status,
        "trustScore":      score,
        "isIsolated":      idx % 15 == 0,
        "lastSeen":        (datetime.now(timezone.utc) - timedelta(minutes=idx * 2)).isoformat(),
    }

DEVICES: list[dict] = [_make_device(i) for i in range(24)]

# ── Incidents ─────────────────────────────────────────────────────────────────
_SEVERITIES = ["critical", "warning", "breach", "stable"]

def _make_incident(idx: int) -> dict:
    sev = _SEVERITIES[idx % len(_SEVERITIES)]
    dev = DEVICES[idx % len(DEVICES)]
    return {
        "id":          str(uuid.UUID(int=1000 + idx)),
        "title":       [
            "Anomaly detected — abnormal traffic spike",
            "Auth failure threshold exceeded",
            "Firmware version mismatch",
            "Geo anomaly — unexpected IP origin",
            "Device trust score dropped below 30",
            "Repeated connection resets",
        ][idx % 6],
        "description": f"Automated detection on device {dev['name']} at {dev['location']}.",
        "severity":    sev,
        "type":        ["anomaly", "auth", "firmware", "geo"][idx % 4],
        "deviceId":    dev["id"],
        "resolved":    idx % 3 == 0,
        "timestamp":   (datetime.now(timezone.utc) - timedelta(hours=idx * 3)).isoformat(),
    }

INCIDENTS: list[dict] = [_make_incident(i) for i in range(18)]

# ── Trust events (one per device) ────────────────────────────────────────────
def _make_trust_event(device: dict) -> dict:
    r = random.Random(device["id"])
    shap = {
        "MI_dir_L5_weight": round(r.uniform(-0.4, 0.4), 4),
        "MI_dir_L5_mean":   round(r.uniform(-0.3, 0.3), 4),
        "H_L5_weight":      round(r.uniform(-0.35, 0.35), 4),
        "H_L5_mean":        round(r.uniform(-0.2, 0.2), 4),
        "ip_diversity":     round(r.uniform(-0.25, 0.25), 4),
    }
    anomaly = round(r.uniform(-0.5, 0.3), 4)
    return {
        "deviceId":    device["id"],
        "trustScore":  device["trustScore"],
        "anomalyScore": anomaly,
        "isAnomaly":   anomaly < -0.1,
        "explanations": [
            {"feature": k, "shap_value": v,
             "impact": "high" if abs(v) >= 0.3 else "medium" if abs(v) >= 0.15 else "positive" if v > 0 else "low"}
            for k, v in sorted(shap.items(), key=lambda x: abs(x[1]), reverse=True)
        ],
        "features": {k: round(abs(v) * 100, 2) for k, v in shap.items()},
        "recordedAt": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
    }

TRUST_EVENTS: dict[str, dict] = {d["id"]: _make_trust_event(d) for d in DEVICES}

# ── Mock user ─────────────────────────────────────────────────────────────────
MOCK_USERS = {
    "admin": {"id": "u-001", "username": "admin", "password": "admin123", "role": "admin", "avatar_url": None},
    "analyst": {"id": "u-002", "username": "analyst", "password": "analyst123", "role": "analyst", "avatar_url": None},
}
