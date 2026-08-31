"""
PillSync WHO Essential Medicines Dosage Benchmarks Service (Track 3 — Engineer 3).

Provides standardized maximum safe daily dosage limits based on the
WHO Model List of Essential Medicines (EML) and standard pharmacological
reference ranges.

Key capabilities:
  1. Maximum daily dose (MDD) lookup for common active ingredients
  2. Pediatric vs Adult dosage differentiation
  3. Pregnancy safety category classification (A/B/C/D/X)
  4. Renal/hepatic dose adjustment flags
  5. Validation engine to flag potential overdose schedules
"""

from typing import Optional

DOSAGE_LIMITS: dict[str, dict] = {
    # --- Analgesics & Antipyretics ---
    "Paracetamol": {
        "max_daily_mg": 4000,
        "adult_dose_range": "500-1000mg per dose, max 4g/day",
        "pediatric_dose_mg_per_kg": 60,
        "frequency": "Every 4-6 hours",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Hepatotoxic above 4g/day. Avoid with alcohol.",
    },
    "Ibuprofen": {
        "max_daily_mg": 2400,
        "adult_dose_range": "200-800mg per dose",
        "pediatric_dose_mg_per_kg": 40,
        "frequency": "3-4 times daily",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Avoid in third trimester. GI bleeding risk.",
    },
    "Diclofenac": {
        "max_daily_mg": 150,
        "adult_dose_range": "50mg 2-3 times daily",
        "pediatric_dose_mg_per_kg": 3,
        "frequency": "2-3 times daily",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "CV risk with prolonged use. Avoid in renal impairment.",
    },
    "Aceclofenac": {
        "max_daily_mg": 200,
        "adult_dose_range": "100mg twice daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Twice daily",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Not recommended for children under 18.",
    },
    "Tramadol": {
        "max_daily_mg": 400,
        "adult_dose_range": "50-100mg every 4-6 hours",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Every 4-6 hours",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Opioid. Risk of dependence and serotonin syndrome.",
    },

    # --- Diabetes ---
    "Metformin": {
        "max_daily_mg": 2550,
        "adult_dose_range": "500-850mg, 2-3 times daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "2-3 times daily with meals",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Contraindicated in eGFR < 30. Lactic acidosis risk.",
    },
    "Glimepiride": {
        "max_daily_mg": 8,
        "adult_dose_range": "1-4mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily with breakfast",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Hypoglycemia risk. Start low, titrate slowly.",
    },
    "Sitagliptin": {
        "max_daily_mg": 100,
        "adult_dose_range": "100mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Reduce to 50mg if eGFR 30-45, 25mg if eGFR < 30.",
    },

    # --- Blood Pressure ---
    "Amlodipine": {
        "max_daily_mg": 10,
        "adult_dose_range": "5-10mg once daily",
        "pediatric_dose_mg_per_kg": 0.3,
        "frequency": "Once daily",
        "pregnancy_category": "C",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Ankle edema common. Start 5mg in elderly.",
    },
    "Telmisartan": {
        "max_daily_mg": 80,
        "adult_dose_range": "20-80mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily",
        "pregnancy_category": "D",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Contraindicated in pregnancy. Monitor potassium.",
    },
    "Losartan": {
        "max_daily_mg": 100,
        "adult_dose_range": "50-100mg once daily",
        "pediatric_dose_mg_per_kg": 1.4,
        "frequency": "Once or twice daily",
        "pregnancy_category": "D",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Contraindicated in pregnancy. Monitor potassium.",
    },
    "Atenolol": {
        "max_daily_mg": 100,
        "adult_dose_range": "25-100mg once daily",
        "pediatric_dose_mg_per_kg": 2,
        "frequency": "Once daily",
        "pregnancy_category": "D",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Do not stop abruptly. Bradycardia risk.",
    },

    # --- Thyroid ---
    "Levothyroxine": {
        "max_daily_mg": 0.3,  # 300mcg = 0.3mg
        "adult_dose_range": "25-200mcg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily on empty stomach",
        "pregnancy_category": "A",
        "renal_adjustment": False,
        "hepatic_adjustment": False,
        "notes": "Take 30-60 min before food. Separate from calcium/iron by 4 hours.",
    },

    # --- Heart / Cardiovascular ---
    "Atorvastatin": {
        "max_daily_mg": 80,
        "adult_dose_range": "10-80mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily (any time)",
        "pregnancy_category": "X",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Contraindicated in pregnancy. Monitor liver enzymes.",
    },
    "Rosuvastatin": {
        "max_daily_mg": 40,
        "adult_dose_range": "5-40mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily",
        "pregnancy_category": "X",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Max 5mg for Asian patients initially. Myopathy risk.",
    },
    "Clopidogrel": {
        "max_daily_mg": 75,
        "adult_dose_range": "75mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Hold 5-7 days before surgery. Bleeding risk.",
    },
    "Aspirin": {
        "max_daily_mg": 4000,
        "adult_dose_range": "75-325mg once daily (CV prevention)",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily",
        "pregnancy_category": "D",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Reye syndrome risk in children. GI bleeding risk.",
    },

    # --- Antibiotics ---
    "Amoxicillin": {
        "max_daily_mg": 3000,
        "adult_dose_range": "250-500mg every 8 hours",
        "pediatric_dose_mg_per_kg": 90,
        "frequency": "Every 8 hours",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Complete full course. Diarrhea common.",
    },
    "Azithromycin": {
        "max_daily_mg": 500,
        "adult_dose_range": "500mg day 1, then 250mg days 2-5",
        "pediatric_dose_mg_per_kg": 12,
        "frequency": "Once daily",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "QT prolongation risk. Avoid with antacids.",
    },
    "Ciprofloxacin": {
        "max_daily_mg": 1500,
        "adult_dose_range": "250-750mg twice daily",
        "pediatric_dose_mg_per_kg": 30,
        "frequency": "Twice daily",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Tendon rupture risk. Avoid in children if possible.",
    },
    "Cefixime": {
        "max_daily_mg": 400,
        "adult_dose_range": "200-400mg once daily",
        "pediatric_dose_mg_per_kg": 8,
        "frequency": "Once or twice daily",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Complete full course.",
    },

    # --- GI / Acid Control ---
    "Pantoprazole": {
        "max_daily_mg": 80,
        "adult_dose_range": "40mg once daily",
        "pediatric_dose_mg_per_kg": 1.2,
        "frequency": "Once daily before breakfast",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Long-term use: risk of magnesium depletion, fractures.",
    },
    "Rabeprazole": {
        "max_daily_mg": 40,
        "adult_dose_range": "20mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily before breakfast",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Do not crush enteric-coated tablets.",
    },
    "Omeprazole": {
        "max_daily_mg": 40,
        "adult_dose_range": "20-40mg once daily",
        "pediatric_dose_mg_per_kg": 1,
        "frequency": "Once daily before breakfast",
        "pregnancy_category": "C",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Interacts with clopidogrel (avoid combination).",
    },
    "Domperidone": {
        "max_daily_mg": 30,
        "adult_dose_range": "10mg three times daily",
        "pediatric_dose_mg_per_kg": 0.75,
        "frequency": "3 times daily before meals",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "QT prolongation risk. Avoid in cardiac patients.",
    },

    # --- Allergy / Respiratory ---
    "Cetirizine": {
        "max_daily_mg": 10,
        "adult_dose_range": "10mg once daily",
        "pediatric_dose_mg_per_kg": 0.25,
        "frequency": "Once daily",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Causes drowsiness. Avoid driving.",
    },
    "Levocetirizine": {
        "max_daily_mg": 5,
        "adult_dose_range": "5mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily in evening",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Less sedating than cetirizine.",
    },
    "Montelukast": {
        "max_daily_mg": 10,
        "adult_dose_range": "10mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily in evening",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "FDA boxed warning: neuropsychiatric events.",
    },

    # --- Vitamins ---
    "Cholecalciferol": {
        "max_daily_mg": 0.25,  # 10,000 IU = 0.25mg
        "adult_dose_range": "1000-4000 IU daily or 60000 IU weekly",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Daily or weekly",
        "pregnancy_category": "A",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Monitor calcium levels. Toxicity above 60000 IU daily.",
    },
    "Folic Acid": {
        "max_daily_mg": 5,
        "adult_dose_range": "0.4-5mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily",
        "pregnancy_category": "A",
        "renal_adjustment": False,
        "hepatic_adjustment": False,
        "notes": "Essential preconception and during pregnancy.",
    },
}

_DOSAGE_LOWER = {k.lower(): v for k, v in DOSAGE_LIMITS.items()}


class WHODosageBenchmarks:
    """
    Provides WHO/Pharmacopoeia-based maximum daily dosage limits and
    safety information for common active ingredients.
    """

    def get_max_daily_dose(self, salt_name: str) -> Optional[dict]:
        if not salt_name or not salt_name.strip():
            return None

        key = salt_name.strip().lower()
        info = _DOSAGE_LOWER.get(key)

        if info:
            return {
                "salt": salt_name.strip(),
                **info,
            }

        return None

    def validate_daily_dose(
        self, salt_name: str, total_daily_mg: float
    ) -> dict:
        limit = self.get_max_daily_dose(salt_name)

        if not limit:
            return {
                "salt": salt_name,
                "daily_mg": total_daily_mg,
                "status": "UNKNOWN",
                "message": f"No dosage benchmark available for {salt_name}",
                "severity": "info",
            }

        max_mg = limit["max_daily_mg"]

        if total_daily_mg <= max_mg:
            return {
                "salt": salt_name,
                "daily_mg": total_daily_mg,
                "max_daily_mg": max_mg,
                "status": "SAFE",
                "message": f"{total_daily_mg}mg/day is within safe limit of {max_mg}mg/day",
                "severity": "safe",
                "utilization_percent": round((total_daily_mg / max_mg) * 100, 1),
            }
        elif total_daily_mg <= max_mg * 1.2:
            return {
                "salt": salt_name,
                "daily_mg": total_daily_mg,
                "max_daily_mg": max_mg,
                "status": "WARNING",
                "message": f"{total_daily_mg}mg/day is near the max safe limit of {max_mg}mg/day",
                "severity": "warning",
                "utilization_percent": round((total_daily_mg / max_mg) * 100, 1),
            }
        else:
            return {
                "salt": salt_name,
                "daily_mg": total_daily_mg,
                "max_daily_mg": max_mg,
                "status": "DANGER",
                "message": f"OVERDOSE RISK: {total_daily_mg}mg/day exceeds max safe limit of {max_mg}mg/day",
                "severity": "critical",
                "utilization_percent": round((total_daily_mg / max_mg) * 100, 1),
                "excess_mg": round(total_daily_mg - max_mg, 2),
            }

    def get_pregnancy_category(self, salt_name: str) -> Optional[str]:
        limit = self.get_max_daily_dose(salt_name)
        return limit["pregnancy_category"] if limit else None

    def get_all_benchmarks(self) -> dict:
        return DOSAGE_LIMITS
