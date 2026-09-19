"""
MQTT Message Handlers & Parsers for IoT Sensor Telemetry
Parses incoming telemetry events and routes them to TelemetryService with full validation and idempotency.
"""

import json
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError

from app.schemas.telemetry import TelemetryEventCreate, MEASUREMENT_ALIASES
from app.services.telemetry_service import TelemetryService
from app.core.exceptions import FarmOpsException
from app.core.logging import logger


def parse_topic(topic: str) -> Optional[Tuple[Optional[str], Optional[str]]]:
    """
    Extracts (farm_id, device_id) from supported topic patterns:
    - farmops/{farm_id}/{device_id}/telemetry
    - farmops/{farm_id}/devices/{device_id}/telemetry
    - farmops/{farm_id}/nodes/{device_id}/telemetry
    - farmops/devices/{device_id}/telemetry
    - farmops/{device_id}/telemetry
    - farmops/{farm_id}/events
    - farmops/{farm_id}/devices/{device_id}/events
    """
    if not topic:
        return None

    parts = [p for p in topic.strip("/").split("/") if p]
    if not parts or parts[0] != "farmops":
        return None

    # farmops/{device_id}/telemetry (len 3)
    if len(parts) == 3 and parts[2] in ["telemetry", "events"]:
        return None, parts[1]

    # farmops/devices/{device_id}/telemetry (len 4)
    if len(parts) == 4 and parts[1] in ["devices", "nodes"] and parts[3] in ["telemetry", "events"]:
        return None, parts[2]

    # farmops/{farm_id}/{device_id}/telemetry (len 4)
    if len(parts) == 4 and parts[3] in ["telemetry", "events"]:
        return parts[1], parts[2]

    # farmops/{farm_id}/devices/{device_id}/telemetry (len 5)
    if len(parts) == 5 and parts[2] in ["devices", "nodes"] and parts[4] in ["telemetry", "events"]:
        return parts[1], parts[3]

    # farmops/{farm_id}/events (len 3)
    if len(parts) == 3 and parts[2] in ["telemetry", "events"]:
        return parts[1], None

    return None


def extract_measurements(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extracts measurements dictionary either from nested 'measurements' key
    or by grouping top-level recognized measurement keys.
    """
    if "measurements" in data and isinstance(data["measurements"], dict):
        return data["measurements"]

    # Fallback: extract recognized flat measurement keys
    extracted = {}
    for k, v in data.items():
        clean_k = k.strip().lower().replace("-", "_")
        if clean_k in MEASUREMENT_ALIASES:
            extracted[k] = v
    return extracted


async def handle_telemetry_message(session: AsyncSession, topic: str, payload_bytes: bytes) -> bool:
    """
    Processes an incoming MQTT message payload, validates payload schema,
    and routes through TelemetryService without crashing on malformed inputs.
    """
    parsed = parse_topic(topic)
    if not parsed:
        logger.warning(f"Unrecognized MQTT topic format: {topic}")
        return False

    farm_id, topic_device_id = parsed

    # 1. Decode JSON safely
    try:
        raw_text = payload_bytes.decode("utf-8") if isinstance(payload_bytes, bytes) else str(payload_bytes)
        data = json.loads(raw_text)
        if not isinstance(data, dict):
            logger.warning(f"MQTT message payload must be a JSON object, got: {type(data)}")
            return False
    except Exception as e:
        logger.error(f"Failed to decode JSON from MQTT message on {topic}: {e}")
        return False

    # 2. Resolve device_id
    device_id = data.get("device_id") or topic_device_id
    if not device_id:
        logger.warning(f"Missing device_id in MQTT payload and topic for {topic}")
        return False

    # 3. Extract measurements
    measurements = extract_measurements(data)
    if not measurements:
        logger.warning(f"Missing or empty measurements in MQTT payload from {topic}")
        return False

    # 4. Resolve sequence
    if "sequence" not in data:
        logger.warning(f"Missing sequence number in MQTT payload from {topic}")
        return False

    try:
        sequence = int(data["sequence"])
    except (ValueError, TypeError):
        logger.warning(f"Invalid sequence '{data.get('sequence')}' in MQTT payload from {topic}")
        return False

    # 5. Resolve event_timestamp
    raw_ts = data.get("event_timestamp") or data.get("event_at") or data.get("timestamp")
    if not raw_ts:
        event_ts = datetime.now(timezone.utc)
    elif isinstance(raw_ts, datetime):
        event_ts = raw_ts
    else:
        try:
            event_ts = datetime.fromisoformat(str(raw_ts).replace("Z", "+00:00"))
        except Exception:
            event_ts = datetime.now(timezone.utc)

    unit_system = data.get("unit_system", "metric")
    metadata = data.get("metadata")

    # 6. Construct TelemetryEventCreate schema
    try:
        telemetry_payload = TelemetryEventCreate(
            device_id=str(device_id),
            sequence=sequence,
            event_timestamp=event_ts,
            measurements=measurements,
            unit_system=unit_system,
            metadata=metadata if isinstance(metadata, dict) else None,
        )
    except (ValidationError, ValueError) as e:
        logger.warning(f"MQTT telemetry payload validation failed for device {device_id}: {e}")
        return False

    # 7. Ingest through TelemetryService
    try:
        result = await TelemetryService.ingest_event(
            session=session,
            payload=telemetry_payload,
            user=None,  # Device hardware authenticated
            source="mqtt",
        )
        if result.duplicate:
            logger.info(f"MQTT telemetry acknowledged duplicate: device={device_id}, sequence={sequence}")
        else:
            logger.info(f"MQTT telemetry ingested successfully: event_id={result.id}, device={device_id}, seq={sequence}")
        return True
    except FarmOpsException as e:
        logger.warning(f"MQTT telemetry rejected for device {device_id} ({e.code}): {e.detail}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error processing MQTT telemetry for device {device_id}: {e}")
        try:
            await session.rollback()
        except Exception:
            pass
        return False
