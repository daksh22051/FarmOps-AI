"""
Farm, FarmMembership, and Zone Pydantic v2 Schemas with Comprehensive Validation
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, ConfigDict, Field, field_validator


VALID_AREA_UNITS = {"hectare", "hectares", "acre", "acres", "sq_meter", "sq_meters", "sq_km", "mu", "sqm"}
VALID_CROP_STAGES = {
    "seedling",
    "vegetative",
    "flowering",
    "fruiting",
    "maturity",
    "harvested",
    "dormant",
    "fallow",
    "ripening",
}
VALID_ZONE_STATUSES = {"active", "fallow", "quarantine", "harvested", "inactive", "maintenance"}
VALID_GEOJSON_TYPES = {
    "Point",
    "MultiPoint",
    "LineString",
    "MultiLineString",
    "Polygon",
    "MultiPolygon",
    "GeometryCollection",
    "Feature",
    "FeatureCollection",
}


def _validate_geojson_shape(v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if v is None:
        return None
    if not isinstance(v, dict):
        raise ValueError("Geometry must be a valid GeoJSON object / dictionary.")
    geom_type = v.get("type")
    if not geom_type or geom_type not in VALID_GEOJSON_TYPES:
        raise ValueError(
            f"Invalid GeoJSON type '{geom_type}'. Must be one of: {sorted(VALID_GEOJSON_TYPES)}"
        )
    if "coordinates" not in v and "features" not in v and "geometries" not in v:
        raise ValueError("GeoJSON object must contain 'coordinates', 'features', or 'geometries'.")
    return v


STANDARD_TIMEZONES = {
    "UTC",
    "GMT",
    "UTC+0",
    "UTC-0",
    "Z",
    "Etc/UTC",
    "Etc/GMT",
}
VALID_TZ_PREFIXES = {
    "Africa/",
    "America/",
    "Antarctica/",
    "Arctic/",
    "Asia/",
    "Atlantic/",
    "Australia/",
    "Europe/",
    "Indian/",
    "Pacific/",
    "US/",
    "Canada/",
    "Etc/",
}


def _validate_timezone_string(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if not v:
        raise ValueError("Timezone cannot be empty.")

    try:
        ZoneInfo(v)
        return v
    except (ZoneInfoNotFoundError, Exception):
        pass

    if v in STANDARD_TIMEZONES or v.upper() in STANDARD_TIMEZONES:
        return v

    if any(v.startswith(prefix) for prefix in VALID_TZ_PREFIXES) and "/" in v:
        parts = v.split("/")
        if len(parts) >= 2 and all(p and p.replace("_", "").isalnum() for p in parts):
            return v

    raise ValueError(
        f"Invalid timezone identifier '{v}'. Must be a valid IANA timezone (e.g. 'UTC', 'America/Los_Angeles', 'Asia/Kolkata')."
    )


def _validate_area_unit_string(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v_clean = v.strip().lower()
    if v_clean not in VALID_AREA_UNITS:
        raise ValueError(f"Invalid area unit '{v}'. Must be one of: {sorted(VALID_AREA_UNITS)}")
    return v_clean


# --- FARM MEMBERSHIP SCHEMAS ---
class FarmMembershipBase(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    role: str = Field("viewer", json_schema_extra={"example": "agronomist"})


class FarmMembershipCreate(FarmMembershipBase):
    pass


class FarmMembershipResponse(FarmMembershipBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    created_at: datetime
    updated_at: datetime


# --- ZONE SCHEMAS ---
class ZoneBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, json_schema_extra={"example": "Sector Alpha - Orchards"})
    area: Optional[float] = Field(None, gt=0, json_schema_extra={"example": 15.5})
    area_unit: str = Field("hectare", max_length=32)
    geometry: Optional[Dict[str, Any]] = None
    crop: Optional[str] = Field(None, max_length=128, json_schema_extra={"example": "Tomato"})
    crop_stage: Optional[str] = Field("seedling", max_length=64, json_schema_extra={"example": "vegetative"})
    soil_type: Optional[str] = Field(None, max_length=64, json_schema_extra={"example": "Loam"})
    status: str = Field("active", max_length=32)
    is_demo: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Zone name cannot be empty or whitespace.")
        return v

    @field_validator("area_unit")
    @classmethod
    def validate_area_unit(cls, v: str) -> str:
        return _validate_area_unit_string(v) or "hectare"

    @field_validator("crop_stage")
    @classmethod
    def validate_crop_stage(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v_clean = v.strip().lower()
        if v_clean not in VALID_CROP_STAGES:
            raise ValueError(f"Invalid crop stage '{v}'. Must be one of: {sorted(VALID_CROP_STAGES)}")
        return v_clean

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        v_clean = v.strip().lower()
        if v_clean not in VALID_ZONE_STATUSES:
            raise ValueError(f"Invalid zone status '{v}'. Must be one of: {sorted(VALID_ZONE_STATUSES)}")
        return v_clean

    @field_validator("geometry")
    @classmethod
    def validate_geometry(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return _validate_geojson_shape(v)


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    area: Optional[float] = Field(None, gt=0)
    area_unit: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None
    crop: Optional[str] = Field(None, max_length=128)
    crop_stage: Optional[str] = None
    soil_type: Optional[str] = Field(None, max_length=64)
    status: Optional[str] = None
    is_demo: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Zone name cannot be empty.")
        return v

    @field_validator("area_unit")
    @classmethod
    def validate_area_unit(cls, v: Optional[str]) -> Optional[str]:
        return _validate_area_unit_string(v)

    @field_validator("crop_stage")
    @classmethod
    def validate_crop_stage(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_clean = v.strip().lower()
            if v_clean not in VALID_CROP_STAGES:
                raise ValueError(f"Invalid crop stage '{v}'. Must be one of: {sorted(VALID_CROP_STAGES)}")
            return v_clean
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_clean = v.strip().lower()
            if v_clean not in VALID_ZONE_STATUSES:
                raise ValueError(f"Invalid zone status '{v}'. Must be one of: {sorted(VALID_ZONE_STATUSES)}")
            return v_clean
        return v

    @field_validator("geometry")
    @classmethod
    def validate_geometry(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return _validate_geojson_shape(v)


class ZoneResponse(ZoneBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    created_at: datetime
    updated_at: datetime


# --- FARM SCHEMAS ---
class FarmBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, json_schema_extra={"example": "Salinas Precision Valley Farm"})
    location: Optional[str] = Field(None, max_length=255, json_schema_extra={"example": "Salinas, CA"})
    address: Optional[str] = None
    timezone: str = Field("UTC", max_length=64)
    total_area: Optional[float] = Field(None, gt=0, json_schema_extra={"example": 120.0})
    area_unit: str = Field("hectare", max_length=32)
    boundary_geometry: Optional[Dict[str, Any]] = None
    crop_profile: Optional[Dict[str, Any]] = None
    policies: Optional[Dict[str, Any]] = None
    is_demo: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Farm name cannot be empty or whitespace.")
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        return _validate_timezone_string(v) or "UTC"

    @field_validator("area_unit")
    @classmethod
    def validate_area_unit(cls, v: str) -> str:
        return _validate_area_unit_string(v) or "hectare"

    @field_validator("boundary_geometry")
    @classmethod
    def validate_geometry(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return _validate_geojson_shape(v)


class FarmCreate(FarmBase):
    pass


class FarmUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    location: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None
    timezone: Optional[str] = None
    total_area: Optional[float] = Field(None, gt=0)
    area_unit: Optional[str] = None
    boundary_geometry: Optional[Dict[str, Any]] = None
    crop_profile: Optional[Dict[str, Any]] = None
    policies: Optional[Dict[str, Any]] = None
    is_demo: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Farm name cannot be empty.")
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: Optional[str]) -> Optional[str]:
        return _validate_timezone_string(v)

    @field_validator("area_unit")
    @classmethod
    def validate_area_unit(cls, v: Optional[str]) -> Optional[str]:
        return _validate_area_unit_string(v)

    @field_validator("boundary_geometry")
    @classmethod
    def validate_geometry(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return _validate_geojson_shape(v)


class FarmResponse(FarmBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    zones: List[ZoneResponse] = []
    created_at: datetime
    updated_at: datetime


class FarmListResponse(BaseModel):
    items: List[FarmResponse]
    total: int
    page: int
    page_size: int
