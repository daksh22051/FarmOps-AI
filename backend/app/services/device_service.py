"""
Device Management Service
"""

from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceUpdate
from app.core.exceptions import EntityNotFoundException


class DeviceService:
    @staticmethod
    async def create_device(session: AsyncSession, farm_id: str, data: DeviceCreate) -> Device:
        device = Device(
            farm_id=farm_id,
            zone_id=data.zone_id,
            device_type=data.device_type,
            calibration=data.calibration,
            credential_reference=data.credential_reference,
            enabled=data.enabled,
            last_seen_at=datetime.now(timezone.utc),
        )
        session.add(device)
        await session.commit()
        await session.refresh(device)
        return device

    @staticmethod
    async def get_device(session: AsyncSession, device_id: str) -> Device:
        query = select(Device).where(Device.id == device_id)
        result = await session.execute(query)
        device = result.scalar_one_or_none()
        if not device:
            raise EntityNotFoundException("Device", device_id)
        return device

    @staticmethod
    async def get_devices(session: AsyncSession, farm_id: str, zone_id: Optional[str] = None) -> List[Device]:
        query = select(Device).where(Device.farm_id == farm_id)
        if zone_id:
            query = query.where(Device.zone_id == zone_id)
        result = await session.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_credential_ref(session: AsyncSession, credential_ref: str) -> Optional[Device]:
        query = select(Device).where(Device.credential_reference == credential_ref)
        result = await session.execute(query)
        return result.scalar_one_or_none()
