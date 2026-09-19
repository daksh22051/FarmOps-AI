"""
FarmOps AI Backend Application Entry Point
FastAPI app initialization, lifespan management, CORS configuration, and route mounting.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.database import engine, is_sqlite
from app.models import Base
from app.api.v1.router import api_v1_router
from app.mqtt.client import mqtt_worker
from app.core.exceptions import FarmOpsException
from app.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info(f"Starting {settings.PROJECT_NAME} (v{settings.VERSION}) in {settings.ENVIRONMENT} mode")

    # In development or testing with sqlite, create tables automatically if needed
    if is_sqlite or settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created.")

    # Start MQTT background worker if enabled
    if settings.MQTT_ENABLED:
        await mqtt_worker.start()

    yield

    # --- Shutdown ---
    logger.info("Shutting down FarmOps AI Backend...")
    if settings.MQTT_ENABLED:
        await mqtt_worker.stop()
    await engine.dispose()
    logger.info("Database engine connections closed.")


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
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail, "data": None},
        headers=exc.headers,
    )


# Unhandled exception handler
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "message": "An unexpected server error occurred.", "data": None},
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
