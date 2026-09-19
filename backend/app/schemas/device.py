"""
Device Pydantic v2 Schemas with DeviceType Validation and Credential Safety
"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


VALID_DEVICE_TYPES = {
    "soil_moisture",
    "soil_sensor",
    "weather",
    "weather_station",
    "npk",
    "ph",
    "temperature",
    "humidity",
    "multi_sensor",
    "multispectral_camera",
    "gateway",
    "actuator",
    "valve",
    "other",
}


def _validate_device_type(v: str) -> str:
    v_clean = v.strip().lower()
    if v_clean not in VALID_DEVICE_TYPES:
        raise ValueError(
            f"Invalid device_type '{v}'. Must be one of: {sorted(VALID_DEVICE_TYPES)}"
        )
    return v_clean


def _validate_credential_reference(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    # Reject strings that look like passwords, bearer tokens, or full private keys
    lower_v = v.lower()
    if any(k in lower_v for k in ["password=", "secret=", "bearer ", "private_key", "-----begin"]):
        raise ValueError("credential_reference must be a hardware ID / serial reference (e.g. 'SN-ESP32-101', MAC address), not a raw secret or password.")
    return v


class DeviceBase(BaseModel):
    device_type: str = Field(..., max_length=64, json_schema_extra={"example": "soil_moisture"})
    calibration: Optional[Dict[str, Any]] = None
    credential_reference: Optional[str] = Field(None, max_length=128, json_schema_extra={"example": "SN-ESP32-A1B2C3"})
    enabled: bool = True
    is_demo: bool = False

    @field_validator("device_type")
    @classmethod
    def validate_device_type(cls, v: str) -> str:
        return _validate_device_type(v)

    @field_validator("credential_reference")
    @classmethod
    def validate_cred_ref(cls, v: Optional[str]) -> Optional[str]:
        return _validate_credential_reference(v)


class DeviceCreate(DeviceBase):
    zone_id: Optional[str] = None


class DeviceUpdate(BaseModel):
    zone_id: Optional[str] = None
    device_type: Optional[str] = None
    calibration: Optional[Dict[str, Any]] = None
    credential_reference: Optional[str] = None
    enabled: Optional[bool] = None
    is_demo: Optional[bool] = None

    @field_validator("device_type")
    @classmethod
    def validate_device_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return _validate_device_type(v)
        return v

    @field_validator("credential_reference")
    @classmethod
    def validate_cred_ref(cls, v: Optional[str]) -> Optional[str]:
        return _validate_credential_reference(v)


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    zone_id: Optional[str] = None
    device_type: str
    calibration: Optional[Dict[str, Any]] = None
    credential_reference: Optional[str] = None
    enabled: bool
    is_demo: bool = False
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_device(cls, device: Any) -> "DeviceResponse":
        calib = device.calibration or {}
        is_demo = bool(calib.get("is_demo", False))
        return cls(
            id=device.id,
            farm_id=device.farm_id,
            zone_id=device.zone_id,
            device_type=device.device_type,
            calibration=device.calibration,
            credential_reference=device.credential_reference,
            enabled=device.enabled,
            is_demo=is_demo,
            last_seen_at=device.last_seen_at,
            created_at=device.created_at,
            updated_at=device.updated_at,
        )
