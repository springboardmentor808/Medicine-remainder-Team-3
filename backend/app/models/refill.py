"""
PillSync Refill Model.

Tracks refill prediction data for each medicine — pill counts,
daily dosage, estimated refill dates, and low-stock alerts
used by the AI Refill Prediction Engine.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Refill(Base):
    """
    Refill prediction entity for a specific medicine.

    Stores current pill inventory and daily consumption rate to
    calculate the estimated refill date and low-stock warnings.
    """

    __tablename__ = "refills"

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

    # --- Refill Prediction Fields ---
    total_pills_remaining: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Current total pills remaining in stock",
    )
    daily_dose_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Number of pills consumed per day",
    )
    estimated_refill_date: Mapped[datetime] = mapped_column(
        Date,
        nullable=True,
        comment="AI-predicted date when stock will run out",
    )
    low_stock_threshold: Mapped[int] = mapped_column(
        Integer,
        default=5,
        nullable=False,
        comment="Number of days below which a low-stock alert triggers",
    )

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # --- Relationships ---
    user = relationship("User", backref="refills", lazy="selectin")
    medicine = relationship("Medicine", backref="refills", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<Refill(id={self.id}, medicine_id={self.medicine_id}, "
            f"pills={self.total_pills_remaining}, refill={self.estimated_refill_date})>"
        )
