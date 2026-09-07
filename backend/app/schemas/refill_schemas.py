"""
PillSync Calibrated Refill Prediction Pydantic Schemas.
Target File: backend/app/schemas/refill_schemas.py
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CalibratedRefillPrediction(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
