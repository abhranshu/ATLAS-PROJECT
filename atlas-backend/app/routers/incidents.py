# ─── Router: Incidents (mock) ─────────────────────────────
# GET /api/incidents/overview
# GET /api/incidents
# GET /api/incidents/logs
# GET /api/incidents/{id}
# ──────────────────────────────────────────────────────────

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import require_auth
from app.mock_data import INCIDENTS

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.get("/overview")
def get_incidents_overview(_: dict = Depends(require_auth)):
    from collections import Counter
    sev_counts = Counter(i["severity"] for i in INCIDENTS)
    return {
        "total":      len(INCIDENTS),
        "unresolved": sum(1 for i in INCIDENTS if not i["resolved"]),
        "critical":   sev_counts.get("critical", 0),
        "warning":    sev_counts.get("warning",  0),
        "breach":     sev_counts.get("breach",   0),
        "stable":     sev_counts.get("stable",   0),
    }


@router.get("")
def list_incidents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    severity: Optional[str] = Query(None),
    _: dict = Depends(require_auth),
):
    items = INCIDENTS
    if severity:
        items = [i for i in items if i["severity"] == severity.lower()]
    total = len(items)
    start = (page - 1) * limit
    return {
        "data":  items[start: start + limit],
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }


@router.get("/logs")
def get_incident_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    _: dict = Depends(require_auth),
):
    total = len(INCIDENTS)
    start = (page - 1) * limit
    return {
        "data":  INCIDENTS[start: start + limit],
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }


@router.get("/{incident_id}")
def get_incident(incident_id: str, _: dict = Depends(require_auth)):
    for i in INCIDENTS:
        if i["id"] == incident_id:
            return i
    raise HTTPException(status_code=404, detail="Incident not found")
