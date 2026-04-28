# ─── Router: Telemetry ────────────────────────────────────
# POST /api/telemetry/ingest
#
# This is the entry point from IoT devices / simulators.
# Pipeline: receive → Isolation Forest → trust score →
#           SHAP explanation → save → auto-create incident
# ──────────────────────────────────────────────────────────

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.device import Device
from app.models.incident import Incident
from app.models.trust_event import TrustEvent
from app.utils.cache import cache_delete, CacheKeys

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


# ─── Request Schema ───────────────────────────────────────
class TelemetryPayload(BaseModel):
    device_id:    str
    
    # Core 12 features for the custom ML Model
    MI_dir_L5_weight: float = 0.0
    MI_dir_L5_mean: float = 0.0
    MI_dir_L5_variance: float = 0.0
    MI_dir_L3_weight: float = 0.0
    MI_dir_L3_mean: float = 0.0
    MI_dir_L3_variance: float = 0.0
    MI_dir_L1_weight: float = 0.0
    MI_dir_L1_mean: float = 0.0
    MI_dir_L1_variance: float = 0.0
    H_L5_weight: float = 0.0
    H_L5_mean: float = 0.0
    H_L5_variance: float = 0.0
    
    # Old features (optional fallback if simulator sends them)
    packet_count: int = 0
    protocol:     str = "unknown"
    entropy:      float = 0.0
    ip_diversity: int = 0
    
    timestamp:    str | None = None


# ─── Route ────────────────────────────────────────────────
@router.post("/ingest", status_code=201)
def ingest_telemetry(
    payload: TelemetryPayload,
    db: Session = Depends(get_db),
):
    """
    Ingest a telemetry window from a device.
    """
    # ── 1. Validate device ────────────────────────────────
    device = db.query(Device).filter(Device.id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {payload.device_id} not found")

    # ── 2 & 3. ML inference (lazy import so server starts without model) ─
    try:
        from app.services.anomaly_detector import detect
        from app.services.trust_engine import compute_trust_score
        from app.services.shap_explainer import explain

        # Map to 12 features expected by the custom scikit model
        features = {
            "MI_dir_L5_weight": payload.MI_dir_L5_weight or payload.packet_count,
            "MI_dir_L5_mean": payload.MI_dir_L5_mean,
            "MI_dir_L5_variance": payload.MI_dir_L5_variance,
            "MI_dir_L3_weight": payload.MI_dir_L3_weight,
            "MI_dir_L3_mean": payload.MI_dir_L3_mean,
            "MI_dir_L3_variance": payload.MI_dir_L3_variance,
            "MI_dir_L1_weight": payload.MI_dir_L1_weight,
            "MI_dir_L1_mean": payload.MI_dir_L1_mean,
            "MI_dir_L1_variance": payload.MI_dir_L1_variance,
            "H_L5_weight": payload.H_L5_weight or payload.entropy,
            "H_L5_mean": payload.H_L5_mean,
            "H_L5_variance": payload.H_L5_variance or payload.ip_diversity,
        }
        
        anomaly_score = detect(features)
        trust_score   = compute_trust_score(anomaly_score)
        shap_values   = explain(features)
        is_anomaly    = anomaly_score < -0.1   # Threshold: tune after training

    except FileNotFoundError:
        # Model not trained yet — use a passthrough rule
        trust_score   = 75.0
        anomaly_score = 0.0
        shap_values   = {}
        is_anomaly    = False

    # ── 4. Persist TrustEvent ─────────────────────────────
    event = TrustEvent(
        device_id=device.id,
        trust_score=trust_score,
        anomaly_score=anomaly_score,
        is_anomaly=is_anomaly,
        features=features if 'features' in dir() else None,
        shap_values=shap_values,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(event)

    # ── 5. Update device status ───────────────────────────
    device.trust_score = trust_score
    device.last_seen   = datetime.now(timezone.utc)
    if trust_score < 30:
        device.status = "BREACH"
    elif trust_score < 60:
        device.status = "WARNING"
    else:
        device.status = "STABLE"

    # ── 6. Auto-create Incident if anomaly ───────────────
    if is_anomaly:
        severity = "critical" if trust_score < 30 else "warning"
        incident = Incident(
            title=f"Anomaly detected — {device.name}",
            description=(
                f"Trust score dropped to {trust_score:.1f}. "
                f"Anomaly score: {anomaly_score:.4f}. "
                f"Features: packet_count={payload.packet_count}, "
                f"entropy={payload.entropy:.3f}, ip_diversity={payload.ip_diversity}."
            ),
            severity=severity,
            type="anomaly",
            device_id=device.id,
        )
        db.add(incident)

    db.commit()

    # ── 7. Bust cache ─────────────────────────────────────
    cache_delete(CacheKeys.DASHBOARD_OVERVIEW)
    cache_delete(CacheKeys.TRUST_OVERVIEW)
    cache_delete(CacheKeys.TRUST_BREAKDOWN)
    cache_delete(CacheKeys.device_detail(str(device.id)))
    cache_delete(CacheKeys.DEVICES_LIST)
    if is_anomaly:
        cache_delete(CacheKeys.INCIDENTS_OVERVIEW)

    return {
        "deviceId":    str(device.id),
        "trustScore":  trust_score,
        "isAnomaly":   is_anomaly,
        "status":      device.status,
        "processedAt": datetime.now(timezone.utc).isoformat(),
    }


# ─── Private Helpers ──────────────────────────────────────
def _protocol_to_int(protocol: str) -> int:
    """Encode protocol string to ordinal for the ML feature vector."""
    mapping = {"mqtt": 0, "coap": 1, "https": 2, "http": 3, "unknown": 4}
    return mapping.get(protocol.lower(), 4)
