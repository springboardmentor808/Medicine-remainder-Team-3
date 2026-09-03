"""
PillSync Analytics Service.

Provides analytics calculation and reporting logic for:
    - Adherence metrics (taken vs missed doses breakdown over time).
    - Medication stock health & depletion risks.
    - Caregiver patient compliance overview.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medicine import Medicine
from app.models.schedule import DoseLog, Schedule
from app.models.user import User


# ---------------------------------------------------------------------------
# Adherence Summary Analytics
# ---------------------------------------------------------------------------

async def get_adherence_summary(
    db: AsyncSession,
    user_id: uuid.UUID,
    days: int = 30,
) -> dict:
    """
    Compute overall adherence percentage and dose breakdown for the past N days.

    Args:
        db: Async database session.
        user_id: User UUID.
        days: Time period in days (default: 30 days).

    Returns:
        Dict with total_doses, taken, missed, snoozed, adherence_percentage, and grade.
    """
    cutoff_date = date.today() - timedelta(days=days)

    query = select(DoseLog).where(
        DoseLog.user_id == user_id,
        DoseLog.scheduled_date >= cutoff_date,
    )
    result = await db.execute(query)
    logs = list(result.scalars().all())

    total = len(logs)
    taken = sum(1 for l in logs if l.action == "Taken")
    missed = sum(1 for l in logs if l.action == "Missed")
    snoozed = sum(1 for l in logs if l.action in ["Snooze", "Snoozed"])

    pct = round((taken / total * 100.0), 2) if total > 0 else 100.0

    if pct >= 90.0:
        grade = "Excellent"
    elif pct >= 75.0:
        grade = "Good"
    elif pct >= 60.0:
        grade = "Fair"
    else:
        grade = "Poor"

    return {
        "user_id": str(user_id),
        "period_days": days,
        "total_doses": total,
        "taken_doses": taken,
        "missed_doses": missed,
        "snoozed_doses": snoozed,
        "adherence_percentage": pct,
        "consistency_grade": grade,
    }


# ---------------------------------------------------------------------------
# Dose Trends (Daily Breakdown)
# ---------------------------------------------------------------------------

async def get_dose_trends(
    db: AsyncSession,
    user_id: uuid.UUID,
    days: int = 7,
) -> list[dict]:
    """
    Fetch daily taken vs. missed dose count for charting.

    Args:
        db: Async database session.
        user_id: User UUID.
        days: Number of days to include (default: 7 days).

    Returns:
        List of daily trend dicts sorted by date ascending.
    """
    end_d = date.today()
    start_d = end_d - timedelta(days=days - 1)

    query = select(DoseLog).where(
        DoseLog.user_id == user_id,
        DoseLog.scheduled_date >= start_d,
        DoseLog.scheduled_date <= end_d,
    )
    result = await db.execute(query)
    logs = list(result.scalars().all())

    # Map by date
    by_date: dict[date, dict] = {}
    current = start_d
    while current <= end_d:
        by_date[current] = {"date": current.isoformat(), "taken": 0, "missed": 0, "snoozed": 0}
        current += timedelta(days=1)

    for l in logs:
        d = l.scheduled_date
        if d in by_date:
            if l.action == "Taken":
                by_date[d]["taken"] += 1
            elif l.action == "Missed":
                by_date[d]["missed"] += 1
            elif l.action in ["Snooze", "Snoozed"]:
                by_date[d]["snoozed"] += 1

    return list(by_date.values())


# ---------------------------------------------------------------------------
# Stock Health Analytics
# ---------------------------------------------------------------------------

async def get_stock_health(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> dict:
    """
    Calculate stock levels and low-stock risk metrics across user's active medicines.

    Returns:
        Dict with total_medicines, low_stock_count, out_of_stock_count, medicines_status list.
    """
    query = select(Medicine).where(Medicine.user_id == user_id)
    result = await db.execute(query)
    medicines = list(result.scalars().all())

    total = len(medicines)
    low_stock = 0
    out_of_stock = 0
    medicine_details = []

    for m in medicines:
        daily_consumption = m.daily_frequency * m.quantity_per_dose
        days_left = (
            round(m.current_stock / daily_consumption, 1)
            if daily_consumption > 0
            else 999.0
        )

        is_out = m.current_stock == 0
        is_low = days_left <= 5 and not is_out

        if is_out:
            out_of_stock += 1
        elif is_low:
            low_stock += 1

        medicine_details.append({
            "medicine_id": str(m.id),
            "name": m.name,
            "current_stock": m.current_stock,
            "days_left": days_left,
            "status": "Out of Stock" if is_out else ("Low Stock" if is_low else "Sufficient"),
        })

    return {
        "user_id": str(user_id),
        "total_medicines": total,
        "low_stock_count": low_stock,
        "out_of_stock_count": out_of_stock,
        "healthy_stock_count": total - low_stock - out_of_stock,
        "medicines": medicine_details,
    }


# ---------------------------------------------------------------------------
# Caregiver Patient Compliance Analytics
# ---------------------------------------------------------------------------

async def get_caregiver_patient_analytics(
    db: AsyncSession,
    caregiver: User,
) -> list[dict]:
    """
    Fetch adherence metrics for all patients assigned to a caregiver.

    Returns:
        List of patient compliance dicts.
    """
    # Fetch assigned patients
    patients = caregiver.assigned_patients or []
    analytics_list = []

    for patient in patients:
        summary = await get_adherence_summary(db, patient.id, days=30)
        stock = await get_stock_health(db, patient.id)

        analytics_list.append({
            "patient_id": str(patient.id),
            "patient_name": patient.full_name,
            "username": patient.username,
            "adherence_percentage": summary["adherence_percentage"],
            "consistency_grade": summary["consistency_grade"],
            "total_medicines": stock["total_medicines"],
            "low_stock_count": stock["low_stock_count"],
            "out_of_stock_count": stock["out_of_stock_count"],
        })

    return analytics_list
