"""
FarmOps AI Backend Configuration
Uses Pydantic v2 Settings to parse environment variables from .env or OS environment.
"""

from typing import List, Union
from pydantic import Field, field_validator
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

    # Supabase PostgreSQL Database (Async)
    # Default to a local SQLite async URL if DATABASE_URL is not set (convenient for local dev/testing)
    DATABASE_URL: str = "sqlite+aiosqlite:///./farmops.db"
    DATABASE_DIRECT_URL: str = "sqlite:///./farmops.db"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    # Supabase Auth
    SUPABASE_URL: str = "https://example.supabase.co"
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = "dev-insecure-jwt-secret-change-me"
    SUPABASE_JWT_ALGORITHM: str = "HS256"

    # Google Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # MQTT Broker for IoT Telemetry
    MQTT_ENABLED: bool = False
    MQTT_BROKER_HOST: str = "broker.hivemq.com"
    MQTT_BROKER_PORT: int = 1883
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""
    MQTT_CLIENT_ID: str = "farmops-ai-backend"
    MQTT_TOPIC_PREFIX: str = "farmops"
    MQTT_KEEPALIVE: int = 60


settings = Settings()
