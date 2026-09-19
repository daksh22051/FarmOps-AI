"""
External Observation Pydantic v2 Schemas
Validation and serialization for weather, satellite NDVI, and market data.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ExternalObservationCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    farm_id: str = Field(..., min_length=1, max_length=36, description="Target Farm UUID")
    zone_id: Optional[str] = Field(None, max_length=36, description="Optional Zone UUID")
    source: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Data source provider (e.g. 'weather', 'openmeteo', 'sentinel_2', 'market', 'drone')",
    )
    observation_type: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Type of observation (e.g. 'rainfall_forecast', 'weather_current', 'satellite_ndvi', 'soil_survey', 'market_price')",
    )
    observed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="ISO-8601 UTC timestamp of observation",
    )
    payload: Dict[str, Any] = Field(
        ...,
        description="Flexible key-value observation payload (e.g. temperature, precipitation, NDVI indices)",
    )
    source_reference: Optional[str] = Field(
        None,
        max_length=128,
        description="Provider-specific unique observation or station identifier",
    )
    valid_from: Optional[datetime] = Field(None, description="Start time of observation validity window")
    valid_until: Optional[datetime] = Field(None, description="End time of observation validity window")
    freshness: str = Field("fresh", max_length=32, description="Observation freshness: 'fresh', 'stale', 'expired'")

    @field_validator("payload")
    @classmethod
    def validate_payload(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if not v or not isinstance(v, dict):
            raise ValueError("Observation payload must be a non-empty JSON object.")
        return v

    @field_validator("observed_at", "valid_from", "valid_until")
    @classmethod
    def ensure_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return None
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class ExternalObservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique observation database UUID")
    farm_id: str = Field(..., description="Farm UUID")
    zone_id: Optional[str] = Field(None, description="Zone UUID")
    source: str = Field(..., description="Data source provider")
    observation_type: str = Field(..., description="Observation type")
    observed_at: datetime = Field(..., description="Observation timestamp")
    payload: Dict[str, Any] = Field(..., description="Observation payload")
    source_reference: Optional[str] = Field(None, description="External reference identifier")
    freshness: str = Field("fresh", description="Freshness status")
    status: str = Field("active", description="Observation status")
    fetched_at: datetime = Field(..., description="Timestamp when observation was fetched/ingested")
    valid_from: Optional[datetime] = Field(None, description="Validity start")
    valid_until: Optional[datetime] = Field(None, description="Validity end")
    created_at: datetime = Field(..., description="Record creation timestamp")
    duplicate: bool = Field(False, description="Whether this observation was recognized as a duplicate")


class ObservationListResponse(BaseModel):
    items: List[ExternalObservationResponse] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 50
