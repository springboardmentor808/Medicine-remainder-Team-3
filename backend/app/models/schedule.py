"""
PillSync Schedule Model.

Defines when a patient should take a specific medicine.
Used by the Smart Reminder System to trigger notifications.
"""

import uuid
from datetime import datetime, time, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Time,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Schedule(Base):
    """
    Medication schedule entry.

    Each row represents a single reminder time for a medicine.
    A medicine taken twice daily at 8AM and 8PM would have two Schedule rows.
    """

    __tablename__ = "schedules"

    # --- Primary Key ---
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # --- Foreign Keys ---
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    medicine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Schedule Config ---
    scheduled_time: Mapped[time] = mapped_column(
        Time, nullable=False,
        comment="Time of day for this dose, e.g., 08:00",
    )
    day_of_week: Mapped[str | None] = mapped_column(
        String(10), nullable=True,
        comment="NULL = everyday, or 'monday', 'tuesday', etc.",
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
    user = relationship("User", back_populates="schedules")
    medicine = relationship("Medicine", back_populates="schedules")

    def __repr__(self) -> str:
        return (
            f"<Schedule(id={self.id}, medicine={self.medicine_id}, "
            f"time={self.scheduled_time}, active={self.is_active})>"
        )
