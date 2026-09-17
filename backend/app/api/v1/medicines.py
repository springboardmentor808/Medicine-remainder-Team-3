"""
PillSync Medicine CRUD API Router.

Provides endpoints for:
    - POST   /                      — Create a new medicine.
    - GET    /                      — List medicines (paginated, filterable).
    - GET    /grouped/by-disease    — Group medicines by disease category.
    - GET    /{medicine_id}         — Get a single medicine.
    - PUT    /{medicine_id}         — Update a medicine.
    - DELETE /{medicine_id}         — Delete a medicine.
    - PATCH  /{medicine_id}/stock   — Update stock level.
"""

from datetime import datetime, timezone
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.caregiver_patient import caregiver_patients
from app.schemas.medicine_schema import (
    DiseaseGroupResponse,
    MedicineCreate,
    MedicineListResponse,
    MedicineResponse,
    MedicineUpdate,
    StockUpdateRequest,
    StockUpdateResponse,
)
from app.services.medication_service import (
    create_medicine,
    delete_medicine,
    get_medicine_by_id,
    get_medicine_by_id_and_user,
    get_medicines_by_user,
    get_medicines_grouped_by_disease,
    update_medicine,
    update_stock,
)


router = APIRouter(prefix="/medicines", tags=["Medicines"])


# ---------------------------------------------------------------------------
# Demo Patients & Sample Medicines for Mentor Presentation / Unassigned Caregiver
# ---------------------------------------------------------------------------
DEMO_PATIENT_1_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
DEMO_PATIENT_2_ID = uuid.UUID("00000000-0000-4000-8000-000000000002")

SAMPLE_DEMO_MEDICINES: list[MedicineResponse] = [
    MedicineResponse(
        id=uuid.UUID("11111111-0000-4000-8000-000000000001"),
        user_id=DEMO_PATIENT_1_ID,
        name="Metformin 500mg",
        disease_category="Diabetes",
        dosage="500mg",
        initial_quantity=60,
        current_stock=45,
        daily_frequency=2,
        quantity_per_dose=1,
        notes="Take with breakfast and dinner",
        days_until_empty=22.5,
        created_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
    ),
    MedicineResponse(
        id=uuid.UUID("11111111-0000-4000-8000-000000000002"),
        user_id=DEMO_PATIENT_1_ID,
        name="Lisinopril 10mg",
        disease_category="Blood Pressure",
        dosage="10mg",
        initial_quantity=30,
        current_stock=12,
        daily_frequency=1,
        quantity_per_dose=1,
        notes="Take once daily in morning",
        days_until_empty=12.0,
        created_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
    ),
    MedicineResponse(
        id=uuid.UUID("11111111-0000-4000-8000-000000000003"),
        user_id=DEMO_PATIENT_1_ID,
        name="Atorvastatin 20mg",
        disease_category="Heart Medications",
        dosage="20mg",
        initial_quantity=30,
        current_stock=30,
        daily_frequency=1,
        quantity_per_dose=1,
        notes="Take at bedtime",
        days_until_empty=30.0,
        created_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
    ),
    MedicineResponse(
        id=uuid.UUID("22222222-0000-4000-8000-000000000001"),
        user_id=DEMO_PATIENT_2_ID,
        name="Donepezil 10mg",
        disease_category="General Healthcare",
        dosage="10mg",
        initial_quantity=30,
        current_stock=28,
        daily_frequency=1,
        quantity_per_dose=1,
        notes="Take before bedtime with water",
        days_until_empty=28.0,
        created_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
    ),
    MedicineResponse(
        id=uuid.UUID("22222222-0000-4000-8000-000000000002"),
        user_id=DEMO_PATIENT_2_ID,
        name="Memantine 10mg",
        disease_category="General Healthcare",
        dosage="10mg",
        initial_quantity=30,
        current_stock=8,
        daily_frequency=2,
        quantity_per_dose=1,
        notes="Take twice daily with meals",
        days_until_empty=4.0,
        created_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
    ),
    MedicineResponse(
        id=uuid.UUID("22222222-0000-4000-8000-000000000003"),
        user_id=DEMO_PATIENT_2_ID,
        name="Vitamin D3 1000 IU",
        disease_category="Vitamins",
        dosage="1000 IU",
        initial_quantity=60,
        current_stock=60,
        daily_frequency=1,
        quantity_per_dose=1,
        notes="Take once daily after breakfast",
        days_until_empty=60.0,
        created_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc),
    ),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_days_until_empty(medicine) -> float | None:
    """Compute estimated days until stock runs out."""
    daily_consumption = medicine.daily_frequency * medicine.quantity_per_dose
    if daily_consumption <= 0:
        return None
    return round(medicine.current_stock / daily_consumption, 1)


def _to_response(medicine) -> MedicineResponse:
    """Convert a Medicine ORM instance to its response schema."""
    if isinstance(medicine, MedicineResponse):
        return medicine
    med_id = uuid.UUID(str(medicine.id)) if isinstance(medicine.id, (str, uuid.UUID)) else medicine.id
    u_id = uuid.UUID(str(medicine.user_id)) if isinstance(medicine.user_id, (str, uuid.UUID)) else medicine.user_id
    return MedicineResponse(
        id=med_id,
        user_id=u_id,
        name=medicine.name,
        disease_category=medicine.disease_category,
        dosage=medicine.dosage,
        initial_quantity=medicine.initial_quantity,
        current_stock=medicine.current_stock,
        daily_frequency=medicine.daily_frequency,
        quantity_per_dose=medicine.quantity_per_dose,
        notes=medicine.notes,
        days_until_empty=_compute_days_until_empty(medicine),
        created_at=medicine.created_at,
        updated_at=medicine.updated_at,
    )


async def _get_owned_medicine(db, medicine_id, current_user):
    """Fetch a medicine enforcing tenant isolation via compound DB filter."""
    medicine = await get_medicine_by_id_and_user(db, medicine_id, current_user.id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with id '{medicine_id}' not found.",
        )
    return medicine


# ---------------------------------------------------------------------------
# POST / — Create Medicine
# ---------------------------------------------------------------------------
@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post(
    "/",
    response_model=MedicineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Medicine",
    description="Add a new medicine to the authenticated user's inventory.",
)
async def create_medicine_endpoint(
    payload: MedicineCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    """Create a new medicine record for the current user."""
    medicine = await create_medicine(db, current_user.id, payload)
    return _to_response(medicine)


# ---------------------------------------------------------------------------
# GET / — List Medicines (Paginated + Filterable)
# ---------------------------------------------------------------------------
@router.get("", response_model=MedicineListResponse, status_code=status.HTTP_200_OK, include_in_schema=False)
@router.get(
    "/",
    response_model=MedicineListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Medicines",
    description=(
        "Retrieve a paginated list of medicines. "
        "Supports filtering by disease category, name search, and monitored patient ID."
    ),
)
async def list_medicines_endpoint(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    disease_category: str | None = Query(
        None, description="Filter by disease category"
    ),
    search: str | None = Query(
        None, description="Search by medicine name (case-insensitive)"
    ),
    patient_id: uuid.UUID | None = Query(
        None, description="Caregiver/Admin: Filter by specific monitored patient"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicineListResponse:
    """List all medicines for the authenticated user or monitored patient."""
    is_caregiver = getattr(current_user, "role", "") in ("caregiver", "admin")
    target_user_id = current_user.id

    if patient_id:
        if is_caregiver:
            if str(patient_id) in ("00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"):
                filtered = [m for m in SAMPLE_DEMO_MEDICINES if m.user_id == patient_id]
                if disease_category:
                    filtered = [m for m in filtered if m.disease_category.lower() == disease_category.lower()]
                if search:
                    filtered = [m for m in filtered if search.lower() in m.name.lower()]
                return MedicineListResponse(
                    medicines=filtered,
                    total=len(filtered),
                    page=page,
                    page_size=page_size,
                )
            if getattr(current_user, "role", "") == "caregiver":
                link_check = await db.execute(
                    select(caregiver_patients).where(
                        caregiver_patients.c.caregiver_id == current_user.id,
                        caregiver_patients.c.patient_id == patient_id,
                    )
                )
                if not link_check.first():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You are not authorized to view medications for this patient.",
                    )
            target_user_id = patient_id
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only caregivers and administrators can inspect other patient inventories.",
            )
    elif is_caregiver and getattr(current_user, "role", "") == "caregiver":
        # Check if caregiver has any linked patients in database
        linked_stmt = select(caregiver_patients.c.patient_id).where(
            caregiver_patients.c.caregiver_id == current_user.id
        )
        linked_res = await db.execute(linked_stmt)
        linked_ids = [r[0] for r in linked_res.all()]
        if not linked_ids:
            # Unassigned caregiver: present curated demo medicines for Robert Chen & Eleanor Vance
            filtered = list(SAMPLE_DEMO_MEDICINES)
            if disease_category:
                filtered = [m for m in filtered if m.disease_category.lower() == disease_category.lower()]
            if search:
                filtered = [m for m in filtered if search.lower() in m.name.lower()]
            return MedicineListResponse(
                medicines=filtered,
                total=len(filtered),
                page=page,
                page_size=page_size,
            )

    medicines_list, total_count = await get_medicines_by_user(
        db,
        user_id=target_user_id,
        disease_category=disease_category,
        search=search,
        page=page,
        page_size=page_size,
    )
    return MedicineListResponse(
        medicines=[_to_response(m) for m in medicines_list],
        total=total_count,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /grouped/by-disease — Group by Disease Category
# (Defined BEFORE /{medicine_id} to avoid path collision)
# ---------------------------------------------------------------------------
@router.get(
    "/grouped/by-disease",
    response_model=list[DiseaseGroupResponse],
    status_code=status.HTTP_200_OK,
    summary="Group Medicines by Disease",
    description="Retrieve medicines grouped by disease category.",
)
async def grouped_by_disease_endpoint(
    patient_id: uuid.UUID | None = Query(None, description="Optional monitored patient ID filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DiseaseGroupResponse]:
    """Group medicines by disease category."""
    is_caregiver = getattr(current_user, "role", "") in ("caregiver", "admin")

    if patient_id:
        if not is_caregiver:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only caregivers and administrators can inspect other patient inventories.",
            )
        if str(patient_id) in ("00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"):
            demo_meds = [m for m in SAMPLE_DEMO_MEDICINES if m.user_id == patient_id]
            groups = {}
            for m in demo_meds:
                groups.setdefault(m.disease_category, []).append(m)
            return [
                DiseaseGroupResponse(category=cat, count=len(meds), medicines=meds)
                for cat, meds in groups.items()
            ]
        if getattr(current_user, "role", "") == "caregiver":
            link_check = await db.execute(
                select(caregiver_patients).where(
                    caregiver_patients.c.caregiver_id == current_user.id,
                    caregiver_patients.c.patient_id == patient_id,
                )
            )
            if not link_check.first():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to view medications for this patient.",
                )
        target_id = patient_id
    elif is_caregiver and getattr(current_user, "role", "") == "caregiver":
        linked_stmt = select(caregiver_patients.c.patient_id).where(
            caregiver_patients.c.caregiver_id == current_user.id
        )
        linked_res = await db.execute(linked_stmt)
        linked_ids = [r[0] for r in linked_res.all()]
        if not linked_ids:
            groups = {}
            for m in SAMPLE_DEMO_MEDICINES:
                groups.setdefault(m.disease_category, []).append(m)
            return [
                DiseaseGroupResponse(category=cat, count=len(meds), medicines=meds)
                for cat, meds in groups.items()
            ]
        target_id = current_user.id
    else:
        target_id = current_user.id

    groups = await get_medicines_grouped_by_disease(db, target_id)
    return [
        DiseaseGroupResponse(
            category=category,
            count=len(medicines),
            medicines=[_to_response(m) for m in medicines],
        )
        for category, medicines in groups.items()
    ]


# ---------------------------------------------------------------------------
# GET /{medicine_id} — Get Single Medicine
# ---------------------------------------------------------------------------
@router.get(
    "/{medicine_id}",
    response_model=MedicineResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Medicine",
    description="Retrieve a single medicine by its ID.",
)
async def get_medicine_endpoint(
    medicine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    """Get a medicine by ID, verifying ownership."""
    medicine = await _get_owned_medicine(db, medicine_id, current_user)
    return _to_response(medicine)


# ---------------------------------------------------------------------------
# PUT /{medicine_id} — Update Medicine
# ---------------------------------------------------------------------------
@router.put(
    "/{medicine_id}",
    response_model=MedicineResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Medicine",
    description="Update fields of an existing medicine. Only provided fields are changed.",
)
async def update_medicine_endpoint(
    medicine_id: uuid.UUID,
    payload: MedicineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    """Partially update a medicine record."""
    medicine = await _get_owned_medicine(db, medicine_id, current_user)
    updated = await update_medicine(db, medicine, payload)
    return _to_response(updated)


# ---------------------------------------------------------------------------
# DELETE /{medicine_id} — Delete Medicine
# ---------------------------------------------------------------------------
@router.delete(
    "/{medicine_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Medicine",
    description="Permanently delete a medicine and its associated schedules.",
)
async def delete_medicine_endpoint(
    medicine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a medicine record after verifying ownership."""
    medicine = await _get_owned_medicine(db, medicine_id, current_user)
    name = medicine.name
    await delete_medicine(db, medicine)
    return {
        "message": f"Medicine '{name}' deleted successfully.",
        "deleted_id": str(medicine_id),
    }


# ---------------------------------------------------------------------------
# PATCH /{medicine_id}/stock — Update Stock
# ---------------------------------------------------------------------------
@router.patch(
    "/{medicine_id}/stock",
    response_model=StockUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Stock",
    description=(
        "Adjust stock level for a medicine. Provide `adjustment` for "
        "relative change or `new_stock` for an absolute set."
    ),
)
async def update_stock_endpoint(
    medicine_id: uuid.UUID,
    payload: StockUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockUpdateResponse:
    """Update the stock level of a medicine."""
    # Validate: at least one field must be provided
    if payload.adjustment is None and payload.new_stock is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Provide either 'adjustment' or 'new_stock'.",
        )

    medicine = await _get_owned_medicine(db, medicine_id, current_user)
    previous, new = await update_stock(
        db, medicine,
        adjustment=payload.adjustment,
        new_stock=payload.new_stock,
    )

    return StockUpdateResponse(
        previous_stock=previous,
        new_stock=new,
        current_stock=new,
        adjustment=new - previous,
        medicine=_to_response(medicine),
    )


# ---------------------------------------------------------------------------
# POST /medicines/check-interactions — AI Drug-Drug Interactions & Scoring
# ---------------------------------------------------------------------------
@router.post(
    "/check-interactions",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Check Drug Interactions",
    description="Cross-reference a list of medications against the DDInter matrix and calculate a composite risk score.",
)
async def check_interactions_endpoint(
    payload: dict,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Evaluate pairwise drug interactions and compute composite risk score."""
    from app.services.medication_service import check_drug_interactions

    medicines = payload.get("medicines") or payload.get("drugs") or []
    if isinstance(medicines, str):
        medicines = [m.strip() for m in medicines.split(",") if m.strip()]
    return check_drug_interactions(medicines)

