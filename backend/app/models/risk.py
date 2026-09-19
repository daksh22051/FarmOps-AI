"""
Risk Assessment SQLAlchemy Model
Domain model for automated agronomic risk detection from telemetry & observation context.
"""

from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import String, Float, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.plan import ActionPlan
    from app.models.alert import Alert
    from app.models.escalation import Escalation


class RiskAssessment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "risk_assessments"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), index=True, nullable=True)
    
    risk_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)  # water_stress, pest_disease, nutrient_deficiency, market_exposure
    severity: Mapped[str] = mapped_column(String(32), index=True, nullable=False)    # low, medium, high, critical
    score: Mapped[float] = mapped_column(Float, nullable=False)                      # 0.0 to 1.0 or 0 to 100
    confidence: Mapped[float] = mapped_column(Float, nullable=False)                 # 0.0 to 1.0
    evidence: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    missing_information: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open", index=True, nullable=False)  # open, mitigated, resolved, false_positive
    agent: Mapped[str] = mapped_column(String(64), nullable=False)                   # water_stress_agent, pest_disease_agent, nutrient_agent, market_context_agent
    agent_version: Mapped[str] = mapped_column(String(32), default="1.0.0", nullable=False)

    # Relationships
    action_plans: Mapped[List["ActionPlan"]] = relationship("ActionPlan", back_populates="risk_assessment", lazy="selectin")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="risk", lazy="selectin")
    escalations: Mapped[List["Escalation"]] = relationship("Escalation", back_populates="risk", lazy="selectin")

    __table_args__ = (
        Index("ix_risk_status_severity", "status", "severity"),
        Index("ix_risk_farm_created", "farm_id", "created_at"),
    )
