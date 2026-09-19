"""
Action Plan SQLAlchemy Model
Candidate action proposals generated from risk assessments, subjected to Deterministic Safety Guard.
"""

from typing import TYPE_CHECKING, Optional, List
from datetime import datetime
from sqlalchemy import String, Float, ForeignKey, DateTime, Text, JSON, Boolean, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.risk import RiskAssessment
    from app.models.task import Task
    from app.models.escalation import Escalation


class ActionPlan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "action_plans"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), index=True, nullable=True)
    risk_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("risk_assessments.id", ondelete="SET NULL"), index=True, nullable=True)
    source_risk_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # list of risk UUID strings
    
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)  # irrigate, apply_biocontrol, apply_fertilizer, scout_field, adjust_harvest_schedule
    action_summary: Mapped[str] = mapped_column(Text, nullable=False)
    earliest_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    latest_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    priority: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)  # low, medium, high, urgent
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    evidence: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    safety_flags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # Deterministic Safety Decision State
    approval_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approval_state: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # pending, approved, rejected, auto_approved
    policy_decision: Mapped[str] = mapped_column(String(32), default="ALLOW", index=True, nullable=False)  # ALLOW, APPROVAL_REQUIRED, ESCALATE, REJECT
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relationships
    risk_assessment: Mapped[Optional["RiskAssessment"]] = relationship("RiskAssessment", back_populates="action_plans")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="plan", cascade="all, delete-orphan", lazy="selectin")
    escalations: Mapped[List["Escalation"]] = relationship("Escalation", back_populates="plan", lazy="selectin")

    __table_args__ = (
        Index("ix_action_plans_farm_created", "farm_id", "created_at"),
    )
