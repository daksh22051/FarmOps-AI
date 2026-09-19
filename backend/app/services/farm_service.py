"""
Farm, Zone, and FarmMembership Management Service
"""

from typing import List, Optional, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.farm import Farm, FarmMembership, Zone
from app.schemas.farm import (
    FarmCreate,
    FarmUpdate,
    ZoneCreate,
    FarmMembershipCreate,
)
from app.core.exceptions import EntityNotFoundException, FarmOpsException


class FarmService:
    @staticmethod
    async def create_farm(session: AsyncSession, owner_id: str, data: FarmCreate) -> Farm:
        """
        Creates a new farm with the authenticated user as owner and creates owner membership.
        """
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
    async def get_farms(
        session: AsyncSession,
        user_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Farm], int]:
        """
        Lists farms accessible to user with pagination.
        Returns (farms, total_count).
        """
        base_query = select(Farm)
        if user_id:
            # Query farms owned by user or where user is a member
            base_query = base_query.where(
                (Farm.owner_id == user_id)
                | Farm.id.in_(
                    select(FarmMembership.farm_id).where(FarmMembership.user_id == user_id)
                )
            )

        # Count total
        count_query = select(func.count()).select_from(base_query.subquery())
        total_count = (await session.execute(count_query)).scalar_one()

        # Paginate results
        offset = max(0, (page - 1) * page_size)
        paginated_query = (
            base_query.options(
                selectinload(Farm.zones),
                selectinload(Farm.memberships),
                selectinload(Farm.devices),
            )
            .order_by(Farm.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await session.execute(paginated_query)
        farms = list(result.scalars().all())
        return farms, total_count

    @staticmethod
    async def get_farm(session: AsyncSession, farm_id: str) -> Farm:
        """Retrieves a single farm by ID."""
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
        """Applies partial updates to a farm."""
        farm = await FarmService.get_farm(session, farm_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(farm, key, value)
        await session.commit()
        await session.refresh(farm)
        return farm

    @staticmethod
    async def delete_farm(session: AsyncSession, farm_id: str) -> bool:
        """Deletes a farm."""
        farm = await FarmService.get_farm(session, farm_id)
        await session.delete(farm)
        await session.commit()
        return True

    # --- MEMBERSHIPS ---
    @staticmethod
    async def add_membership(session: AsyncSession, farm_id: str, data: FarmMembershipCreate) -> FarmMembership:
        """Adds membership for a user on a farm."""
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
        """Lists memberships for a farm."""
        query = select(FarmMembership).where(FarmMembership.farm_id == farm_id)
        result = await session.execute(query)
        return list(result.scalars().all())
