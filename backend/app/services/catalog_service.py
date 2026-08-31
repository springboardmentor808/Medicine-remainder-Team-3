"""
PillSync Catalog Search Service (Track 3 -- Engineer 3).

Provides high-performance search over the 253k Indian medicine catalog
for auto-complete, generic substitution, and OCR text matching.

Features:
  - Fuzzy brand name search (ILIKE / trigram)
  - Composition-based generic substitution with INR savings
  - Salt name search for OCR result matching
  - Price range filtering
  - Paginated results

Usage:
    from app.services.catalog_service import CatalogService

    service = CatalogService()
    results = await service.search_medicines(db, query="Augmentin", limit=10)
    alternatives = await service.find_generic_alternatives(db, brand_name="Augmentin 625 Duo Tablet")
"""

from typing import Optional
import uuid

from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medicine_catalog import MedicineCatalog


# ---------------------------------------------------------------------------
# Search Medicines (Auto-complete)
# ---------------------------------------------------------------------------

async def search_medicines(
    db: AsyncSession,
    query: str,
    limit: int = 10,
    dosage_form: Optional[str] = None,
    exclude_discontinued: bool = True,
) -> list[MedicineCatalog]:
    """
    Search the medicine catalog by brand name substring match.

    Uses ILIKE for case-insensitive matching. On PostgreSQL with pg_trgm,
    this will leverage the GIN trigram index for sub-20ms performance.

    Args:
        query: Search term (min 2 chars recommended)
        limit: Maximum results to return (default 10)
        dosage_form: Optional filter (Tablet, Capsule, Syrup, etc.)
        exclude_discontinued: Whether to skip discontinued medicines

    Returns:
        List of matching MedicineCatalog records
    """
    if not query or len(query.strip()) < 1:
        return []

    pattern = f"%{query.strip()}%"

    stmt = select(MedicineCatalog).where(
        MedicineCatalog.brand_name.ilike(pattern)
    )

    if exclude_discontinued:
        stmt = stmt.where(MedicineCatalog.is_discontinued == False)

    if dosage_form:
        stmt = stmt.where(MedicineCatalog.dosage_form == dosage_form)

    stmt = stmt.order_by(MedicineCatalog.brand_name).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Search by Salt Name
# ---------------------------------------------------------------------------

async def search_by_salt(
    db: AsyncSession,
    salt_name: str,
    limit: int = 20,
    exclude_discontinued: bool = True,
) -> list[MedicineCatalog]:
    """
    Search medicines by active ingredient / salt name.

    Useful for OCR result matching and drug verification.
    """
    if not salt_name or len(salt_name.strip()) < 2:
        return []

    pattern = f"%{salt_name.strip()}%"

    stmt = select(MedicineCatalog).where(
        or_(
            MedicineCatalog.salt_1_name.ilike(pattern),
            MedicineCatalog.salt_2_name.ilike(pattern),
        )
    )

    if exclude_discontinued:
        stmt = stmt.where(MedicineCatalog.is_discontinued == False)

    stmt = stmt.order_by(
        MedicineCatalog.price_per_unit_inr.asc()
    ).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Find Generic Alternatives (Cheaper Substitution)
# ---------------------------------------------------------------------------

async def find_generic_alternatives(
    db: AsyncSession,
    brand_name: str,
    max_results: int = 20,
    same_dosage_form: bool = False,
    exclude_discontinued: bool = True,
) -> dict:
    """
    Find cheaper generic alternatives for a branded medicine.

    Algorithm:
      1. Find the source medicine by exact brand name
      2. Get its composition_fingerprint
      3. Find all medicines with the same fingerprint
      4. Sort by price per unit (cheapest first)
      5. Calculate savings in INR

    Returns:
        dict with query_medicine info, alternatives list, and savings data
    """
    # Step 1: Find source medicine
    result = await db.execute(
        select(MedicineCatalog).where(
            MedicineCatalog.brand_name == brand_name.strip()
        ).limit(1)
    )
    source = result.scalar_one_or_none()

    if not source:
        # Try fuzzy match
        result = await db.execute(
            select(MedicineCatalog).where(
                MedicineCatalog.brand_name.ilike(f"%{brand_name.strip()}%")
            ).limit(1)
        )
        source = result.scalar_one_or_none()

    if not source:
        return {
            "error": f"Medicine '{brand_name}' not found in catalog",
            "alternatives": [],
        }

    if not source.composition_fingerprint:
        return {
            "query_medicine": _medicine_to_dict(source),
            "error": "No composition data available",
            "alternatives": [],
        }

    # Step 2: Find all medicines with same fingerprint
    stmt = select(MedicineCatalog).where(
        and_(
            MedicineCatalog.composition_fingerprint == source.composition_fingerprint,
            MedicineCatalog.id != source.id,
        )
    )

    if exclude_discontinued:
        stmt = stmt.where(MedicineCatalog.is_discontinued == False)

    if same_dosage_form:
        stmt = stmt.where(MedicineCatalog.dosage_form == source.dosage_form)

    stmt = stmt.order_by(
        MedicineCatalog.price_per_unit_inr.asc()
    ).limit(max_results)

    result = await db.execute(stmt)
    alternatives = result.scalars().all()

    # Step 3: Calculate savings
    alt_list = []
    for alt in alternatives:
        savings_per_unit = (source.price_per_unit_inr or 0) - (alt.price_per_unit_inr or 0)
        savings_pct = 0.0
        if source.price_per_unit_inr and source.price_per_unit_inr > 0:
            savings_pct = (savings_per_unit / source.price_per_unit_inr) * 100

        alt_list.append({
            **_medicine_to_dict(alt),
            "savings_per_unit_inr": round(savings_per_unit, 2),
            "savings_percent": round(savings_pct, 1),
            "is_cheaper": savings_per_unit > 0,
        })

    # Count total alternatives
    count_result = await db.execute(
        select(func.count(MedicineCatalog.id)).where(
            and_(
                MedicineCatalog.composition_fingerprint == source.composition_fingerprint,
                MedicineCatalog.id != source.id,
            )
        )
    )
    total_count = count_result.scalar() or 0

    max_savings = 0.0
    if alt_list:
        max_savings = round(
            (source.price_per_unit_inr or 0) - alt_list[0].get("price_per_unit_inr", 0), 2
        )

    return {
        "query_medicine": _medicine_to_dict(source),
        "total_alternatives": total_count,
        "alternatives": alt_list,
        "max_savings_per_unit_inr": max_savings,
    }


# ---------------------------------------------------------------------------
# Get Medicine by ID
# ---------------------------------------------------------------------------

async def get_catalog_medicine(
    db: AsyncSession,
    catalog_id: int,
) -> Optional[MedicineCatalog]:
    """Fetch a single catalog medicine by its ID."""
    result = await db.execute(
        select(MedicineCatalog).where(MedicineCatalog.id == catalog_id)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Get Dosage Form Statistics
# ---------------------------------------------------------------------------

async def get_dosage_form_stats(db: AsyncSession) -> list[dict]:
    """Get count of medicines grouped by dosage form."""
    result = await db.execute(
        select(
            MedicineCatalog.dosage_form,
            func.count(MedicineCatalog.id).label("count"),
        )
        .where(MedicineCatalog.is_discontinued == False)
        .group_by(MedicineCatalog.dosage_form)
        .order_by(desc("count"))
    )

    return [
        {"dosage_form": row[0], "count": row[1]}
        for row in result.all()
    ]


# ---------------------------------------------------------------------------
# Get Manufacturer Statistics
# ---------------------------------------------------------------------------

async def get_manufacturer_stats(db: AsyncSession, limit: int = 20) -> list[dict]:
    """Get top manufacturers by product count."""
    result = await db.execute(
        select(
            MedicineCatalog.manufacturer,
            func.count(MedicineCatalog.id).label("count"),
        )
        .where(
            and_(
                MedicineCatalog.manufacturer != "",
                MedicineCatalog.manufacturer.isnot(None),
            )
        )
        .group_by(MedicineCatalog.manufacturer)
        .order_by(desc("count"))
        .limit(limit)
    )

    return [
        {"manufacturer": row[0], "product_count": row[1]}
        for row in result.all()
    ]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _medicine_to_dict(med: MedicineCatalog) -> dict:
    """Convert a MedicineCatalog record to a plain dict."""
    return {
        "id": med.id,
        "brand_name": med.brand_name,
        "manufacturer": med.manufacturer,
        "price_inr": med.price_inr,
        "price_per_unit_inr": med.price_per_unit_inr,
        "pack_size_label": med.pack_size_label,
        "pack_quantity": med.pack_quantity,
        "dosage_form": med.dosage_form,
        "salt_1_name": med.salt_1_name,
        "salt_1_strength": med.salt_1_strength,
        "salt_1_unit": med.salt_1_unit,
        "salt_2_name": med.salt_2_name,
        "salt_2_strength": med.salt_2_strength,
        "salt_2_unit": med.salt_2_unit,
        "composition_full": med.composition_full,
        "is_discontinued": med.is_discontinued,
    }
