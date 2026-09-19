"""
Authentication and User Profile Pydantic Schemas
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, EmailStr


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: Optional[str] = None
    role: str = "authenticated"
    user_metadata: Dict[str, Any] = {}
    app_metadata: Dict[str, Any] = {}


class TokenClaims(BaseModel):
    sub: str
    email: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None
