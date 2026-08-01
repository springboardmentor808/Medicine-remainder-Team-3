"""
PillSync Auth & User Pydantic Schemas.

Request/Response validation models for authentication endpoints.
Complements the existing pillsync_schemas.py with token-specific models.
"""

import uuid
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ===================================================================
# Request Schemas
# ===================================================================

class RegisterRequest(BaseModel):
    """POST /api/v1/auth/register — New user registration."""
    username: str = Field(
        ..., min_length=3, max_length=50,
        examples=["om_pandey"],
        description="Unique username (3-50 chars)",
    )
    email: EmailStr = Field(
        ..., examples=["om@pillsync.com"],
        description="Valid email address",
    )
    password: str = Field(
        ..., min_length=8, max_length=128,
        examples=["StrongP@ss123"],
        description="Password (min 8 chars)",
    )
    full_name: str = Field(
        ..., min_length=1, max_length=100,
        examples=["Om Pandey"],
        description="Full display name",
    )
    phone: Optional[str] = Field(
        None, max_length=20,
        examples=["+91-9876543210"],
        description="Phone number (optional)",
    )
    role: str = Field(
        default="patient",
        pattern="^(patient|caregiver|admin)$",
        description="User role: patient, caregiver, or admin",
    )


class LoginRequest(BaseModel):
    """POST /api/v1/auth/login — User login."""
    username: str = Field(
        ..., examples=["om_pandey"],
    )
    password: str = Field(
        ..., examples=["StrongP@ss123"],
    )


class RefreshTokenRequest(BaseModel):
    """POST /api/v1/auth/refresh — Token refresh."""
    refresh_token: str = Field(
        ..., description="Valid refresh token",
    )


class UserUpdateRequest(BaseModel):
    """PUT /api/v1/users/profile — Update user profile."""
    full_name: Optional[str] = Field(
        None, min_length=1, max_length=100,
    )
    phone: Optional[str] = Field(
        None, max_length=20,
    )
    email: Optional[EmailStr] = None


class AssignPatientRequest(BaseModel):
    """POST /api/v1/users/assign-patient — Admin assigns patient to caregiver."""
    caregiver_id: uuid.UUID = Field(
        ..., description="UUID of the caregiver",
    )
    patient_id: uuid.UUID = Field(
        ..., description="UUID of the patient to assign",
    )


# ===================================================================
# Response Schemas
# ===================================================================

class UserResponse(BaseModel):
    """Standard user profile response."""
    id: uuid.UUID
    username: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    created_at: str
    assigned_patients: Optional[List[str]] = []

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token pair returned after login/register."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    """Response after successful registration."""
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    message: str = "Registration successful"


class LoginResponse(BaseModel):
    """Response after successful login."""
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    message: str = "Login successful"


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    detail: Optional[str] = None
