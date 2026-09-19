"""
Audit Event SQLAlchemy Model
Tamper-evident audit trail for system events, safety evaluations, and actor interactions.
"""

from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDPrimaryKeyMixin


class AuditEvent(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "audit_events"

    farm_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    actor_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    event_type: Mapped[str] = mapped_column(String(128), index=True, nullable=False)  # risk_detected, plan_created, safety_evaluated, task_created, alert_fired, escalation_opened, etc.
    before_state: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    after_state: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    correlation_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )
    source: Mapped[str] = mapped_column(String(32), default="system", nullable=False)  # agent, safety_guard, user, device, system
    model_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    policy_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    __table_args__ = (
        Index("ix_audit_events_farm_timestamp", "farm_id", "timestamp"),
        Index("ix_audit_events_entity", "entity_type", "entity_id"),
    )
