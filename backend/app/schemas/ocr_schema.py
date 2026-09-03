"""
PillSync OCR Scanner Pydantic Schemas.

Defines request/response validation models for the OCR
Prescription Scanner Engine endpoints and prescription history.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ===================================================================
# OCR Scan Response
# ===================================================================

class OCRScanResponse(BaseModel):
    """
    Response returned after scanning a prescription image.

    Contains the extracted medicine details along with the raw
    OCR text and a confidence score for transparency.
    """

    medicine_name: Optional[str] = Field(
        None,
        examples=["Amoxicillin"],
        description="Extracted medicine name from the prescription",
    )
    dosage: Optional[str] = Field(
        None,
        examples=["500mg"],
        description="Extracted dosage (e.g., '500mg', '250mg')",
    )
    frequency: Optional[str] = Field(
        None,
        examples=["1-0-1"],
        description="Extracted frequency pattern (e.g., '1-0-1', 'twice daily')",
    )
    raw_text: str = Field(
        ...,
        description="Raw text extracted from the prescription image by OCR",
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        examples=[0.85],
        description="OCR extraction confidence score (0.0 to 1.0)",
    )
    scan_id: Optional[str] = Field(
        None,
        description="MongoDB document ID of the saved scan result",
    )


# ===================================================================
# Prescription History Schemas
# ===================================================================

class PrescriptionHistoryItem(BaseModel):
    """A single prescription scan record from MongoDB."""

    scan_id: str = Field(
        ...,
        description="MongoDB document ID",
    )
    filename: str = Field(
        ...,
        description="Original uploaded file name",
    )
    raw_text: str = Field(
        ...,
        description="Raw OCR-extracted text",
    )
    confidence_score: float = Field(
        ...,
        description="OCR extraction confidence (0.0 to 1.0)",
    )
    parsed_data: dict = Field(
        default_factory=dict,
        description="NLP-parsed fields (medicine_name, dosage, frequency)",
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of the scan",
    )


class PrescriptionHistoryResponse(BaseModel):
    """Paginated prescription scan history."""

    scans: list[PrescriptionHistoryItem]
    total: int
    page: int
    page_size: int


class PrescriptionDetailResponse(BaseModel):
    """Detailed view of a single prescription scan."""

    scan_id: str
    user_id: str
    filename: str
    raw_text: str
    confidence_score: float
    parsed_data: dict = Field(default_factory=dict)
    created_at: datetime
