# ─── ORM Model: TrustEvent ────────────────────────────────
# Every time telemetry arrives for a device, a trust event
# is recorded capturing the ML scores and SHAP values.
# ──────────────────────────────────────────────────────────

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class TrustEvent(Base):
    __tablename__ = "trust_events"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id     = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    trust_score   = Column(Float, nullable=False)
    anomaly_score = Column(Float, nullable=True)   # Raw Isolation Forest score
    is_anomaly    = Column(Boolean, default=False)
    features      = Column(JSONB, nullable=True)   # packet_count, protocol, entropy, ip_diversity
    shap_values   = Column(JSONB, nullable=True)   # {feature: shap_value, ...}
    recorded_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # ─── Relationships ────────────────────────────────────
    device = relationship("Device", back_populates="trust_events")
