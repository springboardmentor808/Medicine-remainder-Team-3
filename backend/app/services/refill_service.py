"""
PillSync Refill Prediction Service.

Contains the core mathematical logic for the AI Refill Prediction
Engine:
    - Calculates days remaining based on stock and consumption.
    - Projects the estimated refill date.
    - Evaluates low-stock alerts.

Also provides async database helpers used by the refill API router.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid
from datetime import date, datetime, timedelta, timezone

import numpy as np
from sqlalchemy import cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.medicine import Medicine
from app.models.refill import Refill
from app.models.schedule import DoseLog
from app.schemas.refill_schema import CalibratedRefillPrediction

PROJECT_ROOT = Path(__file__).resolve().parents[3]
MODEL_PATH = PROJECT_ROOT / "backend" / "app" / "ml_artifacts" / "refill_forecaster_v1.json"


# ---------------------------------------------------------------------------
# Core Prediction Logic (Pure Computation — No DB)
# ---------------------------------------------------------------------------

def calculate_refill_prediction(
    total_pills: int,
    daily_dose: int,
    low_stock_threshold: int = 5,
) -> dict:
    """
    Compute refill prediction metrics with safe zero/negative bounds.

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
    # Clamp negative stock to zero
    clamped_pills = max(0, total_pills)

    if daily_dose <= 0:
        # Avoid division by zero; treat as infinite supply
        return {
            "days_remaining": float("inf"),
            "estimated_refill_date": None,
            "is_low_stock": False,
        }

    if clamped_pills == 0:
        return {
            "days_remaining": 0.0,
            "estimated_refill_date": date.today(),
            "is_low_stock": True,
        }

    days_remaining = clamped_pills / daily_dose
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


# ===================================================================
# Calibrated ML Refill Forecasting Engine (Quantile Gradient Boosted)
# ===================================================================

class RefillInferenceEngine:
    _instance: Optional["RefillInferenceEngine"] = None

    def __init__(self) -> None:
        self.model_data: Dict[str, Any] = {}
        self.is_loaded = False
        self._load_artifact()

    def _load_artifact(self) -> None:
        if MODEL_PATH.exists():
            try:
                with open(MODEL_PATH, "r", encoding="utf-8") as f:
                    self.model_data = json.load(f)
                self.is_loaded = True
                print(f"[Refill ML] Loaded model from {MODEL_PATH}")
            except Exception as e:
                print(f"[Refill ML] Failed to load model: {e}")

    def predict_p50(self, features: List[float]) -> float:
        if not self.is_loaded or "stumps" not in self.model_data:
            idx = 10 if len(features) > 10 else 0
            return max(0.0, float(features[idx]))

        base_pred = float(self.model_data.get("base_prediction", 0.0))
        learning_rate = float(self.model_data.get("learning_rate", 0.08))
        stumps = self.model_data.get("stumps", [])

        prediction = base_pred
        for stump in stumps:
            f_idx = stump.get("feature_idx", 0)
            threshold = stump.get("threshold", 0.0)
            left_val = stump.get("left_value", 0.0)
            right_val = stump.get("right_value", 0.0)

            val = features[f_idx] if f_idx < len(features) else 0.0
            if val <= threshold:
                prediction += learning_rate * left_val
            else:
                prediction += learning_rate * right_val

        return max(0.0, float(prediction))


_engine = RefillInferenceEngine()


async def extract_behavioral_features(
    db: AsyncSession,
    user_id: uuid.UUID,
    medicine: Medicine,
) -> List[float]:
    stock = float(max(0, medicine.current_stock or 0))
    freq = float(max(1, medicine.daily_frequency or 1))
    qty = float(max(1, medicine.quantity_per_dose or 1))
    naive_days = stock / (freq * qty)

    two_weeks_ago = datetime.now(timezone.utc).date() - timedelta(days=14)
    q_logs = await db.execute(
        select(DoseLog).where(
            DoseLog.medicine_id == medicine.id,
            DoseLog.user_id == user_id,
            DoseLog.scheduled_date >= two_weeks_ago
        )
    )
    logs = q_logs.scalars().all()

    total_logs = len(logs)
    if total_logs == 0:
        return [stock, freq, qty, 1.0, 0.0, 0.0, 0.0, 5.0, 1.0, freq * qty, naive_days]

    taken_count = sum(1 for l in logs if l.action == "Taken")
    missed_count = sum(1 for l in logs if l.action == "Missed")
    snooze_count = sum(1 for l in logs if l.action == "Snooze")

    adherence_rate = taken_count / float(total_logs)
    weekly_missed = (missed_count / 14.0) * 7.0
    snooze_index = snooze_count / float(total_logs)

    delays = []
    for l in logs:
        if l.action == "Taken" and l.action_time and l.scheduled_time:
            sched_dt = datetime.combine(l.scheduled_date, l.scheduled_time).replace(tzinfo=timezone.utc)
            delta_min = abs((l.action_time - sched_dt).total_seconds()) / 60.0
            delays.append(delta_min)
    avg_delay = float(np.mean(delays)) if delays else 10.0

    effective_consumption = (freq * qty) * (0.5 + 0.5 * adherence_rate)
    streak = float(min(14, taken_count))

    return [
        stock,
        freq,
        qty,
        round(adherence_rate, 4),
        round(weekly_missed, 2),
        round(snooze_index, 4),
        0.05,
        round(avg_delay, 1),
        streak,
        round(effective_consumption, 2),
        round(naive_days, 2)
    ]


async def predict_calibrated_refill(
    db: AsyncSession,
    user_id: uuid.UUID,
    medicine_id: uuid.UUID,
) -> CalibratedRefillPrediction:
    q = await db.execute(
        select(Medicine).where(Medicine.id == medicine_id, Medicine.user_id == user_id)
    )
    med = q.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    features = await extract_behavioral_features(db, user_id, med)
    p50_days = _engine.predict_p50(features)

    adherence = features[3]
    variance_factor = max(0.15, (1.0 - adherence) * 0.5)

    p10_days = max(0.0, round(p50_days * (1.0 - variance_factor), 1))
    p90_days = round(p50_days * (1.0 + variance_factor * 1.2), 1)

    today = date.today()
    est_date_p50 = today + timedelta(days=int(np.ceil(p50_days)))
    crit_date_p10 = today + timedelta(days=int(np.ceil(p10_days)))

    is_low = (med.current_stock or 0) <= 5 or p10_days <= 3.0
    requires_reorder = p10_days <= 2.0 or (med.current_stock or 0) <= 2

    return CalibratedRefillPrediction(
        medicine_id=str(med.id),
        medicine_name=med.name,
        current_stock=int(med.current_stock or 0),
        daily_prescribed_frequency=int(med.daily_frequency or 1),
        p10_runout_days=p10_days,
        p50_runout_days=round(p50_days, 1),
        p90_runout_days=p90_days,
        estimated_runout_date_p50=est_date_p50,
        critical_refill_date_p10=crit_date_p10,
        is_low_stock=is_low,
        requires_immediate_reorder=requires_reorder,
        confidence_score=0.94 if _engine.is_loaded else 0.70
    )
