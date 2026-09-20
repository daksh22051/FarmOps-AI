"""
Zone Domain Service
Manages Zone lifecycle, area validation against parent farm, and spatial boundaries.
"""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.farm import Farm, Zone
from app.schemas.farm import ZoneCreate, ZoneUpdate
from app.core.exceptions import EntityNotFoundException, FarmOpsException


class ZoneService:
    @staticmethod
    async def create_zone(session: AsyncSession, farm_id: str, data: ZoneCreate) -> Zone:
        """
        Creates a new zone in the designated farm with area cross-validation.
        """
        farm_res = await session.execute(select(Farm).where(Farm.id == farm_id))
        farm = farm_res.scalars().first()
        if not farm:
            raise EntityNotFoundException("Farm", farm_id)

        # Validate that zone area does not exceed farm total area
        if data.area is not None and farm.total_area is not None:
            if data.area > farm.total_area:
                raise FarmOpsException(
                    status_code=422,
                    detail=f"Zone area ({data.area} {data.area_unit}) cannot exceed farm total area ({farm.total_area} {farm.area_unit}).",
                )

        zone = Zone(
            farm_id=farm_id,
            name=data.name,
            area=data.area,
            area_unit=data.area_unit,
            geometry=data.geometry,
            crop=data.crop,
            crop_stage=data.crop_stage,
            soil_type=data.soil_type,
            status=data.status,
            is_demo=data.is_demo,
        )
        session.add(zone)
        await session.commit()
        await session.refresh(zone)
        return zone

    @staticmethod
    async def get_zones(session: AsyncSession, farm_id: str) -> List[Zone]:
        """Lists all zones for a farm."""
        query = (
            select(Zone)
            .options(selectinload(Zone.devices))
            .where(Zone.farm_id == farm_id)
            .order_by(Zone.created_at.desc())
        )
        result = await session.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_zone(session: AsyncSession, zone_id: str) -> Zone:
        """Retrieves a single zone by ID."""
        query = select(Zone).options(selectinload(Zone.devices)).where(Zone.id == zone_id)
        result = await session.execute(query)
        zone = result.scalar_one_or_none()
        if not zone:
            raise EntityNotFoundException("Zone", zone_id)
        return zone

    @staticmethod
    async def update_zone(session: AsyncSession, zone_id: str, data: ZoneUpdate) -> Zone:
        """Applies partial updates to a zone with area consistency checks."""
        zone = await ZoneService.get_zone(session, zone_id)

        update_dict = data.model_dump(exclude_unset=True)

        if "area" in update_dict and update_dict["area"] is not None:
            farm_res = await session.execute(select(Farm).where(Farm.id == zone.farm_id))
            farm = farm_res.scalars().first()
            if farm and farm.total_area is not None:
                if update_dict["area"] > farm.total_area:
                    raise FarmOpsException(
                        status_code=422,
                        detail=f"Zone area ({update_dict['area']}) cannot exceed farm total area ({farm.total_area}).",
                    )

        for key, value in update_dict.items():
            setattr(zone, key, value)

        await session.commit()
        await session.refresh(zone)
        return zone

    @staticmethod
    async def delete_zone(session: AsyncSession, zone_id: str) -> None:
        """Deletes a zone by ID."""
        zone = await ZoneService.get_zone(session, zone_id)
        await session.delete(zone)
        await session.commit()
