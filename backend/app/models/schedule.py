"""
PillSync Schedule Model.

Defines when a patient should take a specific medicine.
Used by the Smart Reminder System to trigger notifications.
"""

import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
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
    frequency_pattern: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
        comment="e.g. '1-1-1', '1-0-1', '0-1-1', '0-0-1', or 'custom'",
    )
    dose_label: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="e.g. 'Morning', 'Afternoon', 'Evening', 'Night'",
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
    dose_logs = relationship(
        "DoseLog",
        back_populates="schedule",
        cascade="save-update, merge",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Schedule(id={self.id}, medicine={self.medicine_id}, "
            f"time={self.scheduled_time}, active={self.is_active})>"
        )


class DoseLog(Base):
    """
    Dose Log / Adherence record.

    Tracks each scheduled dose taken, missed, or snoozed by a patient.
    """

    __tablename__ = "dose_logs"

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
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Dose Info ---
    scheduled_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Date of the scheduled dose",
    )
    scheduled_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
        comment="Scheduled time of day",
    )

    # --- Action Tracking ---
    action: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        comment="Taken, Missed, Snooze",
    )
    action_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    snooze_minutes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Minutes snoozed if action is Snooze",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
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
    user = relationship("User")
    medicine = relationship("Medicine")
    schedule = relationship("Schedule", back_populates="dose_logs")

    def __repr__(self) -> str:
        return (
            f"<DoseLog(id={self.id}, user_id={self.user_id}, "
            f"action={self.action}, date={self.scheduled_date})>"
        )

