"""
PillSync Medicine Catalog API Router (Track 3 — Engineer 3).

Exposes endpoints for:
  - Autocomplete search over 253k Indian medicines
  - Generic alternative substitution recommendations with ₹ savings
  - Search by salt composition
  - WHO dosage safety validation
  - FHIR Medication resource export
  - Catalog statistics
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.services.catalog_service import (
    search_medicines,
    search_by_salt,
    find_generic_alternatives,
    get_catalog_medicine,
    get_dosage_form_stats,
    get_manufacturer_stats,
)
from app.utils.fhir_converter import FHIRConverter
from app.services.who_dosage_service import WHODosageBenchmarks
from app.services.disease_taxonomy_service import DiseaseTaxonomy

router = APIRouter(prefix="/catalog", tags=["Medicine Catalog & Generics"])

# In-memory helpers
who_benchmarks = WHODosageBenchmarks()
disease_taxonomy = DiseaseTaxonomy()
fhir_converter = FHIRConverter()


# ===================================================================
# Request / Response Schemas
# ===================================================================

class DosageValidationRequest(BaseModel):
    salt_name: str = Field(..., json_schema_extra={"example": "Paracetamol"})
    daily_dose_mg: float = Field(..., json_schema_extra={"example": 2000.0}, ge=0.1)


# ===================================================================
# Endpoints
# ===================================================================

@router.get(
    "/search",
    summary="Search Indian Medicine Catalog",
    description="Autocomplete brand search over 253,973 medicines with price and salt info.",
)
async def search_catalog(
    q: str = Query(..., min_length=1, description="Medicine brand name or prefix"),
    limit: int = Query(10, ge=1, le=50),
    dosage_form: Optional[str] = Query(None, description="Filter: Tablet, Capsule, Syrup, etc."),
    db: AsyncSession = Depends(get_db),
):
    results = await search_medicines(
        db, query=q, limit=limit, dosage_form=dosage_form
    )
    return {
        "query": q,
        "count": len(results),
        "results": [
            {
                "id": m.id,
                "brand_name": m.brand_name,
                "manufacturer": m.manufacturer,
                "price_inr": m.price_inr,
                "price_per_unit_inr": m.price_per_unit_inr,
                "dosage_form": m.dosage_form,
                "pack_size_label": m.pack_size_label,
                "salt_1": f"{m.salt_1_name or ''} {m.salt_1_strength or ''}{m.salt_1_unit or ''}".strip(),
                "salt_2": f"{m.salt_2_name or ''} {m.salt_2_strength or ''}{m.salt_2_unit or ''}".strip() if m.salt_2_name else None,
                "composition_full": m.composition_full,
            }
            for m in results
        ],
    }


@router.get(
    "/generic-alternatives",
    summary="Find Cheaper Generic Alternatives",
    description="Finds medicines with identical salt compositions ranked by price savings in ₹.",
)
async def get_generic_alternatives(
    brand_name: str = Query(..., description="Brand name (e.g., Augmentin 625 Duo Tablet)"),
    max_results: int = Query(15, ge=1, le=50),
    same_dosage_form: bool = Query(False, description="Restrict to same dosage form"),
    db: AsyncSession = Depends(get_db),
):
    result = await find_generic_alternatives(
        db,
        brand_name=brand_name,
        max_results=max_results,
        same_dosage_form=same_dosage_form,
    )
    if "error" in result and not result.get("query_medicine"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"],
        )
    return result


@router.get(
    "/search-by-salt",
    summary="Search Medicines by Chemical Salt",
    description="Finds all branded formulations containing a specific active salt ingredient.",
)
async def search_salt(
    salt: str = Query(..., min_length=2, description="Active ingredient (e.g., Azithromycin)"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    results = await search_by_salt(db, salt_name=salt, limit=limit)
    return {
        "salt": salt,
        "count": len(results),
        "results": [
            {
                "id": m.id,
                "brand_name": m.brand_name,
                "manufacturer": m.manufacturer,
                "price_inr": m.price_inr,
                "price_per_unit_inr": m.price_per_unit_inr,
                "dosage_form": m.dosage_form,
                "composition_full": m.composition_full,
            }
            for m in results
        ],
    }


@router.post(
    "/validate-dosage",
    summary="WHO Safe Dosage Limit Check",
    description="Validates proposed daily dose against WHO Essential Medicines safe bounds.",
)
async def validate_daily_dosage(payload: DosageValidationRequest):
    result = who_benchmarks.validate_daily_dose(
        salt_name=payload.salt_name,
        total_daily_mg=payload.daily_dose_mg,
    )
    preg_cat = who_benchmarks.get_pregnancy_category(payload.salt_name)
    result["pregnancy_category"] = preg_cat
    return result


@router.get(
    "/classify-disease",
    summary="Classify Salt into Disease Category",
    description="Maps drug salt to standardized therapeutic category (Diabetes, BP, Thyroid, etc.).",
)
async def classify_disease(
    salt: str = Query(..., description="Active salt name (e.g., Metformin)"),
):
    return disease_taxonomy.classify_medicine(salt)


@router.get(
    "/stats/dosage-forms",
    summary="Catalog Dosage Form Distribution",
)
async def dosage_forms_distribution(db: AsyncSession = Depends(get_db)):
    return await get_dosage_form_stats(db)


@router.get(
    "/stats/manufacturers",
    summary="Top Pharmaceutical Manufacturers",
)
async def top_manufacturers(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await get_manufacturer_stats(db, limit=limit)


@router.get(
    "/{catalog_id}",
    summary="Get Catalog Medicine Details",
)
async def get_catalog_item(
    catalog_id: int,
    db: AsyncSession = Depends(get_db),
):
    med = await get_catalog_medicine(db, catalog_id)
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Catalog medicine with id {catalog_id} not found",
        )
    return med


@router.get(
    "/{catalog_id}/fhir",
    summary="Export Medicine as HL7 FHIR R4 Medication",
)
async def export_catalog_fhir(
    catalog_id: int,
    db: AsyncSession = Depends(get_db),
):
    med = await get_catalog_medicine(db, catalog_id)
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Catalog medicine with id {catalog_id} not found",
        )
    
    fhir_med = fhir_converter.medicine_to_fhir_medication(
        medicine=med,
        salt_name=med.salt_1_name,
        strength=f"{med.salt_1_strength or ''}{med.salt_1_unit or ''}".strip() or None,
        dosage_form=med.dosage_form,
        manufacturer_name=med.manufacturer,
    )
    return fhir_converter.to_fhir_json(fhir_med)
