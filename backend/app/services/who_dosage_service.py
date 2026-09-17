"""
PillSync WHO Essential Medicines Dosage Benchmarks Service (Production Hardened).

Provides standardized maximum safe daily dosage limits based on the
WHO Model List of Essential Medicines (EML), British National Formulary (BNF),
and FDA pharmacological standards.

Key clinical capabilities:
  1. Multi-salt fuzzy tokenization and composition extraction
  2. Weight-based (mg/kg/day) pediatric dosage validation (<18 years / <40kg)
  3. Hepatic and renal impairment adjustment flags
  4. Pregnancy category classification with PLLR clinical advisories
  5. Multi-tier clinical overdose alert engine
"""

import re
from typing import Optional, List, Dict, Any

# ---------------------------------------------------------------------------
# WHO / Pharmacological Benchmark Knowledge Base
# ---------------------------------------------------------------------------
DOSAGE_LIMITS: Dict[str, Dict[str, Any]] = {
    # --- Analgesics & Antipyretics ---
    "paracetamol": {
        "canonical_name": "Paracetamol",
        "aliases": ["acetaminophen", "pcm", "paracetamol ip", "paracetamol bp", "apap"],
        "max_daily_mg": 4000.0,
        "adult_dose_range": "500-1000mg per dose every 4-6 hours, max 4000mg/day",
        "pediatric_dose_mg_per_kg": 60.0,  # Max 60mg/kg/day divided in 4 doses
        "frequency": "Every 4-6 hours",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Hepatotoxic above 4g/day. Acute liver failure risk at >150mg/kg.",
    },
    "ibuprofen": {
        "canonical_name": "Ibuprofen",
        "aliases": ["ibuprofen ip", "advil", "motrin"],
        "max_daily_mg": 2400.0,
        "adult_dose_range": "200-800mg per dose 3-4 times daily",
        "pediatric_dose_mg_per_kg": 40.0,  # Max 40mg/kg/day
        "frequency": "3-4 times daily with food",
        "pregnancy_category": "C (D in 3rd trimester)",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Avoid in third trimester (premature closure of ductus arteriosus). GI ulceration risk.",
    },
    "diclofenac": {
        "canonical_name": "Diclofenac",
        "aliases": ["diclofenac sodium", "diclofenac potassium", "voveran"],
        "max_daily_mg": 150.0,
        "adult_dose_range": "50mg 2-3 times daily",
        "pediatric_dose_mg_per_kg": 3.0,
        "frequency": "2-3 times daily",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Cardiovascular and thrombotic risk with prolonged use.",
    },
    "aceclofenac": {
        "canonical_name": "Aceclofenac",
        "aliases": ["aceclofenac ip"],
        "max_daily_mg": 200.0,
        "adult_dose_range": "100mg twice daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Twice daily",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Contraindicated in children under 18. Monitor renal profile.",
    },
    "tramadol": {
        "canonical_name": "Tramadol",
        "aliases": ["tramadol hydrochloride", "tramadol hcl", "ultram"],
        "max_daily_mg": 400.0,
        "adult_dose_range": "50-100mg every 4-6 hours",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Every 4-6 hours",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Opioid analgesic. Risk of respiratory depression, dependence, and serotonin syndrome.",
    },

    # --- Diabetes ---
    "metformin": {
        "canonical_name": "Metformin",
        "aliases": ["metformin hydrochloride", "metformin hcl", "glyciphage"],
        "max_daily_mg": 2550.0,
        "adult_dose_range": "500-850mg, 2-3 times daily",
        "pediatric_dose_mg_per_kg": 40.0,
        "frequency": "2-3 times daily with meals",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Contraindicated in severe renal impairment (eGFR < 30 mL/min). Lactic acidosis risk.",
    },
    "glimepiride": {
        "canonical_name": "Glimepiride",
        "aliases": ["amaryl"],
        "max_daily_mg": 8.0,
        "adult_dose_range": "1-4mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily with breakfast",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "High hypoglycemia risk. Start low (1mg) and titrate slowly.",
    },
    "sitagliptin": {
        "canonical_name": "Sitagliptin",
        "aliases": ["januvia"],
        "max_daily_mg": 100.0,
        "adult_dose_range": "100mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Reduce dose in renal impairment: 50mg if eGFR 30-45, 25mg if eGFR < 30.",
    },
    "glipizide": {
        "canonical_name": "Glipizide",
        "aliases": ["minidiab", "glucotrol"],
        "max_daily_mg": 40.0,
        "adult_dose_range": "2.5-20mg daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "1-2 times daily 30 min before meals",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Preferred sulfonylurea in renal disease due to inactive metabolites.",
    },

    # --- Cardiovascular & Hypertension ---
    "amlodipine": {
        "canonical_name": "Amlodipine",
        "aliases": ["amlodipine besylate", "norvasc", "stamlo"],
        "max_daily_mg": 10.0,
        "adult_dose_range": "2.5-10mg once daily",
        "pediatric_dose_mg_per_kg": 0.6,
        "frequency": "Once daily",
        "pregnancy_category": "C",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Peripheral edema common at 10mg. Start elderly at 2.5mg.",
    },
    "telmisartan": {
        "canonical_name": "Telmisartan",
        "aliases": ["micardis", "telma"],
        "max_daily_mg": 80.0,
        "adult_dose_range": "20-80mg once daily",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily",
        "pregnancy_category": "D",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "FETOTOXIC. Strict contraindication in pregnancy (2nd & 3rd trimesters).",
    },
    "atorvastatin": {
        "canonical_name": "Atorvastatin",
        "aliases": ["atorvastatin calcium", "lipitor", "atorva"],
        "max_daily_mg": 80.0,
        "adult_dose_range": "10-80mg once daily in evening",
        "pediatric_dose_mg_per_kg": None,
        "frequency": "Once daily in evening",
        "pregnancy_category": "X",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "TERATOGENIC. Absolute contraindication in pregnancy and active liver disease.",
    },
    "losartan": {
        "canonical_name": "Losartan",
        "aliases": ["losartan potassium", "cozaar", "losar"],
        "max_daily_mg": 100.0,
        "adult_dose_range": "25-100mg once daily",
        "pediatric_dose_mg_per_kg": 1.4,
        "frequency": "Once daily",
        "pregnancy_category": "D",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Contraindicated in pregnancy. Monitor potassium and serum creatinine.",
    },

    # --- Antibiotics ---
    "amoxicillin": {
        "canonical_name": "Amoxicillin",
        "aliases": ["amoxycillin", "amoxil", "amoxicillin trihydrate"],
        "max_daily_mg": 3000.0,
        "adult_dose_range": "250-500mg every 8 hours or 875mg every 12 hours",
        "pediatric_dose_mg_per_kg": 90.0,  # Max 90mg/kg/day in otitis media
        "frequency": "Every 8-12 hours",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": False,
        "notes": "Penicillin cross-allergy. Complete full prescribed course.",
    },
    "clavulanic acid": {
        "canonical_name": "Clavulanic Acid",
        "aliases": ["potassium clavulanate", "clavulanate potassium", "clavulanate"],
        "max_daily_mg": 375.0,
        "adult_dose_range": "125mg 2-3 times daily combined with amoxicillin",
        "pediatric_dose_mg_per_kg": 10.0,
        "frequency": "With amoxicillin",
        "pregnancy_category": "B",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Beta-lactamase inhibitor. Can cause gastrointestinal upset / diarrhea.",
    },
    "azithromycin": {
        "canonical_name": "Azithromycin",
        "aliases": ["zithromax", "azithral"],
        "max_daily_mg": 500.0,
        "adult_dose_range": "500mg once daily on day 1, then 250mg daily for 4 days",
        "pediatric_dose_mg_per_kg": 12.0,  # 10mg/kg day 1, 5mg/kg days 2-5
        "frequency": "Once daily 1h before or 2h after meals",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "QT prolongation risk. Macrolide class.",
    },
    "ciprofloxacin": {
        "canonical_name": "Ciprofloxacin",
        "aliases": ["cipro", "cifran"],
        "max_daily_mg": 1500.0,
        "adult_dose_range": "250-750mg twice daily",
        "pediatric_dose_mg_per_kg": 30.0,
        "frequency": "Twice daily",
        "pregnancy_category": "C",
        "renal_adjustment": True,
        "hepatic_adjustment": True,
        "notes": "Black box warning: tendon rupture and QT prolongation. Avoid in children unless anthrax/complicated UTI.",
    },

    # --- Gastrointestinal ---
    "pantoprazole": {
        "canonical_name": "Pantoprazole",
        "aliases": ["pantoprazole sodium", "pantocid", "pan"],
        "max_daily_mg": 80.0,
        "adult_dose_range": "40mg once daily (up to 80mg in Zollinger-Ellison)",
        "pediatric_dose_mg_per_kg": 1.0,
        "frequency": "Once daily 30-60 min before breakfast",
        "pregnancy_category": "B",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Long term PPI use: hypomagnesemia and fracture risk.",
    },
    "omeprazole": {
        "canonical_name": "Omeprazole",
        "aliases": ["prilosec", "omez"],
        "max_daily_mg": 40.0,
        "adult_dose_range": "20-40mg once daily",
        "pediatric_dose_mg_per_kg": 1.0,
        "frequency": "Once daily before breakfast",
        "pregnancy_category": "C",
        "renal_adjustment": False,
        "hepatic_adjustment": True,
        "notes": "Inhibits CYP2C19. Strong interaction with Clopidogrel (decreases antiplatelet effect).",
    },
}

# Pre-build fast alias map
_ALIAS_MAP: Dict[str, str] = {}
for canonical_key, data in DOSAGE_LIMITS.items():
    _ALIAS_MAP[canonical_key] = canonical_key
    _ALIAS_MAP[data["canonical_name"].lower()] = canonical_key
    for alias in data.get("aliases", []):
        _ALIAS_MAP[alias.lower()] = canonical_key


class WHODosageBenchmarks:
    """
    Clinical-grade dosage validation engine.
    Supports multi-salt extraction, pediatric weight calculations,
    and clinical contraindication warnings.
    """

    def normalize_salt_name(self, raw_salt: str) -> Optional[str]:
        """Normalizes salt string to canonical benchmark key."""
        if not raw_salt or not raw_salt.strip():
            return None
        cleaned = raw_salt.strip().lower()
        cleaned = re.sub(r"\b(ip|bp|usp|hydrochloride|hcl|sodium|potassium|calcium|trihydrate|monohydrate|extended release|er|sr)\b", "", cleaned).strip()
        cleaned = re.sub(r"\s+", " ", cleaned)

        # Exact alias match
        if cleaned in _ALIAS_MAP:
            return _ALIAS_MAP[cleaned]

        # Partial token match
        for alias, canonical in _ALIAS_MAP.items():
            if alias in cleaned or cleaned in alias:
                return canonical

        return None

    def extract_salts(self, raw_text: str) -> List[Dict[str, Any]]:
        """
        Parses complex multi-salt combinations like:
        'Amoxycillin (500mg) + Clavulanic Acid (125mg)' -> [{'salt': 'amoxicillin', 'mg': 500}, ...]
        """
        if not raw_text:
            return []

        # Split on +, /, and, &
        parts = re.split(r"\s*[\+\/\&]\s*|\s+and\s+", raw_text, flags=re.IGNORECASE)
        results = []

        for part in parts:
            part_str = part.strip()
            if not part_str:
                continue

            # Extract strength
            strength_match = re.search(r"(\d+(?:\.\d+)?)\s*(mg|g|mcg|iu)", part_str, re.IGNORECASE)
            mg_val = 0.0
            if strength_match:
                val = float(strength_match.group(1))
                unit = strength_match.group(2).lower()
                if unit == "g":
                    mg_val = val * 1000.0
                elif unit == "mcg":
                    mg_val = val / 1000.0
                else:
                    mg_val = val
            
            clean_salt_str = re.sub(r"\(\s*\d+(?:\.\d+)?\s*(?:mg|g|mcg|iu)?\s*\)|\d+(?:\.\d+)?\s*(?:mg|g|mcg|iu)", "", part_str, flags=re.IGNORECASE).strip()
            canonical = self.normalize_salt_name(clean_salt_str)
            if canonical:
                results.append({
                    "salt_key": canonical,
                    "canonical_name": DOSAGE_LIMITS[canonical]["canonical_name"],
                    "mg": mg_val,
                })

        return results

    def get_max_daily_dose(self, salt_name: str) -> Optional[dict]:
        """Lookup maximum daily dosage and pharmacological metadata."""
        canonical = self.normalize_salt_name(salt_name)
        if canonical and canonical in DOSAGE_LIMITS:
            info = DOSAGE_LIMITS[canonical]
            return {
                "salt": info["canonical_name"],
                **info,
            }
        return None

    def validate_daily_dose(
        self,
        salt_name: str,
        total_daily_mg: float,
        patient_age: Optional[int] = None,
        patient_weight_kg: Optional[float] = None,
    ) -> dict:
        """
        Validates daily dose against WHO/FDA clinical benchmarks.
        Strictly enforces weight-based pediatric limits (<18 yrs or <40kg).
        """
        limit = self.get_max_daily_dose(salt_name)
        if not limit:
            return {
                "salt": salt_name,
                "daily_mg": total_daily_mg,
                "status": "UNKNOWN",
                "message": f"No standardized WHO dosage benchmark available for '{salt_name}'. Clinical review recommended.",
                "severity": "info",
            }

        canonical_name = limit["canonical_name"]
        is_pediatric = (patient_age is not None and patient_age < 18) or (patient_weight_kg is not None and patient_weight_kg < 40.0)

        # ── Pediatric Validation Branch ──────────────────────────────────────────
        if is_pediatric:
            mg_per_kg_limit = limit.get("pediatric_dose_mg_per_kg")

            if mg_per_kg_limit is None:
                return {
                    "salt": canonical_name,
                    "daily_mg": total_daily_mg,
                    "status": "PEDIATRIC_CONTRAINDICATION",
                    "severity": "critical",
                    "message": f"CLINICAL SAFETY ALERT: {canonical_name} is not approved or recommended for pediatric use without specialist oversight.",
                    "notes": limit.get("notes", ""),
                }

            if patient_weight_kg is None or patient_weight_kg <= 0:
                return {
                    "salt": canonical_name,
                    "daily_mg": total_daily_mg,
                    "status": "REQUIRES_WEIGHT_BASED_DOSING",
                    "severity": "critical",
                    "message": f"CLINICAL SAFETY ALERT: Pediatric dosing for {canonical_name} requires patient body weight. Benchmark: max {mg_per_kg_limit}mg/kg/day.",
                }

            max_allowed_mg = round(mg_per_kg_limit * patient_weight_kg, 2)

            if total_daily_mg > max_allowed_mg:
                excess = round(total_daily_mg - max_allowed_mg, 2)
                return {
                    "salt": canonical_name,
                    "daily_mg": total_daily_mg,
                    "max_daily_mg": max_allowed_mg,
                    "status": "PEDIATRIC_OVERDOSE_ALERT",
                    "severity": "critical",
                    "message": f"LETHAL PEDIATRIC OVERDOSE RISK: {total_daily_mg}mg/day exceeds maximum pediatric limit of {max_allowed_mg}mg/day ({mg_per_kg_limit}mg/kg/day for {patient_weight_kg}kg child).",
                    "excess_mg": excess,
                    "utilization_percent": round((total_daily_mg / max_allowed_mg) * 100, 1),
                    "notes": limit.get("notes", ""),
                }

            return {
                "salt": canonical_name,
                "daily_mg": total_daily_mg,
                "max_daily_mg": max_allowed_mg,
                "status": "SAFE",
                "severity": "safe",
                "message": f"{total_daily_mg}mg/day is within safe pediatric limit of {max_allowed_mg}mg/day ({mg_per_kg_limit}mg/kg/day for {patient_weight_kg}kg).",
                "utilization_percent": round((total_daily_mg / max_allowed_mg) * 100, 1),
            }

        # ── Adult Validation Branch ──────────────────────────────────────────────
        max_adult_mg = limit["max_daily_mg"]

        if total_daily_mg <= max_adult_mg:
            return {
                "salt": canonical_name,
                "daily_mg": total_daily_mg,
                "max_daily_mg": max_adult_mg,
                "status": "SAFE",
                "severity": "safe",
                "message": f"{total_daily_mg}mg/day is within safe maximum limit of {max_adult_mg}mg/day.",
                "utilization_percent": round((total_daily_mg / max_adult_mg) * 100, 1),
            }
        elif total_daily_mg <= max_adult_mg * 1.15:
            return {
                "salt": canonical_name,
                "daily_mg": total_daily_mg,
                "max_daily_mg": max_adult_mg,
                "status": "WARNING",
                "severity": "warning",
                "message": f"DOSAGE WARNING: {total_daily_mg}mg/day is near or slightly above maximum benchmark of {max_adult_mg}mg/day.",
                "utilization_percent": round((total_daily_mg / max_adult_mg) * 100, 1),
                "excess_mg": round(total_daily_mg - max_adult_mg, 2),
            }
        else:
            return {
                "salt": canonical_name,
                "daily_mg": total_daily_mg,
                "max_daily_mg": max_adult_mg,
                "status": "OVERDOSE_ALERT",
                "severity": "critical",
                "message": f"CLINICAL OVERDOSE ALERT: {total_daily_mg}mg/day exceeds maximum safe limit of {max_adult_mg}mg/day.",
                "severity": "critical",
                "utilization_percent": round((total_daily_mg / max_adult_mg) * 100, 1),
                "excess_mg": round(total_daily_mg - max_adult_mg, 2),
                "notes": limit.get("notes", ""),
            }

    def get_pregnancy_category(self, salt_name: str) -> Optional[dict]:
        """Provides pregnancy category and clinical advisory."""
        limit = self.get_max_daily_dose(salt_name)
        if limit:
            return {
                "salt": limit["canonical_name"],
                "pregnancy_category": limit["pregnancy_category"],
                "teratogenic_risk": limit["pregnancy_category"] in ["D", "X", "C (D in 3rd trimester)"],
                "notes": limit.get("notes", ""),
            }
        return None
