"""
Device SQLAlchemy Model
Represents edge gateways, sensors, weather stations, and hardware nodes.
"""

from typing import TYPE_CHECKING, Optional, List
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.farm import Farm, Zone
    from app.models.sensor_event import SensorEvent


class Device(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "devices"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), index=True, nullable=True)
    device_type: Mapped[str] = mapped_column(String(64), nullable=False)  # soil_sensor, weather_station, multispectral_camera, gateway
    calibration: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    credential_reference: Mapped[Optional[str]] = mapped_column(String(128), unique=True, index=True, nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    farm: Mapped["Farm"] = relationship("Farm", back_populates="devices")
    zone: Mapped[Optional["Zone"]] = relationship("Zone", back_populates="devices")
    sensor_events: Mapped[List["SensorEvent"]] = relationship("SensorEvent", back_populates="device", cascade="all, delete-orphan", lazy="selectin")
