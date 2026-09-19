"""
External Observation SQLAlchemy Model
Stores weather forecasts, satellite multispectral NDVI data, and market context.
"""

from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class ExternalObservation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "external_observations"

    farm_id: Mapped[str] = mapped_column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), index=True, nullable=True)
    
    type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)  # weather_forecast, satellite_ndvi, soil_survey, market_price
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)  # openmeteo, sentinel_2, usda, manual
    source_reference: Mapped[Optional[str]] = mapped_column(String(128), index=True, nullable=True)  # station/provider ID
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    freshness: Mapped[str] = mapped_column(String(32), default="fresh", nullable=False)  # fresh, stale, expired
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    valid_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_external_obs_farm_type", "farm_id", "type"),
        Index("ix_external_obs_validity", "valid_from", "valid_until"),
        Index("ix_external_obs_dedupe", "farm_id", "source", "source_reference", "observed_at"),
    )
