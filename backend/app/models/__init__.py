"""
PillSync Models Package.

Barrel import file — ensures all SQLAlchemy models are registered
with Base.metadata so Alembic can auto-discover them for migrations.
"""

from app.models.user import User, UserRole
from app.models.medicine import Medicine
from app.models.medicine_catalog import MedicineCatalog
from app.models.schedule import Schedule, DoseLog
from app.models.caregiver_patient import caregiver_patients
from app.models.refill import Refill

__all__ = [
    "User",
    "UserRole",
    "Medicine",
    "MedicineCatalog",
    "Schedule",
    "DoseLog",
    "caregiver_patients",
    "Refill",
]
