"""
PillSync User Management Router.

Handles user profile CRUD, admin user listing, and caregiver-patient
assignment. All endpoints are RBAC-protected.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.rbac import allow_admin, allow_any_authenticated
from app.models.user import User, UserRole
from app.models.caregiver_patient import caregiver_patients
from app.schemas.auth_schema import (
    AssignPatientRequest,
    MessageResponse,
    UserResponse,
    UserUpdateRequest,
)


router = APIRouter(prefix="/users", tags=["Users"])


# ===================================================================
# GET /api/v1/users/profile — Any authenticated user
# ===================================================================
@router.get(
    "/profile",
    response_model=UserResponse,
    summary="Get own profile",
    description="Returns the authenticated user's profile information.",
)
async def get_profile(
    current_user: User = Depends(allow_any_authenticated),
):
    """Retrieve the current authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat(),
    )


# ===================================================================
# PUT /api/v1/users/profile — Any authenticated user
# ===================================================================
@router.put(
    "/profile",
    response_model=UserResponse,
    summary="Update own profile",
    description="Update the authenticated user's profile fields (name, phone, email).",
)
async def update_profile(
    payload: UserUpdateRequest,
    current_user: User = Depends(allow_any_authenticated),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the current user's profile.
    Only provided (non-None) fields are updated.
    """
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.email is not None:
        # Check email uniqueness
        existing = await db.execute(
            select(User).where(
                User.email == payload.email,
                User.id != current_user.id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use by another account.",
            )
        current_user.email = payload.email

    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)

    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat(),
    )


# ===================================================================
# GET /api/v1/users/ — Admin only
# ===================================================================
@router.get(
    "/",
    response_model=list[UserResponse],
    summary="List all users (Admin only)",
    description="Returns a list of all registered users. Restricted to admin role.",
)
async def list_users(
    current_user: User = Depends(allow_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users in the system. Admin access only."""
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    return [
        UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            phone=u.phone,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


# ===================================================================
# GET /api/v1/users/{user_id} — Admin / Caregiver
# ===================================================================
@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieve a specific user's profile. Admin and caregivers only.",
)
async def get_user_by_id(
    user_id: uuid.UUID,
    current_user: User = Depends(allow_admin),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a user profile by their UUID. Admin access only."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


# ===================================================================
# DELETE /api/v1/users/{user_id} — Admin only (soft delete)
# ===================================================================
@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Deactivate user (Admin only)",
    description="Soft-delete a user by setting is_active=False. Admin access only.",
)
async def deactivate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(allow_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Deactivate (soft-delete) a user. Does NOT permanently remove the record.
    Deactivated users cannot login or use the platform.
    """
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account.",
        )

    user.is_active = False
    db.add(user)
    await db.flush()

    return MessageResponse(
        message=f"User '{user.username}' has been deactivated.",
        detail=f"User ID: {user.id}",
    )


# ===================================================================
# POST /api/v1/users/assign-patient — Admin only
# ===================================================================
@router.post(
    "/assign-patient",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign patient to caregiver (Admin only)",
    description="Create a caregiver-patient relationship. Admin access only.",
)
async def assign_patient_to_caregiver(
    payload: AssignPatientRequest,
    current_user: User = Depends(allow_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Assign a patient to a caregiver.

    Validates:
    - Caregiver exists and has 'caregiver' role.
    - Patient exists and has 'patient' role.
    - Assignment doesn't already exist.
    """
    # Validate caregiver
    cg_result = await db.execute(
        select(User).where(User.id == payload.caregiver_id)
    )
    caregiver = cg_result.scalar_one_or_none()
    if caregiver is None or caregiver.role != UserRole.CAREGIVER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid caregiver ID or user is not a caregiver.",
        )

    # Validate patient
    pt_result = await db.execute(
        select(User).where(User.id == payload.patient_id)
    )
    patient = pt_result.scalar_one_or_none()
    if patient is None or patient.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid patient ID or user is not a patient.",
        )

    # Check duplicate assignment
    existing = await db.execute(
        select(caregiver_patients).where(
            caregiver_patients.c.caregiver_id == payload.caregiver_id,
            caregiver_patients.c.patient_id == payload.patient_id,
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Patient is already assigned to this caregiver.",
        )

    # Create assignment
    await db.execute(
        insert(caregiver_patients).values(
            caregiver_id=payload.caregiver_id,
            patient_id=payload.patient_id,
        )
    )
    await db.flush()

    return MessageResponse(
        message=f"Patient '{patient.username}' assigned to caregiver '{caregiver.username}'.",
        detail=f"Caregiver: {caregiver.id}, Patient: {patient.id}",
    )
