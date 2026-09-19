"""
Telemetry Ingestion Pydantic v2 Schemas and Measurement Normalization
"""

import math
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MEASUREMENT_ALIASES: Dict[str, str] = {
    # Soil Moisture
    "soil_moisture": "soil_moisture",
    "soilmoisture": "soil_moisture",
    "soil-moisture": "soil_moisture",
    "moisture": "soil_moisture",
    "soil_water": "soil_moisture",
    # Temperature
    "temperature": "temperature",
    "temp": "temperature",
    "air_temperature": "temperature",
    "air_temp": "temperature",
    # Humidity
    "humidity": "humidity",
    "relative_humidity": "humidity",
    "rel_humidity": "humidity",
    "rh": "humidity",
    # Rainfall
    "rainfall": "rainfall",
    "rain": "rainfall",
    "precipitation": "rainfall",
    # pH
    "ph": "ph",
    "soil_ph": "ph",
    "ph_level": "ph",
    # Nitrogen
    "nitrogen": "nitrogen",
    "n": "nitrogen",
    "nitro": "nitrogen",
    # Phosphorus
    "phosphorus": "phosphorus",
    "p": "phosphorus",
    "phos": "phosphorus",
    # Potassium
    "potassium": "potassium",
    "k": "potassium",
    "potass": "potassium",
}

SUPPORTED_UNIT_SYSTEMS = {"metric", "si", "default"}

# Sensible domain bounds for agricultural measurements
MEASUREMENT_BOUNDS = {
    "soil_moisture": (0.0, 100.0, "Soil moisture must be between 0 and 100%"),
    "humidity": (0.0, 100.0, "Relative humidity must be between 0 and 100%"),
    "ph": (0.0, 14.0, "pH must be between 0.0 and 14.0"),
    "temperature": (-50.0, 70.0, "Temperature must be between -50°C and 70°C"),
    "rainfall": (0.0, float("inf"), "Rainfall cannot be negative"),
    "nitrogen": (0.0, float("inf"), "Nitrogen (N) value cannot be negative"),
    "phosphorus": (0.0, float("inf"), "Phosphorus (P) value cannot be negative"),
    "potassium": (0.0, float("inf"), "Potassium (K) value cannot be negative"),
}


def normalize_measurement_key(raw_key: str) -> str:
    """Converts key to lowercase canonical metric name if recognized."""
    clean_key = raw_key.strip().lower().replace("-", "_")
    return MEASUREMENT_ALIASES.get(clean_key, clean_key)


def validate_and_normalize_measurements(raw_measurements: Dict[str, Any]) -> Dict[str, float]:
    """
    Validates numeric values, rejects NaN/Inf, checks domain bounds,
    and returns a normalized dict with canonical metric keys.
    """
    if not raw_measurements:
        raise ValueError("Measurements map cannot be empty. At least one measurement is required.")

    normalized: Dict[str, float] = {}

    for k, v in raw_measurements.items():
        if v is None:
            continue

        # Check numeric conversion
        try:
            val_float = float(v)
        except (ValueError, TypeError):
            raise ValueError(f"Measurement '{k}' must have a valid numeric float value, got: {v}")

        # Check for NaN and Infinity
        if math.isnan(val_float):
            raise ValueError(f"Measurement '{k}' cannot be NaN")
        if math.isinf(val_float):
            raise ValueError(f"Measurement '{k}' cannot be Infinity")

        canonical_key = normalize_measurement_key(k)

        # Domain bounds validation
        if canonical_key in MEASUREMENT_BOUNDS:
            min_val, max_val, err_msg = MEASUREMENT_BOUNDS[canonical_key]
            if val_float < min_val or val_float > max_val:
                raise ValueError(f"Invalid value {val_float} for '{canonical_key}': {err_msg}")

        normalized[canonical_key] = round(val_float, 4)

    if not normalized:
        raise ValueError("Measurements map contains no valid numeric readings.")

    return normalized


class TelemetryEventCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    device_id: str = Field(..., min_length=1, max_length=64, description="Unique hardware or virtual device UUID")
    sequence: int = Field(..., ge=0, description="Monotonically increasing sequence number per device")
    event_timestamp: datetime = Field(..., description="ISO-8601 UTC timestamp when measurements were recorded")
    measurements: Dict[str, Any] = Field(..., description="Dictionary of sensor measurements")
    unit_system: str = Field("metric", description="Unit system used for measurements (default: 'metric')")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Optional sensor/gateway metadata")

    @field_validator("unit_system")
    @classmethod
    def validate_unit_system(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        if clean not in SUPPORTED_UNIT_SYSTEMS:
            raise ValueError(
                f"Unsupported unit system '{v}'. Supported systems: {', '.join(sorted(SUPPORTED_UNIT_SYSTEMS))}"
            )
        return clean

    @field_validator("measurements")
    @classmethod
    def validate_measurements_payload(cls, v: Dict[str, Any]) -> Dict[str, float]:
        return validate_and_normalize_measurements(v)

    @field_validator("event_timestamp")
    @classmethod
    def ensure_timezone(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class TelemetryEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique sensor event database ID")
    device_id: str = Field(..., description="Device ID")
    farm_id: Optional[str] = Field(None, description="Authoritative Farm ID")
    zone_id: Optional[str] = Field(None, description="Authoritative Zone ID")
    sequence: int = Field(..., description="Event sequence number")
    event_timestamp: datetime = Field(..., description="Event timestamp (device recording time)")
    received_at: Optional[datetime] = Field(None, description="Backend ingestion timestamp")
    measurements: Dict[str, float] = Field(default_factory=dict, description="Normalized sensor measurements")
    unit_system: str = Field("metric", description="Unit system standard")
    duplicate: bool = Field(False, description="Indicates whether this event was already ingested")
    status: str = Field("accepted", description="Status of ingestion: 'accepted' or 'duplicate'")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Event metadata")
