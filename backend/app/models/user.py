"""
PillSync User Model.

Stores all registered users (Patients, Caregivers, Admins) with
hashed passwords, role assignments, and profile information.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole:
    """User role constants matching the Pydantic schema enum."""
    PATIENT = "patient"
    CAREGIVER = "caregiver"
    ADMIN = "admin"


USER_ROLE_ENUM = SAEnum(
    "patient", "caregiver", "admin",
    name="user_role",
    create_constraint=True,
)


class User(Base):
    """
    Core user table for PillSync.

    Supports three roles:
    - Patient: manages their own medicines and schedules.
    - Caregiver: monitors assigned patients, receives alerts.
    - Admin: full system access, user management, analytics.
    """

    __tablename__ = "users"

    # --- Primary Key ---
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # --- Auth Fields ---
    username: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False,
    )

    # --- Profile ---
    full_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
    )
    phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )

    # --- Role & Status ---
    role: Mapped[str] = mapped_column(
        USER_ROLE_ENUM, default=UserRole.PATIENT, nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
    )

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # --- Relationships ---
    medicines = relationship(
        "Medicine",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    schedules = relationship(
        "Schedule",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # Caregiver ↔ Patient many-to-many (via association table)
    # Patients assigned to this caregiver
    assigned_patients = relationship(
        "User",
        secondary="caregiver_patients",
        primaryjoin="User.id == caregiver_patients.c.caregiver_id",
        secondaryjoin="User.id == caregiver_patients.c.patient_id",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username}, role={self.role})>"
