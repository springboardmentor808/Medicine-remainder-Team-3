"""
PillSync Caregiver-Patient Association Table.

Many-to-many relationship allowing caregivers to monitor
multiple patients, and patients to have multiple caregivers.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Table,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


caregiver_patients = Table(
    "caregiver_patients",
    Base.metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    ),
    Column(
        "caregiver_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "patient_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "assigned_at",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    ),
    UniqueConstraint(
        "caregiver_id", "patient_id",
        name="uq_caregiver_patient",
    ),
)
