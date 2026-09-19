"""
Device Pydantic v2 Schemas
"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class DeviceBase(BaseModel):
    device_type: str = Field(..., max_length=64, json_schema_extra={"example": "soil_sensor"})
    calibration: Optional[Dict[str, Any]] = None
    credential_reference: Optional[str] = Field(None, max_length=128, json_schema_extra={"example": "DEV-ESP32-A1B2C3"})
    enabled: bool = True


class DeviceCreate(DeviceBase):
    zone_id: Optional[str] = None


class DeviceUpdate(BaseModel):
    zone_id: Optional[str] = None
    device_type: Optional[str] = None
    calibration: Optional[Dict[str, Any]] = None
    credential_reference: Optional[str] = None
    enabled: Optional[bool] = None


class DeviceResponse(DeviceBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    zone_id: Optional[str] = None
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
