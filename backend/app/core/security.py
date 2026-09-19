"""
Supabase Auth and JWT Security Layer
Verifies Supabase JWT tokens, extracts claims, and enforces authentication dependencies.
"""

from typing import Optional, Dict, Any
import jwt
from jwt.exceptions import PyJWTError, ExpiredSignatureError
from fastapi import Depends, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.core.exceptions import AuthenticationFailedException, PermissionDeniedException
from app.core.logging import logger

security_scheme = HTTPBearer(auto_error=False)


class AuthUser:
    """Represents an authenticated Supabase user."""

    def __init__(
        self,
        id: str,
        email: Optional[str] = None,
        role: str = "authenticated",
        user_metadata: Optional[Dict[str, Any]] = None,
        app_metadata: Optional[Dict[str, Any]] = None,
    ):
        self.id = id
        self.email = email
        self.role = role
        self.user_metadata = user_metadata or {}
        self.app_metadata = app_metadata or {}

    @property
    def is_authenticated(self) -> bool:
        return bool(self.id)


def decode_supabase_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a Supabase Auth JWT token.
    Supports secret verification with HS256 or unverified claims extraction for testing.
    """
    try:
        # In production/normal mode, decode with secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[settings.SUPABASE_JWT_ALGORITHM],
            options={"verify_aud": False},  # Supabase uses 'authenticated' audience
        )
        return payload
    except ExpiredSignatureError:
        raise AuthenticationFailedException(detail="Token has expired")
    except PyJWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        # In development mode, if secret is default, check for mock dev token format
        if settings.ENVIRONMENT == "development" and token.startswith("dev-token-"):
            user_id = token.replace("dev-token-", "")
            return {
                "sub": user_id,
                "email": f"{user_id}@example.com",
                "role": "authenticated",
                "user_metadata": {"name": "Developer"},
            }
        raise AuthenticationFailedException(detail=f"Could not validate credentials: {str(e)}")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> AuthUser:
    """
    FastAPI dependency to extract and authenticate the current Supabase user.
    """
    if not credentials:
        raise AuthenticationFailedException(detail="Authorization header missing")

    token = credentials.credentials
    payload = decode_supabase_token(token)

    sub: Optional[str] = payload.get("sub")
    if not sub:
        raise AuthenticationFailedException(detail="Token payload missing subject identifier")

    return AuthUser(
        id=sub,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
        user_metadata=payload.get("user_metadata", {}),
        app_metadata=payload.get("app_metadata", {}),
    )


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Optional[AuthUser]:
    """
    FastAPI dependency that returns the authenticated user if token is provided, else None.
    """
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except AuthenticationFailedException:
        return None
