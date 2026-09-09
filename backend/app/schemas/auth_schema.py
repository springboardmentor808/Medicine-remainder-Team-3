"""
PillSync Auth & User Pydantic Schemas (God-Tier Input Validation).

Request/Response validation models with strict entropy rules, 10-digit phone
formatting, XSS script injection guards, and OTP/Password Reset structures.
"""

import re
import uuid
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator


# ===================================================================
# Validation Constants
# ===================================================================
PHONE_REGEX = re.compile(r"^[6-9]\d{9}$")
NAME_REGEX = re.compile(r"^[a-zA-Z\s.'-]{2,100}$")
PASSWORD_SPECIAL_REGEX = re.compile(r"[!@#$%^&*(),.?\":{}|<>]")


# ===================================================================
# Request Schemas
# ===================================================================

def normalize_phone_number(v: Optional[str]) -> Optional[str]:
    """Normalize phone input by removing non-digits, stripping leading 91, and validating 10 digits starting 6-9."""
    if not v:
        return None
    cleaned = v.strip()
    if not cleaned:
        return None
    digits = re.sub(r"\D", "", cleaned)
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if digits and not PHONE_REGEX.match(digits):
        raise ValueError("Phone number must be a valid 10-digit mobile number starting with 6-9.")
    return digits if digits else None


class RegisterRequest(BaseModel):
    """POST /api/v1/auth/register — New user registration with strict validation."""
    username: Optional[str] = Field(
        None, min_length=3, max_length=50,
        examples=["om_pandey"],
        description="Unique username (3-50 chars)",
    )
    email: EmailStr = Field(
        ..., examples=["om@pillsync.com"],
        description="Valid email address",
    )
    password: str = Field(
        ..., min_length=8, max_length=128,
        examples=["StrongP@ss123!"],
        description="Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)",
    )
    full_name: str = Field(
        ..., min_length=2, max_length=100,
        examples=["Om Pandey"],
        description="Full display name (letters and spaces only)",
    )
    phone: Optional[str] = Field(
        None, max_length=20,
        examples=["9876543210"],
        description="10-digit mobile number",
    )
    role: str = Field(
        default="patient",
        description="User role: patient, caregiver, or admin",
    )

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v: str) -> str:
        if isinstance(v, str):
            cleaned = v.strip().lower()
            if cleaned in ("patient", "caregiver", "admin"):
                return cleaned
        raise ValueError("Role must be 'patient', 'caregiver', or 'admin'.")

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not NAME_REGEX.match(cleaned):
            raise ValueError("Full name must contain only letters, spaces, dots, and hyphens (2-100 characters).")
        # Block potential HTML/XSS injection keywords
        if any(bad in cleaned.lower() for bad in ("<script", "<", ">", "javascript:", "eval(")):
            raise ValueError("Full name contains illegal characters or script tags.")
        return cleaned

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return normalize_phone_number(v)

    @field_validator("password")
    @classmethod
    def validate_password_entropy(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z).")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter (a-z).")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number (0-9).")
        if not PASSWORD_SPECIAL_REGEX.search(v):
            raise ValueError("Password must contain at least one special character (!@#$%^&* etc.).")
        return v

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            cleaned = v.strip().lower()
            if cleaned:
                if len(cleaned) < 3:
                    cleaned = (cleaned + "_usr")[:50]
                return cleaned
        return v


class LoginRequest(BaseModel):
    """POST /api/v1/auth/login — User login."""
    username: str = Field(
        ..., min_length=1, max_length=100, examples=["om_pandey"],
    )
    password: str = Field(
        ..., min_length=1, max_length=128, examples=["StrongP@ss123!"],
    )


class RefreshTokenRequest(BaseModel):
    """POST /api/v1/auth/refresh — Token refresh."""
    refresh_token: str = Field(
        ..., description="Valid refresh token",
    )


class ChangePasswordRequest(BaseModel):
    """POST /api/v1/auth/change-password — Change user password."""
    current_password: str = Field(
        ..., min_length=8, description="Current password",
    )
    new_password: str = Field(
        ..., min_length=8, description="New password (min 8 characters)",
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password_entropy(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("New password must contain at least one uppercase letter (A-Z).")
        if not any(c.islower() for c in v):
            raise ValueError("New password must contain at least one lowercase letter (a-z).")
        if not any(c.isdigit() for c in v):
            raise ValueError("New password must contain at least one number (0-9).")
        if not PASSWORD_SPECIAL_REGEX.search(v):
            raise ValueError("New password must contain at least one special character (!@#$%^&* etc.).")
        return v


class SendOTPRequest(BaseModel):
    """POST /api/v1/auth/send-otp — Dispatch 6-digit cryptographic verification code (Email or Phone)."""
    channel: str = Field(default="email", description="Channel: 'email' or 'phone'")
    destination: Optional[str] = Field(None, description="Target email address or phone number")
    email: Optional[EmailStr] = Field(None, description="Legacy field for email address")
    phone: Optional[str] = Field(None, description="Phone number")
    purpose: str = Field(default="VERIFY", description="Purpose: 'VERIFY' or 'PASSWORD_RESET' or 'REGISTRATION'")

    @field_validator("destination", mode="before")
    @classmethod
    def resolve_destination(cls, v: Optional[str], values) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v

    @field_validator("destination")
    @classmethod
    def validate_destination_format(cls, v: Optional[str]) -> Optional[str]:
        if v:
            cleaned = v.strip()
            if "@" in cleaned:
                if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
                    raise ValueError("Invalid email format for destination.")
                return cleaned
            return normalize_phone_number(cleaned)
        return v


    @field_validator("phone")
    @classmethod
    def validate_send_otp_phone(cls, v: Optional[str]) -> Optional[str]:
        return normalize_phone_number(v)


class VerifyOTPRequest(BaseModel):
    """POST /api/v1/auth/verify-otp — Validate 6-digit OTP code."""
    channel: str = Field(default="email", description="Channel: 'email' or 'phone'")
    destination: Optional[str] = Field(None, description="Target email or phone")
    email: Optional[EmailStr] = Field(None, description="Legacy email field")
    phone: Optional[str] = Field(None, description="Phone field")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    purpose: str = Field(default="VERIFY", description="Purpose matching send-otp")

    @field_validator("destination")
    @classmethod
    def validate_verify_destination(cls, v: Optional[str]) -> Optional[str]:
        if v:
            cleaned = v.strip()
            if "@" in cleaned:
                if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
                    raise ValueError("Invalid email format for destination.")
                return cleaned
            return normalize_phone_number(cleaned)
        return v

    @field_validator("phone")
    @classmethod
    def validate_verify_otp_phone(cls, v: Optional[str]) -> Optional[str]:
        return normalize_phone_number(v)

    @field_validator("otp")
    @classmethod
    def validate_otp_format(cls, v: str) -> str:
        cleaned = v.strip()
        if not re.match(r"^\d{6}$", cleaned):
            raise ValueError("OTP must be exactly 6 numeric digits.")
        return cleaned


class OTPVerificationResponse(BaseModel):
    """Response returned when an OTP is successfully verified."""
    verified: bool = True
    channel: str
    destination: str
    message: str = "Verified successfully."



class ForgotPasswordRequest(BaseModel):
    """POST /api/v1/auth/forgot-password — Request password reset email."""
    email: EmailStr = Field(..., description="Account registered email address")


class ResetPasswordRequest(BaseModel):
    """POST /api/v1/auth/reset-password — Complete password reset with single-use token."""
    token: str = Field(..., min_length=20, description="Cryptographic single-use reset token")
    new_password: str = Field(..., min_length=8, description="New password meeting entropy rules")

    @field_validator("new_password")
    @classmethod
    def validate_reset_password_entropy(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z).")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter (a-z).")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number (0-9).")
        if not PASSWORD_SPECIAL_REGEX.search(v):
            raise ValueError("Password must contain at least one special character (!@#$%^&* etc.).")
        return v


class UserUpdateRequest(BaseModel):
    """PUT /api/v1/users/profile — Update user profile."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None

    @field_validator("full_name")
    @classmethod
    def validate_update_full_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if not NAME_REGEX.match(cleaned):
                raise ValueError("Full name must contain only letters, spaces, dots, and hyphens (2-100 characters).")
            if any(bad in cleaned.lower() for bad in ("<script", "<", ">", "javascript:", "eval(")):
                raise ValueError("Full name contains invalid script or markup characters.")
            return cleaned
        return v

    @field_validator("phone")
    @classmethod
    def validate_update_phone(cls, v: Optional[str]) -> Optional[str]:
        return normalize_phone_number(v)


# ===================================================================
# Response Schemas
# ===================================================================

class TokenResponse(BaseModel):
    """Access token response schema."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    refresh_token: Optional[str] = None



class UserProfileResponse(BaseModel):
    """User profile response."""
    id: uuid.UUID
    username: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
class UserResponse(BaseModel):
    """User profile response model."""
    id: uuid.UUID
    username: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    created_at: Optional[str] = None


class LoginResponse(BaseModel):
    """POST /auth/login response."""
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    user: UserResponse


class RegisterResponse(BaseModel):
    """POST /auth/register response."""
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    user: UserResponse


class MessageResponse(BaseModel):
    """Standard message response."""
    message: str
    status: str = "success"
    detail: Optional[str] = None
    debug_otp: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    user: Optional[UserResponse] = None
    role: Optional[str] = None
    verified: Optional[bool] = True



class AssignPatientRequest(BaseModel):
    """POST /users/assign-patient"""
    caregiver_id: uuid.UUID
    patient_id: uuid.UUID


class LinkPatientRequest(BaseModel):
    """POST /users/link-patient — Flexible patient linking schema."""
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    email: Optional[str] = None
    code: Optional[str] = None
    username: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    relationship: Optional[str] = None
    notes: Optional[str] = None
    assigned_medicines: Optional[List[str]] = None


class AdminUserUpdateRequest(BaseModel):
    """PATCH /users/:id — Admin updating user details"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserStatusUpdateRequest(BaseModel):
    """PATCH /users/:id/status"""
    is_active: bool


# Aliases
VerifyOtpRequest = VerifyOTPRequest
