from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.device import Device
from app.models.trust_event import TrustEvent
from app.utils.cache import cache_delete, CacheKeys

router = APIRouter(prefix="/devices", tags=["Devices"])


class DeviceCreatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    type: str = Field(min_length=2, max_length=64)
    location: str | None = Field(default=None, max_length=256)
    ipAddress: str | None = Field(default=None, max_length=45)
    firmwareVersion: str | None = Field(default=None, max_length=64)
    serverId: str | None = None
    trustScore: float = Field(default=90.0, ge=0.0, le=100.0)
    status: str = Field(default="STABLE", max_length=32)


class DeviceUpdatePayload(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    type: str | None = Field(default=None, min_length=2, max_length=64)
    location: str | None = Field(default=None, max_length=256)
    ipAddress: str | None = Field(default=None, max_length=45)
    firmwareVersion: str | None = Field(default=None, max_length=64)
    serverId: str | None = None
    trustScore: float | None = Field(default=None, ge=0.0, le=100.0)
    status: str | None = Field(default=None, max_length=32)


def _serialize(device: Device) -> dict:
    return {
        "id": str(device.id),
        "name": device.name,
        "type": device.type,
        "location": device.location,
        "ipAddress": device.ip_address,
        "firmwareVersion": device.firmware_version,
        "status": device.status,
        "trustScore": round(float(device.trust_score or 0.0), 1),
        "isIsolated": bool(device.is_isolated),
        "lastSeen": device.last_seen.isoformat() if device.last_seen else None,
        "serverId": str(device.server_id) if device.server_id else None,
    }


def _get_or_404(db: Session, device_id: UUID) -> Device:
    row = db.query(Device).filter(Device.id == device_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Device not found")
    return row


@router.get("")
def list_devices(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    status: str | None = Query(None),
    search: str | None = Query(None),
    _: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    query = db.query(Device)
    if status:
        query = query.filter(Device.status == status.upper())
    if search:
        pattern = f"%{search.lower()}%"
        query = query.filter(
            or_(
                Device.name.ilike(pattern),
                Device.location.ilike(pattern),
                Device.type.ilike(pattern),
                Device.ip_address.ilike(pattern),
            )
        )

    total = query.count()
    start = (page - 1) * limit
    rows = query.order_by(Device.created_at.desc()).offset(start).limit(limit).all()
    return {"data": [_serialize(row) for row in rows], "total": total, "page": page, "limit": limit, "pages": max(1, -(-total // limit))}


@router.post("", status_code=201)
def create_device(payload: DeviceCreatePayload, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    row = Device(
        name=payload.name,
        type=payload.type,
        location=payload.location,
        ip_address=payload.ipAddress,
        firmware_version=payload.firmwareVersion,
        server_id=UUID(payload.serverId) if payload.serverId else None,
        trust_score=payload.trustScore,
        status=payload.status.upper(),
        last_seen=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.patch("/{device_id}")
def update_device(device_id: UUID, payload: DeviceUpdatePayload, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    row = _get_or_404(db, device_id)

    if payload.name is not None:
        row.name = payload.name
    if payload.type is not None:
        row.type = payload.type
    if payload.location is not None:
        row.location = payload.location
    if payload.ipAddress is not None:
        row.ip_address = payload.ipAddress
    if payload.firmwareVersion is not None:
        row.firmware_version = payload.firmwareVersion
    if payload.serverId is not None:
        row.server_id = UUID(payload.serverId) if payload.serverId else None
    if payload.trustScore is not None:
        row.trust_score = payload.trustScore
    if payload.status is not None:
        row.status = payload.status.upper()
    row.last_seen = datetime.now(timezone.utc)

    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.delete("/{device_id}")
def delete_device(device_id: UUID, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    row = _get_or_404(db, device_id)
    db.delete(row)
    db.commit()
    return {"message": "Device removed"}


@router.get("/{device_id}/trust-analysis")
def get_trust_analysis(device_id: UUID, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    _get_or_404(db, device_id)
    event = db.query(TrustEvent).filter(TrustEvent.device_id == device_id).order_by(TrustEvent.recorded_at.desc()).first()
    if not event:
        raise HTTPException(status_code=404, detail="No trust analysis data for this device yet")
    shap_values = event.shap_values or {}
    return {
        "deviceId": str(event.device_id),
        "trustScore": event.trust_score,
        "anomalyScore": event.anomaly_score,
        "isAnomaly": event.is_anomaly,
        "features": event.features or {},
        "explanations": [
            {"feature": k, "shap_value": v, "impact": "high" if abs(v) >= 0.3 else "medium" if abs(v) >= 0.15 else "low"}
            for k, v in sorted(shap_values.items(), key=lambda item: abs(item[1]), reverse=True)
        ],
        "recordedAt": event.recorded_at.isoformat() if event.recorded_at else None,
    }


@router.post("/{device_id}/isolate")
def isolate_device(device_id: UUID, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    row = _get_or_404(db, device_id)
    if row.is_isolated:
        return {"message": "Device is already isolated", "deviceId": str(device_id)}
    row.is_isolated = True
    row.status = "OFFLINE"
    db.commit()
    
    # Bust relevant caches
    cache_delete(CacheKeys.DEVICES_LIST)
    cache_delete(CacheKeys.DASHBOARD_OVERVIEW)
    cache_delete(CacheKeys.TRUST_OVERVIEW)
    cache_delete(CacheKeys.NETWORK_NODES)
    cache_delete(CacheKeys.device_detail(str(device_id)))
    
    return {"message": "Device isolated successfully", "deviceId": str(device_id)}


@router.post("/{device_id}/reset-trust")
def reset_trust_score(device_id: UUID, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    """Reset a device's trust score to 100 and status to STABLE."""
    row = _get_or_404(db, device_id)
    
    row.trust_score = 100.0
    row.status = "STABLE"
    row.last_seen = datetime.now(timezone.utc)
    
    # Add a reset TrustEvent
    trust_event = TrustEvent(
        device_id=row.id,
        trust_score=100.0,
        anomaly_score=0.0,
        is_anomaly=False,
        features={"action": "Manual Trust Reset"},
        shap_values={},
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(trust_event)
    db.commit()
    
    # Bust relevant caches
    cache_delete(CacheKeys.DEVICES_LIST)
    cache_delete(CacheKeys.DASHBOARD_OVERVIEW)
    cache_delete(CacheKeys.TRUST_OVERVIEW)
    cache_delete(CacheKeys.TRUST_BREAKDOWN)
    cache_delete(CacheKeys.NETWORK_MAP)
    cache_delete(CacheKeys.NETWORK_NODES)
    cache_delete(CacheKeys.device_detail(str(device_id)))
    
    return {"message": "Trust score reset to 100", "deviceId": str(device_id)}


@router.get("/{device_id}")
def get_device(device_id: UUID, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    return _serialize(_get_or_404(db, device_id))
