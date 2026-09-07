"""
PillSync Analytics Service.

Provides analytics calculation and reporting logic for:
    - Adherence metrics (taken vs missed doses breakdown over time).
    - Weekly dose trends (real PostgreSQL dose_logs, clamped to user account creation date).
    - Adherence heatmap matrix (4 or N weeks, real intensity from dose_logs).
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
    Compute overall adherence percentage and dose breakdown for the past N days,
    clamped to the user's account creation date so new accounts show 0 instead of fake 100%.

    Args:
        db: Async database session.
        user_id: User UUID.
        days: Time period in days (default: 30 days).

    Returns:
        Dict with total_doses, taken, missed, snoozed, adherence_percentage, and grade.
    """
    # Fetch user to get account creation date
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    account_date = user.created_at.date() if user else date.today()

    cutoff_date = max(date.today() - timedelta(days=days), account_date)

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

    pct = round((taken / total * 100.0), 2) if total > 0 else 0.0

    if pct >= 90.0:
        grade = "Excellent"
    elif pct >= 75.0:
        grade = "Good"
    elif pct >= 60.0:
        grade = "Fair"
    elif total == 0:
        grade = "No Data"
    else:
        grade = "Poor"

    # Calculate consecutive streak (days where taken >= all scheduled doses for that day)
    streak_days = await _calculate_streak(db, user_id, account_date)

    return {
        "user_id": str(user_id),
        "period_days": days,
        "total_doses": total,
        "taken_doses": taken,
        "missed_doses": missed,
        "snoozed_doses": snoozed,
        "adherence_percentage": pct,
        "consistency_grade": grade,
        "streak_days": streak_days,
        "account_start_date": account_date.isoformat(),
    }


async def _calculate_streak(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_date: date,
) -> int:
    """
    Count consecutive days ending today where the user had at least 1 Taken dose
    and zero Missed doses.
    """
    today = date.today()
    streak = 0
    current = today
    while current >= account_date:
        result = await db.execute(
            select(DoseLog).where(
                DoseLog.user_id == user_id,
                DoseLog.scheduled_date == current,
            )
        )
        day_logs = list(result.scalars().all())
        if not day_logs:
            break
        taken_count = sum(1 for l in day_logs if l.action == "Taken")
        missed_count = sum(1 for l in day_logs if l.action == "Missed")
        if taken_count > 0 and missed_count == 0:
            streak += 1
            current -= timedelta(days=1)
        else:
            break
    return streak


# ---------------------------------------------------------------------------
# Dose Trends (Daily Breakdown) — real data, clamped to account creation
# ---------------------------------------------------------------------------

async def get_dose_trends(
    db: AsyncSession,
    user_id: uuid.UUID,
    days: int = 7,
) -> list[dict]:
    """
    Fetch daily taken vs. missed dose count for charting.
    Days before the user's account creation date return blank (0) entries.
    Includes day_name and adherence_rate fields for chart rendering.

    Args:
        db: Async database session.
        user_id: User UUID.
        days: Number of days to include (default: 7 days).

    Returns:
        List of daily trend dicts sorted by date ascending.
    """
    # Fetch user creation date so we don't fake historical bars
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    account_date = user.created_at.date() if user else date.today()

    end_d = date.today()
    start_d = end_d - timedelta(days=days - 1)

    # Query dose_logs for the window
    query = select(DoseLog).where(
        DoseLog.user_id == user_id,
        DoseLog.scheduled_date >= start_d,
        DoseLog.scheduled_date <= end_d,
    )
    result = await db.execute(query)
    logs = list(result.scalars().all())

    # Build day-keyed buckets
    WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    DAY_ABBR  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    by_date: dict[date, dict] = {}
    current = start_d
    while current <= end_d:
        is_before_account = current < account_date
        wd = current.weekday()  # 0=Mon … 6=Sun in Python
        # Convert Python weekday (Mon=0) to Sunday-based index for JS compatibility
        js_dow = (wd + 1) % 7  # Sun=0, Mon=1 …
        by_date[current] = {
            "date": current.isoformat(),
            "day_name": WEEKDAYS[js_dow],
            "day_abbr": DAY_ABBR[js_dow],
            "taken": 0,
            "missed": 0,
            "snoozed": 0,
            "total": 0,
            "adherence_rate": 0.0,
            "is_before_account": is_before_account,  # blank out pre-account days
        }
        current += timedelta(days=1)

    # Aggregate real log entries — skip dates before account creation
    for log in logs:
        d = log.scheduled_date
        if d in by_date and not by_date[d]["is_before_account"]:
            by_date[d]["total"] += 1
            if log.action == "Taken":
                by_date[d]["taken"] += 1
            elif log.action == "Missed":
                by_date[d]["missed"] += 1
            elif log.action in ["Snooze", "Snoozed"]:
                by_date[d]["snoozed"] += 1

    # Calculate adherence_rate per day
    for d, entry in by_date.items():
        if entry["is_before_account"]:
            entry["adherence_rate"] = 0.0
        elif entry["total"] > 0:
            entry["adherence_rate"] = round(entry["taken"] / entry["total"] * 100.0, 1)
        else:
            # If today and no logs yet — keep 0; user may not have taken doses yet
            entry["adherence_rate"] = 0.0

    return list(by_date.values())


# ---------------------------------------------------------------------------
# Adherence Heatmap — real data from dose_logs
# ---------------------------------------------------------------------------

async def get_adherence_heatmap(
    db: AsyncSession,
    user_id: uuid.UUID,
    weeks: int = 4,
) -> list[list[dict]]:
    """
    Generate a week-grid heatmap of adherence intensity from real dose_logs.
    - Cells before the user's account creation date → percentage = -1 (blank/gray)
    - Days with no logs after account start → percentage = 0
    - Days with logs → percentage = taken / total * 100

    Returns:
        List of weeks (each a list of 7 day dicts).
    """
    # Fetch user creation date
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    account_date = user.created_at.date() if user else date.today()

    today = date.today()
    # We show `weeks` complete weeks ending today (Sunday of current week)
    # Build all days in the window
    total_days = weeks * 7
    start_day = today - timedelta(days=total_days - 1)

    # Fetch all dose_logs in window
    result = await db.execute(
        select(DoseLog).where(
            DoseLog.user_id == user_id,
            DoseLog.scheduled_date >= start_day,
            DoseLog.scheduled_date <= today,
        )
    )
    logs = list(result.scalars().all())

    # Build per-date taken/total map
    log_map: dict[date, dict] = {}
    for log in logs:
        d = log.scheduled_date
        if d not in log_map:
            log_map[d] = {"taken": 0, "total": 0}
        log_map[d]["total"] += 1
        if log.action == "Taken":
            log_map[d]["taken"] += 1

    WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    # Build week grid — each entry represents one calendar day
    all_days = []
    current = start_day
    while current <= today:
        is_future = current > today
        is_before_account = current < account_date

        if is_future or is_before_account:
            pct = -1
        else:
            day_data = log_map.get(current)
            if day_data and day_data["total"] > 0:
                pct = round(day_data["taken"] / day_data["total"] * 100)
            else:
                # After account creation but no logs — show as 0 (not fake green)
                pct = 0

        js_dow = (current.weekday() + 1) % 7  # Sun=0 Mon=1 …
        all_days.append({
            "date": current.isoformat(),
            "dayLabel": current.day,
            "weekday": WEEKDAYS[js_dow],
            "percentage": pct,
            "isFuture": is_future,
            "isBeforeAccount": is_before_account,
            "taken": log_map.get(current, {}).get("taken", 0),
            "total": log_map.get(current, {}).get("total", 0),
        })
        current += timedelta(days=1)

    # Chunk into weeks of 7 days
    week_grid = []
    for i in range(0, len(all_days), 7):
        week_grid.append(all_days[i : i + 7])

    return week_grid


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
    from app.models.caregiver_patient import caregiver_patients
    from sqlalchemy import cast, String

    try:
        patients = caregiver.assigned_patients or []
    except Exception:
        patients = []

    if not patients:
        try:
            result = await db.execute(
                select(caregiver_patients.c.patient_id).where(
                    caregiver_patients.c.caregiver_id == caregiver.id
                )
            )
            patient_ids = [row[0] for row in result.fetchall()]

            if patient_ids:
                result = await db.execute(
                    select(User).where(User.id.in_(patient_ids))
                )
                patients = list(result.scalars().all())
        except Exception:
            patients = []

    analytics_list = []

    for patient in patients:
        try:
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
        except Exception as e:
            analytics_list.append({
                "patient_id": str(patient.id),
                "patient_name": getattr(patient, "full_name", "Unknown"),
                "username": getattr(patient, "username", "unknown"),
                "error": str(e),
            })

    return analytics_list
