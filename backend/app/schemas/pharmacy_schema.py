"""
PillSync Nearby Pharmacy Pydantic Schemas.

Defines response models for OpenStreetMap-backed nearby pharmacy search.
"""

from typing import Optional

from pydantic import BaseModel, Field


class PharmacyResponse(BaseModel):
    """Details of a single nearby pharmacy from OpenStreetMap."""

    name: str = Field(
        ...,
        examples=["Apollo Pharmacy"],
        description="Name of the pharmacy",
    )
    distance_km: float = Field(
        ...,
        examples=[0.45],
        description="Distance from user's GPS coordinates in kilometers",
    )
    address: Optional[str] = Field(
        None,
        examples=["Main Street, Sector 15"],
        description="Street address or location details",
    )
    latitude: float = Field(
        ...,
        examples=[28.6139],
        description="Latitude coordinate",
    )
    longitude: float = Field(
        ...,
        examples=[77.2090],
        description="Longitude coordinate",
    )
    phone: Optional[str] = Field(
        None,
        description="Contact phone number if available",
    )
    opening_hours: Optional[str] = Field(
        None,
        examples=["24/7" or "09:00-21:00"],
        description="Opening hours if available",
    )


class NearbyPharmacyListResponse(BaseModel):
    """Response containing list of nearby pharmacies."""

    user_latitude: float
    user_longitude: float
    radius_km: float
    total_found: int
    pharmacies: list[PharmacyResponse]
