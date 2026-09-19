"""
Domain Exceptions and Standard Error Response Envelopes
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class FarmOpsException(HTTPException):
    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        detail: Any = "Bad Request",
        code: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code or self._default_code_for_status(status_code)

    @staticmethod
    def _default_code_for_status(status_code: int) -> str:
        if status_code == 401:
            return "AUTHENTICATION_REQUIRED"
        elif status_code == 403:
            return "FORBIDDEN"
        elif status_code == 404:
            return "NOT_FOUND"
        elif status_code == 422:
            return "UNPROCESSABLE_ENTITY"
        elif status_code == 503:
            return "SERVICE_UNAVAILABLE"
        return "BAD_REQUEST"


class EntityNotFoundException(FarmOpsException):
    def __init__(self, entity_name: str, entity_id: Any):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity_name} with id '{entity_id}' was not found.",
            code="NOT_FOUND",
        )


class AuthenticationFailedException(FarmOpsException):
    def __init__(self, detail: str = "Valid authentication is required", code: str = "AUTHENTICATION_REQUIRED"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            code=code,
            headers={"WWW-Authenticate": "Bearer"},
        )


class PermissionDeniedException(FarmOpsException):
    def __init__(self, detail: str = "You do not have permission to perform this action", code: str = "FORBIDDEN"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code=code,
        )


class TelemetryIngestException(FarmOpsException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Telemetry ingestion error: {detail}",
            code="TELEMETRY_INGESTION_ERROR",
        )


class AIProviderException(FarmOpsException):
    def __init__(self, detail: str, code: Optional[str] = None, status_code: int = status.HTTP_502_BAD_GATEWAY):
        super().__init__(
            status_code=status_code,
            detail=detail,
            code=code or "AI_PROVIDER_ERROR",
        )
