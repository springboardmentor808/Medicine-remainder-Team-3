"""
PillSync Refill Prediction Service.

Contains the core mathematical logic for the AI Refill Prediction
Engine:
    - Calculates days remaining based on stock and consumption.
    - Projects the estimated refill date.
    - Evaluates low-stock alerts.

Also provides async database helpers used by the refill API router.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medicine import Medicine
from app.models.refill import Refill


# ---------------------------------------------------------------------------
# Core Prediction Logic (Pure Computation — No DB)
# ---------------------------------------------------------------------------

def calculate_refill_prediction(
    total_pills: int,
    daily_dose: int,
    low_stock_threshold: int = 5,
) -> dict:
    """
    Compute refill prediction metrics.

    Args:
        total_pills: Current remaining pill count.
        daily_dose: Number of pills consumed per day.
        low_stock_threshold: Days threshold for low-stock alert.

    Returns:
        dict with keys:
            - days_remaining (float)
            - estimated_refill_date (date)
            - is_low_stock (bool)
    """
    if daily_dose <= 0:
        # Avoid division by zero; treat as infinite supply
        return {
            "days_remaining": float("inf"),
            "estimated_refill_date": None,
            "is_low_stock": False,
        }

    days_remaining = total_pills / daily_dose
    estimated_refill_date = date.today() + timedelta(days=days_remaining)
    is_low_stock = days_remaining <= low_stock_threshold

    return {
        "days_remaining": round(days_remaining, 1),
        "estimated_refill_date": estimated_refill_date,
        "is_low_stock": is_low_stock,
    }


# ---------------------------------------------------------------------------
# Database Helpers
# ---------------------------------------------------------------------------

async def get_medicine_by_id(
    db: AsyncSession,
    medicine_id: uuid.UUID | str,
) -> Medicine | None:
    """Fetch a medicine record by its primary key."""
    if isinstance(medicine_id, str):
        try:
            medicine_id = uuid.UUID(medicine_id)
        except ValueError:
            return None

    result = await db.execute(
        select(Medicine).where(Medicine.id == medicine_id)
    )
    med = result.scalar_one_or_none()

    if med is None:
        from sqlalchemy import or_, cast, String
        med_str = str(medicine_id)
        med_hex = medicine_id.hex
        result = await db.execute(
            select(Medicine).where(
                or_(
                    cast(Medicine.id, String) == med_str,
                    cast(Medicine.id, String) == med_hex,
                )
            )
        )
        med = result.scalar_one_or_none()

    return med


async def get_refill_by_medicine(
    db: AsyncSession,
    medicine_id: uuid.UUID | str,
) -> Refill | None:
    """Fetch the latest refill record for a given medicine."""
    if isinstance(medicine_id, str):
        try:
            medicine_id = uuid.UUID(medicine_id)
        except ValueError:
            return None

    result = await db.execute(
        select(Refill)
        .where(Refill.medicine_id == medicine_id)
        .order_by(Refill.created_at.desc())
    )
    refill = result.scalar_one_or_none()

    if refill is None:
        from sqlalchemy import or_, cast, String
        med_str = str(medicine_id)
        med_hex = medicine_id.hex
        result = await db.execute(
            select(Refill)
            .where(
                or_(
                    cast(Refill.medicine_id, String) == med_str,
                    cast(Refill.medicine_id, String) == med_hex,
                )
            )
            .order_by(Refill.created_at.desc())
        )
        refill = result.scalar_one_or_none()

    return refill


async def create_or_update_refill(
    db: AsyncSession,
    user_id: uuid.UUID,
    medicine_id: uuid.UUID,
    total_pills_remaining: int,
    daily_dose_count: int,
    low_stock_threshold: int = 5,
) -> Refill:
    """
    Create a new refill prediction record (or update existing)
    for the given medicine.

    Computes the estimated refill date and persists the record.
    """
    prediction = calculate_refill_prediction(
        total_pills=total_pills_remaining,
        daily_dose=daily_dose_count,
        low_stock_threshold=low_stock_threshold,
    )

    # Check for existing refill entry for this medicine
    existing = await get_refill_by_medicine(db, medicine_id)

    if existing:
        existing.total_pills_remaining = total_pills_remaining
        existing.daily_dose_count = daily_dose_count
        existing.estimated_refill_date = prediction["estimated_refill_date"]
        existing.low_stock_threshold = low_stock_threshold
        await db.flush()
        return existing

    refill = Refill(
        user_id=user_id,
        medicine_id=medicine_id,
        total_pills_remaining=total_pills_remaining,
        daily_dose_count=daily_dose_count,
        estimated_refill_date=prediction["estimated_refill_date"],
        low_stock_threshold=low_stock_threshold,
    )
    db.add(refill)
    await db.flush()
    return refill
