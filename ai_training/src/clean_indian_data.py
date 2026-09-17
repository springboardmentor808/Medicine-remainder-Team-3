"""
PillSync Indian Medicine Data ETL Pipeline (Track 3 — Engineer 3).

Processes `data/raw/indian_medicine_data.csv` (253,973 rows) into a clean,
normalized `data/processed/pillsync_medicine_import.csv` ready for database
seeding.

Key transformations:
  1. Parse messy `short_composition1/2` → structured salt_name + strength_mg
  2. Compute price_per_unit (₹ per tablet/ml/capsule)
  3. Extract pack_quantity and dosage_form from `pack_size_label`
  4. Normalize manufacturer names
  5. Build generic-substitution groups by composition fingerprint
  6. Export clean CSV + summary statistics

Usage:
    python ai_training/src/clean_indian_data.py
"""

import csv
import os
import re
import sys
import hashlib
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_CSV_PATH = PROJECT_ROOT / "data" / "raw" / "indian_medicine_data.csv"
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_CSV_PATH = OUTPUT_DIR / "pillsync_medicine_import.csv"
STATS_PATH = OUTPUT_DIR / "etl_stats.txt"


# ---------------------------------------------------------------------------
# Composition Parser
# ---------------------------------------------------------------------------
STRENGTH_PATTERN = re.compile(
    r"\(?\s*(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|iu|%|gm|mg/5ml|mcg/5ml|mg/ml|w/w|w/v|v/v)\s*\)?",
    re.IGNORECASE,
)

def parse_composition(raw_comp: str) -> list[dict]:
    """
    Parse a composition string like 'Amoxycillin (500mg)' into structured parts.

    Returns list of dicts: [{"salt_name": "Amoxycillin", "strength": "500", "unit": "mg"}]
    Handles multi-salt entries separated by '+' or ','
    """
    if not raw_comp or raw_comp.strip() == "":
        return []

    results = []
    # Split by '+' for multi-salt compositions
    parts = re.split(r"\s*\+\s*", raw_comp.strip())

    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Extract strength with unit
        strength_match = STRENGTH_PATTERN.search(part)
        if strength_match:
            strength = strength_match.group(1)
            unit = strength_match.group(2).lower()
            # Remove the strength portion to get the salt name
            salt_name = STRENGTH_PATTERN.sub("", part).strip()
            # Clean trailing/leading punctuation and whitespace
            salt_name = re.sub(r"[,;/\s]+$", "", salt_name).strip()
            salt_name = re.sub(r"^[,;/\s]+", "", salt_name).strip()
        else:
            salt_name = part.strip()
            strength = ""
            unit = ""

        if salt_name:
            results.append({
                "salt_name": salt_name.title(),
                "strength": strength,
                "unit": unit,
            })

    return results


# ---------------------------------------------------------------------------
# Pack Size Parser
# ---------------------------------------------------------------------------
PACK_PATTERN = re.compile(
    r"(?:strip|bottle|box|pack|packet|tube|vial|jar|sachet|pouch|can|container|bag|blister)\s+of\s+(\d+(?:\.\d+)?)\s*(tablets?|capsules?|ml|gm?|sachets?|injections?|drops?|softgels?|units?|pieces?|lozenges?)?",
    re.IGNORECASE,
)

DOSAGE_FORM_KEYWORDS = {
    "tablet": "Tablet",
    "capsule": "Capsule",
    "syrup": "Syrup",
    "injection": "Injection",
    "cream": "Cream",
    "ointment": "Ointment",
    "drops": "Drops",
    "gel": "Gel",
    "lotion": "Lotion",
    "powder": "Powder",
    "suspension": "Suspension",
    "solution": "Solution",
    "inhaler": "Inhaler",
    "spray": "Spray",
    "patch": "Patch",
    "suppository": "Suppository",
    "soap": "Soap",
    "shampoo": "Shampoo",
    "oil": "Oil",
    "sachet": "Sachet",
    "respule": "Respule",
    "softgel": "Softgel Capsule",
    "lozenge": "Lozenge",
    "mouthwash": "Mouthwash",
    "eye drop": "Eye Drops",
    "ear drop": "Ear Drops",
    "nasal": "Nasal Spray",
}

def parse_pack_size(label: str) -> dict:
    """
    Parse 'strip of 10 tablets' → {"pack_quantity": 10, "dosage_form": "Tablet"}
    """
    result = {"pack_quantity": 1, "dosage_form": "Unknown"}

    if not label or label.strip() == "":
        return result

    label_lower = label.lower().strip()

    # Extract quantity
    match = PACK_PATTERN.search(label_lower)
    if match:
        try:
            result["pack_quantity"] = float(match.group(1))
            if result["pack_quantity"] == int(result["pack_quantity"]):
                result["pack_quantity"] = int(result["pack_quantity"])
        except (ValueError, TypeError):
            result["pack_quantity"] = 1

    # Determine dosage form
    for keyword, form in DOSAGE_FORM_KEYWORDS.items():
        if keyword in label_lower:
            result["dosage_form"] = form
            break

    return result


# ---------------------------------------------------------------------------
# Composition Fingerprint (for Generic Substitution Grouping)
# ---------------------------------------------------------------------------
def make_composition_fingerprint(salts: list[dict]) -> str:
    """
    Create a stable fingerprint from parsed salt compositions.
    Used to group medicines with identical active ingredients for generic
    substitution recommendations.

    Example: Amoxycillin 500mg + Clavulanic Acid 125mg → "amoxycillin_500mg+clavulanic_acid_125mg"
    """
    if not salts:
        return ""

    parts = []
    for s in sorted(salts, key=lambda x: x["salt_name"].lower()):
        name = s["salt_name"].lower().strip()
        strength = s["strength"]
        unit = s["unit"]
        if strength and unit:
            parts.append(f"{name}_{strength}{unit}")
        elif strength:
            parts.append(f"{name}_{strength}")
        else:
            parts.append(name)

    fingerprint_str = "+".join(parts)
    return fingerprint_str


# ---------------------------------------------------------------------------
# Main ETL Pipeline
# ---------------------------------------------------------------------------
def run_etl():
    """Execute the full ETL pipeline."""
    print("=" * 72)
    print("  PillSync Indian Medicine Data ETL Pipeline")
    print("  Source: data/raw/indian_medicine_data.csv")
    print("=" * 72)

    if not RAW_CSV_PATH.exists():
        print(f"[ERROR] Raw CSV not found at: {RAW_CSV_PATH}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Counters ---
    total_rows = 0
    processed_rows = 0
    skipped_rows = 0
    discontinued_count = 0
    no_composition_count = 0
    dosage_form_stats = defaultdict(int)
    manufacturer_stats = defaultdict(int)
    composition_groups = defaultdict(list)  # fingerprint → list of medicine names
    price_data = []

    # --- Output CSV schema ---
    output_fields = [
        "id",
        "brand_name",
        "price_inr",
        "price_per_unit_inr",
        "is_discontinued",
        "manufacturer",
        "medicine_type",
        "pack_size_label",
        "pack_quantity",
        "dosage_form",
        "salt_1_name",
        "salt_1_strength",
        "salt_1_unit",
        "salt_2_name",
        "salt_2_strength",
        "salt_2_unit",
        "composition_full",
        "composition_fingerprint",
        "generic_group_hash",
    ]

    print(f"\n[1/4] Reading raw CSV: {RAW_CSV_PATH}")

    with open(RAW_CSV_PATH, "r", encoding="utf-8", errors="replace") as f_in, \
         open(OUTPUT_CSV_PATH, "w", newline="", encoding="utf-8") as f_out:

        reader = csv.DictReader(f_in)
        writer = csv.DictWriter(f_out, fieldnames=output_fields)
        writer.writeheader()

        for row in reader:
            total_rows += 1

            # --- Extract raw fields ---
            raw_id = row.get("id", "").strip()
            raw_name = row.get("name", "").strip()
            raw_price = row.get("price(₹)", row.get("price(\xa3\xac1)", "")).strip()
            # Handle encoding issues with the price column name
            if not raw_price:
                # Try all possible column name variants
                for key in row:
                    if "price" in key.lower():
                        raw_price = row[key].strip()
                        break

            raw_discontinued = row.get("Is_discontinued", "").strip().upper()
            raw_manufacturer = row.get("manufacturer_name", "").strip()
            raw_type = row.get("type", "").strip()
            raw_pack = row.get("pack_size_label", "").strip()
            raw_comp1 = row.get("short_composition1", "").strip()
            raw_comp2 = row.get("short_composition2", "").strip()

            # --- Skip empty names ---
            if not raw_name:
                skipped_rows += 1
                continue

            # --- Parse price ---
            try:
                price = float(raw_price) if raw_price else 0.0
            except ValueError:
                price = 0.0

            # --- Parse discontinued flag ---
            is_discontinued = raw_discontinued in ("TRUE", "1", "YES")
            if is_discontinued:
                discontinued_count += 1

            # --- Parse pack size ---
            pack_info = parse_pack_size(raw_pack)
            pack_quantity = pack_info["pack_quantity"]
            dosage_form = pack_info["dosage_form"]
            dosage_form_stats[dosage_form] += 1

            # --- Compute price per unit ---
            if pack_quantity and pack_quantity > 0 and price > 0:
                price_per_unit = round(price / pack_quantity, 2)
            else:
                price_per_unit = price

            # --- Parse compositions ---
            salts_1 = parse_composition(raw_comp1)
            salts_2 = parse_composition(raw_comp2)
            all_salts = salts_1 + salts_2

            if not all_salts:
                no_composition_count += 1

            # --- Build composition fingerprint ---
            composition_full_parts = []
            if raw_comp1:
                composition_full_parts.append(raw_comp1.strip())
            if raw_comp2:
                composition_full_parts.append(raw_comp2.strip())
            composition_full = " + ".join(composition_full_parts)

            fingerprint = make_composition_fingerprint(all_salts)

            # Create a hash for quick grouping
            if fingerprint:
                generic_group_hash = hashlib.md5(fingerprint.encode()).hexdigest()[:12]
                composition_groups[fingerprint].append(raw_name)
            else:
                generic_group_hash = ""

            # --- Manufacturer normalization ---
            manufacturer = raw_manufacturer.strip()
            if manufacturer:
                manufacturer_stats[manufacturer] += 1

            # --- Extract salt details (up to 2 salts for primary columns) ---
            s1 = salts_1[0] if salts_1 else {"salt_name": "", "strength": "", "unit": ""}
            s2_list = salts_2 if salts_2 else (salts_1[1:2] if len(salts_1) > 1 else [])
            s2 = s2_list[0] if s2_list else {"salt_name": "", "strength": "", "unit": ""}

            # --- Price statistics ---
            if price > 0:
                price_data.append(price_per_unit)

            # --- Write output row ---
            writer.writerow({
                "id": raw_id,
                "brand_name": raw_name,
                "price_inr": price,
                "price_per_unit_inr": price_per_unit,
                "is_discontinued": is_discontinued,
                "manufacturer": manufacturer,
                "medicine_type": raw_type,
                "pack_size_label": raw_pack,
                "pack_quantity": pack_quantity,
                "dosage_form": dosage_form,
                "salt_1_name": s1["salt_name"],
                "salt_1_strength": s1["strength"],
                "salt_1_unit": s1["unit"],
                "salt_2_name": s2["salt_name"],
                "salt_2_strength": s2["strength"],
                "salt_2_unit": s2["unit"],
                "composition_full": composition_full,
                "composition_fingerprint": fingerprint,
                "generic_group_hash": generic_group_hash,
            })

            processed_rows += 1

            # Progress indicator
            if total_rows % 50000 == 0:
                print(f"  ... processed {total_rows:,} rows")

    # --- Compute statistics ---
    print(f"\n[2/4] Computing statistics...")

    avg_price = sum(price_data) / len(price_data) if price_data else 0
    min_price = min(price_data) if price_data else 0
    max_price = max(price_data) if price_data else 0

    # Top 10 manufacturers
    top_manufacturers = sorted(manufacturer_stats.items(), key=lambda x: -x[1])[:10]

    # Generic substitution groups with more than 5 alternatives
    large_generic_groups = {k: len(v) for k, v in composition_groups.items() if len(v) >= 5}
    top_generic_groups = sorted(large_generic_groups.items(), key=lambda x: -x[1])[:15]

    # --- Write stats report ---
    print(f"[3/4] Writing statistics report...")

    stats_lines = [
        "=" * 72,
        "  PillSync Indian Medicine ETL — Processing Report",
        "=" * 72,
        "",
        f"  Total Input Rows          : {total_rows:,}",
        f"  Successfully Processed    : {processed_rows:,}",
        f"  Skipped (empty name)      : {skipped_rows:,}",
        f"  Discontinued Medicines    : {discontinued_count:,}",
        f"  Missing Composition       : {no_composition_count:,}",
        "",
        "--- Price Statistics (₹ per unit) ---",
        f"  Average  : ₹{avg_price:.2f}",
        f"  Minimum  : ₹{min_price:.2f}",
        f"  Maximum  : ₹{max_price:.2f}",
        f"  Total priced entries : {len(price_data):,}",
        "",
        "--- Dosage Form Distribution ---",
    ]
    for form, count in sorted(dosage_form_stats.items(), key=lambda x: -x[1]):
        stats_lines.append(f"  {form:25s} : {count:>8,}")

    stats_lines.extend([
        "",
        "--- Top 10 Manufacturers ---",
    ])
    for mfr, count in top_manufacturers:
        stats_lines.append(f"  {mfr[:50]:50s} : {count:>6,}")

    stats_lines.extend([
        "",
        f"--- Generic Substitution Groups (≥5 alternatives) : {len(large_generic_groups):,} groups ---",
    ])
    for fp, count in top_generic_groups:
        # Show first 60 chars of fingerprint
        stats_lines.append(f"  {fp[:60]:60s} : {count:>4} brands")

    stats_lines.extend([
        "",
        "=" * 72,
        f"  Output File: {OUTPUT_CSV_PATH}",
        f"  Output Size: {OUTPUT_CSV_PATH.stat().st_size / (1024*1024):.2f} MB",
        "=" * 72,
    ])

    stats_text = "\n".join(stats_lines)

    with open(STATS_PATH, "w", encoding="utf-8") as f:
        f.write(stats_text)

    # Handle Windows console encoding (cp1252 can't print ₹)
    try:
        print(stats_text)
    except UnicodeEncodeError:
        print(stats_text.encode("ascii", errors="replace").decode("ascii"))

    print(f"\n[4/4] ETL Pipeline Complete!")
    print(f"  [OK] Clean CSV   : {OUTPUT_CSV_PATH}")
    print(f"  [OK] Stats Report: {STATS_PATH}")
    print(f"  [OK] Processed   : {processed_rows:,} / {total_rows:,} medicines")

    return processed_rows, total_rows


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    run_etl()
