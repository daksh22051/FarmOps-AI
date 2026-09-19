"""
Farm, Farm Membership, and Zone SQLAlchemy Models
"""

from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import String, Float, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.sensor_event import SensorEvent
    from app.models.risk import RiskAssessment
    from app.models.plan import ActionPlan
    from app.models.task import Task
    from app.models.alert import Alert
    from app.models.escalation import Escalation


class Farm(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "farms"

    owner_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    total_area: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    area_unit: Mapped[str] = mapped_column(String(32), default="hectare", nullable=False)
    boundary_geometry: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    crop_profile: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    policies: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    memberships: Mapped[List["FarmMembership"]] = relationship("FarmMembership", back_populates="farm", cascade="all, delete-orphan", lazy="selectin")
    zones: Mapped[List["Zone"]] = relationship("Zone", back_populates="farm", cascade="all, delete-orphan", lazy="selectin")
    devices: Mapped[List["Device"]] = relationship("Device", back_populates="farm", cascade="all, delete-orphan", lazy="selectin")


class FarmMembership(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "farm_memberships"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="viewer", nullable=False)  # owner, manager, agronomist, operator, viewer

    # Relationships
    farm: Mapped["Farm"] = relationship("Farm", back_populates="memberships")


class Zone(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "zones"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    area: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    area_unit: Mapped[str] = mapped_column(String(32), default="hectare", nullable=False)
    geometry: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    crop: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    crop_stage: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # seedling, vegetative, flowering, maturity
    soil_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # Loam, Clay, Sandy, etc.
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    farm: Mapped["Farm"] = relationship("Farm", back_populates="zones")
    devices: Mapped[List["Device"]] = relationship("Device", back_populates="zone", lazy="selectin")
