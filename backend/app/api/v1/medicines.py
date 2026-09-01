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

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
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
    get_medicines_by_user,
    get_medicines_grouped_by_disease,
    update_medicine,
    update_stock,
)


router = APIRouter(prefix="/medicines", tags=["Medicines"])


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
    """Fetch a medicine and verify ownership. Raises 404/403 on failure."""
    medicine = await get_medicine_by_id(db, medicine_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with id '{medicine_id}' not found.",
        )
    # Normalize UUID comparison — handles both Postgres (UUID objects) and SQLite (hex strings)
    med_uid = str(uuid.UUID(str(medicine.user_id))).lower()
    cur_uid = str(uuid.UUID(str(current_user.id))).lower()
    if med_uid != cur_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this medicine.",
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
        "Retrieve a paginated list of the user's medicines. "
        "Supports filtering by disease category and name search."
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicineListResponse:
    """List all medicines for the authenticated user."""
    medicines, total = await get_medicines_by_user(
        db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        disease_category=disease_category,
        search=search,
    )
    return MedicineListResponse(
        medicines=[_to_response(m) for m in medicines],
        total=total,
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
    description="Retrieve the user's medicines grouped by disease category.",
)
async def grouped_by_disease_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DiseaseGroupResponse]:
    """Group the authenticated user's medicines by disease category."""
    groups = await get_medicines_grouped_by_disease(db, current_user.id)
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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
