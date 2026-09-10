"""
PillSync Refill Prediction Pydantic Schemas.

Defines request/response validation models for the AI Refill
Prediction Engine endpoints and nearby pharmacy discovery.
"""

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.pharmacy_schema import PharmacyResponse


# ===================================================================
# ML Calibration Schemas
# ===================================================================

class CalibratedRefillPrediction(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    medicine_id: str = Field(..., description="UUID of medicine")
    medicine_name: str
    current_stock: int = Field(..., ge=0)
    daily_prescribed_frequency: int = Field(..., gt=0)
    p10_runout_days: float = Field(..., description="Pessimistic runout (P10) under frequent extra doses")
    p50_runout_days: float = Field(..., description="Expected median runout (P50)")
    p90_runout_days: float = Field(..., description="Optimistic runout (P90) under occasional missed doses")
    estimated_runout_date_p50: date
    critical_refill_date_p10: date
    is_low_stock: bool
    requires_immediate_reorder: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    model_version: str = "v1.0.0-gradient-boosted"


# ===================================================================
# Request Schemas
# ===================================================================

class RefillPredictionRequest(BaseModel):
    """
    POST /api/v1/refill/update-stock — Update pill stock for a medicine.
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

    Returns the computed refill date, remaining days, low-stock flag,
    and optional nearby pharmacies fetched via OpenStreetMap when GPS
    coordinates are supplied or when stock is low.
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
    nearby_pharmacies: Optional[list[PharmacyResponse]] = Field(
        default=[],
        description="Nearby pharmacies from OpenStreetMap when stock is low or GPS is supplied",
    )
    # --- Calibrated Quantile ML Forecaster Fields ---
    p10_runout_days: Optional[float] = Field(
        None,
        description="10th percentile conservative depletion days (P10 safe trigger threshold)",
    )
    p50_runout_days: Optional[float] = Field(
        None,
        description="50th percentile expected median depletion days (P50)",
    )
    p90_runout_days: Optional[float] = Field(
        None,
        description="90th percentile optimistic depletion days (P90)",
    )
    critical_refill_date_p10: Optional[date] = Field(
        None,
        description="Clinical reorder deadline computed from P10 estimate",
    )
    requires_immediate_reorder: Optional[bool] = Field(
        False,
        description="True if P10 <= 2.0 days or physical stock <= 2 units",
    )
    confidence_score: Optional[float] = Field(
        0.90,
        description="ML model reliability index from historical adherence stability",
    )
    created_at: Optional[datetime] = Field(
        None,
        description="Timestamp when the prediction record was created",
    )

    model_config = ConfigDict(from_attributes=True)
