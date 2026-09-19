"""
Escalation SQLAlchemy Model
Expert review workflows when automated confidence is low, risk is critical, or actions are sensitive.
"""

from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.risk import RiskAssessment
    from app.models.plan import ActionPlan


class Escalation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "escalations"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), index=True, nullable=True)
    risk_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("risk_assessments.id", ondelete="SET NULL"), index=True, nullable=True)
    plan_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("action_plans.id", ondelete="SET NULL"), index=True, nullable=True)
    
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", index=True, nullable=False)  # open, in_review, resolved, rejected
    assigned_expert_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    review_outcome: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Relationships
    risk: Mapped[Optional["RiskAssessment"]] = relationship("RiskAssessment", back_populates="escalations")
    plan: Mapped[Optional["ActionPlan"]] = relationship("ActionPlan", back_populates="escalations")

    __table_args__ = (
        Index("ix_escalations_farm_status", "farm_id", "status"),
    )
