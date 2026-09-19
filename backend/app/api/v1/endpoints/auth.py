"""
Authentication and Current User Profile Endpoints
"""

from fastapi import APIRouter, Depends
from app.core.security import get_current_user, AuthUser
from app.schemas.auth import UserProfile
from app.schemas.common import APIResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me", response_model=APIResponse[UserProfile])
async def get_my_profile(current_user: AuthUser = Depends(get_current_user)):
    """
    Returns the authenticated user details parsed from the Supabase JWT.
    """
    profile = UserProfile(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        user_metadata=current_user.user_metadata,
        app_metadata=current_user.app_metadata,
    )
    return APIResponse(success=True, data=profile)
