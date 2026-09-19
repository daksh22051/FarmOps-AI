"""
User Profile Domain Service
Manages loading and safe synchronization of user profiles from Supabase Auth identity.
"""

from typing import Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.profile import Profile
from app.models.enums import UserRole
from app.core.logging import logger


class ProfileService:
    @staticmethod
    async def get_profile(db: AsyncSession, user_id: str) -> Optional[Profile]:
        """Fetches profile by user ID."""
        result = await db.execute(select(Profile).where(Profile.id == user_id))
        return result.scalars().first()

    @staticmethod
    async def get_or_create_profile(
        db: AsyncSession,
        user_id: str,
        email: Optional[str] = None,
        full_name: Optional[str] = None,
        role: Optional[str] = None,
        user_metadata: Optional[Dict[str, Any]] = None,
    ) -> Profile:
        """
        Loads user profile from database, or safely initializes a record if none exists.
        Never automatically grants ADMIN role.
        """
        profile = await ProfileService.get_profile(db, user_id)
        if profile:
            return profile

        # Determine safe role from input / metadata, defaulting to farmer / viewer
        assigned_role = UserRole.from_str(role or (user_metadata or {}).get("role", "farmer")).value
        if assigned_role == UserRole.ADMIN.value:
            # Only allow ADMIN if explicitly flagged in app_metadata/trusted source, else downgrade to viewer
            assigned_role = UserRole.VIEWER.value

        resolved_name = full_name or (user_metadata or {}).get("full_name") or (user_metadata or {}).get("name")

        new_profile = Profile(
            id=user_id,
            email=email,
            full_name=resolved_name,
            role=assigned_role,
            preferences=user_metadata or {},
        )
        try:
            db.add(new_profile)
            await db.commit()
            await db.refresh(new_profile)
            logger.info(f"Initialized new profile for user '{user_id}' with role '{assigned_role}'.")
            return new_profile
        except Exception as exc:
            await db.rollback()
            logger.warning(f"Could not persist new profile for '{user_id}': {exc}. Returning in-memory instance.")
            return new_profile
