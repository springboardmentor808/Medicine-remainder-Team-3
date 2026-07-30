"""
PillSync Alembic Migration Environment.

Configured for SQLAlchemy migrations against PostgreSQL database.
Auto-discovers all models via app.models barrel import.
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool

from alembic import context

# --- Alembic Config object ---
config = context.config

# --- Logging setup ---
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- Import all models so Alembic can detect them ---
from app.core.database import Base
from app.models import user, medicine, schedule, caregiver_patient  # noqa: F401

target_metadata = Base.metadata

# --- Override sqlalchemy.url with sync PostgreSQL URL from app settings ---
from app.core.config import settings

config.set_main_option("sqlalchemy.url", settings.POSTGRES_URL_SYNC)


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode — generates SQL scripts
    without connecting to the database.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode using standard synchronous engine.
    Uses psycopg2 driver which is stable and reliable for schema DDL operations.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
