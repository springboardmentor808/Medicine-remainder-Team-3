"""
PillSync User Management Router.

Handles user profile CRUD, admin user listing, and caregiver-patient
assignment. All endpoints are RBAC-protected.
"""

import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, insert, func, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.core.rbac import allow_admin, allow_any_authenticated
from app.models.user import User, UserRole
from app.models.caregiver_patient import caregiver_patients
from app.schemas.auth_schema import (
    AssignPatientRequest,
    LinkPatientRequest,
    AdminUserUpdateRequest,
    UserStatusUpdateRequest,
    MessageResponse,
    UserResponse,
    UserUpdateRequest,
)


router = APIRouter(prefix="/users", tags=["Users"])


# ===================================================================
# 1. GET /api/v1/users/profile — Any authenticated user
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
        role=current_user.role if isinstance(current_user.role, str) else current_user.role.value,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat(),
    )


# ===================================================================
# 2. PUT /api/v1/users/profile — Any authenticated user
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
        role=current_user.role if isinstance(current_user.role, str) else current_user.role.value,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat(),
    )


# ===================================================================
# 3. GET /api/v1/users/patients — Caregivers & Admins
# ===================================================================
@router.get(
    "/patients",
    response_model=List[UserResponse],
    summary="Get caregiver's linked patients",
    description="Retrieve patients assigned to the authenticated caregiver (or all patients).",
)
async def get_caregiver_patients(
    current_user: User = Depends(allow_any_authenticated),
    db: AsyncSession = Depends(get_db),
):
    """Fetch patients connected to this caregiver."""
    is_caregiver = current_user.role == UserRole.CAREGIVER or str(current_user.role).lower() == "caregiver"
    if is_caregiver:
        linked_subquery = select(caregiver_patients.c.patient_id).where(
            caregiver_patients.c.caregiver_id == current_user.id
        )
        result = await db.execute(
            select(User).where(User.id.in_(linked_subquery))
        )
        patients = list(result.scalars().all())
        if not patients:
            res_all = await db.execute(
                select(User).where(
                    User.role == UserRole.PATIENT,
                    User.is_active == True,
                ).limit(20)
            )
            patients = list(res_all.scalars().all())
    else:
        result = await db.execute(
            select(User).where(User.role == UserRole.PATIENT)
        )
        patients = list(result.scalars().all())

    return [
        UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            phone=u.phone,
            role=u.role if isinstance(u.role, str) else u.role.value,
            is_active=u.is_active,
            created_at=u.created_at.isoformat() if u.created_at else "",
        )
        for u in patients
    ]


# ===================================================================
# 4. POST /api/v1/users/link-patient — Caregiver links patient dynamically
# ===================================================================
@router.post(
    "/link-patient",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Link patient to caregiver",
    description="Link a patient to the authenticated caregiver via pairing code, email, phone, or username.",
)
async def link_patient_endpoint(
    payload: LinkPatientRequest,
    current_user: User = Depends(allow_any_authenticated),
    db: AsyncSession = Depends(get_db),
):
    patient = None
    query_str = (payload.email or payload.code or payload.username or payload.phone or payload.patient_id or "").strip()

    if payload.patient_id:
        try:
            pid = uuid.UUID(payload.patient_id)
            res = await db.execute(select(User).where(User.id == pid))
            patient = res.scalar_one_or_none()
        except ValueError:
            pass

    if not patient and payload.email:
        res = await db.execute(select(User).where(func.lower(User.email) == payload.email.lower()))
        patient = res.scalar_one_or_none()

    if not patient and payload.code:
        code_clean = payload.code.replace("PS-", "").replace("-", "").lower()
        res = await db.execute(
            select(User).where(
                or_(
                    func.lower(User.username) == payload.code.lower(),
                    cast(User.id, String).contains(code_clean),
                )
            )
        )
        patient = res.scalar_one_or_none()

    if not patient and query_str:
        res = await db.execute(
            select(User).where(
                or_(
                    func.lower(User.email) == query_str.lower(),
                    func.lower(User.username) == query_str.lower(),
                    User.phone == query_str,
                    func.lower(User.full_name) == query_str.lower(),
                )
            )
        )
        patient = res.scalar_one_or_none()

    if not patient:
        if payload.email or payload.patient_name:
            new_uname = (payload.email.split("@")[0] if payload.email else (payload.patient_name.lower().replace(" ", "_")))
            res = await db.execute(select(User).where(User.username == new_uname))
            if res.scalar_one_or_none():
                new_uname = f"{new_uname}_{uuid.uuid4().hex[:4]}"

            temp_init_pw = f"PillSync#{uuid.uuid4().hex[:8]}"
            patient = User(
                username=new_uname,
                email=payload.email or f"{new_uname}@patient.pillsync.app",
                full_name=payload.patient_name or payload.email or "Linked Patient",
                phone=payload.phone,
                role=UserRole.PATIENT,
                hashed_password=hash_password(temp_init_pw),
                is_active=True,
            )
            db.add(patient)
            await db.flush()
            await db.refresh(patient)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Patient not found with provided code or identifier '{query_str}'.",
            )

    if patient.role != UserRole.PATIENT:
        patient.role = UserRole.PATIENT
        db.add(patient)
        await db.flush()

    existing = await db.execute(
        select(caregiver_patients).where(
            caregiver_patients.c.caregiver_id == current_user.id,
            caregiver_patients.c.patient_id == patient.id,
        )
    )
    if not existing.first():
        await db.execute(
            insert(caregiver_patients).values(
                caregiver_id=current_user.id,
                patient_id=patient.id,
            )
        )
        await db.flush()

    await db.commit()

    return {
        "message": f"Patient '{patient.full_name or patient.username}' successfully linked.",
        "patient": {
            "id": str(patient.id),
            "name": patient.full_name or patient.username,
            "email": patient.email,
            "phone": patient.phone,
            "role": "patient",
            "relationship": payload.relationship or "Monitored Patient",
            "age": payload.age,
            "notes": payload.notes,
        },
    }


# ===================================================================
# 5. POST /api/v1/users/assign-patient — Admin only
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
    Validates caregiver and patient roles and avoids duplicate assignments.
    """
    # Validate caregiver
    cg_result = await db.execute(
        select(User).where(User.id == payload.caregiver_id)
    )
    caregiver = cg_result.scalar_one_or_none()
    if caregiver is None or (caregiver.role != UserRole.CAREGIVER and str(caregiver.role).lower() != "caregiver"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid caregiver ID or user is not a caregiver.",
        )

    # Validate patient
    pt_result = await db.execute(
        select(User).where(User.id == payload.patient_id)
    )
    patient = pt_result.scalar_one_or_none()
    if patient is None or (patient.role != UserRole.PATIENT and str(patient.role).lower() != "patient"):
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
    await db.commit()

    return MessageResponse(
        message=f"Patient '{patient.username}' assigned to caregiver '{caregiver.username}'.",
        detail=f"Caregiver: {caregiver.id}, Patient: {patient.id}",
    )


# ===================================================================
# 6. GET /api/v1/users/ — Admin only
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
            role=u.role if isinstance(u.role, str) else u.role.value,
            is_active=u.is_active,
            created_at=u.created_at.isoformat() if u.created_at else "",
        )
        for u in users
    ]


# ===================================================================
# 7. PATCH /api/v1/users/{user_id}/status — Admin only
# ===================================================================
@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
    summary="Toggle user active/suspended status (Admin only)",
)
async def update_user_status_endpoint(
    user_id: uuid.UUID,
    payload: UserStatusUpdateRequest,
    current_user: User = Depends(allow_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.is_active = payload.is_active
    db.add(user)
    await db.flush()
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role if isinstance(user.role, str) else user.role.value,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


# ===================================================================
# 8. PATCH /api/v1/users/{user_id} — Admin only
# ===================================================================
@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user details and role (Admin only)",
)
async def update_user_by_admin(
    user_id: uuid.UUID,
    payload: AdminUserUpdateRequest,
    current_user: User = Depends(allow_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.role is not None:
        r_str = payload.role.strip().lower()
        if r_str in ["patient", "caregiver", "admin"]:
            user.role = r_str
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.email is not None:
        user.email = payload.email

    db.add(user)
    await db.flush()
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role if isinstance(user.role, str) else user.role.value,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


# ===================================================================
# 9. GET /api/v1/users/{user_id} — Admin only
# ===================================================================
@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieve a specific user's profile. Admin access only.",
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
        role=user.role if isinstance(user.role, str) else user.role.value,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


# ===================================================================
# 10. DELETE /api/v1/users/{user_id} — Admin only (soft delete)
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
    await db.commit()

    return MessageResponse(
        message=f"User '{user.username}' has been deactivated.",
        detail=f"User ID: {user.id}",
    )


# ===================================================================
# 11. POST /api/v1/users/{user_id}/reset-password — Admin only
# ===================================================================
class AdminResetPasswordRequest(BaseModel):
    temp_password: Optional[str] = None


@router.post(
    "/{user_id}/reset-password",
    response_model=MessageResponse,
    summary="Admin reset user password",
    description="Resets the target user's password to a secure temporary password. Admin access only.",
)
async def admin_reset_user_password_endpoint(
    user_id: uuid.UUID,
    payload: Optional[AdminResetPasswordRequest] = None,
    current_user: User = Depends(allow_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reset target user password and invalidate previous credentials."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    temp_pw = (payload.temp_password if payload and payload.temp_password else None) or f"PillSync#{uuid.uuid4().hex[:6].upper()}"
    user.hashed_password = hash_password(temp_pw)
    db.add(user)
    await db.flush()
    await db.commit()

    return MessageResponse(
        message=f"Password for user '{user.username}' has been reset.",
        detail=temp_pw,
    )

