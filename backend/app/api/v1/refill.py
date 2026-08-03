"""
PillSync AI Refill Prediction API Router.

Provides endpoints for:
    - GET  /predict/{medicine_id}  — Get refill prediction for a medicine.
    - POST /update-stock          — Update pill stock and recalculate prediction.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.refill_schema import (
    RefillPredictionRequest,
    RefillPredictionResponse,
)
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
        "Retrieve the AI-generated refill prediction for a specific "
        "medicine. Returns remaining days, estimated refill date, and "
        "low-stock status."
    ),
)
async def get_refill_prediction(
    medicine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RefillPredictionResponse:
    """
    Compute or retrieve the refill prediction for a medicine.

    If a saved Refill record exists, recalculates from its stored
    pill count. Otherwise, derives from the Medicine model's
    current_stock and daily_frequency.
    """
    # Verify medicine exists
    medicine = await get_medicine_by_id(db, medicine_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with id '{medicine_id}' not found.",
        )

    # Check ownership — the medicine must belong to the current user
    if medicine.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this medicine.",
        )

    # Try to get an existing refill record
    refill = await get_refill_by_medicine(db, medicine_id)

    if refill:
        # Recalculate from the stored refill record
        prediction = calculate_refill_prediction(
            total_pills=refill.total_pills_remaining,
            daily_dose=refill.daily_dose_count,
            low_stock_threshold=refill.low_stock_threshold,
        )
        return RefillPredictionResponse(
            medicine_id=medicine.id,
            medicine_name=medicine.name,
            total_pills_remaining=refill.total_pills_remaining,
            daily_dose_count=refill.daily_dose_count,
            days_remaining=prediction["days_remaining"],
            estimated_refill_date=prediction["estimated_refill_date"],
            is_low_stock=prediction["is_low_stock"],
            low_stock_threshold=refill.low_stock_threshold,
            created_at=refill.created_at,
        )

    # Fallback: derive from the Medicine model fields
    daily_consumption = medicine.daily_frequency * medicine.quantity_per_dose
    prediction = calculate_refill_prediction(
        total_pills=medicine.current_stock,
        daily_dose=daily_consumption,
    )

    return RefillPredictionResponse(
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        total_pills_remaining=medicine.current_stock,
        daily_dose_count=daily_consumption,
        days_remaining=prediction["days_remaining"],
        estimated_refill_date=prediction["estimated_refill_date"],
        is_low_stock=prediction["is_low_stock"],
        low_stock_threshold=5,
        created_at=None,
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RefillPredictionResponse:
    """
    Accept a stock update, persist a Refill record, and return
    the refreshed prediction.
    """
    # Verify medicine exists
    medicine = await get_medicine_by_id(db, payload.medicine_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with id '{payload.medicine_id}' not found.",
        )

    # Check ownership
    if medicine.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this medicine.",
        )

    # Create / update the refill record
    refill = await create_or_update_refill(
        db=db,
        user_id=current_user.id,
        medicine_id=payload.medicine_id,
        total_pills_remaining=payload.total_pills_remaining,
        daily_dose_count=payload.daily_dose_count,
        low_stock_threshold=payload.low_stock_threshold,
    )

    # Compute the response prediction
    prediction = calculate_refill_prediction(
        total_pills=payload.total_pills_remaining,
        daily_dose=payload.daily_dose_count,
        low_stock_threshold=payload.low_stock_threshold,
    )

    return RefillPredictionResponse(
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        total_pills_remaining=payload.total_pills_remaining,
        daily_dose_count=payload.daily_dose_count,
        days_remaining=prediction["days_remaining"],
        estimated_refill_date=prediction["estimated_refill_date"],
        is_low_stock=prediction["is_low_stock"],
        low_stock_threshold=payload.low_stock_threshold,
        created_at=refill.created_at,
    )
