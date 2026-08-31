"""
PillSync Adherence Feature Engineering (Track 3 -- Engineer 3).

Extracts and engineers ML features from patient dose log history
for the Refill Runout Forecasting model (XGBoost).

Feature set:
  - current_stock (units)
  - daily_prescribed_frequency (doses/day)
  - historical_adherence_rate_7d (%)
  - historical_missed_dose_frequency (per week)
  - weekday_vs_weekend_variance
  - snooze_frequency_index
  - avg_delay_minutes (how late doses are typically taken)
  - streak_length (consecutive days of adherence)

Usage:
    from ai_training.src.adherence_feature_engineering import AdherenceFeatureEngineer

    engineer = AdherenceFeatureEngineer()
    features = engineer.extract_features(dose_logs, medicine, schedule)
"""

from collections import defaultdict
from datetime import datetime, timedelta, date, time
from typing import Optional
import random
import csv
import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SYNTHETIC_DATA_DIR = PROJECT_ROOT / "ai_training" / "datasets" / "processed"


class AdherenceFeatureEngineer:
    """
    Extracts behavioral adherence features from dose history
    for the refill forecasting model.
    """

    def extract_features(
        self,
        dose_logs: list[dict],
        current_stock: int,
        daily_prescribed_frequency: int,
        quantity_per_dose: int = 1,
        lookback_days: int = 7,
    ) -> dict:
        """
        Extract ML features from a list of dose log entries.

        Args:
            dose_logs: List of dicts with keys:
                - scheduled_date: date
                - scheduled_time: time
                - action: "Taken" | "Missed" | "Snoozed" | "Skipped"
                - action_time: datetime (when dose was actually taken)
            current_stock: Current remaining pill count
            daily_prescribed_frequency: Prescribed doses per day
            quantity_per_dose: Number of pills per dose
            lookback_days: Number of days to look back for feature computation

        Returns:
            dict of computed features for ML model input
        """
        if not dose_logs:
            return self._default_features(
                current_stock, daily_prescribed_frequency, quantity_per_dose
            )

        # Filter to lookback window
        cutoff = date.today() - timedelta(days=lookback_days)
        recent_logs = [
            log for log in dose_logs
            if self._get_date(log.get("scheduled_date")) >= cutoff
        ]

        if not recent_logs:
            return self._default_features(
                current_stock, daily_prescribed_frequency, quantity_per_dose
            )

        # --- Feature: adherence_rate_7d ---
        total_scheduled = len(recent_logs)
        taken_count = sum(1 for log in recent_logs if log.get("action") == "Taken")
        adherence_rate = taken_count / total_scheduled if total_scheduled > 0 else 1.0

        # --- Feature: missed_dose_frequency ---
        missed_count = sum(
            1 for log in recent_logs
            if log.get("action") in ("Missed", "Skipped")
        )

        # --- Feature: snooze_frequency_index ---
        snoozed_count = sum(
            1 for log in recent_logs if log.get("action") == "Snoozed"
        )
        snooze_index = snoozed_count / total_scheduled if total_scheduled > 0 else 0.0

        # --- Feature: weekday_vs_weekend_variance ---
        weekday_adherence = []
        weekend_adherence = []
        for log in recent_logs:
            log_date = self._get_date(log.get("scheduled_date"))
            is_taken = 1.0 if log.get("action") == "Taken" else 0.0
            if log_date.weekday() < 5:  # Mon-Fri
                weekday_adherence.append(is_taken)
            else:
                weekend_adherence.append(is_taken)

        wd_rate = sum(weekday_adherence) / len(weekday_adherence) if weekday_adherence else 1.0
        we_rate = sum(weekend_adherence) / len(weekend_adherence) if weekend_adherence else 1.0
        weekday_weekend_variance = abs(wd_rate - we_rate)

        # --- Feature: avg_delay_minutes ---
        delays = []
        for log in recent_logs:
            if log.get("action") == "Taken" and log.get("action_time") and log.get("scheduled_time"):
                scheduled_dt = datetime.combine(
                    self._get_date(log["scheduled_date"]),
                    self._get_time(log["scheduled_time"]),
                )
                action_dt = self._get_datetime(log["action_time"])
                if action_dt and scheduled_dt:
                    delay_min = (action_dt - scheduled_dt).total_seconds() / 60.0
                    delays.append(max(0, delay_min))

        avg_delay = sum(delays) / len(delays) if delays else 0.0

        # --- Feature: streak_length ---
        streak = self._compute_streak(recent_logs)

        # --- Feature: effective_daily_consumption ---
        effective_daily_consumption = (
            daily_prescribed_frequency * quantity_per_dose * adherence_rate
        )

        # --- Feature: days_remaining_naive ---
        if effective_daily_consumption > 0:
            days_remaining_naive = current_stock / effective_daily_consumption
        else:
            days_remaining_naive = current_stock / max(
                daily_prescribed_frequency * quantity_per_dose, 1
            )

        return {
            "current_stock": current_stock,
            "daily_prescribed_frequency": daily_prescribed_frequency,
            "quantity_per_dose": quantity_per_dose,
            "adherence_rate_7d": round(adherence_rate, 4),
            "missed_dose_frequency_weekly": missed_count,
            "snooze_frequency_index": round(snooze_index, 4),
            "weekday_weekend_variance": round(weekday_weekend_variance, 4),
            "avg_delay_minutes": round(avg_delay, 2),
            "streak_length": streak,
            "effective_daily_consumption": round(effective_daily_consumption, 4),
            "days_remaining_naive": round(days_remaining_naive, 2),
        }

    def _default_features(
        self, current_stock: int, daily_freq: int, qty_per_dose: int
    ) -> dict:
        """Return default features when no dose history is available."""
        daily_consumption = daily_freq * qty_per_dose
        return {
            "current_stock": current_stock,
            "daily_prescribed_frequency": daily_freq,
            "quantity_per_dose": qty_per_dose,
            "adherence_rate_7d": 1.0,
            "missed_dose_frequency_weekly": 0,
            "snooze_frequency_index": 0.0,
            "weekday_weekend_variance": 0.0,
            "avg_delay_minutes": 0.0,
            "streak_length": 7,
            "effective_daily_consumption": float(daily_consumption),
            "days_remaining_naive": round(
                current_stock / max(daily_consumption, 1), 2
            ),
        }

    def _compute_streak(self, logs: list[dict]) -> int:
        """Compute the current consecutive-day adherence streak."""
        if not logs:
            return 0

        # Group by date
        daily_status = defaultdict(lambda: True)
        for log in logs:
            log_date = self._get_date(log.get("scheduled_date"))
            if log.get("action") in ("Missed", "Skipped"):
                daily_status[log_date] = False

        # Count streak from most recent date backwards
        sorted_dates = sorted(daily_status.keys(), reverse=True)
        streak = 0
        for d in sorted_dates:
            if daily_status[d]:
                streak += 1
            else:
                break
        return streak

    def _get_date(self, val) -> date:
        """Safely parse a date value."""
        if isinstance(val, date):
            return val
        if isinstance(val, datetime):
            return val.date()
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val).date()
            except ValueError:
                pass
        return date.today()

    def _get_time(self, val) -> time:
        """Safely parse a time value."""
        if isinstance(val, time):
            return val
        if isinstance(val, datetime):
            return val.time()
        if isinstance(val, str):
            try:
                return datetime.strptime(val, "%H:%M:%S").time()
            except ValueError:
                try:
                    return datetime.strptime(val, "%H:%M").time()
                except ValueError:
                    pass
        return time(8, 0)

    def _get_datetime(self, val) -> Optional[datetime]:
        """Safely parse a datetime value."""
        if isinstance(val, datetime):
            return val
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val)
            except ValueError:
                pass
        return None


# ---------------------------------------------------------------------------
# Synthetic Training Data Generator
# ---------------------------------------------------------------------------

def generate_synthetic_adherence_data(
    num_patients: int = 500,
    days_per_patient: int = 30,
    output_path: Optional[Path] = None,
) -> Path:
    """
    Generate synthetic adherence training data for the XGBoost refill model.

    Creates realistic patient dose log histories with varying adherence
    patterns (perfect, moderate, poor, erratic).

    Args:
        num_patients: Number of synthetic patients to generate
        days_per_patient: Number of days of history per patient
        output_path: Where to save the CSV

    Returns:
        Path to the generated CSV file
    """
    if output_path is None:
        output_path = SYNTHETIC_DATA_DIR / "adherence_features.csv"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    engineer = AdherenceFeatureEngineer()

    # Adherence profiles
    profiles = [
        {"name": "perfect", "take_prob": 0.98, "snooze_prob": 0.01, "delay_range": (0, 5), "weight": 0.2},
        {"name": "good", "take_prob": 0.90, "snooze_prob": 0.05, "delay_range": (0, 15), "weight": 0.3},
        {"name": "moderate", "take_prob": 0.75, "snooze_prob": 0.10, "delay_range": (0, 30), "weight": 0.25},
        {"name": "poor", "take_prob": 0.55, "snooze_prob": 0.15, "delay_range": (0, 60), "weight": 0.15},
        {"name": "erratic", "take_prob": 0.40, "snooze_prob": 0.20, "delay_range": (0, 120), "weight": 0.1},
    ]

    feature_fields = [
        "patient_id", "current_stock", "daily_prescribed_frequency",
        "quantity_per_dose", "adherence_rate_7d", "missed_dose_frequency_weekly",
        "snooze_frequency_index", "weekday_weekend_variance", "avg_delay_minutes",
        "streak_length", "effective_daily_consumption", "days_remaining_naive",
        "actual_days_to_runout", "adherence_profile",
    ]

    print(f"[SyntheticData] Generating {num_patients} patients x {days_per_patient} days...")

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=feature_fields)
        writer.writeheader()

        for patient_idx in range(num_patients):
            # Random profile selection
            weights = [p["weight"] for p in profiles]
            profile = random.choices(profiles, weights=weights, k=1)[0]

            # Random medicine parameters
            daily_freq = random.choice([1, 2, 3])
            qty_per_dose = random.choice([1, 1, 1, 2])
            initial_stock = random.choice([10, 15, 20, 30, 60, 90])

            # Generate dose logs
            dose_logs = []
            pills_consumed = 0
            today = date.today()
            start_date = today - timedelta(days=days_per_patient)

            for day_offset in range(days_per_patient):
                log_date = start_date + timedelta(days=day_offset)

                for dose_num in range(daily_freq):
                    scheduled_hour = 8 + (dose_num * (12 // max(daily_freq, 1)))
                    scheduled_time_val = time(min(scheduled_hour, 22), 0)

                    # Determine action
                    rand = random.random()
                    if rand < profile["take_prob"]:
                        action = "Taken"
                        delay = random.uniform(*profile["delay_range"])
                        action_dt = datetime.combine(
                            log_date, scheduled_time_val
                        ) + timedelta(minutes=delay)
                        pills_consumed += qty_per_dose
                    elif rand < profile["take_prob"] + profile["snooze_prob"]:
                        action = "Snoozed"
                        delay = random.uniform(15, 60)
                        action_dt = datetime.combine(
                            log_date, scheduled_time_val
                        ) + timedelta(minutes=delay)
                        pills_consumed += qty_per_dose  # Eventually taken
                    else:
                        action = "Missed"
                        action_dt = None

                    dose_logs.append({
                        "scheduled_date": log_date,
                        "scheduled_time": scheduled_time_val,
                        "action": action,
                        "action_time": action_dt,
                    })

            # Current stock after consumption
            current_stock = max(0, initial_stock - pills_consumed)

            # Compute features
            features = engineer.extract_features(
                dose_logs, current_stock, daily_freq, qty_per_dose
            )

            # Compute actual days to runout (ground truth label)
            if features["effective_daily_consumption"] > 0:
                actual_days = current_stock / features["effective_daily_consumption"]
                # Add some noise
                actual_days *= random.uniform(0.85, 1.15)
                actual_days = max(0, round(actual_days, 1))
            else:
                actual_days = float(current_stock)

            # Write row
            row = {
                "patient_id": f"P{patient_idx:04d}",
                "actual_days_to_runout": actual_days,
                "adherence_profile": profile["name"],
                **features,
            }
            writer.writerow(row)

    file_size = output_path.stat().st_size / 1024
    print(f"[SyntheticData] Generated {output_path} ({file_size:.1f} KB)")
    print(f"[SyntheticData] {num_patients} patients, {num_patients * days_per_patient * 2} total dose events")

    return output_path


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("  PillSync Adherence Feature Engineering")
    print("=" * 60)

    # Generate synthetic training data
    output = generate_synthetic_adherence_data(
        num_patients=1000,
        days_per_patient=30,
    )
    print(f"\n  [OK] Synthetic data saved: {output}")
