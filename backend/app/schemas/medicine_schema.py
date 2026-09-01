"""
PillSync Medicine Pydantic Schemas.

Request/Response validation models for the Medicine CRUD endpoints,
stock management, and disease-based grouping.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


# ===================================================================
# Enums
# ===================================================================

class DiseaseCategory(str, Enum):
    """Allowed disease categories — mirrors the DB enum."""
    BLOOD_PRESSURE = "Blood Pressure"
    DIABETES = "Diabetes"
    THYROID = "Thyroid"
    ANTIBIOTICS = "Antibiotics"
    VITAMINS = "Vitamins"
    HEART_MEDICATIONS = "Heart Medications"
    GENERAL_HEALTHCARE = "General Healthcare"


# ===================================================================
# Request Schemas
# ===================================================================

class MedicineCreate(BaseModel):
    """POST /api/v1/medicines — Create a new medicine."""

    name: str = Field(
        ..., min_length=1, max_length=200,
        examples=["Metformin 500mg"],
        description="Medicine name",
    )
    disease_category: str = Field(
        default="General Healthcare",
        description="Disease category for grouping",
    )
    dosage: str = Field(
        ..., min_length=1, max_length=50,
        examples=["500mg"],
        description="Dosage strength (e.g., '500mg', '2 Tablets')",
    )
    initial_quantity: int = Field(
        default=30, ge=1,
        examples=[30],
        description="Total quantity when medicine is added",
    )
    daily_frequency: int = Field(
        default=1, ge=1,
        examples=[2],
        description="Number of doses per day",
    )
    quantity_per_dose: int = Field(
        default=1, ge=1,
        examples=[1],
        description="Number of units consumed per dose",
    )
    dosage_form: Optional[str] = Field(
        default="Tablet",
        description="Form of the medicine (e.g. Tablet, Capsule, Syrup)",
    )
    notes: Optional[str] = Field(
        None, max_length=1000,
        examples=["Take after meals"],
        description="Additional notes (optional)",
    )

    model_config = {"extra": "allow"}


class MedicineUpdate(BaseModel):
    """PUT /api/v1/medicines/{id} — Update medicine (partial)."""

    name: Optional[str] = Field(
        None, min_length=1, max_length=200,
    )
    disease_category: Optional[str] = None
    dosage: Optional[str] = Field(
        None, min_length=1, max_length=50,
    )
    initial_quantity: Optional[int] = Field(
        None, ge=1,
    )
    current_stock: Optional[int] = Field(
        None, ge=0,
    )
    daily_frequency: Optional[int] = Field(
        None, ge=1,
    )
    quantity_per_dose: Optional[int] = Field(
        None, ge=1,
    )
    dosage_form: Optional[str] = None
    notes: Optional[str] = Field(
        None, max_length=1000,
    )

    model_config = {"extra": "allow"}


class StockUpdateRequest(BaseModel):
    """
    PATCH /api/v1/medicines/{id}/stock — Adjust or set stock level.

    Provide either `adjustment` (relative: +10 to add, -5 to consume)
    or `new_stock` / `current_stock` (absolute: set stock to this value).
    """

    adjustment: Optional[int] = Field(
        None,
        examples=[-2],
        description="Relative stock change (+N to add, -N to consume)",
    )
    new_stock: Optional[int] = Field(
        None, ge=0,
        examples=[25],
        description="Absolute stock value to set",
    )
    current_stock: Optional[int] = Field(
        None, ge=0,
        description="Alias for new_stock for frontend compatibility",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_stock_fields(cls, data):
        if isinstance(data, dict):
            if "current_stock" in data and data.get("new_stock") is None:
                data["new_stock"] = data["current_stock"]
        return data


# ===================================================================
# Response Schemas
# ===================================================================

class MedicineResponse(BaseModel):
    """Standard medicine response with computed fields."""

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    disease_category: str
    dosage: str
    initial_quantity: int
    current_stock: int
    daily_frequency: int
    quantity_per_dose: int
    notes: Optional[str] = None
    days_until_empty: Optional[float] = Field(
        None,
        description="Estimated days until stock runs out",
    )
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicineListResponse(BaseModel):
    """Paginated list of medicines."""

    medicines: list[MedicineResponse]
    total: int
    page: int
    page_size: int


class DiseaseGroupResponse(BaseModel):
    """A single disease-category group with its medicines."""

    category: str
    count: int
    medicines: list[MedicineResponse]


class StockUpdateResponse(BaseModel):
    """Response after a stock adjustment."""

    previous_stock: int
    new_stock: int
    current_stock: Optional[int] = None
    adjustment: int
    medicine: MedicineResponse
