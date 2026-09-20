"""
Aggregates and mounts all v1 API endpoints for the FarmOps AI Backend
"""

from fastapi import APIRouter
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.farms import router as farms_router
from app.api.v1.endpoints.zones import router as zones_router
from app.api.v1.endpoints.devices import router as devices_router
from app.api.v1.endpoints.telemetry import router as telemetry_router
from app.api.v1.endpoints.risks import router as risks_router
from app.api.v1.endpoints.plans import router as plans_router
from app.api.v1.endpoints.tasks import router as tasks_router
from app.api.v1.endpoints.alerts import router as alerts_router
from app.api.v1.endpoints.escalations import router as escalations_router
from app.api.v1.endpoints.observations import router as observations_router
from app.api.v1.endpoints.ai import router as ai_router
from app.api.v1.endpoints.audit import router as audit_router
from app.api.v1.endpoints.demo import router as demo_router

api_v1_router = APIRouter()
api_v1_router.include_router(dashboard_router)

api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(farms_router)
api_v1_router.include_router(zones_router)
api_v1_router.include_router(devices_router)
api_v1_router.include_router(telemetry_router)
api_v1_router.include_router(observations_router)
api_v1_router.include_router(risks_router)
api_v1_router.include_router(ai_router)
api_v1_router.include_router(plans_router)
api_v1_router.include_router(tasks_router)
api_v1_router.include_router(alerts_router)
api_v1_router.include_router(escalations_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(demo_router)
