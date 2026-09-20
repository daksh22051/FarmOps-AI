from functools import lru_cache
from starlette.concurrency import run_in_threadpool
"""
Supabase Auth, JWT Verification, Role-Based and Farm-Scoped Authorization
Cryptographically verifies JWT tokens, resolves user profiles, and enforces farm-scoped permissions.
"""

from typing import Optional, Dict, Any, List, Union
import jwt
from jwt.exceptions import PyJWTError, ExpiredSignatureError
from fastapi import Depends, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_db
from app.core.exceptions import (
    AuthenticationFailedException,
    PermissionDeniedException,
    EntityNotFoundException,
)
from app.core.logging import logger
from app.models.enums import UserRole
from app.models.profile import Profile
from app.models.farm import Farm, FarmMembership, Zone
from app.models.device import Device
from app.models.risk import RiskAssessment
from app.models.plan import ActionPlan
from app.models.task import Task
from app.models.alert import Alert
from app.models.escalation import Escalation
from app.services.profile_service import ProfileService

security_scheme = HTTPBearer(auto_error=False)


class AuthUser:
    """Represents an authenticated, verified Supabase user context."""

    def __init__(
        self,
        id: str,
        email: Optional[str] = None,
        role: str = "viewer",
        user_metadata: Optional[Dict[str, Any]] = None,
        app_metadata: Optional[Dict[str, Any]] = None,
        claims: Optional[Dict[str, Any]] = None,
        profile: Optional[Profile] = None,
    ):
        self.id = id
        self.user_id = id
        self.email = email
        self.role = UserRole.from_str(role).value
        self.user_metadata = user_metadata or {}
        self.app_metadata = app_metadata or {}
        self.claims = claims or {}
        self.profile = profile

    @property
    def is_authenticated(self) -> bool:
        return bool(self.id)

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN.value


@lru_cache(maxsize=4)
def _jwks_client(base_url: str):
    return jwt.PyJWKClient(f"{base_url}/auth/v1/.well-known/jwks.json", lifespan=300, timeout=10)


def decode_supabase_token(token: str) -> Dict[str, Any]:
    """Verify signatures and expiry; never trust unverified claims as a fallback."""
    if not token or not isinstance(token, str):
        raise AuthenticationFailedException(detail="Valid authentication is required", code="AUTHENTICATION_REQUIRED")
    try:
        token = token.strip()
        algorithm = jwt.get_unverified_header(token).get("alg")
        options = {"verify_aud": False, "require": ["sub", "exp"]}
        if algorithm == "HS256":
            secret = settings.SUPABASE_JWT_SECRET
            if not secret:
                raise ValueError("JWT signing secret is not configured")
            payload = jwt.decode(token, secret, algorithms=["HS256"], options=options)
        elif algorithm in {"RS256", "ES256"}:
            base_url = settings.SUPABASE_URL.rstrip("/")
            if not base_url:
                raise ValueError("Supabase URL is not configured")
            key = _jwks_client(base_url).get_signing_key_from_jwt(token).key
            payload = jwt.decode(token, key, algorithms=[algorithm],
                                 issuer=f"{base_url}/auth/v1", options=options)
        else:
            raise ValueError("Unsupported signing algorithm")
        if not payload.get("sub"):
            raise ValueError("Missing subject")
        return payload
    except ExpiredSignatureError:
        raise AuthenticationFailedException(detail="Token has expired", code="AUTHENTICATION_REQUIRED")
    except (PyJWTError, ValueError):
        raise AuthenticationFailedException(detail="Valid authentication is required", code="AUTHENTICATION_REQUIRED")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> AuthUser:
    """
    FastAPI dependency to extract, authenticate, and normalize the current Supabase user.
    Loads or initializes user profile safely.
    """
    if not credentials or not credentials.credentials:
        raise AuthenticationFailedException(
            detail="Valid authentication is required",
            code="AUTHENTICATION_REQUIRED",
        )

    token = credentials.credentials
    payload = await run_in_threadpool(decode_supabase_token, token)
    user_id = payload["sub"]

    # Load profile from database or safely initialize default profile
    profile = await ProfileService.get_or_create_profile(
        db=db,
        user_id=user_id,
        email=payload.get("email"),
        user_metadata=payload.get("user_metadata", {}),
        role=payload.get("role") or (payload.get("app_metadata", {}).get("role")),
    )

    # Active role: verified database profile role takes precedence, else fallback to claims
    active_role = profile.role if profile else UserRole.from_str(payload.get("role", "viewer")).value

    return AuthUser(
        id=user_id,
        email=payload.get("email"),
        role=active_role,
        user_metadata=payload.get("user_metadata", {}),
        app_metadata=payload.get("app_metadata", {}),
        claims=payload,
        profile=profile,
    )


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[AuthUser]:
    """
    FastAPI dependency that returns the authenticated user if token is provided and valid, else None.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials=credentials, db=db)
    except AuthenticationFailedException:
        return None


def require_role(*allowed_roles: Union[UserRole, str]):
    """
    Dependency factory to enforce system/global user roles.
    ADMIN role is automatically permitted.
    """
    target_roles = {UserRole.from_str(r).value if isinstance(r, str) else r.value for r in allowed_roles}
    target_roles.add(UserRole.ADMIN.value)

    async def role_checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if user.role not in target_roles:
            logger.warning(f"User '{user.id}' with role '{user.role}' denied. Required: {target_roles}")
            raise PermissionDeniedException(
                detail="You do not have permission to perform this action",
                code="FORBIDDEN",
            )
        return user

    return role_checker


# ==============================================================================
# FARM-SCOPED AUTHORIZATION & MEMBERSHIP ACCESS HELPERS
# ==============================================================================

async def get_user_farm_role(
    db: AsyncSession,
    farm_id: str,
    user_id: str,
    farm: Optional[Farm] = None,
) -> Optional[str]:
    """
    Resolves the effective role of a user for a specific farm.
    Returns 'owner' if user is farm creator/owner, or the role from farm_memberships.
    """
    # 1. Check direct farm ownership
    if farm is None:
        farm_res = await db.execute(select(Farm).where(Farm.id == farm_id))
        farm = farm_res.scalars().first()
    if not farm:
        return None

    if farm.owner_id == user_id:
        return UserRole.OWNER.value

    # 2. Check farm_memberships table
    mem_res = await db.execute(
        select(FarmMembership).where(
            FarmMembership.farm_id == farm_id,
            FarmMembership.user_id == user_id,
        )
    )
    membership = mem_res.scalars().first()
    if membership:
        return UserRole.from_str(membership.role).value

    return None


async def check_farm_access(
    db: AsyncSession,
    farm_id: str,
    user: AuthUser,
    allowed_roles: Optional[List[str]] = None,
) -> str:
    """
    Checks if a user has access to a farm with optional role constraints.
    Returns the effective role on success, or raises PermissionDeniedException / EntityNotFoundException.
    """
    # 1. ADMIN bypass
    if user.is_admin:
        return UserRole.ADMIN.value

    # 2. Check if farm exists
    farm_res = await db.execute(select(Farm).where(Farm.id == farm_id))
    farm = farm_res.scalars().first()
    if not farm:
        raise EntityNotFoundException("Farm", farm_id)

    # 3. Resolve user's farm role (re-using pre-fetched farm)
    effective_role = await get_user_farm_role(db, farm_id=farm_id, user_id=user.id, farm=farm)
    if not effective_role:
        logger.warning(f"Cross-farm access blocked: User '{user.id}' has no membership in Farm '{farm_id}'.")
        raise PermissionDeniedException(
            detail="You do not have permission to access this farm",
            code="FORBIDDEN",
        )

    # 4. Validate role requirements if specified
    if allowed_roles:
        normalized_allowed = {UserRole.from_str(r).value for r in allowed_roles}
        normalized_allowed.add(UserRole.ADMIN.value)
        if effective_role not in normalized_allowed:
            logger.warning(
                f"User '{user.id}' has role '{effective_role}' in Farm '{farm_id}', but required: {normalized_allowed}"
            )
            raise PermissionDeniedException(
                detail="You do not have permission to perform this action on this farm",
                code="FORBIDDEN",
            )

    return effective_role


async def get_accessible_farm_ids(db: AsyncSession, user: AuthUser) -> Optional[List[str]]:
    """Every farm this user may read, as owner or as a member.

    Returns ``None`` for an admin, meaning "no farm restriction". Collection
    endpoints that accept an optional ``farm_id`` must scope to this list when no
    farm is given, otherwise they return other tenants' rows.
    """
    if user.is_admin:
        return None

    owned = await db.execute(select(Farm.id).where(Farm.owner_id == user.id))
    member_of = await db.execute(
        select(FarmMembership.farm_id).where(FarmMembership.user_id == user.id)
    )
    return list({*owned.scalars().all(), *member_of.scalars().all()})


# ==============================================================================
# RESOURCE-LEVEL AUTHORIZATION HELPERS (RESOLVE RESOURCE -> FARM_ID)
# ==============================================================================

async def verify_farm_access(farm_id: str, db: AsyncSession, user: AuthUser) -> str:
    """Validates farm access for farm_id."""
    return await check_farm_access(db, farm_id, user)


async def verify_zone_access(zone_id: str, db: AsyncSession, user: AuthUser) -> Zone:
    """Resolves Zone and validates user has access to the owning farm."""
    res = await db.execute(select(Zone).where(Zone.id == zone_id))
    zone = res.scalars().first()
    if not zone:
        raise EntityNotFoundException("Zone", zone_id)
    await check_farm_access(db, zone.farm_id, user)
    return zone


async def verify_device_access(device_id: str, db: AsyncSession, user: AuthUser) -> Device:
    """Resolves Device and validates user has access to the owning farm."""
    res = await db.execute(select(Device).where(Device.id == device_id))
    device = res.scalars().first()
    if not device:
        raise EntityNotFoundException("Device", device_id)
    await check_farm_access(db, device.farm_id, user)
    return device


async def verify_risk_access(risk_id: str, db: AsyncSession, user: AuthUser) -> RiskAssessment:
    """Resolves RiskAssessment and validates user has access to the owning farm."""
    res = await db.execute(select(RiskAssessment).where(RiskAssessment.id == risk_id))
    risk = res.scalars().first()
    if not risk:
        raise EntityNotFoundException("RiskAssessment", risk_id)
    await check_farm_access(db, risk.farm_id, user)
    return risk


async def verify_plan_access(plan_id: str, db: AsyncSession, user: AuthUser) -> ActionPlan:
    """Resolves ActionPlan and validates user has access to the owning farm."""
    res = await db.execute(select(ActionPlan).where(ActionPlan.id == plan_id))
    plan = res.scalars().first()
    if not plan:
        raise EntityNotFoundException("ActionPlan", plan_id)
    await check_farm_access(db, plan.farm_id, user)
    return plan


async def verify_task_access(task_id: str, db: AsyncSession, user: AuthUser) -> Task:
    """Resolves Task and validates user has access to the owning farm."""
    res = await db.execute(select(Task).where(Task.id == task_id))
    task = res.scalars().first()
    if not task:
        raise EntityNotFoundException("Task", task_id)
    await check_farm_access(db, task.farm_id, user)
    return task


async def verify_alert_access(alert_id: str, db: AsyncSession, user: AuthUser) -> Alert:
    """Resolves Alert and validates user has access to the owning farm."""
    res = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = res.scalars().first()
    if not alert:
        raise EntityNotFoundException("Alert", alert_id)
    await check_farm_access(db, alert.farm_id, user)
    return alert


async def verify_escalation_access(escalation_id: str, db: AsyncSession, user: AuthUser) -> Escalation:
    """Resolves Escalation and validates user has access to the owning farm."""
    res = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    esc = res.scalars().first()
    if not esc:
        raise EntityNotFoundException("Escalation", escalation_id)
    await check_farm_access(db, esc.farm_id, user)
    return esc
