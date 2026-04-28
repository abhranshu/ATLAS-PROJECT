# ─── ORM Model: Device ────────────────────────────────────
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name             = Column(String(128), nullable=False)
    type             = Column(String(64), nullable=False)          # sensor / gateway / camera ...
    location         = Column(String(256), nullable=True)
    ip_address       = Column(String(45), nullable=True)           # IPv4 or IPv6
    firmware_version = Column(String(64), nullable=True)
    server_id        = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="SET NULL"), nullable=True)
    status           = Column(String(32), default="STABLE")        # STABLE | WARNING | BREACH | OFFLINE
    trust_score      = Column(Float, default=100.0)
    is_isolated      = Column(Boolean, default=False)
    last_seen        = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # ─── Relationships ────────────────────────────────────
    server       = relationship("Server", back_populates="devices")
    trust_events = relationship("TrustEvent", back_populates="device", cascade="all, delete-orphan")
    incidents    = relationship("Incident",   back_populates="device")
