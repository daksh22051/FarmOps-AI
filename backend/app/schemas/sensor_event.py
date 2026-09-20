"""
SensorEvent Pydantic v2 Schemas
"""

from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field


class SensorEventIngest(BaseModel):
    device_id: str
    zone_id: Optional[str] = None
    metric: str = Field(..., max_length=64, json_schema_extra={"example": "soil_moisture"})
    value: float
    unit: str = Field("", max_length=32, json_schema_extra={"example": "%"})
    event_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sequence: int = Field(0, ge=0)
    quality: str = Field("good", max_length=32)
    source: str = Field("device", max_length=32)
    correlation_id: Optional[str] = None
    schema_version: str = Field("1.0", max_length=16)


class SensorEventBatchIngest(BaseModel):
    events: List[SensorEventIngest] = Field(..., min_length=1, max_length=1000)


class SensorEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    device_id: str
    farm_id: str
    zone_id: Optional[str] = None
    metric: str
    value: float
    unit: str
    event_at: datetime
    received_at: datetime
    sequence: int
    quality: str
    source: str
    correlation_id: Optional[str] = None
    schema_version: str
    is_duplicate: bool
    is_delayed: bool


class SensorEventFilter(BaseModel):
    farm_id: str
    zone_id: Optional[str] = None
    device_id: Optional[str] = None
    metric: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)
