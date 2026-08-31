"""
PillSync Indian Medicine Catalog Bulk Seeder (Track 3 -- Engineer 3).

Seeds the `medicine_catalog` table from data/processed/pillsync_medicine_import.csv
using batch inserts for high performance (~253,973 records).

Features:
  - Batch insert (1000 rows per commit) for speed
  - Idempotent: checks if catalog already seeded before re-inserting
  - Progress logging with row counts
  - Handles both PostgreSQL and SQLite backends

Usage:
    cd backend
    python seed_indian_catalog.py

    # Or with wipe & reseed:
    python seed_indian_catalog.py --force
"""

import asyncio
import csv
import sys
import time
from pathlib import Path

from sqlalchemy import select, func, text
from app.core.database import async_session_factory, init_db
from app.models.medicine_catalog import MedicineCatalog

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CATALOG_CSV = PROJECT_ROOT / "data" / "processed" / "pillsync_medicine_import.csv"
BATCH_SIZE = 1000


async def count_catalog(session) -> int:
    """Count existing catalog records."""
    result = await session.execute(
        select(func.count(MedicineCatalog.id))
    )
    return result.scalar() or 0


async def clear_catalog(session):
    """Delete all catalog records (for --force reseed)."""
    await session.execute(text("DELETE FROM medicine_catalog"))
    await session.commit()
    print("[Seed] Cleared existing catalog records.")


async def seed_catalog(force: bool = False):
    """
    Seed the medicine_catalog table from the processed CSV.

    Args:
        force: If True, wipe existing data and reseed.
    """
    print("=" * 68)
    print("  PillSync Indian Medicine Catalog Seeder")
    print(f"  Source: {CATALOG_CSV}")
    print("=" * 68)

    if not CATALOG_CSV.exists():
        print(f"\n[ERROR] Catalog CSV not found: {CATALOG_CSV}")
        print("[ERROR] Run 'python ai_training/src/clean_indian_data.py' first.")
        sys.exit(1)

    print("\n[1/4] Initializing database tables...")
    await init_db()

    async with async_session_factory() as session:
        # Check existing count
        existing_count = await count_catalog(session)
        print(f"[2/4] Existing catalog records: {existing_count:,}")

        if existing_count > 0 and not force:
            print(f"[SKIP] Catalog already seeded ({existing_count:,} records).")
            print("[SKIP] Use --force to wipe and reseed.")
            return existing_count

        if existing_count > 0 and force:
            print("[FORCE] Clearing existing catalog for reseed...")
            await clear_catalog(session)

        # Read CSV and batch insert
        print(f"[3/4] Reading CSV and inserting in batches of {BATCH_SIZE}...")
        start_time = time.time()
        total_inserted = 0
        batch = []

        with open(CATALOG_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                # Parse fields with safe type conversion
                try:
                    price_inr = float(row.get("price_inr", 0) or 0)
                except (ValueError, TypeError):
                    price_inr = 0.0

                try:
                    price_per_unit = float(row.get("price_per_unit_inr", 0) or 0)
                except (ValueError, TypeError):
                    price_per_unit = 0.0

                try:
                    pack_qty = int(float(row.get("pack_quantity", 1) or 1))
                except (ValueError, TypeError):
                    pack_qty = 1

                is_disc = row.get("is_discontinued", "False") == "True"

                catalog_entry = MedicineCatalog(
                    source_id=row.get("id", ""),
                    brand_name=row.get("brand_name", "Unknown"),
                    manufacturer=row.get("manufacturer", ""),
                    medicine_type=row.get("medicine_type", ""),
                    price_inr=price_inr,
                    price_per_unit_inr=price_per_unit,
                    pack_size_label=row.get("pack_size_label", ""),
                    pack_quantity=pack_qty,
                    dosage_form=row.get("dosage_form", ""),
                    salt_1_name=row.get("salt_1_name", ""),
                    salt_1_strength=row.get("salt_1_strength", ""),
                    salt_1_unit=row.get("salt_1_unit", ""),
                    salt_2_name=row.get("salt_2_name", ""),
                    salt_2_strength=row.get("salt_2_strength", ""),
                    salt_2_unit=row.get("salt_2_unit", ""),
                    composition_full=row.get("composition_full", ""),
                    composition_fingerprint=row.get("composition_fingerprint", ""),
                    generic_group_hash=row.get("generic_group_hash", ""),
                    is_discontinued=is_disc,
                )
                batch.append(catalog_entry)

                if len(batch) >= BATCH_SIZE:
                    session.add_all(batch)
                    await session.flush()
                    total_inserted += len(batch)
                    batch = []

                    if total_inserted % 10000 == 0:
                        elapsed = time.time() - start_time
                        rate = total_inserted / elapsed if elapsed > 0 else 0
                        print(
                            f"  ... inserted {total_inserted:>8,} records "
                            f"({rate:,.0f} rows/sec)"
                        )

            # Flush remaining batch
            if batch:
                session.add_all(batch)
                await session.flush()
                total_inserted += len(batch)

        await session.commit()
        elapsed = time.time() - start_time

        # Verify
        final_count = await count_catalog(session)

        print(f"\n[4/4] Seeding complete!")
        print(f"  Records inserted : {total_inserted:,}")
        print(f"  Records in DB    : {final_count:,}")
        print(f"  Time elapsed     : {elapsed:.1f} seconds")
        print(f"  Speed            : {total_inserted / elapsed:,.0f} rows/sec")
        print(f"  [OK] Medicine catalog seeded successfully!")

        return final_count


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    asyncio.run(seed_catalog(force=force_flag))
