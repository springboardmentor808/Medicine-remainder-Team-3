"""
PillSync Generic Substitution Engine (Track 3 -- Engineer 3).

Finds cheaper generic alternatives for branded Indian medicines by matching
identical salt compositions (fingerprints) from the processed catalog.

Key capabilities:
  1. Load the processed catalog (pillsync_medicine_import.csv)
  2. Group medicines by composition_fingerprint
  3. For any brand, find all alternatives sorted by price (ascending)
  4. Calculate savings in INR (per unit and per pack)

Usage:
    from ai_training.src.generic_substitution_engine import GenericSubstitutionEngine

    engine = GenericSubstitutionEngine()
    engine.load_catalog()
    alternatives = engine.find_alternatives("Augmentin 625 Duo Tablet")
"""

import csv
from collections import defaultdict
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CATALOG_PATH = PROJECT_ROOT / "data" / "processed" / "pillsync_medicine_import.csv"


class MedicineLite:
    """Lightweight medicine record for the substitution engine."""

    __slots__ = (
        "id", "brand_name", "price_inr", "price_per_unit_inr",
        "is_discontinued", "manufacturer", "dosage_form",
        "pack_quantity", "salt_1_name", "salt_1_strength", "salt_1_unit",
        "salt_2_name", "salt_2_strength", "salt_2_unit",
        "composition_fingerprint", "generic_group_hash",
    )

    def __init__(self, row: dict):
        self.id = row.get("id", "")
        self.brand_name = row.get("brand_name", "")
        try:
            self.price_inr = float(row.get("price_inr", 0))
        except (ValueError, TypeError):
            self.price_inr = 0.0
        try:
            self.price_per_unit_inr = float(row.get("price_per_unit_inr", 0))
        except (ValueError, TypeError):
            self.price_per_unit_inr = 0.0
        self.is_discontinued = row.get("is_discontinued", "False") == "True"
        self.manufacturer = row.get("manufacturer", "")
        self.dosage_form = row.get("dosage_form", "")
        try:
            self.pack_quantity = int(float(row.get("pack_quantity", 1)))
        except (ValueError, TypeError):
            self.pack_quantity = 1
        self.salt_1_name = row.get("salt_1_name", "")
        self.salt_1_strength = row.get("salt_1_strength", "")
        self.salt_1_unit = row.get("salt_1_unit", "")
        self.salt_2_name = row.get("salt_2_name", "")
        self.salt_2_strength = row.get("salt_2_strength", "")
        self.salt_2_unit = row.get("salt_2_unit", "")
        self.composition_fingerprint = row.get("composition_fingerprint", "")
        self.generic_group_hash = row.get("generic_group_hash", "")


class GenericSubstitutionEngine:
    """
    Finds cheaper generic alternatives for branded medicines.

    Algorithm:
      1. Index all medicines by composition_fingerprint
      2. For a given brand, find its fingerprint
      3. Return all other brands with the same fingerprint, sorted by price
      4. Calculate savings per unit and per pack in INR
    """

    def __init__(self):
        self._name_index: dict[str, MedicineLite] = {}  # lowercase name -> MedicineLite
        self._fingerprint_groups: dict[str, list[MedicineLite]] = defaultdict(list)
        self._loaded = False

    def load_catalog(self, catalog_path: Optional[Path] = None):
        """Load the processed catalog CSV into memory indexes."""
        path = catalog_path or CATALOG_PATH

        if not path.exists():
            raise FileNotFoundError(
                f"Catalog not found at {path}. "
                f"Run ai_training/src/clean_indian_data.py first."
            )

        print(f"[GenericEngine] Loading catalog: {path}")
        count = 0

        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                med = MedicineLite(row)

                # Skip discontinued medicines from alternatives
                # (but still index them for lookup)
                self._name_index[med.brand_name.lower()] = med

                if med.composition_fingerprint:
                    self._fingerprint_groups[med.composition_fingerprint].append(med)

                count += 1

        self._loaded = True
        unique_groups = len(self._fingerprint_groups)
        print(f"[GenericEngine] Loaded {count:,} medicines in {unique_groups:,} composition groups")

    def find_by_name(self, brand_name: str) -> Optional[MedicineLite]:
        """Look up a medicine by its exact brand name."""
        return self._name_index.get(brand_name.strip().lower())

    def find_alternatives(
        self,
        brand_name: str,
        max_results: int = 20,
        exclude_discontinued: bool = True,
        same_dosage_form: bool = False,
    ) -> dict:
        """
        Find cheaper generic alternatives for a given branded medicine.

        Args:
            brand_name: The brand medicine name to find alternatives for.
            max_results: Maximum number of alternatives to return.
            exclude_discontinued: If True, skip discontinued medicines.
            same_dosage_form: If True, only match medicines with the same form
                              (e.g., only tablets for tablets).

        Returns:
            dict with keys:
              - query_medicine: the input medicine details
              - composition: the shared salt composition
              - total_alternatives: count of all brands with same composition
              - alternatives: list of alternatives sorted by price (cheapest first)
              - max_savings_per_unit_inr: maximum per-unit savings in INR
        """
        if not self._loaded:
            self.load_catalog()

        source = self.find_by_name(brand_name)
        if not source:
            return {
                "query_medicine": None,
                "error": f"Medicine '{brand_name}' not found in catalog",
                "alternatives": [],
            }

        fingerprint = source.composition_fingerprint
        if not fingerprint:
            return {
                "query_medicine": {
                    "name": source.brand_name,
                    "price_inr": source.price_inr,
                    "manufacturer": source.manufacturer,
                },
                "error": "No composition data available for this medicine",
                "alternatives": [],
            }

        # Get all medicines with the same composition
        group = self._fingerprint_groups.get(fingerprint, [])

        alternatives = []
        for med in group:
            # Skip the query medicine itself
            if med.brand_name.lower() == source.brand_name.lower():
                continue

            # Apply filters
            if exclude_discontinued and med.is_discontinued:
                continue
            if same_dosage_form and med.dosage_form != source.dosage_form:
                continue

            savings_per_unit = source.price_per_unit_inr - med.price_per_unit_inr
            savings_percent = 0.0
            if source.price_per_unit_inr > 0:
                savings_percent = (savings_per_unit / source.price_per_unit_inr) * 100

            alternatives.append({
                "brand_name": med.brand_name,
                "manufacturer": med.manufacturer,
                "price_inr": med.price_inr,
                "price_per_unit_inr": med.price_per_unit_inr,
                "pack_quantity": med.pack_quantity,
                "dosage_form": med.dosage_form,
                "savings_per_unit_inr": round(savings_per_unit, 2),
                "savings_percent": round(savings_percent, 1),
                "is_cheaper": savings_per_unit > 0,
            })

        # Sort by price per unit (cheapest first)
        alternatives.sort(key=lambda x: x["price_per_unit_inr"])

        # Trim to max_results
        alternatives = alternatives[:max_results]

        # Calculate max savings
        max_savings = 0.0
        if alternatives:
            cheapest = alternatives[0]["price_per_unit_inr"]
            max_savings = round(source.price_per_unit_inr - cheapest, 2)

        return {
            "query_medicine": {
                "name": source.brand_name,
                "price_inr": source.price_inr,
                "price_per_unit_inr": source.price_per_unit_inr,
                "manufacturer": source.manufacturer,
                "dosage_form": source.dosage_form,
                "composition": fingerprint,
            },
            "total_alternatives": len(group) - 1,
            "alternatives": alternatives,
            "max_savings_per_unit_inr": max_savings,
        }

    def search_medicines(self, query: str, limit: int = 10) -> list[dict]:
        """
        Simple substring search for medicine auto-complete.
        Returns medicines whose brand name contains the query string.
        """
        if not self._loaded:
            self.load_catalog()

        query_lower = query.strip().lower()
        if not query_lower:
            return []

        results = []
        for name, med in self._name_index.items():
            if query_lower in name:
                results.append({
                    "brand_name": med.brand_name,
                    "price_inr": med.price_inr,
                    "manufacturer": med.manufacturer,
                    "dosage_form": med.dosage_form,
                    "salt_1": f"{med.salt_1_name} {med.salt_1_strength}{med.salt_1_unit}".strip(),
                })
                if len(results) >= limit:
                    break

        return results


# ---------------------------------------------------------------------------
# CLI Demo
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 72)
    print("  PillSync Generic Substitution Engine Demo")
    print("=" * 72)

    engine = GenericSubstitutionEngine()
    engine.load_catalog()

    # Test cases
    test_brands = [
        "Augmentin 625 Duo Tablet",
        "Azithral 500 Tablet",
        "Allegra 120mg Tablet",
    ]

    for brand in test_brands:
        print(f"\n{'='*72}")
        print(f"  Finding cheaper alternatives for: {brand}")
        print(f"{'='*72}")

        result = engine.find_alternatives(brand, max_results=5)

        if result.get("error"):
            print(f"  [WARN] {result['error']}")
            continue

        qm = result["query_medicine"]
        print(f"  Brand    : {qm['name']}")
        print(f"  Price    : INR {qm['price_inr']}")
        print(f"  Per Unit : INR {qm['price_per_unit_inr']}")
        print(f"  Salt     : {qm['composition']}")
        print(f"  Total Alternatives: {result['total_alternatives']}")
        print(f"  Max Savings/unit  : INR {result['max_savings_per_unit_inr']}")

        print(f"\n  Top 5 Cheapest Alternatives:")
        for i, alt in enumerate(result["alternatives"][:5], 1):
            flag = "[CHEAPER]" if alt["is_cheaper"] else ""
            print(
                f"    {i}. {alt['brand_name'][:40]:40s} "
                f"INR {alt['price_per_unit_inr']:>8.2f}/unit  "
                f"Save: INR {alt['savings_per_unit_inr']:>6.2f} ({alt['savings_percent']:>5.1f}%) "
                f"{flag}"
            )

    print(f"\n  [OK] Generic Substitution Engine ready")
