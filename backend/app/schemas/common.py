"""
Common Pydantic v2 Schemas and Generic Response Envelopes
"""

from typing import Generic, TypeVar, Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(from_attributes=True)

    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
    # Pagination / cursor / freshness metadata for list endpoints.
    meta: Optional[Dict[str, Any]] = None
    # Present only on failures, mirroring the error envelope the exception
    # handlers emit, so clients can read one shape on every response.
    error: Optional[Dict[str, Any]] = None


class PaginatedResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(from_attributes=True)

    items: List[T]
    total: int
    page: int = Field(ge=1, default=1)
    page_size: int = Field(ge=1, le=100, default=20)


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    environment: str
    mqtt: Optional[dict] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

