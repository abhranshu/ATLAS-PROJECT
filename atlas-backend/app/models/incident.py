# ─── ORM Model: Incident ──────────────────────────────────
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title       = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    severity    = Column(String(32), nullable=False)    # critical | warning | stable | breach
    type        = Column(String(64), nullable=True)     # anomaly | auth_failure | port_scan ...
    device_id   = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    resolved    = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # ─── Relationships ────────────────────────────────────
    device = relationship("Device", back_populates="incidents")
