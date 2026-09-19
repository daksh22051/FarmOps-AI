"""
Sensor Event SQLAlchemy Model
High-throughput telemetry time-series event storage with deduplication guarantees.
"""

from typing import TYPE_CHECKING, Optional
from datetime import datetime, timezone
from sqlalchemy import String, Float, ForeignKey, DateTime, Integer, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.device import Device


class SensorEvent(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "sensor_events"

    device_id: Mapped[str] = mapped_column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False)
    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), index=True, nullable=True)
    
    metric: Mapped[str] = mapped_column(String(64), index=True, nullable=False)  # soil_moisture, air_temperature, etc.
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    
    event_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quality: Mapped[str] = mapped_column(String(32), default="good", nullable=False)  # good, suspect, bad
    source: Mapped[str] = mapped_column(String(32), default="device", nullable=False)  # device, gateway, mqtt, rest
    correlation_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    schema_version: Mapped[str] = mapped_column(String(16), default="1.0", nullable=False)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_delayed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="sensor_events")

    # Constraints and Indexing
    __table_args__ = (
        UniqueConstraint("device_id", "sequence", name="uq_device_sequence"),
        Index("ix_sensor_events_farm_event_at", "farm_id", "event_at"),
        Index("ix_sensor_events_zone_event_at", "zone_id", "event_at"),
        Index("ix_sensor_events_device_event_at", "device_id", "event_at"),
    )
