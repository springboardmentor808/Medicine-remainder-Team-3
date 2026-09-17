"""
PillSync User Service.

Encapsulates user profile CRUD, caregiver-patient relationship management,
and administrative user operations.
"""

import uuid
from typing import Optional, List
from sqlalchemy import select, insert, func, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.caregiver_patient import caregiver_patients
from app.core.security import hash_password
from app.schemas.auth_schema import (
    UserUpdateRequest,
    AdminUserUpdateRequest,
    LinkPatientRequest,
)


class UserService:
    """Service layer managing user entities and relationships."""

    @staticmethod
    async def get_user_by_id(user_id: uuid.UUID, db: AsyncSession) -> Optional[User]:
        """Fetch user by UUID."""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_email(email: str, db: AsyncSession) -> Optional[User]:
        """Fetch user by email (case-insensitive)."""
        clean_email = email.strip().lower()
        result = await db.execute(select(User).where(func.lower(User.email) == clean_email))
        return result.scalar_one_or_none()

    @staticmethod
    async def update_profile(
        current_user: User,
        payload: UserUpdateRequest,
        db: AsyncSession,
    ) -> User:
        """Update authenticated user's profile fields."""
        if payload.full_name is not None:
            current_user.full_name = payload.full_name.strip()
        if payload.phone is not None:
            current_user.phone = payload.phone.strip()
        if payload.email is not None:
            clean_email = payload.email.strip().lower()
            existing = await db.execute(
                select(User).where(
                    func.lower(User.email) == clean_email,
                    User.id != current_user.id,
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already in use by another account.",
                )
            current_user.email = clean_email

        db.add(current_user)
        await db.flush()
        await db.commit()
        await db.refresh(current_user)
        return current_user

    @staticmethod
    async def get_caregiver_patients(current_user: User, db: AsyncSession) -> List[User]:
        """Retrieve patients connected to the caregiver."""
        is_caregiver = current_user.role == UserRole.CAREGIVER or current_user.role.lower() == "caregiver"
        if is_caregiver:
            linked_subquery = select(caregiver_patients.c.patient_id).where(
                caregiver_patients.c.caregiver_id == current_user.id
            )
            result = await db.execute(select(User).where(User.id.in_(linked_subquery)))
            patients = list(result.scalars().all())
        else:
            result = await db.execute(select(User).where(User.role == UserRole.PATIENT))
            patients = list(result.scalars().all())
        return patients

    @staticmethod
    async def link_patient_to_caregiver(
        current_user: User,
        payload: LinkPatientRequest,
        db: AsyncSession,
    ) -> dict:
        """Link or auto-provision patient for a caregiver."""
        patient: Optional[User] = None

        # 1. Lookup by UUID if patient_id or code is a valid UUID
        raw_id = (payload.patient_id or payload.code or "").strip()
        if raw_id:
            try:
                code_uuid = uuid.UUID(raw_id)
                res = await db.execute(
                    select(User).where(
                        User.id == code_uuid,
                        User.role == UserRole.PATIENT,
                        User.id != current_user.id,
                    )
                )
                patient = res.scalars().first()
            except (ValueError, AttributeError):
                pass

        # 2. Comprehensive lookup across all supported patient identifiers
        if not patient:
            clauses = []
            if payload.patient_id:
                clauses.append(func.lower(User.username) == payload.patient_id.strip().lower())
                clauses.append(func.lower(User.email) == payload.patient_id.strip().lower())
            if payload.code:
                code_clean = payload.code.strip().lower()
                clauses.append(func.lower(User.email) == code_clean)
                clauses.append(func.lower(User.username) == code_clean)
            if payload.email:
                clauses.append(func.lower(User.email) == payload.email.strip().lower())
            if payload.username:
                clauses.append(func.lower(User.username) == payload.username.strip().lower())
            if payload.phone:
                clauses.append(User.phone == payload.phone.strip())
            if payload.patient_name:
                clauses.append(func.lower(User.full_name) == payload.patient_name.strip().lower())

            if clauses:
                res = await db.execute(
                    select(User).where(
                        User.role == UserRole.PATIENT,
                        User.id != current_user.id,
                        or_(*clauses),
                    )
                )
                candidates = list(res.scalars().all())
                if len(candidates) == 1:
                    patient = candidates[0]
                elif len(candidates) > 1:
                    # Disambiguate with exact match priority: email > username > phone > code
                    exact = None
                    if payload.email:
                        exact = next((u for u in candidates if u.email.lower() == payload.email.strip().lower()), None)
                    if not exact and payload.username:
                        exact = next((u for u in candidates if u.username.lower() == payload.username.strip().lower()), None)
                    if not exact and payload.phone:
                        exact = next((u for u in candidates if u.phone and u.phone == payload.phone.strip()), None)
                    if not exact and payload.code:
                        code_lower = payload.code.strip().lower()
                        exact = next((u for u in candidates if u.email.lower() == code_lower or u.username.lower() == code_lower), None)
                    if exact:
                        patient = exact
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Multiple patients match the provided identifiers. Please provide the exact patient email or link code.",
                        )

        if not patient:
            # Reject conflicting emails before auto-provisioning
            if payload.email:
                existing_email_user = (
                    await db.execute(
                        select(User).where(func.lower(User.email) == payload.email.strip().lower())
                    )
                ).scalars().first()
                if existing_email_user:
                    if existing_email_user.role != UserRole.PATIENT:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"A user with email '{payload.email}' already exists with role '{existing_email_user.role}'. Cannot link as patient.",
                        )
                    patient = existing_email_user

        if not patient:
            new_uname = None
            if payload.email:
                new_uname = payload.email.split("@")[0]
            elif payload.patient_name:
                new_uname = payload.patient_name.lower().replace(" ", "_")

            if new_uname:
                res = await db.execute(select(User).where(User.username == new_uname))
                if res.scalars().first():
                    new_uname = f"{new_uname}_{uuid.uuid4().hex[:4]}"

                target_email = payload.email or f"{new_uname}@patient.pillsync.app"
                conflict_check = (
                    await db.execute(
                        select(User).where(func.lower(User.email) == target_email.lower())
                    )
                ).scalars().first()
                if conflict_check:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Email '{target_email}' already exists. Cannot auto-provision patient.",
                    )

                temp_init_pw = f"PillSync#{uuid.uuid4().hex[:8]}"
                patient = User(
                    username=new_uname,
                    email=target_email,
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
                identifier_label = (
                    payload.patient_id
                    or payload.code
                    or payload.email
                    or payload.username
                    or payload.phone
                    or payload.patient_name
                    or "unknown"
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Patient not found with provided identifier '{identifier_label}'.",
                )

        if patient.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Caregiver cannot link themselves as a patient.",
            )

        if patient.role != UserRole.PATIENT and str(patient.role).lower() != "patient":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot link user '{patient.username}' as patient: user has role '{patient.role}'.",
            )

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

    @staticmethod
    async def assign_patient_admin(
        caregiver_id: uuid.UUID,
        patient_id: uuid.UUID,
        db: AsyncSession,
    ) -> tuple[User, User]:
        """Admin assignment of patient to caregiver."""
        cg_res = await db.execute(select(User).where(User.id == caregiver_id))
        caregiver = cg_res.scalar_one_or_none()
        if not caregiver or (caregiver.role != UserRole.CAREGIVER and str(caregiver.role).lower() != "caregiver"):
            raise HTTPException(status_code=400, detail="Invalid caregiver ID or user is not a caregiver.")

        pt_res = await db.execute(select(User).where(User.id == patient_id))
        patient = pt_res.scalar_one_or_none()
        if not patient or (patient.role != UserRole.PATIENT and str(patient.role).lower() != "patient"):
            raise HTTPException(status_code=400, detail="Invalid patient ID or user is not a patient.")

        existing = await db.execute(
            select(caregiver_patients).where(
                caregiver_patients.c.caregiver_id == caregiver_id,
                caregiver_patients.c.patient_id == patient_id,
            )
        )
        if existing.first():
            raise HTTPException(status_code=409, detail="Patient is already assigned to this caregiver.")

        await db.execute(
            insert(caregiver_patients).values(
                caregiver_id=caregiver_id,
                patient_id=patient_id,
            )
        )
        await db.flush()
        await db.commit()
        return caregiver, patient

    @staticmethod
    async def list_all_users(db: AsyncSession) -> List[User]:
        """List all users for admin."""
        result = await db.execute(select(User).order_by(User.created_at.desc()))
        return list(result.scalars().all())

    @staticmethod
    async def update_user_status(user_id: uuid.UUID, is_active: bool, db: AsyncSession) -> User:
        """Toggle user active status."""
        user = await UserService.get_user_by_id(user_id, db)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        user.is_active = is_active
        db.add(user)
        await db.flush()
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def admin_update_user(
        user_id: uuid.UUID,
        payload: AdminUserUpdateRequest,
        db: AsyncSession,
    ) -> User:
        """Update user details as admin."""
        user = await UserService.get_user_by_id(user_id, db)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        if payload.role is not None:
            r_str = payload.role.strip().lower()
            if r_str in ["patient", "caregiver", "admin"]:
                user.role = r_str
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid role '{payload.role}'. Allowed roles: patient, caregiver, admin.",
                )
        if payload.is_active is not None:
            user.is_active = payload.is_active
        if payload.full_name is not None:
            user.full_name = payload.full_name.strip()
        if payload.phone is not None:
            user.phone = payload.phone.strip()
        if payload.email is not None:
            user.email = payload.email.strip().lower()

        db.add(user)
        await db.flush()
        await db.commit()
        await db.refresh(user)
        return user
