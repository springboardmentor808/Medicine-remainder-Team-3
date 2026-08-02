"""
PillSync Refill Prediction Pydantic Schemas.

Defines request/response validation models for the AI Refill
Prediction Engine endpoints.
"""

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ===================================================================
# Request Schemas
# ===================================================================

class RefillPredictionRequest(BaseModel):
    """
    POST /api/v1/refill/update-stock — Update pill stock for a medicine.

    Used when the user manually records their current pill count
    to recalculate the refill prediction.
    """

    medicine_id: uuid.UUID = Field(
        ...,
        description="UUID of the medicine to update",
    )
    total_pills_remaining: int = Field(
        ...,
        ge=0,
        examples=[30],
        description="Current total pills remaining in stock",
    )
    daily_dose_count: int = Field(
        ...,
        ge=1,
        examples=[2],
        description="Number of pills consumed per day",
    )
    low_stock_threshold: int = Field(
        default=5,
        ge=1,
        examples=[5],
        description="Day threshold below which low-stock alert triggers",
    )


# ===================================================================
# Response Schemas
# ===================================================================

class RefillPredictionResponse(BaseModel):
    """
    Response for refill prediction queries.

    Returns the computed refill date, remaining days, and
    a low-stock warning flag.
    """

    medicine_id: uuid.UUID = Field(
        ...,
        description="UUID of the medicine",
    )
    medicine_name: Optional[str] = Field(
        None,
        description="Name of the medicine",
    )
    total_pills_remaining: int = Field(
        ...,
        description="Current pills left in stock",
    )
    daily_dose_count: int = Field(
        ...,
        description="Daily pill consumption rate",
    )
    days_remaining: float = Field(
        ...,
        examples=[15.0],
        description="Estimated number of days until stock runs out",
    )
    estimated_refill_date: date = Field(
        ...,
        description="Predicted date when a refill is needed",
    )
    is_low_stock: bool = Field(
        ...,
        description="True if days remaining ≤ low-stock threshold",
    )
    low_stock_threshold: int = Field(
        ...,
        description="Configured low-stock threshold in days",
    )
    created_at: Optional[datetime] = Field(
        None,
        description="Timestamp when the prediction record was created",
    )

    model_config = {"from_attributes": True}
