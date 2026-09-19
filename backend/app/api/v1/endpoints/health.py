"""
Health check and diagnostic endpoints for FarmOps AI
"""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.core.database import get_db
from app.core.logging import logger
from app.mqtt.client import mqtt_worker
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def check_health(db: AsyncSession = Depends(get_db)):
    """
    General system health check endpoint.
    """
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.VERSION,
        database=db_status,
        environment=settings.ENVIRONMENT,
        mqtt=mqtt_worker.get_status(),
    )



@router.get("/health/db")
async def check_database_health(db: AsyncSession = Depends(get_db)):
    """
    Dedicated database connectivity health check.
    Returns 200 if Supabase PostgreSQL is reachable, 503 otherwise.
    Safe against credential exposure.
    """
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        logger.warning(f"Database health check failed: {exc.__class__.__name__}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "error", "database": "disconnected"},
        )
