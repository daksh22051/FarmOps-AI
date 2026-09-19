"""
Farm, FarmMembership, and Zone Pydantic v2 Schemas
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


# --- FARM MEMBERSHIP SCHEMAS ---
class FarmMembershipBase(BaseModel):
    user_id: str
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
    name: str = Field(..., max_length=128, json_schema_extra={"example": "Sector Alpha - Orchards"})
    area: Optional[float] = Field(None, ge=0)
    area_unit: str = Field("hectare", max_length=32)
    geometry: Optional[Dict[str, Any]] = None
    crop: Optional[str] = Field(None, max_length=128, json_schema_extra={"example": "Tomato"})
    crop_stage: Optional[str] = Field("seedling", max_length=64, json_schema_extra={"example": "vegetative"})
    soil_type: Optional[str] = Field(None, max_length=64, json_schema_extra={"example": "Loam"})
    status: str = Field("active", max_length=32)
    is_demo: bool = False


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    area: Optional[float] = None
    area_unit: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None
    crop: Optional[str] = None
    crop_stage: Optional[str] = None
    soil_type: Optional[str] = None
    status: Optional[str] = None
    is_demo: Optional[bool] = None


class ZoneResponse(ZoneBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    created_at: datetime
    updated_at: datetime


# --- FARM SCHEMAS ---
class FarmBase(BaseModel):
    name: str = Field(..., max_length=128, json_schema_extra={"example": "Salinas Precision Valley Farm"})
    location: Optional[str] = Field(None, max_length=255, json_schema_extra={"example": "Salinas, CA"})
    address: Optional[str] = None
    timezone: str = Field("UTC", max_length=64)
    total_area: Optional[float] = Field(None, ge=0)
    area_unit: str = Field("hectare", max_length=32)
    boundary_geometry: Optional[Dict[str, Any]] = None
    crop_profile: Optional[Dict[str, Any]] = None
    policies: Optional[Dict[str, Any]] = None
    is_demo: bool = False


class FarmCreate(FarmBase):
    pass


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    timezone: Optional[str] = None
    total_area: Optional[float] = None
    area_unit: Optional[str] = None
    boundary_geometry: Optional[Dict[str, Any]] = None
    crop_profile: Optional[Dict[str, Any]] = None
    policies: Optional[Dict[str, Any]] = None
    is_demo: Optional[bool] = None


class FarmResponse(FarmBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    zones: List[ZoneResponse] = []
    created_at: datetime
    updated_at: datetime
