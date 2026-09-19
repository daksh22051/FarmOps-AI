"""
Farm, Zone, and FarmMembership Management Service
"""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.farm import Farm, FarmMembership, Zone
from app.schemas.farm import (
    FarmCreate,
    FarmUpdate,
    ZoneCreate,
    ZoneUpdate,
    FarmMembershipCreate,
)
from app.core.exceptions import EntityNotFoundException


class FarmService:
    @staticmethod
    async def create_farm(session: AsyncSession, owner_id: str, data: FarmCreate) -> Farm:
        farm = Farm(
            owner_id=owner_id,
            name=data.name,
            location=data.location,
            address=data.address,
            timezone=data.timezone,
            total_area=data.total_area,
            area_unit=data.area_unit,
            boundary_geometry=data.boundary_geometry,
            crop_profile=data.crop_profile,
            policies=data.policies,
            is_demo=data.is_demo,
        )
        session.add(farm)
        await session.commit()
        await session.refresh(farm)

        # Auto-create owner membership
        membership = FarmMembership(
            farm_id=farm.id,
            user_id=owner_id,
            role="owner",
        )
        session.add(membership)
        await session.commit()

        return await FarmService.get_farm(session, farm.id)

    @staticmethod
    async def get_farms(session: AsyncSession, user_id: Optional[str] = None) -> List[Farm]:
        query = (
            select(Farm)
            .options(
                selectinload(Farm.zones),
                selectinload(Farm.memberships),
                selectinload(Farm.devices),
            )
            .order_by(Farm.created_at.desc())
        )
        if user_id:
            # Query farms owned by user or where user is a member
            query = query.where(
                (Farm.owner_id == user_id)
                | Farm.id.in_(
                    select(FarmMembership.farm_id).where(FarmMembership.user_id == user_id)
                )
            )
        result = await session.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_farm(session: AsyncSession, farm_id: str) -> Farm:
        query = (
            select(Farm)
            .options(
                selectinload(Farm.zones),
                selectinload(Farm.memberships),
                selectinload(Farm.devices),
            )
            .where(Farm.id == farm_id)
        )
        result = await session.execute(query)
        farm = result.scalar_one_or_none()
        if not farm:
            raise EntityNotFoundException("Farm", farm_id)
        return farm

    @staticmethod
    async def update_farm(session: AsyncSession, farm_id: str, data: FarmUpdate) -> Farm:
        farm = await FarmService.get_farm(session, farm_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(farm, key, value)
        await session.commit()
        await session.refresh(farm)
        return farm

    @staticmethod
    async def delete_farm(session: AsyncSession, farm_id: str) -> bool:
        farm = await FarmService.get_farm(session, farm_id)
        await session.delete(farm)
        await session.commit()
        return True

    # --- ZONES ---
    @staticmethod
    async def create_zone(session: AsyncSession, farm_id: str, data: ZoneCreate) -> Zone:
        await FarmService.get_farm(session, farm_id)
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
        query = select(Zone).options(selectinload(Zone.devices)).where(Zone.id == zone_id)
        result = await session.execute(query)
        zone = result.scalar_one_or_none()
        if not zone:
            raise EntityNotFoundException("Zone", zone_id)
        return zone

    # --- MEMBERSHIPS ---
    @staticmethod
    async def add_membership(session: AsyncSession, farm_id: str, data: FarmMembershipCreate) -> FarmMembership:
        await FarmService.get_farm(session, farm_id)
        membership = FarmMembership(
            farm_id=farm_id,
            user_id=data.user_id,
            role=data.role,
        )
        session.add(membership)
        await session.commit()
        await session.refresh(membership)
        return membership

    @staticmethod
    async def get_memberships(session: AsyncSession, farm_id: str) -> List[FarmMembership]:
        query = select(FarmMembership).where(FarmMembership.farm_id == farm_id)
        result = await session.execute(query)
        return list(result.scalars().all())
