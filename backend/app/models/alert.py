"""
Alert SQLAlchemy Model
Operational alarms triggered by risk assessments with deduplication key support.
"""

from typing import TYPE_CHECKING, Optional
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.risk import RiskAssessment


class Alert(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "alerts"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), index=True, nullable=True)
    risk_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("risk_assessments.id", ondelete="SET NULL"), index=True, nullable=True)
    
    severity: Mapped[str] = mapped_column(String(32), default="warning", nullable=False)  # info, warning, critical
    channel: Mapped[str] = mapped_column(String(32), default="in_app", nullable=False)   # in_app, email, sms, webhook
    message: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # pending, sent, failed, delivered
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )

    # Relationships
    risk: Mapped[Optional["RiskAssessment"]] = relationship("RiskAssessment", back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_farm_created", "farm_id", "created_at"),
    )
