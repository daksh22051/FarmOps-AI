"""
MQTT Message Handlers & Parsers for IoT Sensor Telemetry
Parses incoming telemetry events and routes them to SensorEventService.
"""

import json
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.sensor_event import SensorEventIngest
from app.services.sensor_event_service import SensorEventService
from app.core.logging import logger


def parse_topic(topic: str) -> Optional[Tuple[str, Optional[str]]]:
    """
    Extracts (farm_id, device_id) from topic patterns:
    - farmops/{farm_id}/events
    - farmops/{farm_id}/devices/{device_id}/events
    """
    parts = topic.strip("/").split("/")
    if len(parts) >= 3 and parts[0] == "farmops":
        farm_id = parts[1]
        if len(parts) == 3 and parts[2] in ["events", "telemetry"]:
            return farm_id, None
        elif len(parts) == 5 and parts[2] in ["devices", "nodes"] and parts[4] in ["events", "telemetry"]:
            return farm_id, parts[3]
    return None


async def handle_telemetry_message(session: AsyncSession, topic: str, payload_bytes: bytes) -> bool:
    parsed = parse_topic(topic)
    if not parsed:
        logger.warning(f"Unrecognized MQTT topic format: {topic}")
        return False

    farm_id, topic_device_id = parsed

    try:
        data = json.loads(payload_bytes.decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to decode JSON from MQTT message on {topic}: {e}")
        return False

    device_id = data.get("device_id") or topic_device_id
    if not device_id:
        logger.warning(f"Missing device_id in MQTT payload from {topic}")
        return False

    data["device_id"] = device_id
    data["source"] = "mqtt"

    try:
        payload = SensorEventIngest(**data)
        await SensorEventService.ingest_event(session, farm_id, payload)
        logger.info(f"Successfully processed MQTT sensor event for device {device_id} on farm {farm_id}")
        return True
    except Exception as e:
        logger.error(f"Error handling MQTT telemetry event: {e}")
        return False
