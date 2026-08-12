"""
PillSync AI Refill Prediction & Nearby Pharmacy API Router.

Provides endpoints for:
    - GET  /predict/{medicine_id}  — Get refill prediction & nearby pharmacies (if low stock / GPS supplied).
    - POST /update-stock          — Update pill stock and recalculate prediction.
    - GET  /nearby-pharmacies     — Search nearby pharmacies via OpenStreetMap.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.pharmacy_schema import NearbyPharmacyListResponse, PharmacyResponse
from app.schemas.refill_schema import (
    RefillPredictionRequest,
    RefillPredictionResponse,
)
from app.services.pharmacy_service import find_nearby_pharmacies
from app.services.refill_service import (
    calculate_refill_prediction,
    create_or_update_refill,
    get_medicine_by_id,
    get_refill_by_medicine,
)


router = APIRouter(prefix="/refill", tags=["Refill AI"])


# ---------------------------------------------------------------------------
# GET /predict/{medicine_id}
# ---------------------------------------------------------------------------
@router.get(
    "/predict/{medicine_id}",
    response_model=RefillPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Refill Prediction",
    description=(
        "Retrieve the AI-generated refill prediction for a specific medicine. "
        "Returns remaining days, estimated refill date, low-stock status, "
        "and automatically attaches nearby pharmacies (via OpenStreetMap) "
        "when stock is low or GPS coordinates (lat/lon) are supplied."
    ),
)
async def get_refill_prediction(
    medicine_id: uuid.UUID,
    lat: Optional[float] = Query(None, description="User GPS latitude"),
    lon: Optional[float] = Query(None, description="User GPS longitude"),
    radius_km: float = Query(5.0, ge=0.5, le=50.0, description="Pharmacy search radius in km"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RefillPredictionResponse:
    """
    Compute or retrieve the refill prediction for a medicine.

    If latitude & longitude are provided, queries OpenStreetMap's Overpass API
    for nearby pharmacies. Also auto-queries if stock is low.
    """
    # Verify medicine exists
    medicine = await get_medicine_by_id(db, medicine_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with id '{medicine_id}' not found.",
        )

    # Check ownership
    med_uid = str(uuid.UUID(str(medicine.user_id))).lower()
    cur_uid = str(uuid.UUID(str(current_user.id))).lower()
    if med_uid != cur_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this medicine.",
        )

    # Try to get an existing refill record
    refill = await get_refill_by_medicine(db, medicine_id)

    if refill:
        prediction = calculate_refill_prediction(
            total_pills=refill.total_pills_remaining,
            daily_dose=refill.daily_dose_count,
            low_stock_threshold=refill.low_stock_threshold,
        )
        total_pills = refill.total_pills_remaining
        daily_dose = refill.daily_dose_count
        threshold = refill.low_stock_threshold
        created_at = refill.created_at
    else:
        daily_consumption = medicine.daily_frequency * medicine.quantity_per_dose
        prediction = calculate_refill_prediction(
            total_pills=medicine.current_stock,
            daily_dose=daily_consumption,
        )
        total_pills = medicine.current_stock
        daily_dose = daily_consumption
        threshold = 5
        created_at = None

    # Fetch nearby pharmacies via OpenStreetMap if lat/lon provided OR stock is low
    nearby_pharmacies: list[PharmacyResponse] = []
    if lat is not None and lon is not None:
        nearby_pharmacies = await find_nearby_pharmacies(
            latitude=lat,
            longitude=lon,
            radius_km=radius_km,
        )

    return RefillPredictionResponse(
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        total_pills_remaining=total_pills,
        daily_dose_count=daily_dose,
        days_remaining=prediction["days_remaining"],
        estimated_refill_date=prediction["estimated_refill_date"],
        is_low_stock=prediction["is_low_stock"],
        low_stock_threshold=threshold,
        nearby_pharmacies=nearby_pharmacies,
        created_at=created_at,
    )


# ---------------------------------------------------------------------------
# POST /update-stock
# ---------------------------------------------------------------------------
@router.post(
    "/update-stock",
    response_model=RefillPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Stock & Recalculate Prediction",
    description=(
        "Update the current pill count for a medicine and recalculate "
        "the refill prediction. Creates or updates the Refill record."
    ),
)
async def update_stock(
    payload: RefillPredictionRequest,
    lat: Optional[float] = Query(None, description="User GPS latitude"),
    lon: Optional[float] = Query(None, description="User GPS longitude"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RefillPredictionResponse:
    """Accept a stock update, persist Refill record, and return updated prediction."""
    medicine = await get_medicine_by_id(db, payload.medicine_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with id '{payload.medicine_id}' not found.",
        )

    if medicine.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this medicine.",
        )

    refill = await create_or_update_refill(
        db=db,
        user_id=current_user.id,
        medicine_id=payload.medicine_id,
        total_pills_remaining=payload.total_pills_remaining,
        daily_dose_count=payload.daily_dose_count,
        low_stock_threshold=payload.low_stock_threshold,
    )

    prediction = calculate_refill_prediction(
        total_pills=payload.total_pills_remaining,
        daily_dose=payload.daily_dose_count,
        low_stock_threshold=payload.low_stock_threshold,
    )

    nearby: list[PharmacyResponse] = []
    if lat is not None and lon is not None:
        nearby = await find_nearby_pharmacies(lat, lon)

    return RefillPredictionResponse(
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        total_pills_remaining=payload.total_pills_remaining,
        daily_dose_count=payload.daily_dose_count,
        days_remaining=prediction["days_remaining"],
        estimated_refill_date=prediction["estimated_refill_date"],
        is_low_stock=prediction["is_low_stock"],
        low_stock_threshold=payload.low_stock_threshold,
        nearby_pharmacies=nearby,
        created_at=refill.created_at,
    )


# ---------------------------------------------------------------------------
# GET /nearby-pharmacies
# ---------------------------------------------------------------------------
@router.get(
    "/nearby-pharmacies",
    response_model=NearbyPharmacyListResponse,
    status_code=status.HTTP_200_OK,
    summary="Find Nearby Pharmacies (OpenStreetMap)",
    description=(
        "Query OpenStreetMap Overpass API for pharmacies near given GPS coordinates. "
        "Free service — no Google Maps API key required."
    ),
)
async def get_nearby_pharmacies_endpoint(
    lat: float = Query(..., description="User latitude (e.g. 28.6139)"),
    lon: float = Query(..., description="User longitude (e.g. 77.2090)"),
    radius_km: float = Query(5.0, ge=0.5, le=50.0, description="Search radius in km"),
    limit: int = Query(10, ge=1, le=50, description="Max pharmacies to return"),
    current_user: User = Depends(get_current_user),
) -> NearbyPharmacyListResponse:
    """Find nearby pharmacies using user's GPS coordinates."""
    pharmacies = await find_nearby_pharmacies(
        latitude=lat,
        longitude=lon,
        radius_km=radius_km,
        limit=limit,
    )

    return NearbyPharmacyListResponse(
        user_latitude=lat,
        user_longitude=lon,
        radius_km=radius_km,
        total_found=len(pharmacies),
        pharmacies=pharmacies,
    )
