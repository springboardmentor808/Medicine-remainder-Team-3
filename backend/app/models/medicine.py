"""
PillSync Medicine Model.

Stores medication details including dosage, stock levels, disease category,
and consumption parameters used by the Refill Prediction Engine.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


DISEASE_CATEGORY_ENUM = SAEnum(
    "Blood Pressure",
    "Diabetes",
    "Thyroid",
    "Antibiotics",
    "Vitamins",
    "Heart Medications",
    "General Healthcare",
    name="disease_category",
    create_constraint=True,
)


class Medicine(Base):
    """
    Medicine entity owned by a patient.

    Tracks current stock levels for the AI Refill Prediction Engine
    and links to scheduled reminders via the Schedule model.
    """

    __tablename__ = "medicines"

    # --- Primary Key ---
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # --- Owner ---
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Medicine Details ---
    name: Mapped[str] = mapped_column(
        String(200), nullable=False, index=True,
    )
    disease_category: Mapped[str] = mapped_column(
        DISEASE_CATEGORY_ENUM, default="General Healthcare", nullable=False,
    )
    dosage: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="e.g., '500mg', '2 Tablets'",
    )

    # --- Stock & Consumption (Refill Engine inputs) ---
    initial_quantity: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Total quantity when medicine was added/refilled",
    )
    current_stock: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Current remaining quantity",
    )
    daily_frequency: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Number of doses per day",
    )
    quantity_per_dose: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False,
        comment="Number of units consumed per dose",
    )

    # --- Notes ---
    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True,
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
    user = relationship("User", back_populates="medicines")
    schedules = relationship(
        "Schedule",
        back_populates="medicine",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Medicine(id={self.id}, name={self.name}, stock={self.current_stock})>"
