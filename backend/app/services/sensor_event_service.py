"""
Sensor Event Ingestion and Time-Series Query Service
Guarantees deduplication across (device_id, sequence) unique constraints.
"""

from typing import List, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sensor_event import SensorEvent
from app.models.device import Device
from app.schemas.sensor_event import SensorEventIngest, SensorEventFilter
from app.core.logging import logger


class SensorEventService:
    @staticmethod
    async def ingest_event(
        session: AsyncSession,
        farm_id: str,
        payload: SensorEventIngest,
    ) -> SensorEvent:
        # Check if device exists or look up by ID
        query = select(Device).where(Device.id == payload.device_id)
        res = await session.execute(query)
        device = res.scalar_one_or_none()

        now_utc = datetime.now(timezone.utc)

        if not device:
            # Auto-register device under farm if ID was not found
            device = Device(
                id=payload.device_id,
                farm_id=farm_id,
                zone_id=payload.zone_id,
                device_type="soil_sensor" if "moisture" in payload.metric else "weather_station",
                last_seen_at=now_utc,
                enabled=True,
            )
            session.add(device)
            await session.commit()
            logger.info(f"Auto-registered device: {device.id} on farm {farm_id}")
        else:
            device.last_seen_at = now_utc
            await session.commit()

        # Check for sequence deduplication
        dup_query = select(SensorEvent).where(
            SensorEvent.device_id == payload.device_id,
            SensorEvent.sequence == payload.sequence,
        )
        dup_res = await session.execute(dup_query)
        existing_event = dup_res.scalar_one_or_none()

        is_duplicate = existing_event is not None
        is_delayed = (now_utc - payload.event_at) > timedelta(minutes=15)

        if is_duplicate:
            logger.warning(f"Duplicate sensor event dropped: device {payload.device_id}, sequence {payload.sequence}")
            return existing_event

        event = SensorEvent(
            device_id=payload.device_id,
            farm_id=farm_id,
            zone_id=payload.zone_id or device.zone_id,
            metric=payload.metric,
            value=payload.value,
            unit=payload.unit,
            event_at=payload.event_at,
            received_at=now_utc,
            sequence=payload.sequence,
            quality=payload.quality,
            source=payload.source,
            correlation_id=payload.correlation_id,
            schema_version=payload.schema_version,
            is_duplicate=is_duplicate,
            is_delayed=is_delayed,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)

        return event

    @staticmethod
    async def ingest_batch(
        session: AsyncSession,
        farm_id: str,
        events: List[SensorEventIngest],
    ) -> List[SensorEvent]:
        ingested: List[SensorEvent] = []
        for e in events:
            event = await SensorEventService.ingest_event(session, farm_id, e)
            ingested.append(event)
        return ingested

    @staticmethod
    async def query_events(
        session: AsyncSession,
        filter_params: SensorEventFilter,
    ) -> List[SensorEvent]:
        query = select(SensorEvent).where(SensorEvent.farm_id == filter_params.farm_id)
        if filter_params.zone_id:
            query = query.where(SensorEvent.zone_id == filter_params.zone_id)
        if filter_params.device_id:
            query = query.where(SensorEvent.device_id == filter_params.device_id)
        if filter_params.metric:
            query = query.where(SensorEvent.metric == filter_params.metric)
        if filter_params.start_time:
            query = query.where(SensorEvent.event_at >= filter_params.start_time)
        if filter_params.end_time:
            query = query.where(SensorEvent.event_at <= filter_params.end_time)

        query = (
            query.order_by(desc(SensorEvent.event_at))
            .offset(getattr(filter_params, "offset", 0) or 0)
            .limit(filter_params.limit)
        )
        res = await session.execute(query)
        return list(res.scalars().all())
