"""
FarmOps AI Backend Configuration
Uses Pydantic v2 Settings to parse environment variables strictly from .env or OS environment.
"""

from typing import List, Union, Optional
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application Info
    PROJECT_NAME: str = "FarmOps AI Backend"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return v

    # Supabase PostgreSQL Database Configuration (Async via asyncpg)
    DATABASE_URL: str = ""
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Union[str, None]) -> str:
        if not v or not isinstance(v, str):
            return ""
        v = v.strip()
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Supabase Credentials
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    
    # Fallback / Aliases
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None
    SUPABASE_JWT_ALGORITHM: str = "HS256"

    @model_validator(mode="after")
    def populate_supabase_keys(self) -> "Settings":
        # Resolve publishable key
        if not self.SUPABASE_PUBLISHABLE_KEY and self.SUPABASE_ANON_KEY:
            self.SUPABASE_PUBLISHABLE_KEY = self.SUPABASE_ANON_KEY
        # Resolve secret key
        if not self.SUPABASE_SECRET_KEY and self.SUPABASE_SERVICE_ROLE_KEY:
            self.SUPABASE_SECRET_KEY = self.SUPABASE_SERVICE_ROLE_KEY
        elif not self.SUPABASE_SECRET_KEY and self.SUPABASE_JWT_SECRET:
            self.SUPABASE_SECRET_KEY = self.SUPABASE_JWT_SECRET

        if not self.SUPABASE_JWT_SECRET:
            self.SUPABASE_JWT_SECRET = self.SUPABASE_SECRET_KEY or "farmops-default-jwt-secret-key-32-chars-min"
        return self

    @property
    def is_database_configured(self) -> bool:
        return bool(self.DATABASE_URL and not self.DATABASE_URL.startswith("sqlite"))

    # Google Gemini API (Multi-Agent Orchestration)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # MQTT Broker (IoT Telemetry Ingestion)
    MQTT_ENABLED: bool = False
    MQTT_BROKER_HOST: str = "broker.hivemq.com"
    MQTT_BROKER_PORT: int = 1883
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""
    MQTT_CLIENT_ID: str = "farmops-ai-backend"
    MQTT_TOPIC_PREFIX: str = "farmops"
    MQTT_KEEPALIVE: int = 60


settings = Settings()
