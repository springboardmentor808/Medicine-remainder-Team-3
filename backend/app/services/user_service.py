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
        code_clean = (payload.code or "").strip().lower()
        query_str = (payload.email or payload.patient_name or payload.code or "").strip()

        if payload.code:
            try:
                code_uuid = uuid.UUID(code_clean)
                res = await db.execute(select(User).where(User.id == code_uuid))
                patient = res.scalars().first()
            except (ValueError, AttributeError):
                res = await db.execute(
                    select(User).where(
                        or_(
                            func.lower(User.email) == code_clean,
                            func.lower(User.username) == code_clean,
                        )
                    )
                )
                patient = res.scalars().first()

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
            candidates = list(res.scalars().all())
            if len(candidates) == 1:
                patient = candidates[0]
            elif len(candidates) > 1:
                exact = [
                    u for u in candidates
                    if u.email.lower() == query_str.lower() or u.username.lower() == query_str.lower() or u.phone == query_str
                ]
                if len(exact) == 1:
                    patient = exact[0]
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Multiple users match '{query_str}'. Please provide the exact patient email or link code.",
                    )

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
                    detail=f"Patient not found with provided identifier '{query_str}'.",
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
