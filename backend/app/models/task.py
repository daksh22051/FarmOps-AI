"""
Task SQLAlchemy Model
Executable field tasks created only upon plan approval or safety guard clearance.
"""

from typing import TYPE_CHECKING, Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Text, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.plan import ActionPlan


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tasks"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), index=True, nullable=True)
    plan_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("action_plans.id", ondelete="SET NULL"), index=True, nullable=True)
    
    assignee_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)  # pending, in_progress, completed, cancelled, blocked
    due_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    due_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    checklist: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    plan: Mapped[Optional["ActionPlan"]] = relationship("ActionPlan", back_populates="tasks")

    __table_args__ = (
        Index("ix_tasks_status_due_window", "status", "due_from", "due_until"),
        Index("ix_tasks_farm_status", "farm_id", "status"),
    )
