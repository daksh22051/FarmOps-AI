"""
FarmOps AI Backend Application Entry Point
FastAPI app initialization, lifespan management, CORS configuration, and route mounting.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core import database
from app.api.v1.router import api_v1_router
from app.mqtt.client import mqtt_worker
from app.core.exceptions import FarmOpsException
from app.core.logging import logger
import sys
import socket

# Windows asyncio workaround: silence WinError 10054 when browser closes connection / refreshes page
if sys.platform == "win32":
    try:
        from asyncio.proactor_events import _ProactorBasePipeTransport

        _orig_call_connection_lost = _ProactorBasePipeTransport._call_connection_lost

        def _silenced_call_connection_lost(self, exc):
            try:
                _orig_call_connection_lost(self, exc)
            except (ConnectionResetError, OSError):
                pass

        _ProactorBasePipeTransport._call_connection_lost = _silenced_call_connection_lost
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info(f"Starting {settings.PROJECT_NAME} (v{settings.VERSION}) in {settings.ENVIRONMENT} mode")

    if settings.is_database_configured:
        logger.info("Supabase PostgreSQL configuration detected.")

    # Start MQTT background worker if enabled
    if settings.MQTT_ENABLED:
        await mqtt_worker.start()

    yield

    # --- Shutdown ---
    logger.info("Shutting down FarmOps AI Backend...")
    if settings.MQTT_ENABLED:
        await mqtt_worker.stop()
    if database._engine is not None:
        await database._engine.dispose()
        logger.info("Database engine connection pool disposed.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Autonomous Multi-Agent Agricultural Operations Backend API for FarmOps AI.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom domain exception handler
@app.exception_handler(FarmOpsException)
async def farmops_exception_handler(request: Request, exc: FarmOpsException):
    error_code = getattr(exc, "code", "ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "data": None,
            "error": {
                "code": error_code,
                "message": exc.detail,
            },
        },
        headers=exc.headers,
    )


# Unhandled exception handler
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An unexpected server error occurred.",
            "data": None,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred.",
            },
        },
    )


# Mount API v1
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/health", tags=["Root"])
async def root_health():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "mqtt": mqtt_worker.get_status(),
    }

