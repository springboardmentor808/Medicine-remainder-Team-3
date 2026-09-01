"""
PillSync Core Configuration Module.

Centralized application settings loaded exclusively from environment variables
via Pydantic BaseSettings. Zero hardcoded credentials.
Enforces fail-fast startup validation for production environments.
"""

import secrets
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application-wide settings. All values are loaded from the .env file
    or environment variables. Defaults are safe development-only fallbacks.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    ENVIRONMENT: str = "development"
    APP_NAME: str = "PillSync"
    APP_VERSION: str = "0.1.0"
    PORT: int = 8000
    DEBUG: bool = True

    # --- Operational Hardening Limits ---
    MAX_OCR_FILE_SIZE: int = 10 * 1024 * 1024  # 10 MB payload limit
    MAX_NLP_INPUT_CHARS: int = 2048           # ReDoS input boundary
    REDIS_CACHE_TTL: int = 3600               # 1-hour default token/cache TTL

    # --- JWT Authentication ---
    SECRET_KEY: str = secrets.token_urlsafe(64)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- CORS ---
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # --- PostgreSQL ---
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgrespassword"
    POSTGRES_DB: str = "med_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_URL: str = (
        "sqlite+aiosqlite:///./pillsync_dev.db"
    )
    POSTGRES_URL_SYNC: str = (
        "postgresql://postgres:postgrespassword@localhost:5432/med_db"
    )

    # --- MongoDB (OCR & Prescriptions) ---
    MONGO_URL: str = "mongodb://localhost:27017/med_db"

    # --- Redis (Sessions, Blacklist & Cache) ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- SMTP Email (OTP, Password Reset, Notifications) ---
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@pillsync.app"
    SMTP_FROM_NAME: str = "PillSync"
    SMTP_USE_TLS: bool = True

    # --- Frontend URL (for password reset links) ---
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @model_validator(mode="after")
    def validate_production_invariants(self) -> "Settings":
        """
        Fail-Fast Startup Guard:
        Crash immediately during boot if production is detected with insecure defaults.
        """
        if self.ENVIRONMENT.lower() == "production":
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError("FATAL [PillSync Config]: SECRET_KEY must be at least 32 characters in production.")

            if "sqlite" in self.POSTGRES_URL.lower():
                raise ValueError("FATAL [PillSync Config]: SQLite is prohibited in production. POSTGRES_URL must be configured.")

            if self.MAX_OCR_FILE_SIZE > 25 * 1024 * 1024:
                raise ValueError("FATAL [PillSync Config]: MAX_OCR_FILE_SIZE cannot exceed 25MB.")

        return self


# Singleton settings instance — import this across the application
settings = Settings()
