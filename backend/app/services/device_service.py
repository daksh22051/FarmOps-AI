"""
Device Management Domain Service with Cross-Farm Integrity Validation
"""

from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.device import Device
from app.models.farm import Farm, Zone
from app.schemas.device import DeviceCreate, DeviceUpdate
from app.core.exceptions import EntityNotFoundException, FarmOpsException


class DeviceService:
    @staticmethod
    async def create_device(session: AsyncSession, farm_id: str, data: DeviceCreate) -> Device:
        """
        Registers a new device to a farm, ensuring cross-farm zone attachment is rejected.
        """
        # 1. Verify Farm exists
        farm_res = await session.execute(select(Farm).where(Farm.id == farm_id))
        farm = farm_res.scalars().first()
        if not farm:
            raise EntityNotFoundException("Farm", farm_id)

        # 2. Verify Zone belongs to the same farm if provided
        if data.zone_id:
            zone_res = await session.execute(select(Zone).where(Zone.id == data.zone_id))
            zone = zone_res.scalars().first()
            if not zone:
                raise EntityNotFoundException("Zone", data.zone_id)
            if zone.farm_id != farm_id:
                raise FarmOpsException(
                    status_code=422,
                    detail=f"Zone '{data.zone_id}' belongs to another farm and cannot be attached to farm '{farm_id}'.",
                )

        calib = dict(data.calibration or {})
        if data.is_demo or farm.is_demo:
            calib["is_demo"] = True

        device = Device(
            farm_id=farm_id,
            zone_id=data.zone_id,
            device_type=data.device_type,
            calibration=calib,
            credential_reference=data.credential_reference,
            enabled=data.enabled,
            last_seen_at=None,
        )
        session.add(device)
        await session.commit()
        await session.refresh(device)
        return device

    @staticmethod
    async def get_device(session: AsyncSession, device_id: str) -> Device:
        """Retrieves a device by ID."""
        query = select(Device).where(Device.id == device_id)
        result = await session.execute(query)
        device = result.scalar_one_or_none()
        if not device:
            raise EntityNotFoundException("Device", device_id)
        return device

    @staticmethod
    async def get_devices(session: AsyncSession, farm_id: str, zone_id: Optional[str] = None) -> List[Device]:
        """Lists devices within a farm, optionally filtered by zone."""
        query = select(Device).where(Device.farm_id == farm_id)
        if zone_id:
            query = query.where(Device.zone_id == zone_id)
        result = await session.execute(query.order_by(Device.created_at.desc()))
        return list(result.scalars().all())

    @staticmethod
    async def update_device(session: AsyncSession, device_id: str, data: DeviceUpdate) -> Device:
        """
        Applies partial updates to a device, validating zone ownership if changed.
        """
        device = await DeviceService.get_device(session, device_id)
        update_dict = data.model_dump(exclude_unset=True)

        if "zone_id" in update_dict and update_dict["zone_id"] is not None:
            zone_id = update_dict["zone_id"]
            zone_res = await session.execute(select(Zone).where(Zone.id == zone_id))
            zone = zone_res.scalars().first()
            if not zone:
                raise EntityNotFoundException("Zone", zone_id)
            if zone.farm_id != device.farm_id:
                raise FarmOpsException(
                    status_code=422,
                    detail=f"Zone '{zone_id}' belongs to another farm and cannot be attached to this device.",
                )

        if "is_demo" in update_dict:
            calib = dict(device.calibration or {})
            calib["is_demo"] = bool(update_dict.pop("is_demo"))
            device.calibration = calib

        for key, value in update_dict.items():
            setattr(device, key, value)

        await session.commit()
        await session.refresh(device)
        return device

    @staticmethod
    async def get_by_credential_ref(session: AsyncSession, credential_ref: str) -> Optional[Device]:
        """Finds device by hardware credential reference."""
        query = select(Device).where(Device.credential_reference == credential_ref)
        result = await session.execute(query)
        return result.scalar_one_or_none()
