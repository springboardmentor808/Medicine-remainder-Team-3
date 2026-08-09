"""
PillSync Core Configuration Module.

Centralized application settings loaded exclusively from environment variables
via Pydantic BaseSettings. Zero hardcoded credentials.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


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

    # --- JWT Authentication ---
    SECRET_KEY: str = "CHANGE-THIS-IN-PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- CORS ---
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

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

    # --- MongoDB (Future: OCR metadata) ---
    MONGO_URL: str = "mongodb://localhost:27017/med_db"

    # --- Redis (Sessions & Cache) ---
    REDIS_URL: str = "redis://localhost:6379/0"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


# Singleton settings instance — import this across the application
settings = Settings()
