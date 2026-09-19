"""
Telemetry Ingestion Service
Manages validation, device-farm-zone verification, deduplication, and persistence.
"""

from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status

from app.models.device import Device
from app.models.farm import Zone
from app.models.sensor_event import SensorEvent
from app.schemas.telemetry import (
    TelemetryEventCreate,
    TelemetryEventResponse,
    validate_and_normalize_measurements,
)
from app.core.security import AuthUser, check_farm_access
from app.core.exceptions import FarmOpsException
from app.core.logging import logger


class TelemetryService:
    @staticmethod
    async def ingest_event(
        session: AsyncSession,
        payload: TelemetryEventCreate,
        user: Optional[AuthUser] = None,
        source: str = "rest_api",
    ) -> TelemetryEventResponse:
        """
        Processes and persists an edge telemetry event with deduplication guarantees.
        Enforces authoritative device->farm->zone hierarchy and farm-scoped RBAC.
        """
        # 1. Device Verification
        dev_query = select(Device).where(Device.id == payload.device_id)
        dev_res = await session.execute(dev_query)
        device = dev_res.scalar_one_or_none()

        if not device:
            raise FarmOpsException(
                status_code=status.HTTP_404_NOT_FOUND,
                code="DEVICE_NOT_FOUND",
                detail=f"Device '{payload.device_id}' does not exist or is not registered.",
            )

        if not device.enabled:
            raise FarmOpsException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                code="DEVICE_DISABLED",
                detail=f"Device '{payload.device_id}' is disabled and cannot ingest telemetry.",
            )

        # 2. Derive authoritative farm and zone from device record
        authoritative_farm_id = device.farm_id
        authoritative_zone_id = device.zone_id

        # 3. Zone Verification (if device is bound to a zone)
        if authoritative_zone_id:
            zone_query = select(Zone).where(Zone.id == authoritative_zone_id)
            zone_res = await session.execute(zone_query)
            zone = zone_res.scalar_one_or_none()
            if not zone or zone.farm_id != authoritative_farm_id:
                raise FarmOpsException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    code="INVALID_ZONE_ASSOCIATION",
                    detail=f"Device '{payload.device_id}' is linked to an invalid or mismatched zone.",
                )

        # 4. Authorize User for the Device's Farm (if user context provided)
        if user is not None:
            await check_farm_access(session, farm_id=authoritative_farm_id, user=user)

        # 5. Measurement Normalization & Bounds Validation
        normalized_measurements = validate_and_normalize_measurements(payload.measurements)

        # 6. Timestamp & Latency Calculation
        now_utc = datetime.now(timezone.utc)
        event_ts = payload.event_timestamp
        if event_ts.tzinfo is None:
            event_ts = event_ts.replace(tzinfo=timezone.utc)
        else:
            event_ts = event_ts.astimezone(timezone.utc)

        is_delayed = (now_utc - event_ts) > timedelta(minutes=15)

        # 7. Deduplication Check (device_id, sequence)
        dup_query = select(SensorEvent).where(
            SensorEvent.device_id == payload.device_id,
            SensorEvent.sequence == payload.sequence,
        )
        dup_res = await session.execute(dup_query)
        existing = dup_res.scalar_one_or_none()

        if existing:
            logger.info(
                f"Duplicate telemetry event received: device_id={payload.device_id}, sequence={payload.sequence}"
            )
            existing_measurements = existing.measurements or (
                {existing.metric: existing.value}
                if existing.metric and existing.metric != "multi"
                else normalized_measurements
            )
            return TelemetryEventResponse(
                id=existing.id,
                device_id=existing.device_id,
                farm_id=existing.farm_id,
                zone_id=existing.zone_id,
                sequence=existing.sequence,
                event_timestamp=existing.event_at,
                received_at=existing.received_at,
                measurements=existing_measurements,
                unit_system=payload.unit_system,
                duplicate=True,
                status="duplicate",
                metadata=existing.metadata_payload,
            )

        # 8. Persistence with Race-Condition Protection
        primary_metric = next(iter(normalized_measurements.keys())) if normalized_measurements else "multi"
        primary_value = next(iter(normalized_measurements.values())) if normalized_measurements else 0.0

        new_event = SensorEvent(
            device_id=payload.device_id,
            farm_id=authoritative_farm_id,
            zone_id=authoritative_zone_id,
            metric=primary_metric,
            value=primary_value,
            unit=payload.unit_system,
            measurements=normalized_measurements,
            metadata_payload=payload.metadata,
            event_at=event_ts,
            received_at=now_utc,
            sequence=payload.sequence,
            quality="good",
            source=source,
            schema_version="1.0",
            is_duplicate=False,
            is_delayed=is_delayed,
        )
        session.add(new_event)

        try:
            # 9. Update Device last_seen_at (do not move backwards for out-of-order events)
            if device.last_seen_at is None:
                device.last_seen_at = event_ts
            else:
                last_seen = device.last_seen_at
                if last_seen.tzinfo is None:
                    last_seen = last_seen.replace(tzinfo=timezone.utc)
                if event_ts > last_seen:
                    device.last_seen_at = event_ts

            await session.commit()
            await session.refresh(new_event)
        except IntegrityError:
            await session.rollback()
            # Race condition: duplicate inserted concurrently
            dup_check = await session.execute(
                select(SensorEvent).where(
                    SensorEvent.device_id == payload.device_id,
                    SensorEvent.sequence == payload.sequence,
                )
            )
            concurrent_event = dup_check.scalar_one_or_none()
            if concurrent_event:
                concurrent_measurements = concurrent_event.measurements or normalized_measurements
                return TelemetryEventResponse(
                    id=concurrent_event.id,
                    device_id=concurrent_event.device_id,
                    farm_id=concurrent_event.farm_id,
                    zone_id=concurrent_event.zone_id,
                    sequence=concurrent_event.sequence,
                    event_timestamp=concurrent_event.event_at,
                    received_at=concurrent_event.received_at,
                    measurements=concurrent_measurements,
                    unit_system=payload.unit_system,
                    duplicate=True,
                    status="duplicate",
                    metadata=concurrent_event.metadata_payload,
                )
            raise

        logger.info(
            f"Successfully ingested telemetry event id={new_event.id} for device_id={new_event.device_id}, sequence={new_event.sequence}"
        )

        # 10. Isolated Risk Evaluation Trigger (Safe execution that cannot fail ingestion)
        try:
            from app.services.risk_detection_service import RiskDetectionService
            await RiskDetectionService.evaluate_zone(
                session=session,
                farm_id=authoritative_farm_id,
                zone_id=authoritative_zone_id,
                actor_id=user.id if user else "telemetry_ingest",
            )
        except Exception as eval_err:
            logger.warning(f"Non-blocking risk evaluation error during telemetry ingestion: {eval_err}")

        return TelemetryEventResponse(
            id=new_event.id,
            device_id=new_event.device_id,
            farm_id=new_event.farm_id,
            zone_id=new_event.zone_id,
            sequence=new_event.sequence,
            event_timestamp=new_event.event_at,
            received_at=new_event.received_at,
            measurements=new_event.measurements or normalized_measurements,
            unit_system=payload.unit_system,
            duplicate=False,
            status="accepted",
            metadata=new_event.metadata_payload,
        )
