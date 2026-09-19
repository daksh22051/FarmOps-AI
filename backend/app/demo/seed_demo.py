"""
Demo Infrastructure Seeding Service
Idempotently creates or resolves demo farm, zone, and sensor device.
"""

from typing import Tuple, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.farm import Farm, Zone
from app.models.device import Device
from app.core.logging import logger


async def seed_or_get_demo_infrastructure(
    session: AsyncSession,
    owner_id: str,
    farm_name: str = "Demo Autonomous Farm",
    zone_name: str = "Demo Sector Alpha",
    device_name: str = "Demo Moisture Node 01",
) -> Tuple[Farm, Zone, Device]:
    """
    Idempotently resolves or creates a dedicated demo farm, zone, and telemetry device.
    Preserves all existing user records and prevents duplicate demo infrastructure sprawl.
    """
    # 1. Resolve or create Demo Farm
    farm_query = select(Farm).where(
        Farm.owner_id == owner_id,
        Farm.name == farm_name,
    )
    res = await session.execute(farm_query)
    farm = res.scalars().first()

    if not farm:
        farm = Farm(
            name=farm_name,
            owner_id=owner_id,
            location="Salinas Valley Demo Grid",
            timezone="America/Los_Angeles",
            total_area=120.0,
            crop_profile={"primary_crop": "Romaine Lettuce", "variety": "Crisp"},
            is_demo=True,
        )
        session.add(farm)
        await session.flush()
        logger.info(f"Created demo farm: {farm.id} ('{farm.name}')")

    # 2. Resolve or create Demo Zone
    zone_query = select(Zone).where(
        Zone.farm_id == farm.id,
        Zone.name == zone_name,
    )
    res = await session.execute(zone_query)
    zone = res.scalars().first()

    if not zone:
        zone = Zone(
            farm_id=farm.id,
            name=zone_name,
            crop="Romaine Lettuce",
            crop_stage="vegetative",
            soil_type="Sandy Loam",
            area=25.0,
            status="active",
            is_demo=True,
        )
        session.add(zone)
        await session.flush()
        logger.info(f"Created demo zone: {zone.id} ('{zone.name}')")

    # 3. Resolve or create Demo Device
    device_query = select(Device).where(
        Device.farm_id == farm.id,
        Device.zone_id == zone.id,
        Device.device_type == "soil_sensor",
    )
    res = await session.execute(device_query)
    device = res.scalars().first()

    if not device:
        device = Device(
            farm_id=farm.id,
            zone_id=zone.id,
            device_type="soil_sensor",
            enabled=True,
            calibration={"depth_cm": 15, "calibration_offset": 0.0},
        )
        session.add(device)
        await session.flush()
        logger.info(f"Created demo device: {device.id}")

    await session.commit()
    await session.refresh(farm)
    await session.refresh(zone)
    await session.refresh(device)

    return farm, zone, device
