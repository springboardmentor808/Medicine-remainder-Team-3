"""
PillSync Track 1 Vision - Fuzzy Catalog Matcher Module.

Matches OCR-extracted medicine strings against the Indian Medicines catalog
using RapidFuzz token_sort_ratio and returns verified matches, generic salts,
and confidence scores.
"""

import csv
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from rapidfuzz import fuzz, process
    HAS_RAPIDFUZZ = True
except ImportError:
    fuzz = None
    process = None
    HAS_RAPIDFUZZ = False
    import difflib


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAW_CSV_PATH = PROJECT_ROOT / "data" / "raw" / "indian_medicine_data.csv"
CATALOG_JSON_PATH = PROJECT_ROOT / "backend" / "app" / "catalogs" / "indian_medicines_catalog.json"


class FuzzyCatalogMatcher:
    """Fuzzy Medicine Catalog Matcher using RapidFuzz."""

    def __init__(
        self,
        catalog_path: Optional[Union[str, Path]] = None,
        csv_path: Optional[Union[str, Path]] = None,
        auto_build: bool = True,
        max_catalog_entries: Optional[int] = None,
    ):
        self.catalog_path = Path(catalog_path) if catalog_path else CATALOG_JSON_PATH
        self.csv_path = Path(csv_path) if csv_path else RAW_CSV_PATH
        self.catalog: List[Dict[str, Any]] = []
        self.name_list: List[str] = []

        if auto_build:
            self._ensure_catalog_exists(max_entries=max_catalog_entries)
        self._load_catalog()

    def _ensure_catalog_exists(self, max_entries: Optional[int] = None) -> None:
        """Build indian_medicines_catalog.json from indian_medicine_data.csv if missing."""
        if self.catalog_path.exists() and self.catalog_path.stat().st_size > 100:
            return

        if not self.csv_path.exists():
            print(f"[FuzzyCatalogMatcher] Warning: Source CSV not found at {self.csv_path}")
            return

        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        catalog_entries: List[Dict[str, Any]] = []

        try:
            with open(self.csv_path, mode="r", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                count = 0
                for row in reader:
                    name = (row.get("name") or "").strip()
                    if not name:
                        continue

                    mfr = (row.get("manufacturer_name") or "").strip()
                    comp1 = (row.get("short_composition1") or "").strip()
                    comp2 = (row.get("short_composition2") or "").strip()

                    # Combine non-empty short compositions into generic salt string
                    generic_salt = ", ".join(filter(None, [comp1, comp2]))

                    entry = {
                        "name": name,
                        "manufacturer": mfr,
                        "generic_salt": generic_salt,
                        "price": row.get("price(₹)", "").strip(),
                    }
                    catalog_entries.append(entry)
                    count += 1
                    if max_entries and count >= max_entries:
                        break

            with open(self.catalog_path, mode="w", encoding="utf-8") as out_f:
                json.dump(catalog_entries, out_f, indent=2, ensure_ascii=False)

            print(f"[FuzzyCatalogMatcher] Compiled {len(catalog_entries)} entries into {self.catalog_path}")

        except Exception as e:
            print(f"[FuzzyCatalogMatcher] Failed to build catalog JSON: {e}")

    def _load_catalog(self) -> None:
        """Loads catalog JSON into memory."""
        if not self.catalog_path.exists():
            return

        try:
            with open(self.catalog_path, mode="r", encoding="utf-8") as f:
                self.catalog = json.load(f)
            self.name_list = [entry["name"] for entry in self.catalog]
        except Exception as e:
            print(f"[FuzzyCatalogMatcher] Failed to load catalog JSON: {e}")
            self.catalog = []
            self.name_list = []

    def match_medicine(self, text: str, score_cutoff: float = 60.0) -> Dict[str, Any]:
        """
        Fuzzy matches extracted text against the Indian medicine catalog.

        Args:
            text: Raw OCR text line or candidate medicine string.
            score_cutoff: Minimum similarity score (0 to 100) to accept a match.

        Returns:
            Dict containing:
                - verified: bool
                - original_text: str
                - matched_medicine: str | None
                - generic_salt: str | None
                - confidence: float (0.0 to 1.0)
        """
        result_default = {
            "verified": False,
            "original_text": text or "",
            "matched_medicine": None,
            "generic_salt": None,
            "confidence": 0.0,
        }

        if not text or not text.strip() or not self.name_list:
            return result_default

        clean_query = text.strip()

        try:
            if HAS_RAPIDFUZZ and process is not None and fuzz is not None:
                # Use RapidFuzz token_sort_ratio
                best_match = process.extractOne(
                    clean_query,
                    self.name_list,
                    scorer=fuzz.token_sort_ratio,
                    score_cutoff=score_cutoff,
                )

                if best_match:
                    matched_name, score, index = best_match[0], best_match[1], best_match[2]
                    catalog_entry = self.catalog[index]
                    confidence = round(float(score) / 100.0, 2)

                    return {
                        "verified": confidence >= 0.60,
                        "original_text": clean_query,
                        "matched_medicine": catalog_entry.get("name"),
                        "generic_salt": catalog_entry.get("generic_salt"),
                        "confidence": confidence,
                    }

            else:
                # Fallback to standard library difflib
                matches = difflib.get_close_matches(clean_query, self.name_list, n=1, cutoff=score_cutoff / 100.0)
                if matches:
                    matched_name = matches[0]
                    index = self.name_list.index(matched_name)
                    catalog_entry = self.catalog[index]
                    ratio = difflib.SequenceMatcher(None, clean_query, matched_name).ratio()

                    return {
                        "verified": ratio >= 0.60,
                        "original_text": clean_query,
                        "matched_medicine": catalog_entry.get("name"),
                        "generic_salt": catalog_entry.get("generic_salt"),
                        "confidence": round(float(ratio), 2),
                    }

        except Exception as err:
            print(f"[FuzzyCatalogMatcher] Exception during matching: {err}")

        return result_default
